//! Migrating RankDB 0.3's data into a new, empty database.
//!
//! Version 1.0 reaches 0.3 users through the same update channel and installs over it (same
//! product name, install folder and `rankdb.exe`), but 0.3 kept its data under its own identifier:
//! `%APPDATA%\com.rankdb.desktop\rankdb.sqlite3`, table `app_state`, one JSON payload sealed with
//! AES-256-GCM (nonce first, no associated data) under a key in Windows Credential Manager (keyring
//! crate: service "RankDB", user "local-db-key", stored as target "local-db-key.RankDB").
//!
//! The first start of a release build with an empty database migrates it (db/mod.rs `open`); Settings
//! → Data offers it while the database is still empty (a manual download, or a failed first try).
//! It never adds to existing accounts. Credentials arrive unencrypted; a master password can be
//! set afterwards. The old folder is opened read-only and never changed.
//!
//! Settings → Data also reads 0.3's password-encrypted exports (`.rankdb-export`). Those replace
//! the accounts and groups (and their past ranks) but leave the app's settings and credential
//! protection as they are: credentials are sealed under the current protection.

use base64::Engine;
use rusqlite::{params, Connection, OpenFlags, Transaction};
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::credential_security::Vault;
use crate::db::{
    binding_for, to_message, write_rank, Rank, SecretField, Status, MAX_CURRENCY, MAX_DODGES,
    MAX_NAME, MAX_NOTES, ROLE_SLOTS, SIXV6_SLOT, TIERS, VALUES_A, VALUES_B,
};

const OLD_IDENTIFIER: &str = "com.rankdb.desktop";
const OLD_DATABASE: &str = "rankdb.sqlite3";
const OLD_INSTALL_DATE: &str = "install-date.txt";
/// 0.3's export file (`EncryptedExportBundle` in its lib.rs): JSON, snake_case fields; the payload
/// is `nonce || AES-256-GCM` (no associated data) under a PBKDF2-SHA256 key from the password.
const EXPORT_FORMAT: &str = "rankdb-encrypted-export-v1";
pub const EXPORT_EXTENSION: &str = "rankdb-export";
/// Setting written once the first start migrated the data: `{ at, accounts }`. Stops a later start
/// with an emptied list from migrating again.
pub const MARKER: &str = "oldAppImport";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub accounts: usize,
}

/// Whether the database has no accounts and no groups, the only state a migration writes into.
pub fn is_empty(connection: &Connection) -> Result<bool, String> {
    connection
        .query_row("SELECT NOT EXISTS (SELECT 1 FROM accounts) AND NOT EXISTS (SELECT 1 FROM groups)", [], |row| row.get(0))
        .map_err(to_message)
}

/* ---------- Reading the old app ---------- */

/// The old app's data folder, if it has a database.
pub fn old_folder() -> Option<PathBuf> {
    let folder = PathBuf::from(std::env::var_os("APPDATA")?).join(OLD_IDENTIFIER);
    folder.join(OLD_DATABASE).exists().then_some(folder)
}

/// Whether the first start already migrated the old app's data.
pub fn imported(connection: &Connection) -> Result<bool, String> {
    connection
        .query_row("SELECT EXISTS (SELECT 1 FROM settings WHERE key = ?1)", [MARKER], |row| row.get(0))
        .map_err(to_message)
}

/// Reads and decrypts the old app's saved state. Read-only throughout.
fn read(folder: &Path, key: &[u8]) -> Result<Value, String> {
    let connection = Connection::open_with_flags(
        folder.join(OLD_DATABASE),
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| crate::text::format("errors.oldApp.openFailed", &[("error", error.to_string())]))?;
    let sealed: Option<Vec<u8>> = connection
        .query_row("SELECT encrypted_payload FROM app_state WHERE id = 1", [], |row| row.get(0))
        .ok();
    let Some(sealed) = sealed else { return Ok(Value::Null) };
    let payload = crate::secrets::Secrets::from_key(key)?
        .open_sealed(&sealed, "")
        .map_err(|_| crate::text::text("errors.oldApp.decryptFailed").to_string())?;
    serde_json::from_str(&payload).map_err(|_| crate::text::text("errors.oldApp.unreadable").into())
}

/// The old app's first-start day, `YYYY-MM-DD` (Discord's "User since").
fn install_date(folder: &Path) -> Option<String> {
    let day = fs::read_to_string(folder.join(OLD_INSTALL_DATE)).ok()?.trim().to_string();
    let valid = day.len() == 10 && day.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() });
    valid.then_some(day)
}

#[cfg(windows)]
mod credential {
    use windows::core::w;
    use windows::Win32::Security::Credentials::{CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC};
    use zeroize::Zeroizing;

    /// The old app's database key (keyring crate, Windows generic credential, raw bytes).
    pub fn read() -> Result<Zeroizing<Vec<u8>>, String> {
        let mut credential: *mut CREDENTIALW = std::ptr::null_mut();
        // SAFETY: CredReadW allocates `credential`; the blob is copied out and the memory freed.
        unsafe {
            CredReadW(w!("local-db-key.RankDB"), CRED_TYPE_GENERIC, None, &mut credential)
                .map_err(|_| crate::text::text("errors.oldApp.keyMissing").to_string())?;
            let blob = std::slice::from_raw_parts((*credential).CredentialBlob, (*credential).CredentialBlobSize as usize).to_vec();
            CredFree(credential.cast());
            Ok(Zeroizing::new(blob))
        }
    }
}

#[cfg(not(windows))]
mod credential {
    pub fn read() -> Result<zeroize::Zeroizing<Vec<u8>>, String> {
        Err(crate::text::text("errors.oldApp.keyMissing").into())
    }
}

/// Migrates the old app's data into the empty `connection`. Returns None when there's no old app.
pub fn import_installed(connection: &mut Connection, secrets: &Vault) -> Result<Option<ImportSummary>, String> {
    let Some(folder) = old_folder() else { return Ok(None) };
    let key = credential::read()?;
    let root = read(&folder, &key)?;
    let summary = import(connection, secrets, &convert(&root), install_date(&folder))?;
    Ok(Some(summary))
}

/// Replaces the accounts and groups (with their ranks, credentials and past ranks) with those in
/// a 0.3 export. Settings, the install day and credential protection stay as they are; with a
/// master password the credentials need it unlocked. All or nothing.
pub fn replace_from_export(connection: &mut Connection, secrets: &Vault, file: &[u8], password: &str) -> Result<ImportSummary, String> {
    let root = decrypt_export(file, password)?;
    let data = convert(&root);
    secrets.require_unlocked()?;
    let transaction = connection.transaction().map_err(to_message)?;
    // Ranks, currencies, credentials and past ranks go with their accounts (ON DELETE CASCADE).
    transaction.execute_batch("DELETE FROM accounts; DELETE FROM groups;").map_err(to_message)?;
    write_accounts(&transaction, secrets, &data)?;
    transaction.commit().map_err(to_message)?;
    Ok(ImportSummary { accounts: data.accounts.len() })
}

#[derive(serde::Deserialize)]
struct ExportBundle {
    format: String,
    version: u32,
    salt: String,
    pbkdf2_iterations: u32,
    encrypted_payload: String,
}

/// Opens a 0.3 export with its password: the `{ accounts, groups, uiSettings, ... }` payload.
fn decrypt_export(file: &[u8], password: &str) -> Result<Value, String> {
    let unreadable = || crate::text::text("errors.legacyExport.unreadable").to_string();
    let bundle: ExportBundle = serde_json::from_slice(file).map_err(|_| unreadable())?;
    if bundle.format != EXPORT_FORMAT || bundle.version != 1 || !(1..=2_000_000).contains(&bundle.pbkdf2_iterations) {
        return Err(unreadable());
    }
    let decode = |value: &str| base64::engine::general_purpose::STANDARD.decode(value).map_err(|_| unreadable());
    let payload = crate::secrets::Secrets::from_password(password, &decode(&bundle.salt)?, bundle.pbkdf2_iterations)?
        .open_bytes(&decode(&bundle.encrypted_payload)?, "")
        .map_err(|_| crate::text::text("errors.legacyExport.wrongPassword").to_string())?;
    let payload = zeroize::Zeroizing::new(payload);
    serde_json::from_slice(&payload).map_err(|_| unreadable())
}

/* ---------- Conversion ---------- */

struct OldGroup {
    key: String,
    name: String,
    collapsed: bool,
    sort_key: f64,
}

struct OldAccount {
    name: String,
    ranks: [Rank; 3],
    six_v6: Rank,
    values_a: [i64; 3],
    values_b: [i64; 2],
    group: Option<String>,
    banned: bool,
    sort_key: f64,
    country: String,
    notes: String,
    games_dodged: i64,
    last_rank_change_at: Option<String>,
    email: String,
    password: String,
    /// Past ranks: (slot, rank, reset time).
    history: Vec<(&'static str, Rank, String)>,
}

#[derive(Default)]
struct OldData {
    groups: Vec<OldGroup>,
    accounts: Vec<OldAccount>,
    settings: Vec<(String, Value)>,
}

fn object(value: &Value) -> Map<String, Value> {
    value.as_object().cloned().unwrap_or_default()
}

fn text(map: &Map<String, Value>, key: &str) -> String {
    map.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn number(map: &Map<String, Value>, key: &str) -> i64 {
    map.get(key).and_then(|value| value.as_i64().or_else(|| value.as_f64().map(|float| float as i64))).unwrap_or(0)
}

fn flag(map: &Map<String, Value>, key: &str) -> bool {
    map.get(key).and_then(Value::as_bool).unwrap_or(false)
}

/// Anything odd becomes Unranked. The old app had no placement count: a predicted rank comes over
/// as 1 of 10 games played.
fn rank(value: Option<&Value>) -> Rank {
    let map = value.map(object).unwrap_or_default();
    let tier = text(&map, "tier");
    if tier == "Unranked" || !TIERS.contains(&tier.as_str()) {
        return Rank::unranked();
    }
    let predicted = flag(&map, "predicted");
    Rank { tier, division: number(&map, "division").clamp(1, 5) as u8, predicted, placements: u8::from(predicted) }
}

fn values<const N: usize>(value: Option<&Value>) -> [i64; N] {
    let list = value.and_then(Value::as_array).cloned().unwrap_or_default();
    std::array::from_fn(|index| {
        list.get(index)
            .and_then(|value| value.as_i64().or_else(|| value.as_f64().map(|float| float as i64)))
            .unwrap_or(0)
            .clamp(0, MAX_CURRENCY)
    })
}

/// Old dates were ISO strings, or `"<unix seconds>Z"`.
fn date(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }
    if let Some(seconds) = value.strip_suffix('Z').and_then(|digits| digits.parse::<i64>().ok()) {
        return Some(unix_to_iso(seconds));
    }
    Some(value.to_string())
}

fn unix_to_iso(seconds: i64) -> String {
    let days = seconds.div_euclid(86_400);
    let rest = seconds.rem_euclid(86_400);
    // Civil date from days since 1970-01-01 (H. Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.000Z", rest / 3600, rest % 3600 / 60, rest % 60)
}

fn truncate(value: &str, limit: usize) -> String {
    value.chars().take(limit).collect()
}

/// The old app's data (`{ accounts, groups, uiSettings }`, possibly in a `{ format, payload }`
/// envelope). Read leniently: missing or odd fields fall back.
fn convert(root: &Value) -> OldData {
    let root = match root.get("payload") {
        Some(payload) if root.get("format").is_some() => payload,
        _ => root,
    };
    let old_accounts = root.get("accounts").and_then(Value::as_array).cloned().unwrap_or_default();
    let old_groups = root.get("groups").and_then(Value::as_array).cloned().unwrap_or_default();

    // Only groups of the normal section come over; banned accounts aren't grouped any more.
    let groups: Vec<Map<String, Value>> = old_groups
        .iter()
        .map(object)
        .filter(|group| text(group, "section") != "banned" && !text(group, "id").is_empty())
        .collect();
    let group_ids: HashSet<String> = groups.iter().map(|group| text(group, "id")).collect();
    let accounts: Vec<Map<String, Value>> = old_accounts.iter().map(object).collect();

    // The old list order: accounts as stored; a group where its first account is; an empty group
    // before/after its anchor account, or at the end (old buildSectionLayoutSlots).
    let mut top_keys: HashMap<String, f64> = HashMap::new();
    let mut account_keys: HashMap<usize, f64> = HashMap::new();
    let mut next = 0.0;
    let mut empty_before: HashMap<i64, Vec<String>> = HashMap::new();
    let mut empty_after: HashMap<i64, Vec<String>> = HashMap::new();
    let used: HashSet<String> =
        accounts.iter().filter(|account| !flag(account, "isBanned")).map(|account| text(account, "groupId")).collect();
    let mut trailing = Vec::new();
    for group in &groups {
        let id = text(group, "id");
        if used.contains(&id) {
            continue;
        }
        match group.get("anchorAccountId").and_then(Value::as_i64) {
            Some(anchor) if text(group, "anchorPosition") == "before" => empty_before.entry(anchor).or_default().push(id),
            Some(anchor) => empty_after.entry(anchor).or_default().push(id),
            None => trailing.push(id),
        }
    }
    let place_group = |id: &str, keys: &mut HashMap<String, f64>, next: &mut f64| {
        if !keys.contains_key(id) {
            keys.insert(id.to_string(), *next);
            *next += 1.0;
        }
    };
    let mut banned_next = 0.0;
    let mut in_group: HashMap<String, f64> = HashMap::new();
    for (index, account) in accounts.iter().enumerate() {
        if flag(account, "isBanned") {
            account_keys.insert(index, banned_next);
            banned_next += 1.0;
            continue;
        }
        let old_id = number(account, "id");
        for id in empty_before.remove(&old_id).unwrap_or_default() {
            place_group(&id, &mut top_keys, &mut next);
        }
        let group = text(account, "groupId");
        if group_ids.contains(&group) {
            place_group(&group, &mut top_keys, &mut next);
            let key = in_group.entry(group).or_insert(0.0);
            account_keys.insert(index, *key);
            *key += 1.0;
        } else {
            account_keys.insert(index, next);
            next += 1.0;
        }
        for id in empty_after.remove(&old_id).unwrap_or_default() {
            place_group(&id, &mut top_keys, &mut next);
        }
    }
    // Anchors that no longer exist, and anchorless empty groups, go last.
    for id in trailing.into_iter().chain(empty_before.into_values().flatten()).chain(empty_after.into_values().flatten()) {
        place_group(&id, &mut top_keys, &mut next);
    }

    let groups = groups
        .iter()
        .filter_map(|group| {
            let key = text(group, "id");
            Some(OldGroup {
                sort_key: *top_keys.get(&key)?,
                name: truncate(text(group, "name").trim(), crate::db::MAX_GROUP_NAME),
                collapsed: flag(group, "collapsed"),
                key,
            })
        })
        .collect();

    let accounts = accounts
        .iter()
        .enumerate()
        .map(|(index, account)| {
            let ranks_list = account.get("ranks").and_then(Value::as_array).cloned().unwrap_or_default();
            let banned = flag(account, "isBanned");
            let group = text(account, "groupId");
            // Each archived snapshot becomes a season reset in Past ranks.
            let mut history = Vec::new();
            for snapshot in account.get("archivedRankSnapshots").and_then(Value::as_array).cloned().unwrap_or_default() {
                let snapshot = object(&snapshot);
                let Some(changed_at) = date(&text(&snapshot, "createdAt")) else { continue };
                let snapshot_ranks = snapshot.get("ranks").and_then(Value::as_array).cloned().unwrap_or_default();
                let entries = ROLE_SLOTS
                    .iter()
                    .enumerate()
                    .map(|(slot, name)| (*name, rank(snapshot_ranks.get(slot))))
                    .chain(std::iter::once((SIXV6_SLOT, rank(snapshot.get("sixV6Rank")))));
                for (slot, rank) in entries {
                    if rank.tier != "Unranked" {
                        history.push((slot, rank, changed_at.clone()));
                    }
                }
            }
            let country = text(account, "countryCode").trim().to_ascii_uppercase();
            OldAccount {
                name: truncate(text(account, "accountName").trim(), MAX_NAME),
                ranks: std::array::from_fn(|slot| rank(ranks_list.get(slot))),
                six_v6: rank(account.get("sixV6Rank")),
                values_a: values::<3>(account.get("valuesA")),
                values_b: values::<2>(account.get("valuesB")),
                group: (!banned && group_ids.contains(&group)).then_some(group),
                banned,
                sort_key: account_keys.get(&index).copied().unwrap_or(0.0),
                country: if country.len() == 2 && country.chars().all(|c| c.is_ascii_uppercase()) { country } else { String::new() },
                notes: truncate(&text(account, "notes"), MAX_NOTES),
                games_dodged: number(account, "gamesDodged").clamp(0, MAX_DODGES),
                last_rank_change_at: date(&text(account, "lastRankModifiedAt")),
                email: text(account, "email").trim().to_string(),
                password: text(account, "password"),
                history,
            }
        })
        .collect();

    OldData { groups, accounts, settings: settings(root.get("uiSettings")) }
}

/// The old Settings that still exist, under their new names.
fn settings(value: Option<&Value>) -> Vec<(String, Value)> {
    let old = value.map(object).unwrap_or_default();
    let mut settings = Vec::new();
    let mut copy = |from: &str, to: &str| {
        if let Some(value) = old.get(from).filter(|value| value.is_boolean()) {
            settings.push((to.to_string(), value.clone()));
        }
    };
    copy("showSixV6", "showSixV6");
    copy("showNonRankColumns", "showCurrency");
    copy("showLeadButtons", "showCredentialButtons");
    copy("privacyModeEnabled", "privacyMode");
    copy("badgeAnimationsEnabled", "badgeEffects");
    if let Some(chars) = old.get("privacyVisibleCharacters").and_then(Value::as_i64) {
        settings.push(("privacyChars".into(), Value::from(chars.clamp(0, 7))));
    }
    if let Some(zoom) = old.get("uiZoom").and_then(Value::as_f64) {
        // Old zoom was a percentage (e.g. 100) or a factor (1.0); the frontend snaps it to a step.
        let factor = if zoom > 3.0 { zoom / 100.0 } else { zoom };
        settings.push(("uiScale".into(), Value::from(factor.clamp(0.5, 1.5))));
    }
    if let Some(seconds) = old.get("clipboardClearTimerSeconds").and_then(Value::as_i64) {
        // 31 meant "never".
        let seconds = if seconds >= 31 { Value::Null } else { Value::from((seconds.clamp(5, 30) + 2) / 5 * 5) };
        settings.push(("clipboardClearSeconds".into(), seconds));
    }
    settings
}

/* ---------- Writing ---------- */

/// Writes the old data into the empty database in one transaction, credentials unencrypted.
/// Refuses (and writes nothing) when the database has accounts or groups, or a master password.
/// Settings only fill keys that aren't set yet; `install_day` replaces the install day.
fn import(connection: &mut Connection, secrets: &Vault, data: &OldData, install_day: Option<String>) -> Result<ImportSummary, String> {
    if !secrets.is_plain()? {
        return Err(crate::text::text("errors.oldApp.protected").into());
    }
    let transaction = connection.transaction().map_err(to_message)?;
    if !is_empty(&transaction)? {
        return Err(crate::text::text("errors.oldApp.notEmpty").into());
    }
    write_accounts(&transaction, secrets, data)?;
    for (key, value) in &data.settings {
        transaction
            .execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)", params![key, value.to_string()])
            .map_err(to_message)?;
    }
    if let Some(day) = install_day {
        transaction
            .execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('installedOn', json_quote(?1))", [day])
            .map_err(to_message)?;
    }
    let summary = ImportSummary { accounts: data.accounts.len() };
    transaction
        .execute(
            "INSERT OR REPLACE INTO settings (key, value)
             VALUES (?1, json_object('at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'accounts', ?2))",
            params![MARKER, summary.accounts as i64],
        )
        .map_err(to_message)?;
    transaction.commit().map_err(to_message)?;
    Ok(summary)
}

/// Adds the old groups and accounts (ranks, currencies, credentials, past ranks) in `transaction`.
/// Credentials are sealed under the current protection.
fn write_accounts(transaction: &Transaction, secrets: &Vault, data: &OldData) -> Result<(), String> {
    let mut group_ids = HashMap::new();
    for group in &data.groups {
        let id = crate::db::new_group_id()?;
        let name = if group.name.is_empty() { crate::text::text("oldApp.groupName").to_string() } else { group.name.clone() };
        transaction
            .execute(
                "INSERT INTO groups (id, name, sort_key, collapsed) VALUES (?1, ?2, ?3, ?4)",
                params![id, name, group.sort_key, group.collapsed],
            )
            .map_err(to_message)?;
        group_ids.insert(group.key.as_str(), id);
    }
    for account in &data.accounts {
        let group = account.group.as_deref().and_then(|key| group_ids.get(key));
        let status = if account.banned { Status::Banned } else { Status::Clean };
        let name = if account.name.is_empty() { crate::text::text("oldApp.accountName").to_string() } else { account.name.clone() };
        transaction
            .execute(
                "INSERT INTO accounts (name, sort_key, group_id, status, country, notes, games_dodged, last_rank_change_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![name, account.sort_key, group, status, account.country, account.notes, account.games_dodged, account.last_rank_change_at],
            )
            .map_err(to_message)?;
        let id = transaction.last_insert_rowid();
        for (slot, rank) in ROLE_SLOTS.iter().zip(&account.ranks).chain(std::iter::once((&SIXV6_SLOT, &account.six_v6))) {
            rank.validate()?;
            write_rank(transaction, id, slot, rank)?;
        }
        for (kind, value) in VALUES_A.iter().zip(account.values_a).chain(VALUES_B.iter().zip(account.values_b)) {
            transaction
                .execute("INSERT INTO currencies (account_id, kind, value) VALUES (?1, ?2, ?3)", params![id, kind, value])
                .map_err(to_message)?;
        }
        let seal = |value: &str, field| (!value.is_empty()).then(|| secrets.seal(value, &binding_for(id, field))).transpose();
        let (email, password) = (seal(&account.email, SecretField::Email)?, seal(&account.password, SecretField::Password)?);
        if email.is_some() || password.is_some() {
            transaction
                .execute("INSERT INTO credentials (account_id, email, password) VALUES (?1, ?2, ?3)", params![id, email, password])
                .map_err(to_message)?;
        }
        for (slot, rank, changed_at) in &account.history {
            transaction
                .execute(
                    "INSERT INTO rank_history (account_id, slot, tier, division, predicted, placements, changed_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![id, slot, rank.tier, rank.division, rank.predicted, rank.placements, changed_at],
                )
                .map_err(to_message)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn old_state() -> Value {
        serde_json::json!({
            "format": "rankdb-app-state",
            "schemaVersion": 1,
            "payload": {
                "accounts": [
                    { "id": 1, "accountName": "Loose#1", "email": "a@b.c", "password": "pw",
                      "ranks": [{ "tier": "Gold", "division": 2, "predicted": false },
                                { "tier": "Diamond", "division": 4, "predicted": true },
                                { "tier": "Unranked", "division": 5, "predicted": false }],
                      "sixV6Rank": { "tier": "Master", "division": 1, "predicted": false },
                      "valuesA": [10, 20, 30], "valuesB": [40, 50], "groupId": null, "isBanned": false,
                      "notes": "main", "countryCode": "de", "gamesDodged": 2, "lastRankModifiedAt": "1700000000Z",
                      "archivedRankSnapshots": [{ "id": "s1", "createdAt": "2025-01-02T03:04:05.000Z",
                          "ranks": [{ "tier": "Platinum", "division": 1, "predicted": false }],
                          "sixV6Rank": { "tier": "Unranked", "division": 5, "predicted": false } }] },
                    { "id": 2, "accountName": "InGroup#2", "groupId": "g1", "isBanned": false,
                      "ranks": [{ "tier": "Nonsense", "division": 9, "predicted": true }] },
                    { "id": 3, "accountName": "Loose#3", "groupId": null, "isBanned": false },
                    { "id": 4, "accountName": "Banned#4", "groupId": "g1", "isBanned": true }
                ],
                "groups": [
                    { "id": "g1", "name": "Smurfs", "collapsed": true, "section": "normal" },
                    { "id": "g2", "name": "Empty", "collapsed": false, "section": "normal",
                      "anchorAccountId": 1, "anchorPosition": "before" },
                    { "id": "gb", "name": "Banned group", "section": "banned" }
                ],
                "uiSettings": { "showSixV6": false, "uiZoom": 110, "clipboardClearTimerSeconds": 31 }
            }
        })
    }

    fn database() -> (Connection, Vault) {
        let mut connection = Connection::open_in_memory().unwrap();
        connection.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        crate::db::migrate(&mut connection).unwrap();
        let vault = Vault::load(&connection).unwrap();
        (connection, vault)
    }

    #[test]
    fn imports_accounts_groups_order_credentials_and_past_ranks() {
        let (mut connection, vault) = database();
        let summary = import(&mut connection, &vault, &convert(&old_state()), Some("2024-05-06".into())).unwrap();
        assert_eq!(summary.accounts, 4);
        let roster = crate::db::read_roster(&connection).unwrap();
        let by_name: HashMap<_, _> = roster.accounts.iter().map(|account| (account.name.as_str(), account)).collect();
        let groups: HashMap<_, _> = roster.groups.iter().map(|group| (group.name.as_str(), group)).collect();
        // Banned-section groups are dropped; the empty group sits before its anchor, the group
        // where its first account was.
        assert_eq!(groups.len(), 2);
        let loose1 = by_name["Loose#1"];
        assert!(groups["Empty"].sort_key < loose1.sort_key);
        assert!(loose1.sort_key < groups["Smurfs"].sort_key && groups["Smurfs"].sort_key < by_name["Loose#3"].sort_key);
        assert!(groups["Smurfs"].collapsed);
        assert_eq!(by_name["InGroup#2"].group_id.as_deref(), Some(groups["Smurfs"].id.as_str()));
        assert_eq!(by_name["InGroup#2"].ranks[0].tier, "Unranked");
        assert!(matches!(by_name["Banned#4"].status, Status::Banned) && by_name["Banned#4"].group_id.is_none());
        assert_eq!((loose1.ranks[1].predicted, loose1.ranks[1].placements), (true, 1));
        assert_eq!(loose1.six_v6.tier, "Master");
        assert_eq!(loose1.values_b, [40, 50]);
        assert!(loose1.has_email && loose1.has_password);
        assert_eq!(loose1.last_rank_change_at.as_deref(), Some("2023-11-14T22:13:20.000Z"));
        let email: Vec<u8> = connection.query_row("SELECT email FROM credentials WHERE account_id = ?1", [loose1.id], |row| row.get(0)).unwrap();
        assert_eq!(email, b"a@b.c");
        let (country, notes): (String, String) =
            connection.query_row("SELECT country, notes FROM accounts WHERE id = ?1", [loose1.id], |row| Ok((row.get(0)?, row.get(1)?))).unwrap();
        assert_eq!((country.as_str(), notes.as_str()), ("DE", "main"));
        let history: Vec<(String, String)> = connection
            .prepare("SELECT tier, changed_at FROM rank_history")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .map(Result::unwrap)
            .collect();
        assert_eq!(history, [("Platinum".to_string(), "2025-01-02T03:04:05.000Z".to_string())]);
        let setting = |key: &str| -> String {
            connection.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| row.get(0)).unwrap()
        };
        assert_eq!(setting("showSixV6"), "false");
        assert_eq!(setting("uiScale"), "1.1");
        assert_eq!(setting("clipboardClearSeconds"), "null");
        assert_eq!(setting("installedOn"), "\"2024-05-06\"");
        assert!(imported(&connection).unwrap());
    }

    #[test]
    fn never_adds_to_existing_accounts_or_groups() {
        for existing in ["INSERT INTO accounts (name, sort_key) VALUES ('Mine', 0)", "INSERT INTO groups (id, name, sort_key) VALUES ('g', 'Mine', 0)"] {
            let (mut connection, vault) = database();
            connection.execute_batch(existing).unwrap();
            assert!(import(&mut connection, &vault, &convert(&old_state()), None).is_err());
            let rows: i64 = connection
                .query_row("SELECT (SELECT COUNT(*) FROM accounts) + (SELECT COUNT(*) FROM groups)", [], |row| row.get(0))
                .unwrap();
            assert_eq!(rows, 1);
            assert!(!imported(&connection).unwrap());
        }
    }

    #[test]
    fn a_master_password_refuses_without_writing() {
        let (mut connection, vault) = database();
        vault.configure(&mut connection, &[], true, "fixture master password", "").unwrap();
        assert!(import(&mut connection, &vault, &convert(&old_state()), None).is_err());
        let accounts: i64 = connection.query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0)).unwrap();
        assert_eq!(accounts, 0);
        assert!(!imported(&connection).unwrap());
    }

    #[test]
    fn decrypts_the_old_payload_format() {
        let key = [3u8; 32];
        let sealed = crate::secrets::Secrets::from_key(&key).unwrap().seal(&old_state().to_string(), "").unwrap();
        let folder = std::env::temp_dir().join(format!("rankdb-old-app-test-{}", std::process::id()));
        fs::create_dir_all(&folder).unwrap();
        let old = Connection::open(folder.join(OLD_DATABASE)).unwrap();
        old.execute_batch("CREATE TABLE app_state (id INTEGER PRIMARY KEY, encrypted_payload BLOB NOT NULL, updated_at TEXT);").unwrap();
        old.execute("INSERT INTO app_state VALUES (1, ?1, '0')", [sealed]).unwrap();
        drop(old);
        fs::write(folder.join(OLD_INSTALL_DATE), "2024-05-06\n").unwrap();
        assert_eq!(read(&folder, &key).unwrap(), old_state());
        assert!(read(&folder, &[4u8; 32]).is_err());
        assert_eq!(install_date(&folder).as_deref(), Some("2024-05-06"));
        fs::remove_dir_all(folder).unwrap();
    }

    /// A 0.3 export as its lib.rs `encrypt_export_payload` wrote it (fewer rounds, to stay quick).
    fn old_export(password: &str) -> Vec<u8> {
        let salt = [5u8; 16];
        let payload = old_state()["payload"].to_string();
        let sealed = crate::secrets::Secrets::from_password(password, &salt, 1).unwrap().seal(&payload, "").unwrap();
        let encode = |value: &[u8]| base64::engine::general_purpose::STANDARD.encode(value);
        serde_json::json!({
            "format": EXPORT_FORMAT, "version": 1, "exported_at": "2025-01-01T00:00:00.000Z",
            "salt": encode(&salt), "pbkdf2_iterations": 1, "encrypted_payload": encode(&sealed),
        })
        .to_string()
        .into_bytes()
    }

    #[test]
    fn an_export_replaces_the_accounts_and_keeps_settings_and_the_master_password() {
        let (mut connection, vault) = database();
        connection.execute_batch(
            "INSERT INTO accounts (name, sort_key) VALUES ('Mine', 0);
             INSERT INTO groups (id, name, sort_key) VALUES ('g', 'Mine', 1);
             INSERT INTO settings (key, value) VALUES ('showSixV6', 'true'), ('installedOn', '\"2020-01-01\"');",
        ).unwrap();
        vault.configure(&mut connection, &[], true, "fixture master password", "").unwrap();
        assert!(replace_from_export(&mut connection, &vault, &old_export("export pw"), "wrong").is_err());
        vault.lock().unwrap();
        assert!(replace_from_export(&mut connection, &vault, &old_export("export pw"), "export pw").is_err());
        let accounts: i64 = connection.query_row("SELECT COUNT(*) FROM accounts WHERE name = 'Mine'", [], |row| row.get(0)).unwrap();
        assert_eq!(accounts, 1);

        vault.unlock("fixture master password").unwrap();
        let summary = replace_from_export(&mut connection, &vault, &old_export("export pw"), "export pw").unwrap();
        assert_eq!(summary.accounts, 4);
        let roster = crate::db::read_roster(&connection).unwrap();
        assert!(roster.accounts.iter().all(|account| account.name != "Mine"));
        assert!(roster.groups.iter().all(|group| group.name != "Mine"));
        let setting = |key: &str| -> String {
            connection.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| row.get(0)).unwrap()
        };
        assert_eq!(setting("showSixV6"), "true");
        assert_eq!(setting("installedOn"), "\"2020-01-01\"");
        assert!(!vault.is_plain().unwrap());
        let (id, email): (i64, Vec<u8>) = connection
            .query_row("SELECT account_id, email FROM credentials WHERE email IS NOT NULL", [], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap();
        assert_ne!(email, b"a@b.c");
        assert_eq!(vault.open_sealed(&email, &binding_for(id, SecretField::Email)).unwrap(), "a@b.c");
    }

}
