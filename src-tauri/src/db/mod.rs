//! RankDB's data: one SQLite database in the app's data directory (`rankdb.sqlite3`).
//!
//! Rust owns the data and the frontend mirrors it (docs/PLAN.md). Every user action is one small
//! command that validates its input, writes in a transaction and returns the changed records.
//! Schema changes are numbered migrations, tracked with SQLite's `user_version`.

use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

use crate::clipboard;
use crate::credential_security::{SecurityStatus, Vault};
use crate::legacy::{self, ImportSummary};

mod migrations;
mod records;
mod accounts;
mod settings;
mod credentials;
mod groups;
mod history;
mod backup;
#[cfg(test)]
mod upgrade_tests;

pub use records::*;
pub use accounts::*;
pub use settings::*;
pub use credentials::*;
pub use groups::*;
pub use history::*;
pub use backup::*;
use migrations::MIGRATIONS;

const FILE_NAME: &str = "rankdb.sqlite3";

pub(crate) const TIERS: &[&str] = &[
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
    /// The app data folder (its upgrade copies follow credential protection changes).
    dir: PathBuf,
    /// The first start's import of RankDB 0.3, reported once to the frontend.
    old_import: Mutex<Option<Result<ImportSummary, String>>>,
}

impl Database {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.connection.lock().map_err(|error| error.to_string())
    }

    /// The copies kept beside the database (upgrades, the latest import), converted along when
    /// credential protection changes.
    fn upgrade_copies(&self) -> Vec<PathBuf> {
        let before_import = self.dir.join(UPGRADE_COPIES).join(backup::BEFORE_IMPORT);
        upgrade_copies(&self.dir).into_iter().map(|(_, path)| path).chain(before_import.exists().then_some(before_import)).collect()
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
    let database = open_at(&dir)?;
    // The first start of a release build migrates RankDB 0.3's data into the empty database
    // (src/legacy.rs). A failure leaves both databases as they were, is reported, and is tried
    // again next start.
    if !cfg!(debug_assertions) {
        let mut connection = database.lock()?;
        if legacy::is_empty(&connection)? && !legacy::imported(&connection)? {
            let result = legacy::import_installed(&mut connection, &database.secrets).transpose();
            *database.old_import.lock().map_err(|error| error.to_string())? = result;
        }
    }
    Ok(database)
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
    Ok(Database { connection: Mutex::new(connection), secrets, dir: dir.to_path_buf(), old_import: Mutex::new(None) })
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
    fs::rename(&partial, &target).map_err(|error| failed(error.to_string()))?;
    // The newest few are enough to step back from a bad upgrade.
    for (_, old) in upgrade_copies(dir).into_iter().skip(KEPT_UPGRADE_COPIES) {
        let _ = fs::remove_file(old);
    }
    Ok(())
}

/// How many upgrade copies are kept.
const KEPT_UPGRADE_COPIES: usize = 3;

/// The upgrade copies, newest schema first.
fn upgrade_copies(dir: &Path) -> Vec<(i64, PathBuf)> {
    let mut copies: Vec<(i64, PathBuf)> = fs::read_dir(dir.join(UPGRADE_COPIES))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let version = name.strip_prefix("rankdb-schema-v")?.strip_suffix(".sqlite3")?.parse().ok()?;
            Some((version, entry.path()))
        })
        .collect();
    copies.sort_by_key(|copy| std::cmp::Reverse(copy.0));
    copies
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

/// Before an update installs (the installer ends the app without a normal exit): the database
/// file complete on its own, and no secret left on the clipboard.
#[tauri::command]
pub async fn prepare_for_update(database: State<'_, Database>) -> Result<(), String> {
    database.checkpoint();
    clipboard::clear_pending();
    Ok(())
}

/* ---------- RankDB 0.3 (src/legacy.rs) ---------- */

/// The first start's import, once: its summary, its error, or null when none ran.
#[tauri::command]
pub async fn take_old_app_import(database: State<'_, Database>) -> Result<Option<ImportSummary>, String> {
    let result = database.old_import.lock().map_err(|error| error.to_string())?.take();
    result.transpose()
}

/// Whether Settings offers the migration: RankDB 0.3's data is on this PC and the list is empty.
#[tauri::command]
pub async fn old_app_status(database: State<'_, Database>) -> Result<bool, String> {
    let connection = database.lock()?;
    Ok(legacy::old_folder().is_some() && legacy::is_empty(&connection)?)
}

/// Settings → Data: migrates RankDB 0.3's data into the empty database.
#[tauri::command]
pub async fn import_old_app(database: State<'_, Database>) -> Result<ImportSummary, String> {
    let mut connection = database.lock()?;
    legacy::import_installed(&mut connection, &database.secrets)?
        .ok_or_else(|| crate::text::text("errors.oldApp.notFound").into())
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
