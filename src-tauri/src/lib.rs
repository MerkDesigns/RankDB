use base64::Engine;
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
const GCM_TAG_LENGTH: usize = 16;
const KEY_SALT_LENGTH: usize = 16;
const EXPORT_FORMAT: &str = "rankdb-encrypted-export-v1";
const EXPORT_PBKDF2_ITERATIONS: u32 = 600_000;

#[derive(Default)]
struct AppState {
    encryption_key: Mutex<Option<Vec<u8>>>,
}

#[derive(Deserialize, Serialize)]
struct AppMetaRecord {
    protected_key: Option<Vec<u8>>,
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
            CREATE TABLE IF NOT EXISTS app_meta (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              protected_key BLOB
            );
            CREATE TABLE IF NOT EXISTS app_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              encrypted_payload BLOB NOT NULL,
              updated_at TEXT NOT NULL
            );
            ",
        )
        .map_err(|error| error.to_string())?;

    let has_protected_key = connection
        .prepare("PRAGMA table_info(app_meta)")
        .map_err(|error| error.to_string())?
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?
        .flatten()
        .any(|column_name| column_name == "protected_key");

    if !has_protected_key {
        connection
            .execute("ALTER TABLE app_meta ADD COLUMN protected_key BLOB", [])
            .map_err(|error| error.to_string())?;
    }

    Ok(())
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

fn load_app_meta(connection: &Connection) -> Result<Option<AppMetaRecord>, String> {
    connection
        .query_row(
            "SELECT protected_key FROM app_meta WHERE id = 1",
            [],
            |row| {
                Ok(AppMetaRecord {
                    protected_key: row.get(0)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
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

#[cfg(windows)]
mod secure_payload {
    use super::{AES_KEY_LENGTH, GCM_NONCE_LENGTH, GCM_TAG_LENGTH};
    use windows::core::{w, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{HLOCAL, LocalFree, NTSTATUS};
    use windows::Win32::Security::Cryptography::{
        BCryptCloseAlgorithmProvider, BCryptDeriveKeyPBKDF2, BCryptDestroyKey, BCryptEncrypt,
        BCryptDecrypt, BCryptGenRandom, BCryptGenerateSymmetricKey, BCryptGetProperty,
        BCryptOpenAlgorithmProvider, BCryptSetProperty, BCRYPT_AES_ALGORITHM,
        BCRYPT_ALG_HANDLE_HMAC_FLAG, BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO,
        BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO_VERSION,
        BCRYPT_FLAGS, BCRYPT_KEY_HANDLE, BCRYPT_OBJECT_LENGTH, BCRYPT_OPEN_ALGORITHM_PROVIDER_FLAGS,
        BCRYPT_SHA256_ALGORITHM, BCRYPT_USE_SYSTEM_PREFERRED_RNG, CRYPTPROTECT_UI_FORBIDDEN,
        CRYPT_INTEGER_BLOB, CryptProtectData, CryptUnprotectData,
    };

    fn ntstatus_to_result(status: NTSTATUS, context: &str) -> Result<(), String> {
        if status.is_ok() {
            Ok(())
        } else {
            Err(format!("{context} failed with NTSTATUS {:#x}", status.0))
        }
    }

    pub fn random_bytes<const N: usize>() -> Result<[u8; N], String> {
        let mut bytes = [0u8; N];
        ntstatus_to_result(
            unsafe { BCryptGenRandom(None, &mut bytes, BCRYPT_USE_SYSTEM_PREFERRED_RNG) },
            "BCryptGenRandom",
        )?;
        Ok(bytes)
    }

    pub fn derive_key(password: &str, salt: &[u8], iterations: u32) -> Result<Vec<u8>, String> {
        let mut sha256_handle = Default::default();
        ntstatus_to_result(
            unsafe {
                BCryptOpenAlgorithmProvider(
                    &mut sha256_handle,
                    BCRYPT_SHA256_ALGORITHM,
                    None,
                    BCRYPT_ALG_HANDLE_HMAC_FLAG,
                )
            },
            "BCryptOpenAlgorithmProvider(SHA256)",
        )?;

        let mut key = vec![0u8; AES_KEY_LENGTH];
        let derive_result = ntstatus_to_result(
            unsafe {
                BCryptDeriveKeyPBKDF2(
                    sha256_handle,
                    Some(password.as_bytes()),
                    Some(salt),
                    iterations as u64,
                    &mut key,
                    0,
                )
            },
            "BCryptDeriveKeyPBKDF2",
        );

        let _ = unsafe { BCryptCloseAlgorithmProvider(sha256_handle, 0) };
        derive_result?;
        Ok(key)
    }

    pub fn protect_local_key(key: &[u8]) -> Result<Vec<u8>, String> {
        let input_blob = CRYPT_INTEGER_BLOB {
            cbData: key.len() as u32,
            pbData: key.as_ptr() as *mut u8,
        };
        let mut output_blob = CRYPT_INTEGER_BLOB::default();

        unsafe {
            CryptProtectData(
                &input_blob,
                PCWSTR::null(),
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output_blob,
            )
        }
        .map_err(|error| error.message().to_string())?;

        let protected_key = unsafe {
            let bytes = std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize).to_vec();
            let _ = LocalFree(Some(HLOCAL(output_blob.pbData as _)));
            bytes
        };

        Ok(protected_key)
    }

    pub fn unprotect_local_key(protected_key: &[u8]) -> Result<Vec<u8>, String> {
        let input_blob = CRYPT_INTEGER_BLOB {
            cbData: protected_key.len() as u32,
            pbData: protected_key.as_ptr() as *mut u8,
        };
        let mut output_blob = CRYPT_INTEGER_BLOB::default();
        let mut description = PWSTR::null();

        unsafe {
            CryptUnprotectData(
                &input_blob,
                Some(&mut description),
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output_blob,
            )
        }
        .map_err(|error| error.message().to_string())?;

        let local_key = unsafe {
            let bytes = std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize).to_vec();
            if !description.is_null() {
                let _ = LocalFree(Some(HLOCAL(description.0 as _)));
            }
            let _ = LocalFree(Some(HLOCAL(output_blob.pbData as _)));
            bytes
        };

        Ok(local_key)
    }

    fn create_aes_key_handle(
        key: &[u8],
    ) -> Result<
        (
            windows::Win32::Security::Cryptography::BCRYPT_ALG_HANDLE,
            BCRYPT_KEY_HANDLE,
            Vec<u8>,
        ),
        String,
    > {
        let mut aes_handle = Default::default();
        ntstatus_to_result(
            unsafe {
                BCryptOpenAlgorithmProvider(
                    &mut aes_handle,
                    BCRYPT_AES_ALGORITHM,
                    None,
                    BCRYPT_OPEN_ALGORITHM_PROVIDER_FLAGS(0),
                )
            },
            "BCryptOpenAlgorithmProvider(AES)",
        )?;

        let chain_mode_bytes: Vec<u8> = "ChainingModeGCM\0"
            .encode_utf16()
            .flat_map(|value| value.to_le_bytes())
            .collect();
        ntstatus_to_result(
            unsafe { BCryptSetProperty(aes_handle.into(), w!("ChainingMode"), &chain_mode_bytes, 0) },
            "BCryptSetProperty(ChainingModeGCM)",
        )?;

        let mut object_length_bytes = [0u8; 4];
        let mut property_result_length = 0u32;
        ntstatus_to_result(
            unsafe {
                BCryptGetProperty(
                    aes_handle.into(),
                    BCRYPT_OBJECT_LENGTH,
                    Some(&mut object_length_bytes),
                    &mut property_result_length,
                    0,
                )
            },
            "BCryptGetProperty(ObjectLength)",
        )?;

        let object_length = u32::from_le_bytes(object_length_bytes) as usize;
        let mut key_object = vec![0u8; object_length];
        let mut key_handle = Default::default();
        let generate_result = ntstatus_to_result(
            unsafe {
                BCryptGenerateSymmetricKey(
                    aes_handle,
                    &mut key_handle,
                    Some(&mut key_object),
                    key,
                    0,
                )
            },
            "BCryptGenerateSymmetricKey",
        );

        if let Err(error) = generate_result {
            let _ = unsafe { BCryptCloseAlgorithmProvider(aes_handle, 0) };
            return Err(error);
        }

        Ok((aes_handle, key_handle, key_object))
    }

    pub fn encrypt(key: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
        let nonce = random_bytes::<GCM_NONCE_LENGTH>()?;
        let mut tag = vec![0u8; GCM_TAG_LENGTH];
        let (alg_handle, key_handle, _key_object) = create_aes_key_handle(key)?;

        let auth_info = BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO {
            cbSize: std::mem::size_of::<BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO>() as u32,
            dwInfoVersion: BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO_VERSION,
            pbNonce: nonce.as_ptr() as *mut u8,
            cbNonce: nonce.len() as u32,
            pbTag: tag.as_mut_ptr(),
            cbTag: tag.len() as u32,
            ..Default::default()
        };

        let mut encrypted = vec![0u8; plaintext.len()];
        let mut encrypted_len = 0u32;
        let encrypt_result = ntstatus_to_result(
            unsafe {
                BCryptEncrypt(
                    key_handle,
                    Some(plaintext),
                    Some(&auth_info as *const _ as *const core::ffi::c_void),
                    None,
                    Some(&mut encrypted),
                    &mut encrypted_len,
                    BCRYPT_FLAGS(0),
                )
            },
            "BCryptEncrypt",
        );

        let _ = unsafe { BCryptDestroyKey(key_handle) };
        let _ = unsafe { BCryptCloseAlgorithmProvider(alg_handle, 0) };
        if let Err(error) = encrypt_result {
            return Err(error);
        }

        encrypted.truncate(encrypted_len as usize);
        let mut packaged = Vec::with_capacity(nonce.len() + tag.len() + encrypted.len());
        packaged.extend_from_slice(&nonce);
        packaged.extend_from_slice(&tag);
        packaged.extend_from_slice(&encrypted);
        Ok(packaged)
    }

    pub fn decrypt(key: &[u8], encrypted_payload: &[u8]) -> Result<Vec<u8>, String> {
        if encrypted_payload.len() < GCM_NONCE_LENGTH + GCM_TAG_LENGTH {
            return Err("Encrypted payload is too short.".into());
        }

        let (nonce, remainder) = encrypted_payload.split_at(GCM_NONCE_LENGTH);
        let (tag, ciphertext) = remainder.split_at(GCM_TAG_LENGTH);
        let (alg_handle, key_handle, _key_object) = create_aes_key_handle(key)?;
        let mut tag_copy = tag.to_vec();

        let auth_info = BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO {
            cbSize: std::mem::size_of::<BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO>() as u32,
            dwInfoVersion: BCRYPT_AUTHENTICATED_CIPHER_MODE_INFO_VERSION,
            pbNonce: nonce.as_ptr() as *mut u8,
            cbNonce: nonce.len() as u32,
            pbTag: tag_copy.as_mut_ptr(),
            cbTag: tag_copy.len() as u32,
            ..Default::default()
        };

        let mut decrypted = vec![0u8; ciphertext.len()];
        let mut decrypted_len = 0u32;
        let decrypt_result = ntstatus_to_result(
            unsafe {
                BCryptDecrypt(
                    key_handle,
                    Some(ciphertext),
                    Some(&auth_info as *const _ as *const core::ffi::c_void),
                    None,
                    Some(&mut decrypted),
                    &mut decrypted_len,
                    BCRYPT_FLAGS(0),
                )
            },
            "BCryptDecrypt",
        );

        let _ = unsafe { BCryptDestroyKey(key_handle) };
        let _ = unsafe { BCryptCloseAlgorithmProvider(alg_handle, 0) };
        decrypt_result?;
        decrypted.truncate(decrypted_len as usize);
        Ok(decrypted)
    }
}

#[cfg(not(windows))]
mod secure_payload {
    pub fn random_bytes<const N: usize>() -> Result<[u8; N], String> {
        Err("Secure local storage is only implemented for Windows builds.".into())
    }

    pub fn derive_key(_password: &str, _salt: &[u8], _iterations: u32) -> Result<Vec<u8>, String> {
        Err("Encrypted export/import is only implemented for Windows builds.".into())
    }

    pub fn encrypt(_key: &[u8], _plaintext: &[u8]) -> Result<Vec<u8>, String> {
        Err("Secure local storage is only implemented for Windows builds.".into())
    }

    pub fn decrypt(_key: &[u8], _encrypted_payload: &[u8]) -> Result<Vec<u8>, String> {
        Err("Secure local storage is only implemented for Windows builds.".into())
    }

    pub fn protect_local_key(_key: &[u8]) -> Result<Vec<u8>, String> {
        Err("Secure local storage is only implemented for Windows builds.".into())
    }

    pub fn unprotect_local_key(_protected_key: &[u8]) -> Result<Vec<u8>, String> {
        Err("Secure local storage is only implemented for Windows builds.".into())
    }
}

fn unlocked_key(state: &State<AppState>) -> Result<Vec<u8>, String> {
    state
        .encryption_key
        .lock()
        .map_err(|_| "Could not acquire encryption state lock.".to_string())?
        .clone()
        .ok_or_else(|| "Database key is unavailable.".to_string())
}

fn store_local_key(connection: &Connection, local_key: &[u8]) -> Result<(), String> {
    let protected_key = secure_payload::protect_local_key(local_key)?;
    connection
        .execute(
            "
            INSERT INTO app_meta (id, protected_key) VALUES (1, ?1)
            ON CONFLICT(id) DO UPDATE SET protected_key = excluded.protected_key
            ",
            params![protected_key],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn ensure_app_storage_ready(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let connection = open_app_database(&app)?;
    let has_existing_state = has_stored_app_state(&connection)?;
    let local_key = if let Some(meta) = load_app_meta(&connection)? {
        if let Some(protected_key) = meta.protected_key {
            if protected_key.is_empty() {
                let key = secure_payload::random_bytes::<AES_KEY_LENGTH>()?.to_vec();
                store_local_key(&connection, &key)?;
                key
            } else {
                match secure_payload::unprotect_local_key(&protected_key) {
                    Ok(key) => key,
                    Err(error) if !has_existing_state => {
                        let key = secure_payload::random_bytes::<AES_KEY_LENGTH>()?.to_vec();
                        store_local_key(&connection, &key)?;
                        key
                    }
                    Err(error) => {
                        return Err(format!(
                            "Could not unlock the protected database. Existing encrypted data is present, so the local key could not be regenerated safely. {error}"
                        ));
                    }
                }
            }
        } else {
            let key = secure_payload::random_bytes::<AES_KEY_LENGTH>()?.to_vec();
            store_local_key(&connection, &key)?;
            key
        }
    } else {
        let key = secure_payload::random_bytes::<AES_KEY_LENGTH>()?.to_vec();
        store_local_key(&connection, &key)?;
        key
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
    let encrypted_payload = connection
        .query_row(
            "SELECT encrypted_payload FROM app_state WHERE id = 1",
            [],
            |row| row.get::<_, Vec<u8>>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(encrypted_payload) = encrypted_payload else {
        return Ok(None);
    };

    let decrypted_payload = secure_payload::decrypt(&key, &encrypted_payload)?;
    let payload = serde_json::from_slice::<Value>(&decrypted_payload).map_err(|error| error.to_string())?;
    Ok(Some(payload))
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
            load_app_storage
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
