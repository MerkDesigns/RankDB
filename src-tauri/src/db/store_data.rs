//! The Microsoft Store build's data (docs/MICROSOFT_STORE.md).
//!
//! The Store build is its own app to Windows: its own identifier, so its own data folder, which
//! Windows keeps inside the package (and removes when the app is uninstalled). It never shares a
//! database with the RankDB installed from GitHub. Instead, its first start copies that RankDB's
//! database over, once: accounts, ranks, settings, credentials and credential protection all live
//! in the one file, so a master password and everything sealed with it arrive as they were.
//!
//! The copy only ever reads the other version's files and never touches a Store database that
//! holds anything. This module is compiled into every build, so its tests always run, but only
//! the Store build (`store` feature) calls it.

use super::*;

/// The identifier of the RankDB installed from GitHub (its data folder's name).
const GITHUB_IDENTIFIER: &str = "com.merkdesigns.rankdb.next";
/// Left in the Store build's data folder once the copy is done, so it never happens twice: not
/// after the list was emptied by hand, and not after a backup import replaced the database.
const MARKER: &str = "copied-from-github-version";
/// The copy while it is being checked, beside where the database will be.
const STAGED: &str = "rankdb-from-github.sqlite3";
/// How often a copy is retried while the other RankDB keeps writing.
const ATTEMPTS: usize = 5;

/// What the first start brought over, for its notification.
#[derive(Serialize)]
pub struct StoreImport {
    accounts: i64,
}

/// The GitHub version's data folder beside this build's, if it has a database.
pub(super) fn github_folder(dir: &Path) -> Option<PathBuf> {
    let folder = dir.parent()?.join(GITHUB_IDENTIFIER);
    (folder != dir && folder.join(FILE_NAME).exists()).then_some(folder)
}

/// Copies the GitHub version's database into `to`, before it is opened. Nothing happens when it
/// already happened, when there is nothing to copy, or when `to` already holds accounts, groups
/// or a master password. A failure leaves both sides as they were and is tried again next start.
pub(super) fn bring_over(from: &Path, to: &Path) -> Result<Option<StoreImport>, String> {
    let source = from.join(FILE_NAME);
    if to.join(MARKER).exists() || !source.exists() || !pristine(to) {
        return Ok(None);
    }
    fs::create_dir_all(to).map_err(|error| failed(error.to_string()))?;
    let staged = to.join(STAGED);
    let result = stage(&source, &staged).and_then(|()| check(&staged));
    if result.is_err() {
        remove_database(&staged);
    }
    let accounts = result?;
    let target = to.join(FILE_NAME);
    remove_database(&target);
    fs::rename(&staged, &target).map_err(|error| failed(error.to_string()))?;
    // Without the marker the worst case is a second, identical copy over a still-empty database.
    let _ = fs::write(to.join(MARKER), b"");
    Ok(Some(StoreImport { accounts }))
}

fn failed(error: String) -> String {
    crate::text::format("errors.storeData.copyFailed", &[("error", error)])
}

fn sidecar(database: &Path, suffix: &str) -> PathBuf {
    let mut name = database.as_os_str().to_owned();
    name.push(suffix);
    PathBuf::from(name)
}

fn remove_database(database: &Path) {
    for file in [database.to_path_buf(), sidecar(database, "-wal"), sidecar(database, "-shm")] {
        let _ = fs::remove_file(file);
    }
}

/// Whether `dir` has no database yet, or one nobody has used: no accounts, no groups, no master
/// password. Anything unreadable counts as used and is left alone.
fn pristine(dir: &Path) -> bool {
    let file = dir.join(FILE_NAME);
    if !file.exists() {
        return true;
    }
    let Ok(connection) = Connection::open(&file) else { return false };
    connection
        .query_row(
            "SELECT NOT EXISTS (SELECT 1 FROM accounts) AND NOT EXISTS (SELECT 1 FROM groups)
                AND NOT EXISTS (SELECT 1 FROM credential_security WHERE mode <> 'plain')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false)
}

/// Copies the database file and its write-ahead log as they were at one moment. The other RankDB
/// may be running, so both are read twice (file, log, file, log): if neither changed in between,
/// the first pair is what was on disk at the moment the log was first read, and SQLite recovers
/// any such moment like a power cut. Reading never locks or changes the other version's files.
fn stage(source: &Path, staged: &Path) -> Result<(), String> {
    let read = |path: &Path| match fs::read(path) {
        Ok(bytes) => Ok(Some(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(failed(error.to_string())),
    };
    let log = sidecar(source, "-wal");
    for attempt in 0..ATTEMPTS {
        if attempt > 0 {
            std::thread::sleep(Duration::from_millis(150));
        }
        let (database, wal) = (read(source)?, read(&log)?);
        if database != read(source)? || wal != read(&log)? {
            continue;
        }
        let Some(database) = database else { break };
        remove_database(staged);
        fs::write(staged, database).map_err(|error| failed(error.to_string()))?;
        if let Some(wal) = wal.filter(|wal| !wal.is_empty()) {
            fs::write(sidecar(staged, "-wal"), wal).map_err(|error| failed(error.to_string()))?;
        }
        return Ok(());
    }
    Err(crate::text::text("errors.storeData.inUse").into())
}

/// Opens the staged copy (SQLite folds its log in), makes sure it is a healthy RankDB database no
/// newer than this build, and leaves it as one complete file. Returns how many accounts it holds.
fn check(staged: &Path) -> Result<i64, String> {
    let unreadable = || crate::text::text("errors.storeData.unreadable").to_string();
    let connection = Connection::open(staged).map_err(|_| unreadable())?;
    let healthy: String = connection.query_row("PRAGMA quick_check", [], |row| row.get(0)).map_err(|_| unreadable())?;
    let version = schema_version(&connection).map_err(|_| unreadable())?;
    if healthy != "ok" || version <= 0 {
        return Err(unreadable());
    }
    if version as usize > MIGRATIONS.len() {
        return Err(crate::text::text("errors.storeData.newer").into());
    }
    let accounts = connection.query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0)).map_err(|_| unreadable())?;
    connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;").map_err(|_| unreadable())?;
    drop(connection);
    let _ = fs::remove_file(sidecar(staged, "-wal"));
    let _ = fs::remove_file(sidecar(staged, "-shm"));
    Ok(accounts)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folders(name: &str) -> (PathBuf, PathBuf, PathBuf) {
        let root = std::env::temp_dir().join(format!("rankdb-store-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let (from, to) = (root.join(GITHUB_IDENTIFIER), root.join("com.merkdesigns.rankdb.store"));
        fs::create_dir_all(&from).unwrap();
        (root, from, to)
    }

    /// A GitHub-version database with two accounts, a setting and a saved email.
    fn github_database(from: &Path) -> Database {
        let database = open_at(from).unwrap();
        database
            .lock()
            .unwrap()
            .execute_batch(
                "INSERT INTO accounts (id, name, sort_key) VALUES (1, 'One#1', 0), (2, 'Two#2', 1);
                 INSERT INTO ranks VALUES (1, 'tank', 'Gold', 3, 0, 0);
                 INSERT INTO credentials VALUES (1, CAST('a@b.c' AS BLOB), NULL);
                 INSERT OR REPLACE INTO settings VALUES ('accentColor', '\"#112233\"');",
            )
            .unwrap();
        database
    }

    fn names(dir: &Path) -> Vec<String> {
        let database = open_at(dir).unwrap();
        let connection = database.lock().unwrap();
        let mut statement = connection.prepare("SELECT name FROM accounts ORDER BY id").unwrap();
        let names = statement.query_map([], |row| row.get(0)).unwrap().map(Result::unwrap).collect();
        names
    }

    #[test]
    fn the_first_start_copies_everything_once() {
        let (root, from, to) = folders("once");
        drop(github_database(&from));
        assert_eq!(github_folder(&to), Some(from.clone()));
        assert_eq!(bring_over(&from, &to).unwrap().unwrap().accounts, 2);
        {
            let database = open_at(&to).unwrap();
            let connection = database.lock().unwrap();
            let roster = read_roster(&connection).unwrap();
            assert_eq!(roster.accounts.len(), 2);
            assert!(roster.accounts[0].has_email && roster.accounts[0].ranks[0].tier == "Gold");
            let accent: String = connection.query_row("SELECT value FROM settings WHERE key = 'accentColor'", [], |row| row.get(0)).unwrap();
            assert_eq!(accent, "\"#112233\"");
        }
        // Later starts copy nothing, even after the list was emptied and the other side changed.
        open_at(&to).unwrap().lock().unwrap().execute_batch("DELETE FROM accounts;").unwrap();
        open_at(&from).unwrap().lock().unwrap().execute_batch("INSERT INTO accounts (id, name, sort_key) VALUES (3, 'Three#3', 2);").unwrap();
        assert!(bring_over(&from, &to).unwrap().is_none());
        assert!(names(&to).is_empty());
        // The other version's data is as it was.
        assert_eq!(names(&from), ["One#1", "Two#2", "Three#3"]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_running_other_version_is_copied_with_its_log() {
        let (root, from, to) = folders("running");
        // Still open: the newest rows are only in the write-ahead log.
        let running = github_database(&from);
        assert!(sidecar(&from.join(FILE_NAME), "-wal").metadata().unwrap().len() > 0);
        assert_eq!(bring_over(&from, &to).unwrap().unwrap().accounts, 2);
        assert_eq!(names(&to), ["One#1", "Two#2"]);
        // Nothing of the copy's making is left beside the database.
        assert!(!to.join(STAGED).exists() && !sidecar(&to.join(STAGED), "-wal").exists());
        drop(running);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_store_database_in_use_is_never_replaced() {
        let (root, from, to) = folders("used");
        drop(github_database(&from));
        open_at(&to).unwrap().lock().unwrap().execute_batch("INSERT INTO accounts (id, name, sort_key) VALUES (9, 'Mine#9', 0);").unwrap();
        assert!(bring_over(&from, &to).unwrap().is_none());
        assert_eq!(names(&to), ["Mine#9"]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn an_empty_store_database_takes_the_copy() {
        let (root, from, to) = folders("empty");
        // The Store build started once before the GitHub version had anything.
        drop(open_at(&to).unwrap());
        drop(github_database(&from));
        assert_eq!(bring_over(&from, &to).unwrap().unwrap().accounts, 2);
        assert_eq!(names(&to), ["One#1", "Two#2"]);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn nothing_to_copy_and_bad_copies_change_nothing() {
        let (root, from, to) = folders("bad");
        assert!(github_folder(&to).is_none());
        assert!(bring_over(&from, &to).unwrap().is_none());
        // Not a database at all.
        fs::write(from.join(FILE_NAME), b"not a database").unwrap();
        assert!(bring_over(&from, &to).is_err());
        // A database from a newer RankDB.
        fs::remove_file(from.join(FILE_NAME)).unwrap();
        drop(github_database(&from));
        Connection::open(from.join(FILE_NAME)).unwrap().execute_batch(&format!("PRAGMA user_version = {};", MIGRATIONS.len() + 1)).unwrap();
        assert!(bring_over(&from, &to).is_err());
        // Either way: no database, no leftovers, no marker, so a later start can try again.
        assert!(!to.join(FILE_NAME).exists() && !to.join(STAGED).exists() && !to.join(MARKER).exists());
        fs::remove_dir_all(root).unwrap();
    }
}
