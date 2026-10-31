//! Account commands: the roster, ranks, names, currencies and details.

use super::*;

/* ---------- Commands ---------- */

#[tauri::command]
pub async fn load_roster(database: State<'_, Database>) -> Result<Roster, String> {
    let connection = database.lock()?;
    read_roster(&connection)
}

/// Sets one rank and returns the updated account.
#[tauri::command]
pub async fn set_rank(database: State<'_, Database>, account_id: i64, slot: String, rank: Rank) -> Result<Account, String> {
    rank.validate()?;
    let slot = slot_name(&slot)?;
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    let exists: bool = transaction
        .query_row("SELECT EXISTS (SELECT 1 FROM accounts WHERE id = ?1)", [account_id], |row| row.get(0))
        .map_err(to_message)?;
    if !exists {
        return Err(crate::text::text("errors.db.accountNotFound").into());
    }
    write_rank(&transaction, account_id, slot, &rank)?;
    transaction
        .execute(
            "UPDATE accounts SET last_rank_change_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            [account_id],
        )
        .map_err(to_message)?;
    transaction.commit().map_err(to_message)?;
    read_account(&connection, account_id)?.ok_or_else(|| crate::text::text("errors.db.accountNotFound").into())
}

/// Development only: replaces every account and group with the given roster (the Glass Lab's
/// dummy accounts). Release builds don't register it.
#[cfg(debug_assertions)]
#[tauri::command]
pub async fn replace_roster(database: State<'_, Database>, roster: Roster) -> Result<Roster, String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    transaction
        .execute_batch("DELETE FROM accounts; DELETE FROM groups;")
        .map_err(to_message)?;
    for (index, group) in roster.groups.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO groups (id, name, sort_key, collapsed) VALUES (?1, ?2, ?3, ?4)",
                // After the loose accounts, as the dummy roster lists them.
                params![group.id, group.name, (roster.accounts.len() + index) as f64, group.collapsed],
            )
            .map_err(to_message)?;
    }
    for (index, account) in roster.accounts.iter().enumerate() {
        insert_account(&transaction, account, index as f64)?;
    }
    transaction.commit().map_err(to_message)?;
    read_roster(&connection)
}

/* ---------- Accounts ---------- */

/// Battletags are up to 12 characters plus `#` and a number; leave room for notes like "(main)".
pub(crate) const MAX_NAME: usize = 64;
pub(crate) const MAX_NOTES: usize = 4000;
pub(crate) const MAX_SECRET: usize = 512;
pub(crate) const MAX_CURRENCY: i64 = 99_999_999;

pub(crate) fn clean_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(crate::text::text("errors.db.nameRequired").into());
    }
    if name.chars().count() > MAX_NAME {
        return Err(crate::text::format("errors.db.nameTooLong", &[("limit", MAX_NAME.to_string())]));
    }
    Ok(name.to_string())
}

pub(crate) fn require_account(connection: &Connection, id: i64) -> Result<(), String> {
    let exists: bool = connection
        .query_row("SELECT EXISTS (SELECT 1 FROM accounts WHERE id = ?1)", [id], |row| row.get(0))
        .map_err(to_message)?;
    if exists { Ok(()) } else { Err(crate::text::text("errors.db.accountNotFound").into()) }
}

pub(crate) fn account_or_gone(connection: &Connection, id: i64) -> Result<Account, String> {
    read_account(connection, id)?.ok_or_else(|| crate::text::text("errors.db.accountNotFound").into())
}

/// Adds an account at the end of the loose accounts: unranked, no currencies, no credentials.
#[tauri::command]
pub async fn add_account(database: State<'_, Database>, name: String) -> Result<Account, String> {
    let name = clean_name(&name)?;
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    let id: i64 = transaction
        .query_row("SELECT COALESCE(MAX(id), 0) + 1 FROM accounts", [], |row| row.get(0))
        .map_err(to_message)?;
    let sort_key = next_key(&transaction, Container::TopLevel)?;
    let account = Account {
        id,
        name,
        ranks: [Rank::unranked(), Rank::unranked(), Rank::unranked()],
        six_v6: Rank::unranked(),
        values_a: [0; 3],
        values_b: [0; 2],
        group_id: None,
        status: Status::Clean,
        sort_key,
        games_dodged: 0,
        last_rank_change_at: None,
        has_email: false,
        has_password: false,
    };
    insert_account(&transaction, &account, sort_key)?;
    transaction.commit().map_err(to_message)?;
    account_or_gone(&connection, id)
}

#[tauri::command]
pub async fn rename_account(database: State<'_, Database>, account_id: i64, name: String) -> Result<Account, String> {
    let name = clean_name(&name)?;
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    connection
        .execute("UPDATE accounts SET name = ?2 WHERE id = ?1", params![account_id, name])
        .map_err(to_message)?;
    account_or_gone(&connection, account_id)
}

#[tauri::command]
pub async fn set_currency(database: State<'_, Database>, account_id: i64, kind: String, value: i64) -> Result<Account, String> {
    if !VALUES_A.contains(&kind.as_str()) && !VALUES_B.contains(&kind.as_str()) {
        return Err(crate::text::format("errors.db.unknownCurrency", &[("kind", kind.to_string())]));
    }
    if !(0..=MAX_CURRENCY).contains(&value) {
        return Err(crate::text::text("errors.db.amountOutOfRange").into());
    }
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    connection
        .execute(
            "INSERT INTO currencies (account_id, kind, value) VALUES (?1, ?2, ?3)
             ON CONFLICT (account_id, kind) DO UPDATE SET value = excluded.value",
            params![account_id, kind, value],
        )
        .map_err(to_message)?;
    account_or_gone(&connection, account_id)
}

/// Deletes an account with its ranks, currencies, credentials and rank history.
#[tauri::command]
pub async fn delete_account(database: State<'_, Database>, account_id: i64) -> Result<(), String> {
    let connection = database.lock()?;
    connection.execute("DELETE FROM accounts WHERE id = ?1", [account_id]).map_err(to_message)?;
    Ok(())
}

/// What the account info dialog shows beyond the row.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDetails {
    pub country: String,
    pub notes: String,
    pub games_dodged: i64,
    pub last_rank_change_at: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub async fn get_account_details(database: State<'_, Database>, account_id: i64) -> Result<AccountDetails, String> {
    let connection = database.lock()?;
    connection
        .query_row(
            "SELECT country, notes, games_dodged, last_rank_change_at, created_at FROM accounts WHERE id = ?1",
            [account_id],
            |row| {
                Ok(AccountDetails {
                    country: row.get(0)?,
                    notes: row.get(1)?,
                    games_dodged: row.get(2)?,
                    last_rank_change_at: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(to_message)?
        .ok_or_else(|| crate::text::text("errors.db.accountNotFound").into())
}

/// Saves the info dialog's editable fields. `country` is an ISO 3166-1 alpha-2 code or empty.
#[tauri::command]
pub async fn set_account_details(
    database: State<'_, Database>,
    account_id: i64,
    country: String,
    notes: String,
) -> Result<(), String> {
    let country = country.trim().to_ascii_uppercase();
    if !(country.is_empty() || (country.len() == 2 && country.chars().all(|c| c.is_ascii_uppercase()))) {
        return Err(crate::text::text("errors.db.unknownCountry").into());
    }
    if notes.chars().count() > MAX_NOTES {
        return Err(crate::text::format("errors.db.notesTooLong", &[("limit", MAX_NOTES.to_string())]));
    }
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    connection
        .execute(
            "UPDATE accounts SET country = ?2, notes = ?3 WHERE id = ?1",
            params![account_id, country, notes],
        )
        .map_err(to_message)?;
    Ok(())
}
