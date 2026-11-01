//! Optional credential encryption. SQLite owns the mode and password-wrapped random field key.
//! Credentials are plain unless the user sets a master password. The earlier Windows-key (DPAPI)
//! storage of development builds is no longer supported: such a database doesn't open.
use base64::Engine;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use zeroize::Zeroizing;

use crate::db::{binding_for, to_message, SecretField};
use crate::secrets::Secrets;

/// One stored credential row: account id, email, password (each sealed or plain).
type CredentialRow = (i64, Option<Vec<u8>>, Option<Vec<u8>>);

const ITERATIONS: u32 = 600_000;
const KEY_BINDING: &str = "rankdb:credential-key:v1";

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
enum Mode { Plain, Password }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityStatus {
    mode: Mode,
    locked: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Envelope { version: u8, iterations: u32, salt: String, sealed_key: String }

impl Envelope {
    fn parse(json: &str) -> Result<Self, String> {
        let value: Self = serde_json::from_str(json).map_err(|_| crate::text::text("errors.credentialSecurity.metadataDamaged").to_string())?;
        if value.version != 1 || value.iterations != ITERATIONS || decode(&value.salt)?.len() != 16 || decode(&value.sealed_key)?.len() != 72 {
            return Err(crate::text::text("errors.credentialSecurity.metadataDamaged").into());
        }
        Ok(value)
    }
    fn wrapping_cipher(&self, password: &str) -> Result<Secrets, String> {
        let mut key = Zeroizing::new([0u8; 32]);
        pbkdf2::pbkdf2_hmac::<sha2::Sha256>(password.as_bytes(), &decode(&self.salt)?, self.iterations, &mut *key);
        Secrets::from_key(key.as_ref())
    }
    fn wrap(key: &[u8; 32], password: &str) -> Result<Self, String> {
        validate_password(password)?;
        let mut salt = [0u8; 16];
        getrandom::fill(&mut salt).map_err(|error| error.to_string())?;
        let mut envelope = Self { version: 1, iterations: ITERATIONS, salt: encode(&salt), sealed_key: String::new() };
        let encoded_key = Zeroizing::new(encode(key));
        envelope.sealed_key = encode(&envelope.wrapping_cipher(password)?.seal(&encoded_key, KEY_BINDING)?);
        Ok(envelope)
    }
    fn unwrap(&self, password: &str) -> Result<Zeroizing<[u8; 32]>, String> {
        let value = Zeroizing::new(self.wrapping_cipher(password)?.open_sealed(&decode(&self.sealed_key)?, KEY_BINDING)
            .map_err(|_| crate::text::text("errors.credentialSecurity.unlockFailed").to_string())?);
        let bytes = Zeroizing::new(decode(&value)?);
        let mut key = Zeroizing::new([0u8; 32]);
        if bytes.len() != key.len() { return Err(crate::text::text("errors.credentialSecurity.metadataDamaged").into()); }
        key.copy_from_slice(&bytes);
        Ok(key)
    }
}
fn encode(value: &[u8]) -> String { base64::engine::general_purpose::STANDARD.encode(value) }
fn decode(value: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD.decode(value).map_err(|_| crate::text::text("errors.credentialSecurity.metadataDamaged").into())
}
fn validate_password(password: &str) -> Result<(), String> {
    if !(1..=1024).contains(&password.chars().count()) { return Err(crate::text::text("errors.credentialSecurity.invalidPasswordLength").into()); }
    Ok(())
}

struct Protection { mode: Mode, envelope: Option<Envelope>, cipher: Option<Secrets> }
impl Protection {
    fn load(connection: &Connection) -> Result<Self, String> {
        let (mode, config): (String, Option<String>) = connection.query_row(
            "SELECT mode, password_config FROM credential_security WHERE id = 1", [], |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(to_message)?;
        match mode.as_str() {
            "plain" => Ok(Self { mode: Mode::Plain, envelope: None, cipher: None }),
            "password" => Ok(Self { mode: Mode::Password, envelope: Some(Envelope::parse(config.as_deref().ok_or(crate::text::text("errors.credentialSecurity.metadataMissing"))?)?), cipher: None }),
            "legacy" => Err(crate::text::text("errors.credentialSecurity.legacyUnsupported").into()),
            _ => Err(crate::text::text("errors.credentialSecurity.unknownMode").into()),
        }
    }
    fn status(&self) -> SecurityStatus {
        SecurityStatus { mode: self.mode, locked: self.mode != Mode::Plain && self.cipher.is_none() }
    }
    fn cipher(&self) -> Result<&Secrets, String> {
        self.cipher.as_ref().ok_or_else(|| crate::text::text("errors.credentialSecurity.unlockRequired").into())
    }
    fn seal(&self, value: &str, binding: &str) -> Result<Vec<u8>, String> {
        if self.mode == Mode::Plain { Ok(value.as_bytes().to_vec()) } else { self.cipher()?.seal(value, binding) }
    }
    fn open(&self, value: &[u8], binding: &str) -> Result<String, String> {
        if self.mode == Mode::Plain { String::from_utf8(value.to_vec()).map_err(|_| crate::text::text("errors.credentialSecurity.credentialDamaged").into()) }
        else { self.cipher()?.open_sealed(value, binding) }
    }
    fn persist(&self, connection: &Connection) -> Result<(), String> {
        let mode = match self.mode { Mode::Plain => "plain", Mode::Password => "password" };
        let config = self.envelope.as_ref().map(serde_json::to_string).transpose().map_err(|error| error.to_string())?;
        connection.execute("UPDATE credential_security SET mode = ?1, password_config = ?2 WHERE id = 1", params![mode, config]).map_err(to_message)?;
        Ok(())
    }
}

pub struct Vault { protection: Mutex<Protection> }
impl Vault {
    pub fn load(connection: &Connection) -> Result<Self, String> {
        Ok(Self { protection: Mutex::new(Protection::load(connection)?) })
    }
    /// After the whole database was replaced (a backup): its own protection, locked.
    pub fn reload(&self, connection: &Connection) -> Result<SecurityStatus, String> {
        let mut state = self.lock_state()?;
        *state = Protection::load(connection)?;
        Ok(state.status())
    }
    fn lock_state(&self) -> Result<std::sync::MutexGuard<'_, Protection>, String> { self.protection.lock().map_err(|error| error.to_string()) }
    pub fn status(&self) -> Result<SecurityStatus, String> { Ok(self.lock_state()?.status()) }
    pub fn seal(&self, value: &str, binding: &str) -> Result<Vec<u8>, String> { self.lock_state()?.seal(value, binding) }
    pub fn open_sealed(&self, value: &[u8], binding: &str) -> Result<String, String> { self.lock_state()?.open(value, binding) }
    pub fn is_plain(&self) -> Result<bool, String> { Ok(self.lock_state()?.mode == Mode::Plain) }
    pub fn require_unlocked(&self) -> Result<(), String> {
        let state = self.lock_state()?;
        if state.mode != Mode::Plain { state.cipher()?; }
        Ok(())
    }
    pub fn unlock(&self, password: &str) -> Result<SecurityStatus, String> {
        let mut state = self.lock_state()?;
        if let Some(envelope) = &state.envelope {
            let key = envelope.unwrap(password)?;
            state.cipher = Some(Secrets::from_key(key.as_ref())?);
        }
        Ok(state.status())
    }
    pub fn lock(&self) -> Result<SecurityStatus, String> {
        let mut state = self.lock_state()?;
        if state.mode == Mode::Password { state.cipher = None; }
        Ok(state.status())
    }
    /// `copies`: the copies taken before upgrades, converted along (see `convert_copies`).
    pub fn configure(&self, connection: &mut Connection, copies: &[PathBuf], enabled: bool, password: &str, current_password: &str) -> Result<SecurityStatus, String> {
        let mut old = self.lock_state()?;
        if enabled && old.mode == Mode::Password { return Err(crate::text::text("errors.credentialSecurity.alreadyEnabled").into()); }
        // Turning protection off always verifies the password, even if this session is unlocked.
        let verified = if let Some(envelope) = &old.envelope {
            let key = envelope.unwrap(current_password)?;
            Some(Protection { mode: Mode::Password, envelope: None, cipher: Some(Secrets::from_key(key.as_ref())?) })
        } else { None };
        let next = if enabled {
            let mut key = Zeroizing::new([0u8; 32]);
            getrandom::fill(&mut *key).map_err(|error| error.to_string())?;
            Protection { mode: Mode::Password, envelope: Some(Envelope::wrap(&key, password)?), cipher: Some(Secrets::from_key(key.as_ref())?) }
        } else { Protection { mode: Mode::Plain, envelope: None, cipher: None } };
        convert_credentials(connection, verified.as_ref().unwrap_or(&old), &next)?;
        // Remove obsolete plaintext/key-envelope pages from the current database/WAL.
        compact(connection)?;
        convert_copies(copies, verified.as_ref(), &next);
        *old = next;
        Ok(old.status())
    }
    pub fn change_password(&self, connection: &mut Connection, copies: &[PathBuf], current: &str, password: &str) -> Result<SecurityStatus, String> {
        let mut state = self.lock_state()?;
        let key = state.envelope.as_ref().ok_or(crate::text::text("errors.credentialSecurity.notEnabled"))?.unwrap(current)?;
        let envelope = Envelope::wrap(&key, password)?;
        let next = Protection { mode: Mode::Password, envelope: Some(envelope), cipher: Some(Secrets::from_key(key.as_ref())?) };
        let transaction = connection.transaction().map_err(to_message)?;
        next.persist(&transaction)?;
        transaction.commit().map_err(to_message)?;
        compact(connection)?;
        // Same key, new envelope: the copies' envelopes must stop opening with the old password.
        convert_copies(copies, Some(&next), &next);
        *state = next;
        Ok(state.status())
    }
}

fn convert_credentials(connection: &mut Connection, source: &Protection, next: &Protection) -> Result<(), String> {
    let transaction = connection.transaction().map_err(to_message)?;
    let rows: Vec<CredentialRow> = transaction.prepare("SELECT account_id, email, password FROM credentials")
        .and_then(|mut statement| statement.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?.collect()).map_err(to_message)?;
    for (id, email, password) in rows {
        let convert = |value: Option<Vec<u8>>, field| -> Result<Option<Vec<u8>>, String> {
            value.map(|value| {
                let binding = binding_for(id, field);
                let plain = Zeroizing::new(source.open(&value, &binding)?);
                next.seal(&plain, &binding)
            }).transpose()
        };
        transaction.execute("UPDATE credentials SET email = ?2, password = ?3 WHERE account_id = ?1",
            params![id, convert(email, SecretField::Email)?, convert(password, SecretField::Password)?]).map_err(to_message)?;
    }
    next.persist(&transaction)?;
    transaction.commit().map_err(to_message)
}

/// Copies taken before upgrades get the same protection as the database, so turning on a master
/// password never leaves plain-text credentials in one, and changing it never leaves one that
/// opens with the old password. `password_source` opens password-protected copies (the key before
/// the change). A copy that can't be converted is deleted: protecting the credentials matters more
/// than keeping a spare copy.
fn convert_copies(copies: &[PathBuf], password_source: Option<&Protection>, next: &Protection) {
    let plain = Protection { mode: Mode::Plain, envelope: None, cipher: None };
    for path in copies {
        let converted = (|| -> Result<(), String> {
            let mut connection = Connection::open(path).map_err(to_message)?;
            connection.execute_batch("PRAGMA secure_delete = ON;").map_err(to_message)?;
            let mode: String = connection
                .query_row("SELECT mode FROM credential_security WHERE id = 1", [], |row| row.get(0))
                .map_err(to_message)?;
            let source = match mode.as_str() {
                "plain" => &plain,
                "password" => password_source.ok_or_else(|| crate::text::text("errors.credentialSecurity.unlockRequired").to_string())?,
                _ => return Err(crate::text::text("errors.credentialSecurity.unknownMode").into()),
            };
            convert_credentials(&mut connection, source, next)?;
            compact(&connection)
        })();
        if converted.is_err() {
            let _ = std::fs::remove_file(path);
        }
    }
}

fn compact(connection: &Connection) -> Result<(), String> {
    connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|error| crate::text::format("errors.credentialSecurity.cleanupFailed", &[("error", error.to_string())]))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn database() -> Connection {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;").unwrap();
        crate::db::migrate(&mut connection).unwrap();
        connection.execute("INSERT INTO accounts (id, name, sort_key) VALUES (1, 'Fixture', 0)", []).unwrap();
        connection.execute("INSERT INTO credentials (account_id, email, password) VALUES (1, ?1, ?2)", params![b"example@example.com".as_slice(), b"fixture-password".as_slice()]).unwrap();
        connection
    }
    fn bytes(connection: &Connection) -> Vec<u8> {
        connection.query_row("SELECT password FROM credentials WHERE account_id = 1", [], |row| row.get(0)).unwrap()
    }
    const PASSWORD: &str = "test master password";

    #[test]
    fn fresh_storage_is_plain_and_has_no_key_dependency() {
        let connection = database();
        let missing_dir = std::path::Path::new("nonexistent-rankdb-test-key-folder");
        let vault = Vault::load(&connection).unwrap();
        assert!(matches!(vault.status().unwrap().mode, Mode::Plain));
        assert_eq!(vault.seal("plaintext", "binding").unwrap(), b"plaintext");
        assert_eq!(vault.open_sealed(&bytes(&connection), "binding").unwrap(), "fixture-password");
        assert!(!missing_dir.join("data.key").exists());
    }

    #[test]
    fn enable_restart_unlock_and_field_binding() {
        let mut connection = database();
        let vault = Vault::load(&connection).unwrap();
        vault.configure(&mut connection, &[], true, PASSWORD, "").unwrap();
        let encrypted = bytes(&connection);
        assert_ne!(encrypted, b"fixture-password");
        assert_eq!(vault.open_sealed(&encrypted, "rankdb:1:password").unwrap(), "fixture-password");
        assert!(vault.open_sealed(&encrypted, "rankdb:2:password").is_err());
        assert!(vault.open_sealed(&encrypted, "rankdb:1:email").is_err());
        let restarted = Vault::load(&connection).unwrap();
        assert!(restarted.status().unwrap().locked);
        assert!(restarted.seal("value", "binding").is_err());
        assert!(restarted.unlock("wrong password").is_err());
        assert!(restarted.status().unwrap().locked);
        restarted.unlock(PASSWORD).unwrap();
        assert_eq!(restarted.open_sealed(&encrypted, "rankdb:1:password").unwrap(), "fixture-password");
        restarted.lock().unwrap();
        assert!(restarted.open_sealed(&encrypted, "rankdb:1:password").is_err());
    }

    #[test]
    fn disable_verifies_password_even_while_unlocked_and_survives_restart() {
        let mut connection = database();
        let vault = Vault::load(&connection).unwrap();
        vault.configure(&mut connection, &[], true, PASSWORD, "").unwrap();
        let encrypted = bytes(&connection);
        assert!(vault.configure(&mut connection, &[], false, "", "wrong").is_err());
        assert_eq!(bytes(&connection), encrypted);
        assert!(matches!(vault.status().unwrap().mode, Mode::Password));
        vault.configure(&mut connection, &[], false, "", PASSWORD).unwrap();
        assert_eq!(bytes(&connection), b"fixture-password");
        let restarted = Vault::load(&connection).unwrap();
        assert!(matches!(restarted.status().unwrap().mode, Mode::Plain));
    }

    #[test]
    fn password_change_rewraps_key_without_rewriting_credentials() {
        let mut connection = database();
        let vault = Vault::load(&connection).unwrap();
        vault.configure(&mut connection, &[], true, PASSWORD, "").unwrap();
        let encrypted = bytes(&connection);
        assert!(vault.change_password(&mut connection, &[], "wrong", "new password").is_err());
        vault.change_password(&mut connection, &[], PASSWORD, "new password").unwrap();
        assert_eq!(bytes(&connection), encrypted);
        vault.lock().unwrap();
        assert!(vault.unlock(PASSWORD).is_err());
        vault.unlock("new password").unwrap();
        assert_eq!(vault.open_sealed(&encrypted, "rankdb:1:password").unwrap(), "fixture-password");
    }

    #[test]
    fn corrupted_field_rolls_back_the_entire_conversion() {
        let mut connection = database();
        connection.execute("INSERT INTO accounts (id, name, sort_key) VALUES (2, 'Bad field', 1)", []).unwrap();
        connection.execute("INSERT INTO credentials (account_id, password) VALUES (2, ?1)", [vec![255u8]]).unwrap();
        let vault = Vault::load(&connection).unwrap();
        assert!(vault.configure(&mut connection, &[], true, PASSWORD, "").is_err());
        assert_eq!(bytes(&connection), b"fixture-password");
        assert!(matches!(vault.status().unwrap().mode, Mode::Plain));
        assert_eq!(connection.query_row("SELECT mode FROM credential_security", [], |r| r.get::<_, String>(0)).unwrap(), "plain");
    }

    #[test]
    fn empty_password_and_damaged_envelope_are_rejected() {
        let mut connection = database();
        let vault = Vault::load(&connection).unwrap();
        assert!(vault.configure(&mut connection, &[], true, "", "").is_err());
        assert_eq!(bytes(&connection), b"fixture-password");
        for json in ["{}", r#"{"version":1,"iterations":1,"salt":"","sealedKey":""}"#] {
            assert!(Envelope::parse(json).is_err());
        }
    }

    #[test]
    fn upgrade_copies_follow_every_protection_change() {
        let folder = std::env::temp_dir().join(format!("rankdb-copies-test-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let copy = folder.join("rankdb-schema-v4.sqlite3");
        let mut connection = database();
        connection.execute("VACUUM INTO ?1", [copy.to_string_lossy()]).unwrap();
        let copy_password = || -> Vec<u8> {
            Connection::open(&copy).unwrap().query_row("SELECT password FROM credentials WHERE account_id = 1", [], |row| row.get(0)).unwrap()
        };
        let copy_mode = || -> String {
            Connection::open(&copy).unwrap().query_row("SELECT mode FROM credential_security", [], |row| row.get(0)).unwrap()
        };
        let copies = [copy.clone()];
        let vault = Vault::load(&connection).unwrap();
        // On: the copy's plain text is gone, and it opens with the same password.
        vault.configure(&mut connection, &copies, true, PASSWORD, "").unwrap();
        assert_ne!(copy_password(), b"fixture-password");
        assert_eq!(copy_mode(), "password");
        let from_copy = Vault::load(&Connection::open(&copy).unwrap()).unwrap();
        from_copy.unlock(PASSWORD).unwrap();
        assert_eq!(from_copy.open_sealed(&copy_password(), "rankdb:1:password").unwrap(), "fixture-password");
        // Changed: the copy no longer opens with the old password.
        vault.change_password(&mut connection, &copies, PASSWORD, "new password").unwrap();
        let from_copy = Vault::load(&Connection::open(&copy).unwrap()).unwrap();
        assert!(from_copy.unlock(PASSWORD).is_err());
        from_copy.unlock("new password").unwrap();
        // Off: plain again, like the database.
        vault.configure(&mut connection, &copies, false, "", "new password").unwrap();
        assert_eq!(copy_password(), b"fixture-password");
        assert_eq!(copy_mode(), "plain");
        // A copy that can't be converted is deleted rather than left unprotected.
        std::fs::write(&copy, b"not a database").unwrap();
        vault.configure(&mut connection, &copies, true, PASSWORD, "").unwrap();
        assert!(!copy.exists());
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn old_windows_key_storage_is_refused_without_touching_data() {
        let connection = database();
        connection.execute("UPDATE credential_security SET mode = 'legacy'", []).unwrap();
        assert!(Vault::load(&connection).is_err());
        assert_eq!(bytes(&connection), b"fixture-password");
    }
}
