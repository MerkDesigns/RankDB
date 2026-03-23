use base64::Engine;
use aes_gcm::{Aes256Gcm, Nonce};
use keyring::{Entry as KeyringEntry, Error as KeyringError};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

const AES_KEY_LENGTH: usize = 32;
const GCM_NONCE_LENGTH: usize = 12;
const KEY_SALT_LENGTH: usize = 16;
const EXPORT_FORMAT: &str = "rankdb-encrypted-export-v1";
const EXPORT_PBKDF2_ITERATIONS: u32 = 600_000;
const LOCAL_KEYRING_SERVICE: &str = "RankDB";
const LOCAL_KEYRING_USER: &str = "local-db-key";
const OWAPI_PROFILE_BASE_URL: &str = "https://www.owapi.eu/stats";

#[derive(Default)]
struct AppState {
    encryption_key: Mutex<Option<Vec<u8>>>,
}

#[derive(Serialize)]
struct OwApiProfileResponse {
    status: u16,
    content_type: Option<String>,
    body_text: String,
}

#[derive(Deserialize, Serialize)]
struct EncryptedExportBundle {
    format: String,
    version: u32,
    exported_at: String,
    salt: String,
    pbkdf2_iterations: u32,
    encrypted_payload: String,
}

fn app_database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    Ok(app_data_dir.join("rankdb.sqlite3"))
}

fn backup_existing_file(path: &PathBuf, suffix: &str) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let backup_path = path.with_file_name(format!(
        "{}.{}",
        path.file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Could not resolve database file name.".to_string())?,
        suffix
    ));

    fs::rename(path, backup_path).map_err(|error| error.to_string())
}

fn reset_app_database(app: &AppHandle) -> Result<(), String> {
    let database_path = app_database_path(app)?;
    let timestamp = current_unix_timestamp();
    let backup_suffix = format!("legacy-backup-{timestamp}");
    let wal_path = PathBuf::from(format!("{}-wal", database_path.display()));
    let shm_path = PathBuf::from(format!("{}-shm", database_path.display()));

    backup_existing_file(&database_path, &backup_suffix)?;
    backup_existing_file(&wal_path, &backup_suffix)?;
    backup_existing_file(&shm_path, &backup_suffix)?;
    clear_local_key()?;

    Ok(())
}

fn open_app_database(app: &AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(app_database_path(app)?).map_err(|error| error.to_string())?;
    initialize_app_database(&connection)?;
    Ok(connection)
}

fn initialize_app_database(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS app_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              encrypted_payload BLOB NOT NULL,
              updated_at TEXT NOT NULL
            );
            ",
        )
        .map_err(|error| error.to_string())
}

fn current_unix_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

fn current_iso_timestamp() -> String {
    format!("{}Z", current_unix_timestamp())
}

fn has_stored_app_state(connection: &Connection) -> Result<bool, String> {
    connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM app_state WHERE id = 1 AND length(encrypted_payload) > 0)",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value != 0)
        .map_err(|error| error.to_string())
}

fn base64_encode(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

fn base64_decode(value: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(value)
        .map_err(|error| error.to_string())
}
mod secure_payload {
    use super::{Aes256Gcm, Nonce, AES_KEY_LENGTH, GCM_NONCE_LENGTH};
    use aes_gcm::aead::{Aead, KeyInit};
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha256;

    pub fn random_bytes<const N: usize>() -> Result<[u8; N], String> {
        let mut bytes = [0u8; N];
        getrandom::getrandom(&mut bytes).map_err(|error| error.to_string())?;
        Ok(bytes)
    }

    pub fn derive_key(password: &str, salt: &[u8], iterations: u32) -> Result<Vec<u8>, String> {
        let mut key = [0u8; AES_KEY_LENGTH];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut key);
        Ok(key.to_vec())
    }

    pub fn encrypt(key: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
        let cipher = Aes256Gcm::new_from_slice(key).map_err(|error| error.to_string())?;
        let nonce = random_bytes::<GCM_NONCE_LENGTH>()?;
        let ciphertext = cipher
            .encrypt(Nonce::from_slice(&nonce), plaintext)
            .map_err(|error| error.to_string())?;

        let mut packaged = Vec::with_capacity(nonce.len() + ciphertext.len());
        packaged.extend_from_slice(&nonce);
        packaged.extend_from_slice(&ciphertext);
        Ok(packaged)
    }

    pub fn decrypt(key: &[u8], encrypted_payload: &[u8]) -> Result<Vec<u8>, String> {
        if encrypted_payload.len() <= GCM_NONCE_LENGTH {
            return Err("Encrypted payload is too short.".into());
        }

        let (nonce, ciphertext) = encrypted_payload.split_at(GCM_NONCE_LENGTH);
        let cipher = Aes256Gcm::new_from_slice(key).map_err(|error| error.to_string())?;
        cipher
            .decrypt(Nonce::from_slice(nonce), ciphertext)
            .map_err(|error| error.to_string())
    }
}

fn local_key_entry() -> Result<KeyringEntry, String> {
    KeyringEntry::new(LOCAL_KEYRING_SERVICE, LOCAL_KEYRING_USER).map_err(|error| error.to_string())
}

fn load_local_key() -> Result<Option<Vec<u8>>, String> {
    match local_key_entry()?.get_secret() {
        Ok(secret) => Ok(Some(secret)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn store_local_key(local_key: &[u8]) -> Result<(), String> {
    local_key_entry()?
        .set_secret(local_key)
        .map_err(|error| error.to_string())
}

fn clear_local_key() -> Result<(), String> {
    match local_key_entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn load_encrypted_app_state(connection: &Connection) -> Result<Option<Vec<u8>>, String> {
    connection
        .query_row(
            "SELECT encrypted_payload FROM app_state WHERE id = 1",
            [],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn unlocked_key(state: &State<AppState>) -> Result<Vec<u8>, String> {
    state
        .encryption_key
        .lock()
        .map_err(|_| "Could not acquire encryption state lock.".to_string())?
        .clone()
        .ok_or_else(|| "Database key is unavailable.".to_string())
}

#[tauri::command]
fn ensure_app_storage_ready(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let attempt_prepare_storage = || -> Result<Vec<u8>, String> {
        let connection = open_app_database(&app)?;
        let has_existing_state = has_stored_app_state(&connection)?;
        let local_key = match load_local_key()? {
            Some(key) if key.len() == AES_KEY_LENGTH => key,
            Some(_) if !has_existing_state => {
                let key = secure_payload::random_bytes::<AES_KEY_LENGTH>()?.to_vec();
                store_local_key(&key)?;
                key
            }
            Some(_) => {
                return Err("Could not unlock the protected database. The local keyring entry is invalid and the old desktop database must be reset.".into());
            }
            None if !has_existing_state => {
                let key = secure_payload::random_bytes::<AES_KEY_LENGTH>()?.to_vec();
                store_local_key(&key)?;
                key
            }
            None => {
                return Err("Could not unlock the protected database. No local keyring entry was found for the existing desktop database.".into());
            }
        };

        if let Some(encrypted_payload) = load_encrypted_app_state(&connection)? {
            secure_payload::decrypt(&local_key, &encrypted_payload).map_err(|error| {
                format!(
                    "Could not unlock the protected database. The existing desktop payload could not be decrypted with the local keyring entry. {error}"
                )
            })?;
        }

        Ok(local_key)
    };

    let local_key = match attempt_prepare_storage() {
        Ok(key) => key,
        Err(initial_error) => {
            reset_app_database(&app)?;
            attempt_prepare_storage().map_err(|retry_error| {
                format!(
                    "{initial_error} The automatic reset also failed: {retry_error}"
                )
            })?
        }
    };

    *state
        .encryption_key
        .lock()
        .map_err(|_| "Could not acquire encryption state lock.".to_string())? = Some(local_key);

    Ok(())
}

#[tauri::command]
fn save_app_storage(app: AppHandle, state: State<AppState>, payload: Value) -> Result<(), String> {
    let key = unlocked_key(&state)?;
    let serialized_payload = serde_json::to_vec(&payload).map_err(|error| error.to_string())?;
    let encrypted_payload = secure_payload::encrypt(&key, &serialized_payload)?;
    let connection = open_app_database(&app)?;

    connection
        .execute(
            "
            INSERT INTO app_state (id, encrypted_payload, updated_at)
            VALUES (1, ?1, ?2)
            ON CONFLICT(id) DO UPDATE SET
              encrypted_payload = excluded.encrypted_payload,
              updated_at = excluded.updated_at
            ",
            params![encrypted_payload, current_unix_timestamp()],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
fn encrypt_export_payload(payload: Value, password: String) -> Result<String, String> {
    if password.trim().is_empty() {
        return Err("Export password cannot be empty.".into());
    }

    let salt = secure_payload::random_bytes::<KEY_SALT_LENGTH>()?;
    let key = secure_payload::derive_key(&password, &salt, EXPORT_PBKDF2_ITERATIONS)?;
    let serialized_payload = serde_json::to_vec(&payload).map_err(|error| error.to_string())?;
    let encrypted_payload = secure_payload::encrypt(&key, &serialized_payload)?;

    let bundle = EncryptedExportBundle {
        format: EXPORT_FORMAT.to_string(),
        version: 1,
        exported_at: current_iso_timestamp(),
        salt: base64_encode(&salt),
        pbkdf2_iterations: EXPORT_PBKDF2_ITERATIONS,
        encrypted_payload: base64_encode(&encrypted_payload),
    };

    serde_json::to_string_pretty(&bundle).map_err(|error| error.to_string())
}

#[tauri::command]
fn decrypt_export_payload(encrypted_export: String, password: String) -> Result<Value, String> {
    if password.trim().is_empty() {
        return Err("Export password cannot be empty.".into());
    }

    let bundle: EncryptedExportBundle =
        serde_json::from_str(&encrypted_export).map_err(|error| error.to_string())?;
    if bundle.format != EXPORT_FORMAT || bundle.version != 1 {
        return Err("Unsupported export file format.".into());
    }

    let salt = base64_decode(&bundle.salt)?;
    let encrypted_payload = base64_decode(&bundle.encrypted_payload)?;
    let key = secure_payload::derive_key(&password, &salt, bundle.pbkdf2_iterations)?;
    let decrypted_payload = secure_payload::decrypt(&key, &encrypted_payload)
        .map_err(|_| "Incorrect export password or corrupted export file.".to_string())?;

    serde_json::from_slice::<Value>(&decrypted_payload).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_app_storage(app: AppHandle, state: State<AppState>) -> Result<Option<Value>, String> {
    let key = unlocked_key(&state)?;
    let connection = open_app_database(&app)?;
    let encrypted_payload = load_encrypted_app_state(&connection)?;

    let Some(encrypted_payload) = encrypted_payload else {
        return Ok(None);
    };

    let decrypted_payload = secure_payload::decrypt(&key, &encrypted_payload)?;
    let payload = serde_json::from_slice::<Value>(&decrypted_payload).map_err(|error| error.to_string())?;
    Ok(Some(payload))
}

#[tauri::command]
async fn fetch_owapi_profile(
    platform: String,
    player_id: String,
) -> Result<OwApiProfileResponse, String> {
    let mut header_map = HeaderMap::new();
    header_map.insert(
        HeaderName::from_static("accept"),
        HeaderValue::from_static("application/json, text/plain, */*"),
    );
    header_map.insert(
        HeaderName::from_static("user-agent"),
        HeaderValue::from_static(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
        ),
    );
    header_map.insert(
        HeaderName::from_static("accept-language"),
        HeaderValue::from_static("en-US,en;q=0.9"),
    );

    let client = reqwest::Client::builder()
        .default_headers(header_map)
        .build()
        .map_err(|error| error.to_string())?;

    let response = client
        .get(format!("{OWAPI_PROFILE_BASE_URL}/{platform}/{player_id}/profile"))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let body_text = response
        .text()
        .await
        .map_err(|error| error.to_string())?;

    Ok(OwApiProfileResponse {
        status,
        content_type,
        body_text,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            ensure_app_storage_ready,
            save_app_storage,
            encrypt_export_payload,
            decrypt_export_payload,
            load_app_storage,
            fetch_owapi_profile
        ])
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
