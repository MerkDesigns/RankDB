//! Backups (Settings → Data): the whole database in one password-encrypted file, to move RankDB to
//! another PC or a fresh installation. Importing one replaces everything: accounts, groups, past
//! ranks, settings and credential protection. RankDB 0.3's exports are read by `legacy.rs`; they
//! replace only the accounts and groups.
//!
//! The file is JSON, `{ format, version, schema, exportedAt, salt, iterations, data }`: `data` is a
//! `VACUUM INTO` copy of the database, sealed with AES-256-GCM under a PBKDF2-SHA256 key from the
//! backup password. Credentials inside keep the protection they had, so with a master password
//! they need that password again after an import. Before any import the current database is
//! copied aside (`upgrade-copies/rankdb-before-import.sqlite3`).

use super::*;
use base64::Engine;
use rusqlite::backup::Backup;
use tauri_plugin_dialog::DialogExt;
use zeroize::Zeroizing;

use crate::secrets::{random_bytes, Secrets};

const FORMAT: &str = "rankdb-backup";
const VERSION: u32 = 1;
const ITERATIONS: u32 = 600_000;
/// Ties the sealed data to this file format.
const BINDING: &str = "rankdb:backup:v1";
const EXTENSION: &str = "rankdb-backup";
/// Far above any real roster; a wrong file isn't read whole.
const MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;
/// The database as it was before the latest import. It sits with the upgrade copies, so credential
/// protection changes convert it along with them.
pub(super) const BEFORE_IMPORT: &str = "rankdb-before-import.sqlite3";

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile {
    format: String,
    version: u32,
    /// The schema version of the database inside (`user_version`).
    schema: i64,
    exported_at: String,
    salt: String,
    iterations: u32,
    data: String,
}

/// Which file the picker asks for.
#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum TransferFile {
    ExportBackup,
    ImportBackup,
    LegacyExport,
}

/// Opens the save or open dialog for a backup or a 0.3 export. Null when cancelled.
#[tauri::command]
pub async fn choose_transfer_file(app: AppHandle, database: State<'_, Database>, file: TransferFile) -> Result<Option<String>, String> {
    let today: String = database
        .lock()?
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .map_err(to_message)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file();
        if let Some(window) = app.get_webview_window("main") {
            dialog = dialog.set_parent(&window);
        }
        let picked = match file {
            TransferFile::ExportBackup => dialog
                .add_filter(crate::text::text("dataTransfer.fileTypes.backup"), &[EXTENSION])
                .set_file_name(crate::text::format("dataTransfer.backupFileName", &[("date", today)]))
                .blocking_save_file(),
            TransferFile::ImportBackup => dialog.add_filter(crate::text::text("dataTransfer.fileTypes.backup"), &[EXTENSION]).blocking_pick_file(),
            TransferFile::LegacyExport => dialog
                .add_filter(crate::text::text("dataTransfer.fileTypes.legacy"), &[legacy::EXPORT_EXTENSION])
                .blocking_pick_file(),
        };
        picked.and_then(|path| path.into_path().ok()).map(|path| path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|error| error.to_string())
}

/// Writes everything into a backup at `path`, encrypted with `password`.
#[tauri::command]
pub async fn export_backup(database: State<'_, Database>, path: String, password: String) -> Result<(), String> {
    write_backup(&database, Path::new(&path), &password)
}

/// Replaces everything with the backup at `path`. Returns how many accounts it holds.
#[tauri::command]
pub async fn import_backup(database: State<'_, Database>, path: String, password: String) -> Result<ImportSummary, String> {
    let file = read_file(Path::new(&path))?;
    restore_backup(&database, &file, &password)
}

/// Replaces the accounts and groups with those of a RankDB 0.3 export; settings stay.
#[tauri::command]
pub async fn import_legacy_export(database: State<'_, Database>, path: String, password: String) -> Result<ImportSummary, String> {
    let file = read_file(Path::new(&path))?;
    let mut connection = database.lock()?;
    keep_before_import(&connection, &database.dir)?;
    legacy::replace_from_export(&mut connection, &database.secrets, &file, &password)
}

fn read_file(path: &Path) -> Result<Vec<u8>, String> {
    let failed = |error: String| crate::text::format("errors.backup.readFailed", &[("error", error)]);
    let size = fs::metadata(path).map_err(|error| failed(error.to_string()))?.len();
    if size > MAX_FILE_BYTES {
        return Err(crate::text::text("errors.backup.unreadable").into());
    }
    fs::read(path).map_err(|error| failed(error.to_string()))
}

fn validate_password(password: &str) -> Result<(), String> {
    if !(1..=1024).contains(&password.chars().count()) {
        return Err(crate::text::text("errors.backup.invalidPassword").into());
    }
    Ok(())
}

pub(crate) fn write_backup(database: &Database, path: &Path, password: &str) -> Result<(), String> {
    validate_password(password)?;
    let failed = |error: String| crate::text::format("errors.backup.writeFailed", &[("error", error)]);
    let (schema, exported_at, bytes) = {
        let connection = database.lock()?;
        let copy = database.dir.join("backup.partial");
        let _ = fs::remove_file(&copy);
        let result = (|| -> Result<_, String> {
            connection.execute("VACUUM INTO ?1", [copy.to_string_lossy()]).map_err(to_message)?;
            let bytes = Zeroizing::new(fs::read(&copy).map_err(|error| error.to_string())?);
            let exported_at: String = connection
                .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| row.get(0))
                .map_err(to_message)?;
            Ok((schema_version(&connection)?, exported_at, bytes))
        })();
        let _ = fs::remove_file(&copy);
        result.map_err(failed)?
    };
    let salt = random_bytes(16)?;
    let sealed = Secrets::from_password(password, &salt, ITERATIONS)?.seal_bytes(&bytes, BINDING)?;
    let encode = |value: &[u8]| base64::engine::general_purpose::STANDARD.encode(value);
    let file = BackupFile {
        format: FORMAT.into(),
        version: VERSION,
        schema,
        exported_at,
        salt: encode(&salt),
        iterations: ITERATIONS,
        data: encode(&sealed),
    };
    let json = serde_json::to_vec_pretty(&file).map_err(|error| failed(error.to_string()))?;
    // Written under a temporary name first, so a failure never leaves half a backup that looks whole.
    let partial = path.with_extension("partial");
    fs::write(&partial, json).map_err(|error| failed(error.to_string()))?;
    fs::rename(&partial, path).map_err(|error| {
        let _ = fs::remove_file(&partial);
        failed(error.to_string())
    })
}

pub(crate) fn restore_backup(database: &Database, file: &[u8], password: &str) -> Result<ImportSummary, String> {
    let unreadable = || crate::text::text("errors.backup.unreadable").to_string();
    let backup: BackupFile = serde_json::from_slice(file).map_err(|_| unreadable())?;
    if backup.format != FORMAT || backup.version != VERSION || !(1..=2_000_000).contains(&backup.iterations) {
        return Err(unreadable());
    }
    if backup.schema > MIGRATIONS.len() as i64 {
        return Err(crate::text::text("errors.backup.newerVersion").into());
    }
    let decode = |value: &str| base64::engine::general_purpose::STANDARD.decode(value).map_err(|_| unreadable());
    let bytes = Zeroizing::new(
        Secrets::from_password(password, &decode(&backup.salt)?, backup.iterations)?
            .open_bytes(&decode(&backup.data)?, BINDING)
            .map_err(|_| crate::text::text("errors.backup.wrongPassword").to_string())?,
    );

    // The backup is opened, checked and brought up to this version's schema as its own file
    // first; only then does it replace the database, in one step.
    let staged = database.dir.join("import.partial");
    let remove_staged = || {
        for suffix in ["", "-journal", "-wal", "-shm"] {
            let _ = fs::remove_file(format!("{}{suffix}", staged.to_string_lossy()));
        }
    };
    remove_staged();
    let result = (|| -> Result<ImportSummary, String> {
        fs::write(&staged, &*bytes).map_err(|error| crate::text::format("errors.backup.readFailed", &[("error", error.to_string())]))?;
        let mut source = Connection::open(&staged).map_err(|_| unreadable())?;
        source.execute_batch("PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;").map_err(|_| unreadable())?;
        let healthy: String = source.query_row("PRAGMA quick_check", [], |row| row.get(0)).map_err(|_| unreadable())?;
        if healthy != "ok" {
            return Err(unreadable());
        }
        if schema_version(&source)? > MIGRATIONS.len() as i64 {
            return Err(crate::text::text("errors.backup.newerVersion").into());
        }
        migrate(&mut source)?;
        // Its credential protection must be one this version can open.
        Vault::load(&source)?;
        let accounts: i64 = source.query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0)).map_err(to_message)?;

        let mut connection = database.lock()?;
        keep_before_import(&connection, &database.dir)?;
        let replaced = Backup::new(&source, &mut connection).and_then(|backup| backup.run_to_completion(256, Duration::ZERO, None));
        replaced.map_err(|error| crate::text::format("errors.backup.replaceFailed", &[("error", error.to_string())]))?;
        connection.execute_batch("PRAGMA journal_mode = WAL;").map_err(to_message)?;
        // The credentials now follow the backup's protection (locked, with a master password).
        database.secrets.reload(&connection)?;
        connection
            .execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('installedOn', json_quote(date('now')))", [])
            .map_err(to_message)?;
        Ok(ImportSummary { accounts: accounts as usize })
    })();
    remove_staged();
    result
}

/// Copies the database aside before an import replaces (part of) it: one step back from a wrong
/// file. Only the latest is kept.
fn keep_before_import(connection: &Connection, dir: &Path) -> Result<(), String> {
    let failed = |error: String| crate::text::format("errors.backup.safetyCopyFailed", &[("error", error)]);
    let folder = dir.join(UPGRADE_COPIES);
    fs::create_dir_all(&folder).map_err(|error| failed(error.to_string()))?;
    let partial = folder.join("rankdb-before-import.partial");
    let _ = fs::remove_file(&partial);
    connection
        .execute("VACUUM INTO ?1", [partial.to_string_lossy()])
        .map_err(|error| failed(error.to_string()))?;
    fs::rename(&partial, folder.join(BEFORE_IMPORT)).map_err(|error| failed(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn folder(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("rankdb-backup-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    fn fill(database: &Database, name: &str, accent: &str) {
        let connection = database.lock().unwrap();
        connection.execute("INSERT INTO accounts (name, sort_key) VALUES (?1, 0)", [name]).unwrap();
        let id = connection.last_insert_rowid();
        connection.execute("INSERT INTO credentials (account_id, email) VALUES (?1, ?2)", params![id, format!("{name}@example.com").as_bytes()]).unwrap();
        connection.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('accentColor', json_quote(?1))", [accent]).unwrap();
    }

    fn names(database: &Database) -> Vec<String> {
        let connection = database.lock().unwrap();
        let mut statement = connection.prepare("SELECT name FROM accounts ORDER BY name").unwrap();
        statement.query_map([], |row| row.get(0)).unwrap().map(Result::unwrap).collect()
    }

    fn accent(database: &Database) -> String {
        database.lock().unwrap().query_row("SELECT json_extract(value, '$') FROM settings WHERE key = 'accentColor'", [], |row| row.get(0)).unwrap()
    }

    #[test]
    fn a_backup_replaces_everything_and_keeps_a_copy_of_what_was_there() {
        let (from_dir, to_dir) = (folder("from"), folder("to"));
        let from = open_at(&from_dir).unwrap();
        fill(&from, "Old#1", "#111111");
        let file = from_dir.join("test.rankdb-backup");
        write_backup(&from, &file, "backup password").unwrap();
        let bytes = fs::read(&file).unwrap();
        // The file holds nothing readable.
        assert!(!bytes.windows(b"Old#1".len()).any(|window| window == b"Old#1"));

        let to = open_at(&to_dir).unwrap();
        fill(&to, "Mine#2", "#222222");
        assert!(restore_backup(&to, &bytes, "wrong password").is_err());
        assert_eq!(names(&to), ["Mine#2"]);

        let summary = restore_backup(&to, &bytes, "backup password").unwrap();
        assert_eq!(summary.accounts, 1);
        assert_eq!(names(&to), ["Old#1"]);
        assert_eq!(accent(&to), "#111111");
        let id: i64 = to.lock().unwrap().query_row("SELECT id FROM accounts", [], |row| row.get(0)).unwrap();
        assert_eq!(read_secret(&to, &to.lock().unwrap(), id, SecretField::Email).unwrap().as_deref(), Some("Old#1@example.com"));
        let before = Connection::open(to_dir.join(UPGRADE_COPIES).join(BEFORE_IMPORT)).unwrap();
        let kept: String = before.query_row("SELECT name FROM accounts", [], |row| row.get(0)).unwrap();
        assert_eq!(kept, "Mine#2");
        drop((before, from, to));
        // Reopening finds the restored data.
        assert_eq!(names(&open_at(&to_dir).unwrap()), ["Old#1"]);
        let _ = (fs::remove_dir_all(from_dir), fs::remove_dir_all(to_dir));
    }

    #[test]
    fn a_master_password_comes_along_locked() {
        let (from_dir, to_dir) = (folder("protected-from"), folder("protected-to"));
        let from = open_at(&from_dir).unwrap();
        fill(&from, "Old#1", "#111111");
        {
            let mut connection = from.lock().unwrap();
            from.secrets.configure(&mut connection, &[], true, "master", "").unwrap();
        }
        let file = from_dir.join("test.rankdb-backup");
        write_backup(&from, &file, "backup password").unwrap();
        let to = open_at(&to_dir).unwrap();
        restore_backup(&to, &fs::read(&file).unwrap(), "backup password").unwrap();
        let id: i64 = to.lock().unwrap().query_row("SELECT id FROM accounts", [], |row| row.get(0)).unwrap();
        assert!(read_secret(&to, &to.lock().unwrap(), id, SecretField::Email).is_err());
        to.secrets.unlock("master").unwrap();
        assert_eq!(read_secret(&to, &to.lock().unwrap(), id, SecretField::Email).unwrap().as_deref(), Some("Old#1@example.com"));
        drop((from, to));
        let _ = (fs::remove_dir_all(from_dir), fs::remove_dir_all(to_dir));
    }

    #[test]
    fn newer_or_foreign_files_are_refused() {
        let dir = folder("refused");
        let database = open_at(&dir).unwrap();
        fill(&database, "Mine#1", "#222222");
        let file = dir.join("test.rankdb-backup");
        write_backup(&database, &file, "pw").unwrap();
        let mut backup: serde_json::Value = serde_json::from_slice(&fs::read(&file).unwrap()).unwrap();
        backup["schema"] = (MIGRATIONS.len() as i64 + 1).into();
        assert!(restore_backup(&database, backup.to_string().as_bytes(), "pw").is_err());
        assert!(restore_backup(&database, b"{\"format\":\"something else\"}", "pw").is_err());
        assert!(restore_backup(&database, b"not json", "pw").is_err());
        assert_eq!(names(&database), ["Mine#1"]);
        drop(database);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn an_older_schema_is_brought_up_to_date() {
        let dir = folder("older");
        let database = open_at(&dir).unwrap();
        // A schema-4 database (as 1.0's predecessors left it), with one account.
        let old_path = dir.join("old.sqlite3");
        let old = Connection::open(&old_path).unwrap();
        for (index, migration) in MIGRATIONS.iter().take(4).enumerate() {
            old.execute_batch(migration).unwrap();
            old.execute_batch(&format!("PRAGMA user_version = {}", index + 1)).unwrap();
        }
        old.execute("INSERT INTO accounts (name, sort_key) VALUES ('Old#1', 0)", []).unwrap();
        drop(old);
        let salt = random_bytes(16).unwrap();
        let sealed = Secrets::from_password("pw", &salt, 1).unwrap().seal_bytes(&fs::read(&old_path).unwrap(), BINDING).unwrap();
        let encode = |value: &[u8]| base64::engine::general_purpose::STANDARD.encode(value);
        let file = BackupFile { format: FORMAT.into(), version: VERSION, schema: 4, exported_at: String::new(), salt: encode(&salt), iterations: 1, data: encode(&sealed) };
        restore_backup(&database, &serde_json::to_vec(&file).unwrap(), "pw").unwrap();
        assert_eq!(names(&database), ["Old#1"]);
        assert_eq!(schema_version(&database.lock().unwrap()).unwrap(), MIGRATIONS.len() as i64);
        drop(database);
        let _ = fs::remove_dir_all(dir);
    }
}
