//! RankDB's data: one SQLite database in the app's data directory (`rankdb.sqlite3`).
//!
//! Rust owns the data and the frontend mirrors it (docs/PLAN.md). Every user action is one small
//! command that validates its input, writes in a transaction and returns the changed records.
//! Schema changes are numbered migrations, tracked with SQLite's `user_version`.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

use crate::clipboard;
use crate::credential_security::{SecurityStatus, Vault};

const FILE_NAME: &str = "rankdb.sqlite3";

/// Applied in order; `user_version` holds how many have run. Never edit one that has shipped:
/// add a new one instead.
const MIGRATIONS: &[&str] = &[
    // 1: accounts, ranks, currencies, groups, rank history, settings.
    "
    CREATE TABLE groups (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        sort_key    REAL NOT NULL,
        collapsed   INTEGER NOT NULL DEFAULT 0,
        section     TEXT NOT NULL DEFAULT 'normal' CHECK (section IN ('normal', 'banned'))
    );
    CREATE TABLE accounts (
        id                  INTEGER PRIMARY KEY,
        name                TEXT NOT NULL,
        sort_key            REAL NOT NULL,
        group_id            TEXT REFERENCES groups(id) ON DELETE SET NULL,
        banned              INTEGER NOT NULL DEFAULT 0,
        country             TEXT NOT NULL DEFAULT '',
        notes               TEXT NOT NULL DEFAULT '',
        games_dodged        INTEGER NOT NULL DEFAULT 0,
        last_rank_change_at TEXT,
        created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE ranks (
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot        TEXT NOT NULL CHECK (slot IN ('tank', 'damage', 'support', 'sixv6')),
        tier        TEXT NOT NULL,
        division    INTEGER NOT NULL CHECK (division BETWEEN 1 AND 5),
        predicted   INTEGER NOT NULL DEFAULT 0,
        placements  INTEGER NOT NULL DEFAULT 0 CHECK (placements BETWEEN 0 AND 10),
        PRIMARY KEY (account_id, slot)
    );
    CREATE TABLE currencies (
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        kind        TEXT NOT NULL
                    CHECK (kind IN ('prisms', 'coins', 'credits', 'competitive', 'legacy')),
        value       INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (account_id, kind)
    );
    CREATE TABLE rank_history (
        id          INTEGER PRIMARY KEY,
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot        TEXT NOT NULL,
        tier        TEXT NOT NULL,
        division    INTEGER NOT NULL,
        predicted   INTEGER NOT NULL,
        placements  INTEGER NOT NULL,
        changed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        reason      TEXT NOT NULL CHECK (reason IN ('edit', 'season-reset', 'import'))
    );
    CREATE INDEX rank_history_account ON rank_history (account_id, changed_at);
    CREATE TABLE settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL
    );
    ",
    // 2: email and password, each sealed with the data key (src/secrets.rs); NULL when not set.
    "
    CREATE TABLE credentials (
        account_id  INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        email       BLOB,
        password    BLOB
    );
    ",
    // 3: a status (clean, needs SMS verification, banned) instead of the banned flag; SMS and
    // banned accounts each have their own section. Rank changes are no longer logged, only the
    // ranks season resets cleared.
    "
    ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'clean'
        CHECK (status IN ('clean', 'sms', 'banned'));
    UPDATE accounts SET status = 'banned' WHERE banned <> 0;
    ALTER TABLE accounts DROP COLUMN banned;
    DELETE FROM rank_history WHERE reason <> 'season-reset';
    ",
    // 4: explicit credential protection; fresh installations have no key dependency.
    "
    CREATE TABLE credential_security (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL CHECK (mode IN ('plain', 'legacy', 'password')),
        password_config TEXT,
        CHECK ((mode = 'password' AND password_config IS NOT NULL) OR (mode <> 'password' AND password_config IS NULL))
    );
    INSERT INTO credential_security (id, mode)
      SELECT 1, CASE WHEN EXISTS (SELECT 1 FROM credentials WHERE email IS NOT NULL OR password IS NOT NULL)
        THEN 'legacy' ELSE 'plain' END;
    ",
    // 5: cleanup. Groups lost their section (statuses replaced it in 3), and rank history holds
    // only season resets, so its columns get the same checks as `ranks`.
    "
    ALTER TABLE groups DROP COLUMN section;
    CREATE TABLE rank_history_v5 (
        id          INTEGER PRIMARY KEY,
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot        TEXT NOT NULL CHECK (slot IN ('tank', 'damage', 'support', 'sixv6')),
        tier        TEXT NOT NULL,
        division    INTEGER NOT NULL CHECK (division BETWEEN 1 AND 5),
        predicted   INTEGER NOT NULL,
        placements  INTEGER NOT NULL CHECK (placements BETWEEN 0 AND 10),
        changed_at  TEXT NOT NULL,
        reason      TEXT NOT NULL DEFAULT 'season-reset' CHECK (reason = 'season-reset')
    );
    INSERT INTO rank_history_v5 (id, account_id, slot, tier, division, predicted, placements, changed_at, reason)
        SELECT id, account_id, slot, tier, division, predicted, placements, changed_at, reason FROM rank_history
        WHERE reason = 'season-reset' AND slot IN ('tank', 'damage', 'support', 'sixv6')
          AND division BETWEEN 1 AND 5 AND placements BETWEEN 0 AND 10;
    DROP TABLE rank_history;
    ALTER TABLE rank_history_v5 RENAME TO rank_history;
    CREATE INDEX rank_history_account ON rank_history (account_id, changed_at);
    CREATE INDEX rank_history_reset ON rank_history (changed_at);
    ",
];

const TIERS: &[&str] = &[
    "Bronze",
    "Silver",
    "Gold",
    "Platinum",
    "Emerald",
    "Diamond",
    "Master",
    "Grandmaster",
    "Champion",
    "Unranked",
];
/// Order of `Account.ranks` in the frontend.
pub(crate) const ROLE_SLOTS: [&str; 3] = ["tank", "damage", "support"];
pub(crate) const SIXV6_SLOT: &str = "sixv6";
/// Order of `Account.valuesA` and `Account.valuesB` (the header's currency icons).
pub(crate) const VALUES_A: [&str; 3] = ["prisms", "coins", "credits"];
pub(crate) const VALUES_B: [&str; 2] = ["competitive", "legacy"];

pub struct Database {
    connection: Mutex<Connection>,
    secrets: Vault,
}

impl Database {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.connection.lock().map_err(|error| error.to_string())
    }

    /// Moves everything from the write-ahead log into the database file (app exit, before an
    /// update installs), so the file on its own is complete.
    pub fn checkpoint(&self) {
        if let Ok(connection) = self.lock() {
            let _ = connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
        }
    }
}

/// Why the database couldn't be opened, if it couldn't: the app then shows this instead of the
/// list and touches nothing (the file stays as it is, for recovery).
pub struct StartupProblem(pub Option<String>);

/// Copies taken before a schema upgrade, one per old version (`rankdb-schema-v4.sqlite3`).
const UPGRADE_COPIES: &str = "upgrade-copies";

/// Opens (or creates) the database and brings its schema up to date.
///
/// An update hands the database over like this: the new version opens the same file (the data
/// folder follows the app identifier, which never changes), copies it aside if its schema is
/// older, then runs the missing migrations, each in its own transaction. A database from a newer
/// version is refused rather than misread, so going back to an older version can't damage it.
pub fn open(app: &AppHandle) -> Result<Database, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    open_at(&dir)
}

pub(crate) fn open_at(dir: &Path) -> Result<Database, String> {
    let failed = |error: String| crate::text::format("errors.db.openFailed", &[("error", error)]);
    fs::create_dir_all(dir).map_err(|error| failed(error.to_string()))?;
    let mut connection = Connection::open(dir.join(FILE_NAME)).map_err(|error| failed(error.to_string()))?;
    // Another process reading the file (a backup tool, an antivirus scan) gets a moment to finish.
    connection.busy_timeout(Duration::from_secs(5)).map_err(|error| failed(error.to_string()))?;
    connection
        .execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;")
        .map_err(|error| failed(error.to_string()))?;
    let healthy: String = connection
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|_| crate::text::text("errors.db.damaged").to_string())?;
    if healthy != "ok" {
        return Err(crate::text::text("errors.db.damaged").into());
    }
    let version = schema_version(&connection)?;
    if version > 0 && (version as usize) < MIGRATIONS.len() {
        copy_before_upgrade(&connection, dir, version)?;
    }
    migrate(&mut connection)?;
    let secrets = Vault::load(&connection)?;
    // First start: remember the day (Discord's "User since").
    connection
        .execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('installedOn', json_quote(date('now')))",
            [],
        )
        .map_err(to_message)?;
    Ok(Database { connection: Mutex::new(connection), secrets })
}

fn schema_version(connection: &Connection) -> Result<i64, String> {
    connection.query_row("PRAGMA user_version", [], |row| row.get(0)).map_err(to_message)
}

/// A complete copy of the database as it was before an upgrade. An existing copy for this version
/// is kept: it's from before the first (perhaps failed) attempt.
fn copy_before_upgrade(connection: &Connection, dir: &Path, version: i64) -> Result<(), String> {
    let folder = dir.join(UPGRADE_COPIES);
    let target = folder.join(format!("rankdb-schema-v{version}.sqlite3"));
    if target.exists() {
        return Ok(());
    }
    let failed = |error: String| crate::text::format("errors.db.upgradeCopyFailed", &[("error", error)]);
    fs::create_dir_all(&folder).map_err(|error| failed(error.to_string()))?;
    // Written under a temporary name first, so a crash never leaves half a copy that looks whole.
    let partial = folder.join(format!("rankdb-schema-v{version}.partial"));
    let _ = fs::remove_file(&partial);
    connection
        .execute("VACUUM INTO ?1", [partial.to_string_lossy()])
        .map_err(|error| failed(error.to_string()))?;
    fs::rename(&partial, &target).map_err(|error| failed(error.to_string()))
}

pub(crate) fn migrate(connection: &mut Connection) -> Result<(), String> {
    let applied = schema_version(connection)?;
    if applied as usize > MIGRATIONS.len() {
        return Err(crate::text::text("errors.db.newerVersion").into());
    }
    for (index, migration) in MIGRATIONS.iter().enumerate().skip(applied.max(0) as usize) {
        let failed = |error: String| {
            crate::text::format("errors.db.migrationFailed", &[("version", (index + 1).to_string()), ("error", error)])
        };
        let transaction = connection.transaction().map_err(|error| failed(error.to_string()))?;
        let dangling = |transaction: &Transaction| -> Result<i64, String> {
            transaction
                .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |row| row.get(0))
                .map_err(|error| failed(error.to_string()))
        };
        let before = dangling(&transaction)?;
        transaction.execute_batch(migration).map_err(|error| failed(error.to_string()))?;
        // A migration that leaves a new dangling reference is undone rather than committed.
        if dangling(&transaction)? > before {
            return Err(failed(crate::text::text("errors.db.brokenReferences").into()));
        }
        transaction
            .execute_batch(&format!("PRAGMA user_version = {}", index + 1))
            .map_err(|error| failed(error.to_string()))?;
        transaction.commit().map_err(|error| failed(error.to_string()))?;
    }
    Ok(())
}

pub(crate) fn to_message(error: rusqlite::Error) -> String {
    error.to_string()
}

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

    fn validate(&self) -> Result<(), String> {
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

fn read_account(connection: &Connection, id: i64) -> Result<Option<Account>, String> {
    Ok(read_accounts(connection, Some(id))?.pop())
}

/// Every account (or only `only`), in saved order: one query per table, not per account.
fn read_accounts(connection: &Connection, only: Option<i64>) -> Result<Vec<Account>, String> {
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

fn read_group(row: &rusqlite::Row) -> rusqlite::Result<Group> {
    Ok(Group { id: row.get(0)?, name: row.get(1)?, collapsed: row.get(2)?, sort_key: row.get(3)? })
}

fn read_roster(connection: &Connection) -> Result<Roster, String> {
    let accounts = read_accounts(connection, None)?;
    let groups = connection
        .prepare("SELECT id, name, collapsed, sort_key FROM groups ORDER BY sort_key, id")
        .and_then(|mut statement| statement.query_map([], read_group)?.collect())
        .map_err(to_message)?;
    Ok(Roster { accounts, groups })
}

/* ---------- Writing ---------- */

fn slot_name(slot: &str) -> Result<&'static str, String> {
    ROLE_SLOTS
        .iter()
        .chain(std::iter::once(&SIXV6_SLOT))
        .find(|entry| **entry == slot)
        .copied()
        .ok_or_else(|| crate::text::format("errors.db.unknownRankSlot", &[("slot", slot.to_string())]))
}

fn write_rank(transaction: &Transaction, account_id: i64, slot: &str, rank: &Rank) -> Result<(), String> {
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

fn insert_account(transaction: &Transaction, account: &Account, sort_key: f64) -> Result<(), String> {
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

/* ---------- Settings ---------- */

/// One JSON value per setting. The frontend validates what it reads (src/data/settingsStore.ts);
/// this only keeps keys and values to a sane size.
const MAX_SETTING_KEY: usize = 64;
const MAX_SETTING_BYTES: usize = 4096;

#[tauri::command]
pub async fn load_settings(database: State<'_, Database>) -> Result<HashMap<String, serde_json::Value>, String> {
    let connection = database.lock()?;
    let mut statement = connection.prepare("SELECT key, value FROM settings").map_err(to_message)?;
    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(to_message)?;
    let mut settings = HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(to_message)?;
        // A value that no longer parses is skipped (the frontend falls back to its default).
        if let Ok(value) = serde_json::from_str(&value) {
            settings.insert(key, value);
        }
    }
    Ok(settings)
}

/// Saves the given settings (only those; others keep their values).
#[tauri::command]
pub async fn save_settings(database: State<'_, Database>, values: HashMap<String, serde_json::Value>) -> Result<(), String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    for (key, value) in values {
        let json = value.to_string();
        if key.is_empty() || key.len() > MAX_SETTING_KEY || json.len() > MAX_SETTING_BYTES {
            return Err(crate::text::format("errors.db.settingTooLarge", &[("key", key.to_string())]));
        }
        transaction
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                params![key, json],
            )
            .map_err(to_message)?;
    }
    transaction.commit().map_err(to_message)
}

/* ---------- Accounts ---------- */

/// Battletags are up to 12 characters plus `#` and a number; leave room for notes like "(main)".
const MAX_NAME: usize = 64;
const MAX_NOTES: usize = 4000;
const MAX_SECRET: usize = 512;
const MAX_CURRENCY: i64 = 99_999_999;

fn clean_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(crate::text::text("errors.db.nameRequired").into());
    }
    if name.chars().count() > MAX_NAME {
        return Err(crate::text::format("errors.db.nameTooLong", &[("limit", MAX_NAME.to_string())]));
    }
    Ok(name.to_string())
}

fn require_account(connection: &Connection, id: i64) -> Result<(), String> {
    let exists: bool = connection
        .query_row("SELECT EXISTS (SELECT 1 FROM accounts WHERE id = ?1)", [id], |row| row.get(0))
        .map_err(to_message)?;
    if exists { Ok(()) } else { Err(crate::text::text("errors.db.accountNotFound").into()) }
}

fn account_or_gone(connection: &Connection, id: i64) -> Result<Account, String> {
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

/* ---------- Credentials ---------- */

#[derive(Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SecretField {
    Email,
    Password,
}

impl SecretField {
    fn column(self) -> &'static str {
        match self {
            Self::Email => "email",
            Self::Password => "password",
        }
    }
}

/// Ties a sealed value to its account and field (the AES-GCM associated data).
pub(crate) fn binding_for(account_id: i64, field: SecretField) -> String {
    format!("rankdb:{account_id}:{}", field.column())
}

fn read_secret(database: &Database, connection: &Connection, account_id: i64, field: SecretField) -> Result<Option<String>, String> {
    let sealed: Option<Vec<u8>> = connection
        .query_row(
            &format!("SELECT {} FROM credentials WHERE account_id = ?1", field.column()),
            [account_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(to_message)?
        .flatten();
    sealed
        .map(|sealed| database.secrets.open_sealed(&sealed, &binding_for(account_id, field)))
        .transpose()
}

#[derive(Serialize)]
pub struct Credentials {
    pub email: String,
    pub password: String,
}

/// For the edit-credentials dialog only (empty strings when not set).
#[tauri::command]
pub async fn get_credentials(database: State<'_, Database>, account_id: i64) -> Result<Credentials, String> {
    let connection = database.lock()?;
    database.secrets.require_unlocked()?;
    require_account(&connection, account_id)?;
    Ok(Credentials {
        email: read_secret(&database, &connection, account_id, SecretField::Email)?.unwrap_or_default(),
        password: read_secret(&database, &connection, account_id, SecretField::Password)?.unwrap_or_default(),
    })
}

/// Replaces both credentials; an empty string removes that one.
#[tauri::command]
pub async fn set_credentials(
    database: State<'_, Database>,
    account_id: i64,
    email: String,
    password: String,
) -> Result<Account, String> {
    // Serialize encoding with protection changes; never seal under an old mode before acquiring
    // the database lock and then commit it after the mode has changed.
    let connection = database.lock()?;
    database.secrets.require_unlocked()?;
    let email = email.trim();
    if email.chars().count() > MAX_SECRET || password.chars().count() > MAX_SECRET {
        return Err(crate::text::text("errors.db.credentialTooLong").into());
    }
    let seal = |value: &str, field| -> Result<Option<Vec<u8>>, String> {
        if value.is_empty() { Ok(None) } else { database.secrets.seal(value, &binding_for(account_id, field)).map(Some) }
    };
    let sealed_email = seal(email, SecretField::Email)?;
    let sealed_password = seal(&password, SecretField::Password)?;
    require_account(&connection, account_id)?;
    connection
        .execute(
            "INSERT INTO credentials (account_id, email, password) VALUES (?1, ?2, ?3)
             ON CONFLICT (account_id) DO UPDATE SET email = excluded.email, password = excluded.password",
            params![account_id, sealed_email, sealed_password],
        )
        .map_err(to_message)?;
    account_or_gone(&connection, account_id)
}

/// Copies an account's email or password to the clipboard, kept out of clipboard history and
/// cleared after `clear_after_seconds` (none: kept). The secret never passes through the frontend.
#[tauri::command]
pub async fn copy_secret(
    database: State<'_, Database>,
    account_id: i64,
    field: SecretField,
    clear_after_seconds: Option<u64>,
) -> Result<(), String> {
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    let secret = read_secret(&database, &connection, account_id, field)?.ok_or_else(|| match field {
        SecretField::Email => crate::text::text("errors.db.emailMissing").to_string(),
        SecretField::Password => crate::text::text("errors.db.passwordMissing").to_string(),
    })?;
    drop(connection);
    clipboard::copy(&secret, true, clear_after_seconds.map(Duration::from_secs))
}

/// Copies plain text (a Battletag). It goes to clipboard history like any copy.
#[tauri::command]
pub async fn copy_text(text: String) -> Result<(), String> {
    if text.chars().count() > MAX_NAME {
        return Err(crate::text::text("errors.db.copyTooLong").into());
    }
    clipboard::copy(&text, false, None)
}

/* ---------- Groups, sections and order ---------- */

const MAX_GROUP_NAME: usize = 40;

/// Where items live. Loose accounts and groups share the top level; each group and the SMS and
/// banned sections have their own order.
#[derive(Clone, Copy)]
enum Container<'a> {
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
fn next_key(connection: &Connection, container: Container) -> Result<f64, String> {
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

fn clean_group_name(name: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(crate::text::text("errors.db.groupNameRequired").into());
    }
    if name.chars().count() > MAX_GROUP_NAME {
        return Err(crate::text::format("errors.db.groupNameTooLong", &[("limit", MAX_GROUP_NAME.to_string())]));
    }
    Ok(name.to_string())
}

fn require_group(connection: &Connection, id: &str) -> Result<(), String> {
    let exists: bool = connection
        .query_row("SELECT EXISTS (SELECT 1 FROM groups WHERE id = ?1)", [id], |row| row.get(0))
        .map_err(to_message)?;
    if exists { Ok(()) } else { Err(crate::text::text("errors.db.groupNotFound").into()) }
}

fn read_group_by_id(connection: &Connection, id: &str) -> Result<Group, String> {
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

/* ---------- Rank tracking ---------- */

/// A rank a season reset cleared.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RankHistoryEntry {
    pub slot: String,
    pub rank: Rank,
    pub changed_at: String,
    pub reason: String,
}

/// Newest first; a long-tracked account keeps only the most recent entries on screen.
const HISTORY_LIMIT: i64 = 200;

#[tauri::command]
pub async fn get_rank_history(database: State<'_, Database>, account_id: i64) -> Result<Vec<RankHistoryEntry>, String> {
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    let mut statement = connection
        .prepare(
            "SELECT slot, tier, division, predicted, placements, changed_at, reason FROM rank_history
             WHERE account_id = ?1 AND reason = 'season-reset' ORDER BY changed_at DESC, id DESC LIMIT ?2",
        )
        .map_err(to_message)?;
    let rows = statement
        .query_map(params![account_id, HISTORY_LIMIT], |row| {
            Ok(RankHistoryEntry {
                slot: row.get(0)?,
                rank: Rank { tier: row.get(1)?, division: row.get(2)?, predicted: row.get(3)?, placements: row.get(4)? },
                changed_at: row.get(5)?,
                reason: row.get(6)?,
            })
        })
        .map_err(to_message)?;
    rows.collect::<Result<_, _>>().map_err(to_message)
}

/// Every season reset, newest first (the time its history entries share).
#[tauri::command]
pub async fn list_season_resets(database: State<'_, Database>) -> Result<Vec<String>, String> {
    let connection = database.lock()?;
    connection
        .prepare(
            "SELECT DISTINCT changed_at FROM rank_history WHERE reason = 'season-reset' ORDER BY changed_at DESC",
        )
        .and_then(|mut statement| statement.query_map([], |row| row.get(0))?.collect())
        .map_err(to_message)
}

/// One rank a season reset cleared (slots it doesn't list were Unranked then).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetRank {
    pub account_id: i64,
    pub slot: String,
    pub rank: Rank,
}

#[tauri::command]
pub async fn get_season_reset(database: State<'_, Database>, reset_at: String) -> Result<Vec<ResetRank>, String> {
    let connection = database.lock()?;
    let mut statement = connection
        .prepare(
            "SELECT account_id, slot, tier, division, predicted, placements FROM rank_history
             WHERE reason = 'season-reset' AND changed_at = ?1",
        )
        .map_err(to_message)?;
    let rows = statement
        .query_map([&reset_at], |row| {
            Ok(ResetRank {
                account_id: row.get(0)?,
                slot: row.get(1)?,
                rank: Rank { tier: row.get(2)?, division: row.get(3)?, predicted: row.get(4)?, placements: row.get(5)? },
            })
        })
        .map_err(to_message)?;
    rows.collect::<Result<_, _>>().map_err(to_message)
}

/// What a season reset did, so it can be undone.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonReset {
    /// Marks this reset's history entries (they all share this time).
    pub reset_at: String,
    /// Ranks that were cleared.
    pub cleared: i64,
    pub roster: Roster,
}

/// Season reset: every rank of every account (6v6 included) goes back to Unranked. Each cleared
/// rank is kept in the rank history as `season-reset`, shown under Past ranks.
#[tauri::command]
pub async fn season_reset(database: State<'_, Database>) -> Result<SeasonReset, String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    let reset_at: String = transaction
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| row.get(0))
        .map_err(to_message)?;
    let cleared = transaction
        .execute(
            "INSERT INTO rank_history (account_id, slot, tier, division, predicted, placements, changed_at, reason)
             SELECT account_id, slot, tier, division, predicted, placements, ?1, 'season-reset'
             FROM ranks WHERE tier <> 'Unranked'",
            [&reset_at],
        )
        .map_err(to_message)? as i64;
    transaction
        .execute(
            "UPDATE ranks SET tier = 'Unranked', division = 5, predicted = 0, placements = 0 WHERE tier <> 'Unranked'",
            [],
        )
        .map_err(to_message)?;
    transaction.commit().map_err(to_message)?;
    Ok(SeasonReset { reset_at, cleared, roster: read_roster(&connection)? })
}

/// Undoes a season reset: ranks it cleared come back, unless they were set again since (those
/// keep their new value). Its history entries are removed.
#[tauri::command]
pub async fn undo_season_reset(database: State<'_, Database>, reset_at: String) -> Result<Roster, String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    transaction
        .execute(
            "UPDATE ranks SET
                tier = h.tier, division = h.division, predicted = h.predicted, placements = h.placements
             FROM (SELECT account_id, slot, tier, division, predicted, placements FROM rank_history
                   WHERE reason = 'season-reset' AND changed_at = ?1) AS h
             WHERE ranks.account_id = h.account_id AND ranks.slot = h.slot
               AND ranks.tier = 'Unranked' AND ranks.predicted = 0",
            [&reset_at],
        )
        .map_err(to_message)?;
    transaction
        .execute("DELETE FROM rank_history WHERE reason = 'season-reset' AND changed_at = ?1", [&reset_at])
        .map_err(to_message)?;
    transaction.commit().map_err(to_message)?;
    read_roster(&connection)
}

/// The old app's counter: penalties step up per dodge and reset after 20 games without one.
const MAX_DODGES: i64 = 10;

#[tauri::command]
pub async fn set_games_dodged(database: State<'_, Database>, account_id: i64, count: i64) -> Result<Account, String> {
    if !(0..=MAX_DODGES).contains(&count) {
        return Err(crate::text::format("errors.db.dodgesOutOfRange", &[("limit", MAX_DODGES.to_string())]));
    }
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    connection
        .execute("UPDATE accounts SET games_dodged = ?2 WHERE id = ?1", params![account_id, count])
        .map_err(to_message)?;
    account_or_gone(&connection, account_id)
}

/* ---------- Credential protection ---------- */

#[tauri::command]
pub async fn credential_security_status(database: State<'_, Database>) -> Result<SecurityStatus, String> {
    let _connection = database.lock()?;
    database.secrets.status()
}
#[tauri::command]
pub async fn unlock_credentials(database: State<'_, Database>, password: String) -> Result<SecurityStatus, String> {
    // Only the vault: account edits go on while the key is derived.
    let password = zeroize::Zeroizing::new(password);
    database.secrets.unlock(&password)
}
#[tauri::command]
pub async fn lock_credentials(database: State<'_, Database>) -> Result<SecurityStatus, String> {
    let _connection = database.lock()?;
    database.secrets.lock()
}
#[tauri::command]
pub async fn configure_credential_encryption(database: State<'_, Database>, enabled: bool, password: String, current_password: String) -> Result<SecurityStatus, String> {
    let password = zeroize::Zeroizing::new(password);
    let current_password = zeroize::Zeroizing::new(current_password);
    let mut connection = database.lock()?;
    database.secrets.configure(&mut connection, enabled, &password, &current_password)
}
#[tauri::command]
pub async fn change_master_password(database: State<'_, Database>, current_password: String, password: String) -> Result<SecurityStatus, String> {
    let password = zeroize::Zeroizing::new(password);
    let current_password = zeroize::Zeroizing::new(current_password);
    let mut connection = database.lock()?;
    database.secrets.change_password(&mut connection, &current_password, &password)
}

/// Before an update installs (the installer ends the app without a normal exit).
#[tauri::command]
pub async fn flush_database(database: State<'_, Database>) -> Result<(), String> {
    database.checkpoint();
    Ok(())
}

/// Why the database couldn't be opened (the app shows it instead of the list), or null.
#[tauri::command]
pub fn database_problem(problem: State<StartupProblem>) -> Option<String> {
    problem.0.clone()
}

/// The saved installation day, YYYY-MM-DD.
#[tauri::command]
pub async fn installed_on(database: State<'_, Database>) -> Result<String, String> {
    let connection = database.lock()?;
    connection
        .query_row("SELECT json_extract(value, '$') FROM settings WHERE key = 'installedOn'", [], |row| row.get(0))
        .map_err(to_message)
}

#[cfg(test)]
mod upgrade_tests {
    use super::*;

    fn folder() -> std::path::PathBuf {
        let mut suffix = [0u8; 8];
        getrandom::fill(&mut suffix).unwrap();
        let path = std::env::temp_dir().join(format!("rankdb-db-test-{}-{:x}", std::process::id(), u64::from_le_bytes(suffix)));
        fs::create_dir_all(&path).unwrap();
        path
    }

    fn table_sql(connection: &Connection) -> Vec<String> {
        connection
            .prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .map(|sql| sql.unwrap().split_whitespace().collect::<Vec<_>>().join(" "))
            .collect()
    }

    /// A database as version 4 left it, with a bit of everything.
    fn version_4(dir: &Path) {
        let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
        connection.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        for migration in &MIGRATIONS[..4] {
            connection.execute_batch(migration).unwrap();
        }
        connection
            .execute_batch(
                "PRAGMA user_version = 4;
                 INSERT INTO groups (id, name, sort_key, section) VALUES ('g', 'Mains', 0, 'normal');
                 INSERT INTO accounts (id, name, sort_key, group_id, status, notes) VALUES (1, 'One#1', 0, 'g', 'clean', 'note');
                 INSERT INTO accounts (id, name, sort_key, status) VALUES (2, 'Two#2', 1, 'banned');
                 INSERT INTO ranks VALUES (1, 'tank', 'Gold', 3, 0, 0), (1, 'sixv6', 'Diamond', 1, 1, 4);
                 INSERT INTO currencies VALUES (1, 'coins', 1200);
                 INSERT INTO credentials VALUES (1, CAST('a@b.c' AS BLOB), NULL);
                 UPDATE credential_security SET mode = 'plain';
                 INSERT INTO rank_history (account_id, slot, tier, division, predicted, placements, changed_at, reason)
                    VALUES (1, 'tank', 'Master', 2, 0, 0, '2026-01-01T00:00:00.000Z', 'season-reset'),
                           (2, 'damage', 'Silver', 5, 0, 0, '2026-01-01T00:00:00.000Z', 'season-reset');
                 INSERT INTO settings VALUES ('uiScale', '1.1');",
            )
            .unwrap();
    }

    #[test]
    fn upgrade_keeps_every_record_and_copies_the_old_file_first() {
        let dir = folder();
        version_4(&dir);
        let database = open_at(&dir).unwrap();
        {
            let connection = database.lock().unwrap();
            assert_eq!(schema_version(&connection).unwrap() as usize, MIGRATIONS.len());
            let roster = read_roster(&connection).unwrap();
            assert_eq!(roster.accounts.len(), 2);
            let one = &roster.accounts[0];
            assert_eq!((one.name.as_str(), one.group_id.as_deref()), ("One#1", Some("g")));
            assert_eq!((one.ranks[0].tier.as_str(), one.ranks[0].division), ("Gold", 3));
            assert_eq!((one.six_v6.tier.as_str(), one.six_v6.placements), ("Diamond", 4));
            assert_eq!(one.values_a, [0, 1200, 0]);
            assert!(one.has_email && !one.has_password);
            assert!(matches!(roster.accounts[1].status, Status::Banned));
            assert_eq!(roster.groups.len(), 1);
            let history: i64 = connection.query_row("SELECT COUNT(*) FROM rank_history", [], |row| row.get(0)).unwrap();
            assert_eq!(history, 2);
            let scale: String = connection.query_row("SELECT value FROM settings WHERE key = 'uiScale'", [], |row| row.get(0)).unwrap();
            assert_eq!(scale, "1.1");
        }
        drop(database);
        // The copy is the database exactly as version 4 had it.
        let copy = Connection::open(dir.join(UPGRADE_COPIES).join("rankdb-schema-v4.sqlite3")).unwrap();
        assert_eq!(schema_version(&copy).unwrap(), 4);
        let accounts: i64 = copy.query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0)).unwrap();
        assert_eq!(accounts, 2);
        drop(copy);
        // Opening again changes nothing and copies nothing.
        drop(open_at(&dir).unwrap());
        assert_eq!(fs::read_dir(dir.join(UPGRADE_COPIES)).unwrap().count(), 1);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn upgraded_schema_matches_a_fresh_one() {
        let fresh_dir = folder();
        let fresh = open_at(&fresh_dir).unwrap();
        assert!(!fresh_dir.join(UPGRADE_COPIES).exists());
        let upgraded_dir = folder();
        version_4(&upgraded_dir);
        let upgraded = open_at(&upgraded_dir).unwrap();
        assert_eq!(table_sql(&fresh.lock().unwrap()), table_sql(&upgraded.lock().unwrap()));
        drop((fresh, upgraded));
        fs::remove_dir_all(fresh_dir).unwrap();
        fs::remove_dir_all(upgraded_dir).unwrap();
    }

    #[test]
    fn database_from_a_newer_version_is_refused_untouched() {
        let dir = folder();
        drop(open_at(&dir).unwrap());
        let newer = MIGRATIONS.len() + 1;
        Connection::open(dir.join(FILE_NAME)).unwrap().execute_batch(&format!("PRAGMA user_version = {newer};")).unwrap();
        assert!(open_at(&dir).is_err());
        let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
        assert_eq!(schema_version(&connection).unwrap() as usize, newer);
        drop(connection);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_failing_migration_leaves_the_database_at_its_old_version() {
        let dir = folder();
        version_4(&dir);
        // An index on the column migration 5 drops makes it fail halfway.
        let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
        connection.execute_batch("CREATE INDEX groups_section ON groups (section);").unwrap();
        drop(connection);
        assert!(open_at(&dir).is_err());
        let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
        assert_eq!(schema_version(&connection).unwrap(), 4);
        let section: i64 = connection
            .query_row("SELECT COUNT(*) FROM pragma_table_info('groups') WHERE name = 'section'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(section, 1);
        drop(connection);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn old_windows_key_database_is_refused_untouched() {
        let dir = folder();
        version_4(&dir);
        Connection::open(dir.join(FILE_NAME)).unwrap().execute_batch("UPDATE credential_security SET mode = 'legacy';").unwrap();
        assert!(open_at(&dir).is_err());
        let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
        let email: Vec<u8> = connection.query_row("SELECT email FROM credentials", [], |row| row.get(0)).unwrap();
        assert_eq!(email, b"a@b.c");
        drop(connection);
        fs::remove_dir_all(dir).unwrap();
    }
}
