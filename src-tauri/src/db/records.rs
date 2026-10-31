//! The records sent to the frontend (src/data/accounts.ts), and reading and writing them.

use super::*;

/* ---------- Records sent to the frontend (src/data/accounts.ts) ---------- */

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rank {
    pub tier: String,
    pub division: u8,
    pub predicted: bool,
    pub placements: u8,
}

impl Rank {
    pub(crate) fn unranked() -> Self {
        Self { tier: "Unranked".into(), division: 5, predicted: false, placements: 0 }
    }

    pub(crate) fn validate(&self) -> Result<(), String> {
        if !TIERS.contains(&self.tier.as_str()) {
            return Err(crate::text::format("errors.db.unknownRankTier", &[("tier", self.tier.to_string())]));
        }
        if !(1..=5).contains(&self.division) {
            return Err(crate::text::text("errors.db.invalidDivision").into());
        }
        if self.placements > 10 || (self.predicted && self.placements == 0) {
            return Err(crate::text::text("errors.db.invalidPlacements").into());
        }
        if self.predicted && self.tier == "Unranked" {
            return Err(crate::text::text("errors.db.invalidPrediction").into());
        }
        Ok(())
    }
}

/// An account's standing. SMS and banned accounts live in their own sections below the list.
#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    #[default]
    Clean,
    /// Needs SMS verification.
    Sms,
    Banned,
}

impl Status {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Status::Clean => "clean",
            Status::Sms => "sms",
            Status::Banned => "banned",
        }
    }
}

impl rusqlite::ToSql for Status {
    fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
        Ok(self.as_str().into())
    }
}

impl rusqlite::types::FromSql for Status {
    fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
        match value.as_str()? {
            "sms" => Ok(Status::Sms),
            "banned" => Ok(Status::Banned),
            _ => Ok(Status::Clean),
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub name: String,
    pub ranks: [Rank; 3],
    #[serde(rename = "sixV6")]
    pub six_v6: Rank,
    pub values_a: [i64; 3],
    pub values_b: [i64; 2],
    pub group_id: Option<String>,
    #[serde(default)]
    pub status: Status,
    /// Order within its container (loose accounts and groups share one order; each group and the
    /// SMS and banned sections have their own).
    #[serde(default)]
    pub sort_key: f64,
    /// Dodged games counted toward the next leaver penalty (0 to MAX_DODGES).
    #[serde(default)]
    pub games_dodged: i64,
    /// When a rank was last set (the account menu's "Last edit").
    #[serde(default)]
    pub last_rank_change_at: Option<String>,
    /// Whether an email / password is saved (the values themselves never leave Rust unasked).
    #[serde(default)]
    pub has_email: bool,
    #[serde(default)]
    pub has_password: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub name: String,
    pub collapsed: bool,
    /// Its place among the loose accounts.
    #[serde(default)]
    pub sort_key: f64,
}

/// Everything the list shows, in display order.
#[derive(Serialize, Deserialize)]
pub struct Roster {
    pub accounts: Vec<Account>,
    pub groups: Vec<Group>,
}

/* ---------- Reading ---------- */

pub(crate) fn read_account(connection: &Connection, id: i64) -> Result<Option<Account>, String> {
    Ok(read_accounts(connection, Some(id))?.pop())
}

/// Every account (or only `only`), in saved order: one query per table, not per account.
pub(crate) fn read_accounts(connection: &Connection, only: Option<i64>) -> Result<Vec<Account>, String> {
    let mut accounts: Vec<Account> = connection
        .prepare_cached(
            "SELECT id, name, group_id, status, sort_key, games_dodged, last_rank_change_at FROM accounts
             WHERE ?1 IS NULL OR id = ?1 ORDER BY sort_key, id",
        )
        .and_then(|mut statement| {
            statement
                .query_map([only], |row| {
                    Ok(Account {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        ranks: [Rank::unranked(), Rank::unranked(), Rank::unranked()],
                        six_v6: Rank::unranked(),
                        values_a: [0; 3],
                        values_b: [0; 2],
                        group_id: row.get(2)?,
                        status: row.get(3)?,
                        sort_key: row.get(4)?,
                        games_dodged: row.get(5)?,
                        last_rank_change_at: row.get(6)?,
                        has_email: false,
                        has_password: false,
                    })
                })?
                .collect()
        })
        .map_err(to_message)?;
    let index: HashMap<i64, usize> = accounts.iter().enumerate().map(|(position, account)| (account.id, position)).collect();

    let mut statement = connection
        .prepare_cached(
            "SELECT account_id, slot, tier, division, predicted, placements FROM ranks WHERE ?1 IS NULL OR account_id = ?1",
        )
        .map_err(to_message)?;
    let rows = statement
        .query_map([only], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                Rank { tier: row.get(2)?, division: row.get(3)?, predicted: row.get(4)?, placements: row.get(5)? },
            ))
        })
        .map_err(to_message)?;
    for row in rows {
        let (id, slot, rank) = row.map_err(to_message)?;
        let Some(account) = index.get(&id).map(|position| &mut accounts[*position]) else { continue };
        match ROLE_SLOTS.iter().position(|role| *role == slot) {
            Some(slot) => account.ranks[slot] = rank,
            None if slot == SIXV6_SLOT => account.six_v6 = rank,
            None => {}
        }
    }

    let mut statement = connection
        .prepare_cached("SELECT account_id, kind, value FROM currencies WHERE ?1 IS NULL OR account_id = ?1")
        .map_err(to_message)?;
    let rows = statement
        .query_map([only], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?)))
        .map_err(to_message)?;
    for row in rows {
        let (id, kind, value) = row.map_err(to_message)?;
        let Some(account) = index.get(&id).map(|position| &mut accounts[*position]) else { continue };
        if let Some(slot) = VALUES_A.iter().position(|entry| *entry == kind) {
            account.values_a[slot] = value;
        } else if let Some(slot) = VALUES_B.iter().position(|entry| *entry == kind) {
            account.values_b[slot] = value;
        }
    }

    let mut statement = connection
        .prepare_cached(
            "SELECT account_id, email IS NOT NULL, password IS NOT NULL FROM credentials WHERE ?1 IS NULL OR account_id = ?1",
        )
        .map_err(to_message)?;
    let rows = statement
        .query_map([only], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, bool>(1)?, row.get::<_, bool>(2)?)))
        .map_err(to_message)?;
    for row in rows {
        let (id, has_email, has_password) = row.map_err(to_message)?;
        if let Some(account) = index.get(&id).map(|position| &mut accounts[*position]) {
            account.has_email = has_email;
            account.has_password = has_password;
        }
    }
    Ok(accounts)
}

pub(crate) fn read_group(row: &rusqlite::Row) -> rusqlite::Result<Group> {
    Ok(Group { id: row.get(0)?, name: row.get(1)?, collapsed: row.get(2)?, sort_key: row.get(3)? })
}

pub(crate) fn read_roster(connection: &Connection) -> Result<Roster, String> {
    let accounts = read_accounts(connection, None)?;
    let groups = connection
        .prepare("SELECT id, name, collapsed, sort_key FROM groups ORDER BY sort_key, id")
        .and_then(|mut statement| statement.query_map([], read_group)?.collect())
        .map_err(to_message)?;
    Ok(Roster { accounts, groups })
}

/* ---------- Writing ---------- */

pub(crate) fn slot_name(slot: &str) -> Result<&'static str, String> {
    ROLE_SLOTS
        .iter()
        .chain(std::iter::once(&SIXV6_SLOT))
        .find(|entry| **entry == slot)
        .copied()
        .ok_or_else(|| crate::text::format("errors.db.unknownRankSlot", &[("slot", slot.to_string())]))
}

pub(crate) fn write_rank(transaction: &Transaction, account_id: i64, slot: &str, rank: &Rank) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO ranks (account_id, slot, tier, division, predicted, placements)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT (account_id, slot) DO UPDATE SET
                tier = excluded.tier, division = excluded.division,
                predicted = excluded.predicted, placements = excluded.placements",
            params![account_id, slot, rank.tier, rank.division, rank.predicted, rank.placements],
        )
        .map_err(to_message)?;
    Ok(())
}

pub(crate) fn insert_account(transaction: &Transaction, account: &Account, sort_key: f64) -> Result<(), String> {
    transaction
        .execute(
            "INSERT INTO accounts (id, name, sort_key, group_id, status) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![account.id, account.name, sort_key, account.group_id, account.status],
        )
        .map_err(to_message)?;
    for (slot, rank) in ROLE_SLOTS.iter().zip(&account.ranks) {
        rank.validate()?;
        write_rank(transaction, account.id, slot, rank)?;
    }
    account.six_v6.validate()?;
    write_rank(transaction, account.id, SIXV6_SLOT, &account.six_v6)?;
    let values = VALUES_A.iter().zip(account.values_a).chain(VALUES_B.iter().zip(account.values_b));
    for (kind, value) in values {
        transaction
            .execute(
                "INSERT INTO currencies (account_id, kind, value) VALUES (?1, ?2, ?3)",
                params![account.id, kind, value.max(0)],
            )
            .map_err(to_message)?;
    }
    Ok(())
}
