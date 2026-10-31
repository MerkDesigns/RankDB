//! Credentials (email, password) and the optional master password (credential_security.rs).

use super::*;

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

pub(crate) fn read_secret(database: &Database, connection: &Connection, account_id: i64, field: SecretField) -> Result<Option<String>, String> {
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
    database.secrets.configure(&mut connection, &database.upgrade_copies(), enabled, &password, &current_password)
}
#[tauri::command]
pub async fn change_master_password(database: State<'_, Database>, current_password: String, password: String) -> Result<SecurityStatus, String> {
    let password = zeroize::Zeroizing::new(password);
    let current_password = zeroize::Zeroizing::new(current_password);
    let mut connection = database.lock()?;
    database.secrets.change_password(&mut connection, &database.upgrade_copies(), &current_password, &password)
}
