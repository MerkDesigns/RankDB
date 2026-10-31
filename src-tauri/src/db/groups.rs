//! Groups, statuses (sections) and order.

use super::*;

/* ---------- Groups, sections and order ---------- */

pub(crate) const MAX_GROUP_NAME: usize = 40;

/// Where items live. Loose accounts and groups share the top level; each group and the SMS and
/// banned sections have their own order.
#[derive(Clone, Copy)]
pub(crate) enum Container<'a> {
    TopLevel,
    Group(&'a str),
    /// The SMS or banned section (never Clean).
    Section(Status),
}

impl Container<'_> {
    fn of(group_id: Option<&str>, status: Status) -> Result<Container<'_>, String> {
        match (group_id, status) {
            (None, Status::Clean) => Ok(Container::TopLevel),
            (Some(id), Status::Clean) => Ok(Container::Group(id)),
            (None, status) => Ok(Container::Section(status)),
            (Some(_), _) => Err(crate::text::text("errors.db.groupingNotAllowed").into()),
        }
    }
}

/// One past the last item of a container.
pub(crate) fn next_key(connection: &Connection, container: Container) -> Result<f64, String> {
    let max: Option<f64> = match container {
        Container::TopLevel => connection.query_row(
            "SELECT MAX(key) FROM (
                SELECT sort_key AS key FROM accounts WHERE group_id IS NULL AND status = 'clean'
                UNION ALL SELECT sort_key FROM groups)",
            [],
            |row| row.get(0),
        ),
        Container::Group(id) => connection.query_row(
            "SELECT MAX(sort_key) FROM accounts WHERE group_id = ?1 AND status = 'clean'",
            [id],
            |row| row.get(0),
        ),
        Container::Section(status) => {
            connection.query_row("SELECT MAX(sort_key) FROM accounts WHERE status = ?1", [status], |row| row.get(0))
        }
    }
    .map_err(to_message)?;
    Ok(max.map_or(0.0, |max| max.floor() + 1.0))
}

pub(crate) fn clean_group_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(crate::text::text("errors.db.groupNameRequired").into());
    }
    if name.chars().count() > MAX_GROUP_NAME {
        return Err(crate::text::format("errors.db.groupNameTooLong", &[("limit", MAX_GROUP_NAME.to_string())]));
    }
    Ok(name.to_string())
}

pub(crate) fn require_group(connection: &Connection, id: &str) -> Result<(), String> {
    let exists: bool = connection
        .query_row("SELECT EXISTS (SELECT 1 FROM groups WHERE id = ?1)", [id], |row| row.get(0))
        .map_err(to_message)?;
    if exists { Ok(()) } else { Err(crate::text::text("errors.db.groupNotFound").into()) }
}

pub(crate) fn read_group_by_id(connection: &Connection, id: &str) -> Result<Group, String> {
    connection
        .query_row("SELECT id, name, collapsed, sort_key FROM groups WHERE id = ?1", [id], read_group)
        .optional()
        .map_err(to_message)?
        .ok_or_else(|| crate::text::text("errors.db.groupNotFound").into())
}

pub(crate) fn new_group_id() -> Result<String, String> {
    let mut bytes = [0u8; 8];
    getrandom::fill(&mut bytes).map_err(|error| error.to_string())?;
    Ok(format!("g-{}", bytes.iter().map(|byte| format!("{byte:02x}")).collect::<String>()))
}

/// Adds an empty group at the end of the top level.
#[tauri::command]
pub async fn add_group(database: State<'_, Database>, name: String) -> Result<Group, String> {
    let name = clean_group_name(&name)?;
    let connection = database.lock()?;
    let id = new_group_id()?;
    let sort_key = next_key(&connection, Container::TopLevel)?;
    connection
        .execute("INSERT INTO groups (id, name, sort_key) VALUES (?1, ?2, ?3)", params![id, name, sort_key])
        .map_err(to_message)?;
    read_group_by_id(&connection, &id)
}

#[tauri::command]
pub async fn rename_group(database: State<'_, Database>, group_id: String, name: String) -> Result<Group, String> {
    let name = clean_group_name(&name)?;
    let connection = database.lock()?;
    require_group(&connection, &group_id)?;
    connection
        .execute("UPDATE groups SET name = ?2 WHERE id = ?1", params![group_id, name])
        .map_err(to_message)?;
    read_group_by_id(&connection, &group_id)
}

#[tauri::command]
pub async fn set_group_collapsed(database: State<'_, Database>, group_id: String, collapsed: bool) -> Result<Group, String> {
    let connection = database.lock()?;
    require_group(&connection, &group_id)?;
    connection
        .execute("UPDATE groups SET collapsed = ?2 WHERE id = ?1", params![group_id, collapsed])
        .map_err(to_message)?;
    read_group_by_id(&connection, &group_id)
}

/// Deletes a group. Its accounts become loose accounts where the group was, in their order.
#[tauri::command]
pub async fn delete_group(database: State<'_, Database>, group_id: String) -> Result<Roster, String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    let group_key: f64 = transaction
        .query_row("SELECT sort_key FROM groups WHERE id = ?1", [&group_id], |row| row.get(0))
        .optional()
        .map_err(to_message)?
        .ok_or_else(|| crate::text::text("errors.db.groupNotFound").to_string())?;
    let members: Vec<i64> = transaction
        .prepare("SELECT id FROM accounts WHERE group_id = ?1 AND status = 'clean' ORDER BY sort_key, id")
        .and_then(|mut statement| statement.query_map([&group_id], |row| row.get(0))?.collect())
        .map_err(to_message)?;
    // Spread between the group's key and the next whole number, so they stay together in place.
    let step = 1.0 / (members.len() as f64 + 1.0);
    for (index, id) in members.iter().enumerate() {
        transaction
            .execute(
                "UPDATE accounts SET group_id = NULL, sort_key = ?2 WHERE id = ?1",
                params![id, group_key + step * index as f64],
            )
            .map_err(to_message)?;
    }
    transaction.execute("DELETE FROM groups WHERE id = ?1", [&group_id]).map_err(to_message)?;
    transaction.commit().map_err(to_message)?;
    read_roster(&connection)
}

/// Sets an account's status. It moves to the end of where it lands (the loose accounts, or the
/// SMS or banned section) and leaves its group; setting the same status again changes nothing.
#[tauri::command]
pub async fn set_status(database: State<'_, Database>, account_id: i64, status: Status) -> Result<Account, String> {
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    let current: Status = connection
        .query_row("SELECT status FROM accounts WHERE id = ?1", [account_id], |row| row.get(0))
        .map_err(to_message)?;
    if current != status {
        let sort_key = next_key(&connection, Container::of(None, status)?)?;
        connection
            .execute(
                "UPDATE accounts SET status = ?2, group_id = NULL, sort_key = ?3 WHERE id = ?1",
                params![account_id, status, sort_key],
            )
            .map_err(to_message)?;
    }
    account_or_gone(&connection, account_id)
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Item {
    Account { id: i64 },
    Group { id: String },
}

/// Where a moved item goes: the top level (no group, clean), a group (clean), or the SMS or
/// banned section (no group).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Destination {
    pub group_id: Option<String>,
    pub status: Status,
}

/// Moves one item (drag and drop, or Move to group) and sets the order of its destination:
/// `order` lists every item there, the moved one included, top to bottom.
#[tauri::command]
pub async fn move_item(
    database: State<'_, Database>,
    item: Item,
    destination: Destination,
    order: Vec<Item>,
) -> Result<Roster, String> {
    let container = Container::of(destination.group_id.as_deref(), destination.status)?;
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;

    match (&item, container) {
        (Item::Account { id }, _) => {
            require_account(&transaction, *id)?;
            if let Container::Group(group_id) = container {
                require_group(&transaction, group_id)?;
            }
            transaction
                .execute(
                    "UPDATE accounts SET group_id = ?2, status = ?3 WHERE id = ?1",
                    params![id, destination.group_id, destination.status],
                )
                .map_err(to_message)?;
        }
        (Item::Group { id }, Container::TopLevel) => require_group(&transaction, id)?,
        (Item::Group { .. }, _) => return Err(crate::text::text("errors.db.groupNestingNotAllowed").into()),
    }

    // Every listed item must now belong to the destination; then they are numbered in order.
    for (index, entry) in order.iter().enumerate() {
        let key = index as f64;
        let changed = match (entry, container) {
            (Item::Account { id }, Container::TopLevel) => transaction.execute(
                "UPDATE accounts SET sort_key = ?2 WHERE id = ?1 AND group_id IS NULL AND status = 'clean'",
                params![id, key],
            ),
            (Item::Account { id }, Container::Group(group_id)) => transaction.execute(
                "UPDATE accounts SET sort_key = ?2 WHERE id = ?1 AND group_id = ?3 AND status = 'clean'",
                params![id, key, group_id],
            ),
            (Item::Account { id }, Container::Section(status)) => transaction.execute(
                "UPDATE accounts SET sort_key = ?2 WHERE id = ?1 AND status = ?3",
                params![id, key, status],
            ),
            (Item::Group { id }, Container::TopLevel) => {
                transaction.execute("UPDATE groups SET sort_key = ?2 WHERE id = ?1", params![id, key])
            }
            (Item::Group { .. }, _) => return Err(crate::text::text("errors.db.groupNestingNotAllowed").into()),
        }
        .map_err(to_message)?;
        if changed != 1 {
            return Err(crate::text::text("errors.db.listChanged").into());
        }
    }
    transaction.commit().map_err(to_message)?;
    read_roster(&connection)
}
