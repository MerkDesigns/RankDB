use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
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
const UPDATE_RECOVERY_FORMAT: &str = "rankdb-update-recovery-v1";
const UPDATE_RECOVERY_FILE_NAME: &str = "update-recovery.rankdb-recovery";
const OWAPI_PROFILE_BASE_URL: &str = "https://www.owapi.eu/stats";
const CUSTOM_THEMES_DIR_NAME: &str = "custom-themes";
const THEME_FILE_FORMAT: &str = "rankdb-theme";
const THEME_FILE_SCHEMA_VERSION: u32 = 1;
const THEME_TOKEN_KEYS: [&str; 13] = [
    "appBackground",
    "headerSurface",
    "headerIcon",
    "panelSurface",
    "panelSurfaceRaised",
    "rowPrimarySurface",
    "borderSubtle",
    "textPrimary",
    "textMuted",
    "hoverSurface",
    "accent",
    "toggleAccent",
    "bannedAccent",
];

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

#[derive(Deserialize, Serialize)]
struct UpdateRecoveryBundle {
    format: String,
    version: u32,
    created_at: String,
    protected_payload: String,
}

#[derive(Serialize)]
struct UpdateRecoveryMetadata {
    created_at: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ThemeBakeTokens {
    app_background: String,
    header_surface: String,
    #[serde(default = "default_theme_header_icon")]
    header_icon: String,
    panel_surface: String,
    panel_surface_raised: String,
    row_primary_surface: String,
    border_subtle: String,
    text_primary: String,
    text_muted: String,
    hover_surface: String,
    accent: String,
    toggle_accent: String,
    banned_accent: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CustomThemeFile {
    #[serde(default = "default_theme_file_format")]
    format: String,
    #[serde(default = "default_theme_file_schema_version")]
    schema_version: u32,
    id: String,
    name: String,
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    updated_at: String,
    tokens: ThemeBakeTokens,
}

fn default_theme_file_format() -> String {
    THEME_FILE_FORMAT.to_string()
}

fn default_theme_file_schema_version() -> u32 {
    THEME_FILE_SCHEMA_VERSION
}

fn default_theme_header_icon() -> String {
    "#f1f5f9".to_string()
}

fn app_database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;
    Ok(app_data_dir.join("rankdb.sqlite3"))
}

fn update_recovery_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let recovery_dir = app_data_dir.join("recovery");
    fs::create_dir_all(&recovery_dir).map_err(|error| error.to_string())?;
    Ok(recovery_dir.join(UPDATE_RECOVERY_FILE_NAME))
}

fn custom_themes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let themes_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(CUSTOM_THEMES_DIR_NAME);
    fs::create_dir_all(&themes_dir).map_err(|error| error.to_string())?;
    Ok(themes_dir)
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
    let connection =
        Connection::open(app_database_path(app)?).map_err(|error| error.to_string())?;
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

#[cfg(windows)]
mod local_recovery {
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    pub fn protect(plaintext: &[u8]) -> Result<Vec<u8>, String> {
        let input_blob = CRYPT_INTEGER_BLOB {
            cbData: plaintext.len() as u32,
            pbData: plaintext.as_ptr() as *mut u8,
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

        let protected_payload = unsafe {
            let bytes = std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize)
                .to_vec();
            let _ = LocalFree(HLOCAL(output_blob.pbData as _));
            bytes
        };

        Ok(protected_payload)
    }

    pub fn unprotect(protected_payload: &[u8]) -> Result<Vec<u8>, String> {
        let input_blob = CRYPT_INTEGER_BLOB {
            cbData: protected_payload.len() as u32,
            pbData: protected_payload.as_ptr() as *mut u8,
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

        let plaintext = unsafe {
            let bytes = std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize)
                .to_vec();
            if !description.is_null() {
                let _ = LocalFree(HLOCAL(description.0 as _));
            }
            let _ = LocalFree(HLOCAL(output_blob.pbData as _));
            bytes
        };

        Ok(plaintext)
    }
}

#[cfg(not(windows))]
mod local_recovery {
    pub fn protect(plaintext: &[u8]) -> Result<Vec<u8>, String> {
        Ok(plaintext.to_vec())
    }

    pub fn unprotect(protected_payload: &[u8]) -> Result<Vec<u8>, String> {
        Ok(protected_payload.to_vec())
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

fn prepare_app_storage_key(app: &AppHandle) -> Result<Vec<u8>, String> {
    let connection = open_app_database(app)?;
    let has_existing_state = has_stored_app_state(&connection)?;
    let local_key = match load_local_key()? {
        Some(key) if key.len() == AES_KEY_LENGTH => key,
        Some(_) if !has_existing_state => {
            let key = secure_payload::random_bytes::<AES_KEY_LENGTH>()?.to_vec();
            store_local_key(&key)?;
            key
        }
        Some(_) => {
            return Err("Could not unlock the protected database. The local keyring entry is invalid for the existing desktop database.".into());
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
}

fn set_unlocked_key(state: &State<AppState>, local_key: Vec<u8>) -> Result<(), String> {
    *state
        .encryption_key
        .lock()
        .map_err(|_| "Could not acquire encryption state lock.".to_string())? = Some(local_key);
    Ok(())
}

fn save_app_storage_payload(
    app: &AppHandle,
    state: &State<AppState>,
    payload: &Value,
) -> Result<(), String> {
    let key = unlocked_key(state)?;
    let serialized_payload = serde_json::to_vec(payload).map_err(|error| error.to_string())?;
    let encrypted_payload = secure_payload::encrypt(&key, &serialized_payload)?;
    let connection = open_app_database(app)?;

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

fn write_update_recovery_backup(
    app: &AppHandle,
    payload: &Value,
) -> Result<UpdateRecoveryMetadata, String> {
    let serialized_payload = serde_json::to_vec(payload).map_err(|error| error.to_string())?;
    let protected_payload = local_recovery::protect(&serialized_payload)?;
    let created_at = current_iso_timestamp();
    let bundle = UpdateRecoveryBundle {
        format: UPDATE_RECOVERY_FORMAT.to_string(),
        version: 1,
        created_at: created_at.clone(),
        protected_payload: base64_encode(&protected_payload),
    };
    let serialized_bundle =
        serde_json::to_vec_pretty(&bundle).map_err(|error| error.to_string())?;
    fs::write(update_recovery_path(app)?, serialized_bundle).map_err(|error| error.to_string())?;
    Ok(UpdateRecoveryMetadata { created_at })
}

fn read_update_recovery_bundle(app: &AppHandle) -> Result<Option<UpdateRecoveryBundle>, String> {
    let recovery_path = update_recovery_path(app)?;
    if !recovery_path.exists() {
        return Ok(None);
    }

    let raw_bundle = fs::read_to_string(recovery_path).map_err(|error| error.to_string())?;
    let bundle = serde_json::from_str::<UpdateRecoveryBundle>(&raw_bundle)
        .map_err(|error| error.to_string())?;
    if bundle.format != UPDATE_RECOVERY_FORMAT || bundle.version != 1 {
        return Err("Unsupported automatic update recovery backup format.".into());
    }

    Ok(Some(bundle))
}

fn read_update_recovery_payload(app: &AppHandle) -> Result<Option<Value>, String> {
    let Some(bundle) = read_update_recovery_bundle(app)? else {
        return Ok(None);
    };

    let protected_payload = base64_decode(&bundle.protected_payload)?;
    let decrypted_payload = local_recovery::unprotect(&protected_payload)?;
    let payload =
        serde_json::from_slice::<Value>(&decrypted_payload).map_err(|error| error.to_string())?;
    Ok(Some(payload))
}

fn clear_update_recovery_backup_file(app: &AppHandle) -> Result<(), String> {
    let recovery_path = update_recovery_path(app)?;
    if !recovery_path.exists() {
        return Ok(());
    }

    fs::remove_file(recovery_path).map_err(|error| error.to_string())
}

fn validate_theme_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..]
            .chars()
            .all(|character| character.is_ascii_hexdigit())
}

fn theme_token_entries(tokens: &ThemeBakeTokens) -> [(&'static str, &str); 13] {
    [
        ("appBackground", &tokens.app_background),
        ("headerSurface", &tokens.header_surface),
        ("headerIcon", &tokens.header_icon),
        ("panelSurface", &tokens.panel_surface),
        ("panelSurfaceRaised", &tokens.panel_surface_raised),
        ("rowPrimarySurface", &tokens.row_primary_surface),
        ("borderSubtle", &tokens.border_subtle),
        ("textPrimary", &tokens.text_primary),
        ("textMuted", &tokens.text_muted),
        ("hoverSurface", &tokens.hover_surface),
        ("accent", &tokens.accent),
        ("toggleAccent", &tokens.toggle_accent),
        ("bannedAccent", &tokens.banned_accent),
    ]
}

fn validate_theme_tokens(tokens: &ThemeBakeTokens) -> Result<(), String> {
    for (key, value) in theme_token_entries(tokens) {
        if !validate_theme_color(value) {
            return Err(format!("{key} must be a six-digit hex color."));
        }
    }

    Ok(())
}

fn format_theme_tokens(tokens: &ThemeBakeTokens, indent: &str) -> String {
    let entries = theme_token_entries(tokens);
    let mut formatted = String::from("{\n");
    for (index, (key, value)) in entries.iter().enumerate() {
        let trailing_comma = if index + 1 == THEME_TOKEN_KEYS.len() {
            ""
        } else {
            ","
        };
        formatted.push_str(&format!("{indent}  {key}: '{value}'{trailing_comma}\n"));
    }
    formatted.push_str(indent);
    formatted.push('}');
    formatted
}

fn find_matching_brace_end(content: &str, open_brace: usize) -> Result<usize, String> {
    let mut depth = 0usize;
    for (offset, character) in content[open_brace..].char_indices() {
        match character {
            '{' => depth += 1,
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Ok(open_brace + offset + character.len_utf8());
                }
            }
            _ => {}
        }
    }

    Err("Could not find the end of the theme token object.".into())
}

fn replace_default_theme_tokens(content: &str, tokens: &ThemeBakeTokens) -> Result<String, String> {
    let marker = "const DEFAULT_THEME_TOKENS: Record<ThemeTokenKey, string> = ";
    let start = content
        .find(marker)
        .ok_or_else(|| "Could not find DEFAULT_THEME_TOKENS.".to_string())?;
    let object_start = start + marker.len();
    let object_end = find_matching_brace_end(content, object_start)?;
    let replacement = format_theme_tokens(tokens, "");

    Ok(format!(
        "{}{}{}",
        &content[..object_start],
        replacement,
        &content[object_end..]
    ))
}

fn replace_preset_theme_tokens(
    content: &str,
    theme_id: &str,
    tokens: &ThemeBakeTokens,
) -> Result<String, String> {
    if theme_id == "preset-rankdb-default" {
        return replace_default_theme_tokens(content, tokens);
    }

    let id_marker = format!("id: '{theme_id}'");
    let id_start = content
        .find(&id_marker)
        .ok_or_else(|| format!("Could not find preset theme {theme_id}."))?;
    let tokens_marker_start = content[id_start..]
        .find("tokens:")
        .map(|offset| id_start + offset)
        .ok_or_else(|| format!("Could not find tokens for preset theme {theme_id}."))?;
    let relative_object_start = content[tokens_marker_start..]
        .find('{')
        .ok_or_else(|| format!("Could not find token object for preset theme {theme_id}."))?;
    let object_start = tokens_marker_start + relative_object_start;
    let object_end = find_matching_brace_end(content, object_start)?;
    let replacement = format_theme_tokens(tokens, "      ");

    Ok(format!(
        "{}{}{}",
        &content[..object_start],
        replacement,
        &content[object_end..]
    ))
}

fn sanitize_theme_file_stem(value: &str) -> String {
    let mut sanitized = String::new();
    let mut last_was_dash = false;

    for character in value.chars().flat_map(|character| character.to_lowercase()) {
        if character.is_ascii_alphanumeric() {
            sanitized.push(character);
            last_was_dash = false;
        } else if !last_was_dash {
            sanitized.push('-');
            last_was_dash = true;
        }
    }

    let trimmed = sanitized.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "theme".to_string()
    } else {
        trimmed
    }
}

fn custom_theme_path(app: &AppHandle, theme_id: &str) -> Result<PathBuf, String> {
    if !theme_id.starts_with("custom-") {
        return Err("Only custom themes can be stored in the custom themes folder.".into());
    }

    let file_stem = sanitize_theme_file_stem(theme_id);
    Ok(custom_themes_dir(app)?.join(format!("{file_stem}.json")))
}

fn read_custom_theme_file(path: &PathBuf) -> Result<CustomThemeFile, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut theme: CustomThemeFile =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    if theme.format != THEME_FILE_FORMAT || theme.schema_version != THEME_FILE_SCHEMA_VERSION {
        return Err("Unsupported theme file format.".into());
    }
    if !theme.id.starts_with("custom-") {
        return Err("Custom theme id must start with custom-.".into());
    }
    validate_theme_tokens(&theme.tokens)?;
    if theme.created_at.is_empty() {
        theme.created_at = current_iso_timestamp();
    }
    if theme.updated_at.is_empty() {
        theme.updated_at = theme.created_at.clone();
    }
    Ok(theme)
}

fn load_custom_theme_files(app: &AppHandle) -> Result<Vec<CustomThemeFile>, String> {
    let mut themes = Vec::new();
    for entry in fs::read_dir(custom_themes_dir(app)?).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        if let Ok(theme) = read_custom_theme_file(&path) {
            themes.push(theme);
        }
    }
    themes.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(themes)
}

fn write_custom_theme_file(
    app: &AppHandle,
    theme_id: &str,
    name: &str,
    tokens: ThemeBakeTokens,
) -> Result<CustomThemeFile, String> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Custom theme name cannot be empty.".into());
    }
    validate_theme_tokens(&tokens)?;
    let existing_created_at = custom_theme_path(app, theme_id)
        .ok()
        .and_then(|path| read_custom_theme_file(&path).ok())
        .map(|theme| theme.created_at);
    let updated_at = current_iso_timestamp();

    let theme = CustomThemeFile {
        format: THEME_FILE_FORMAT.to_string(),
        schema_version: THEME_FILE_SCHEMA_VERSION,
        id: theme_id.to_string(),
        name: trimmed_name.chars().take(48).collect(),
        created_at: existing_created_at.unwrap_or_else(|| updated_at.clone()),
        updated_at,
        tokens,
    };
    let content = serde_json::to_string_pretty(&theme).map_err(|error| error.to_string())?;
    fs::write(custom_theme_path(app, theme_id)?, format!("{content}\n"))
        .map_err(|error| error.to_string())?;
    Ok(theme)
}

fn delete_custom_theme_file(app: &AppHandle, theme_id: &str) -> Result<(), String> {
    let path = custom_theme_path(app, theme_id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn premade_theme_path(theme_id: &str) -> Result<PathBuf, String> {
    if !theme_id.starts_with("preset-") || theme_id == "preset-rankdb-default" {
        return Err("Only shipped JSON premade themes can be baked into theme files.".into());
    }

    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "Could not resolve repository root.".to_string())?
        .to_path_buf();
    Ok(repo_root
        .join("app")
        .join("themes")
        .join("premade")
        .join(format!(
            "{}.json",
            sanitize_theme_file_stem(theme_id.trim_start_matches("preset-"))
        )))
}

fn bake_premade_theme_file(theme_id: &str, tokens: &ThemeBakeTokens) -> Result<(), String> {
    validate_theme_tokens(tokens)?;
    let path = premade_theme_path(theme_id)?;
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let mut theme: serde_json::Value =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    theme["tokens"] = serde_json::to_value(tokens).map_err(|error| error.to_string())?;
    let next_content = serde_json::to_string_pretty(&theme).map_err(|error| error.to_string())?;
    fs::write(path, format!("{next_content}\n")).map_err(|error| error.to_string())
}

fn bake_preset_theme_file(theme_id: &str, tokens: &ThemeBakeTokens) -> Result<(), String> {
    if !theme_id.starts_with("preset-") {
        return Err("Only premade themes can be baked into the source file.".into());
    }

    validate_theme_tokens(tokens)?;

    if theme_id != "preset-rankdb-default" {
        return bake_premade_theme_file(theme_id, tokens);
    }

    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| "Could not resolve repository root.".to_string())?
        .to_path_buf();
    let theme_file_path = repo_root
        .join("app")
        .join("components")
        .join("rankdb")
        .join("RankDbApp.vue");
    let content = fs::read_to_string(&theme_file_path).map_err(|error| error.to_string())?;
    let next_content = replace_preset_theme_tokens(&content, theme_id, tokens)?;
    fs::write(theme_file_path, next_content).map_err(|error| error.to_string())
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
    let local_key = prepare_app_storage_key(&app)?;
    set_unlocked_key(&state, local_key)
}

#[tauri::command]
fn save_app_storage(app: AppHandle, state: State<AppState>, payload: Value) -> Result<(), String> {
    save_app_storage_payload(&app, &state, &payload)
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
    let payload =
        serde_json::from_slice::<Value>(&decrypted_payload).map_err(|error| error.to_string())?;
    Ok(Some(payload))
}

#[tauri::command]
fn create_update_recovery_backup(
    app: AppHandle,
    payload: Value,
) -> Result<UpdateRecoveryMetadata, String> {
    write_update_recovery_backup(&app, &payload)
}

#[tauri::command]
fn get_update_recovery_backup_metadata(
    app: AppHandle,
) -> Result<Option<UpdateRecoveryMetadata>, String> {
    let metadata = read_update_recovery_bundle(&app)?.map(|bundle| UpdateRecoveryMetadata {
        created_at: bundle.created_at,
    });
    Ok(metadata)
}

#[tauri::command]
fn clear_update_recovery_backup(app: AppHandle) -> Result<(), String> {
    clear_update_recovery_backup_file(&app)
}

#[tauri::command]
fn restore_update_recovery_backup(app: AppHandle, state: State<AppState>) -> Result<Value, String> {
    let payload = read_update_recovery_payload(&app)?
        .ok_or_else(|| "No automatic update recovery backup is available.".to_string())?;

    reset_app_database(&app)?;
    let local_key = prepare_app_storage_key(&app)?;
    set_unlocked_key(&state, local_key)?;
    save_app_storage_payload(&app, &state, &payload)?;
    clear_update_recovery_backup_file(&app)?;

    Ok(payload)
}

#[tauri::command]
fn bake_preset_theme(theme_id: String, tokens: ThemeBakeTokens) -> Result<(), String> {
    if !cfg!(debug_assertions) {
        return Err("Theme baking is only available in development builds.".into());
    }

    bake_preset_theme_file(&theme_id, &tokens)
}

#[tauri::command]
fn list_custom_themes(app: AppHandle) -> Result<Vec<CustomThemeFile>, String> {
    load_custom_theme_files(&app)
}

#[tauri::command]
fn save_custom_theme(
    app: AppHandle,
    theme_id: String,
    name: String,
    tokens: ThemeBakeTokens,
) -> Result<CustomThemeFile, String> {
    write_custom_theme_file(&app, &theme_id, &name, tokens)
}

#[tauri::command]
fn delete_custom_theme(app: AppHandle, theme_id: String) -> Result<(), String> {
    delete_custom_theme_file(&app, &theme_id)
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
        .get(format!(
            "{OWAPI_PROFILE_BASE_URL}/{platform}/{player_id}/profile"
        ))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let body_text = response.text().await.map_err(|error| error.to_string())?;

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
            create_update_recovery_backup,
            get_update_recovery_backup_metadata,
            clear_update_recovery_backup,
            restore_update_recovery_backup,
            bake_preset_theme,
            list_custom_themes,
            save_custom_theme,
            delete_custom_theme,
            fetch_owapi_profile
        ])
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

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
