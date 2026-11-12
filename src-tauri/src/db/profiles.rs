//! Profile pictures and banners (experimental, off by default: Settings → Misc).
//!
//! When on, a background queue looks every account's BattleTag up on owapi.eu (Blizzard's public
//! career profile: only public profiles are found) and keeps the profile picture and banner as
//! files in `profile-images/` beside the database, so the page never loads anything from the
//! internet (it reads them through the `profile` scheme, `serve_image`). The rows in
//! `account_profiles` say what was found for which BattleTag.
//!
//! The queue is gentle with a free service that publishes no limits: one account at a time, a
//! pause between lookups, found and missing profiles looked up again after 7 days, a renamed
//! account at once, names that can't be looked up only after a rename. Too many requests, an
//! outage or no connection stop it until the next day. Turning the feature off only stops the
//! queue and hides the images (by request): rows and files stay, and turning it on again shows
//! them at once and carries on with whatever is due. Stop (Settings) halts the queue until the next
//! start or Refresh now. A single account's refresh (its menu) jumps the queue, stopped or not.

use super::*;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Instant;
use tauri::Emitter;

const FOLDER: &str = "profile-images";
const API: &str = "https://owapi.eu/stats/pc/";
/// Between two lookups.
const SPACING: Duration = Duration::from_millis(1500);
/// After too many requests, an outage or no connection.
const BACKOFF: Duration = Duration::from_secs(24 * 60 * 60);
/// With nothing due, how often to look again (profiles fall due after 7 days).
const IDLE: Duration = Duration::from_secs(6 * 60 * 60);
const TIMEOUT: Duration = Duration::from_secs(20);
/// Profile pictures are about 8 KB and banners about 130 KB; anything far bigger isn't one.
const MAX_IMAGE: usize = 4 * 1024 * 1024;
const EXTENSIONS: [&str; 3] = ["png", "jpg", "webp"];
pub(crate) const CHANGED_EVENT: &str = "profiles-changed";
pub(crate) const STATUS_EVENT: &str = "profiles-status";

/// What is known about one account's profile.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    account_id: i64,
    /// `found`, `missing` (not public, or no such player) or `invalid` (a name that can't be looked up).
    state: String,
    /// Image file names in `profile-images/`, for the `profile` scheme.
    avatar: Option<String>,
    banner: Option<String>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProfileStatus {
    /// Looking accounts up right now.
    running: bool,
    /// Stopped until tomorrow (too many requests, an outage or no connection).
    paused: bool,
    /// Stopped by hand until the next start, Refresh now or an account's refresh.
    stopped: bool,
}

/// The queue's controls, shared by the commands and the worker.
#[derive(Default)]
pub struct ProfileQueue {
    enabled: AtomicBool,
    /// Bumped whenever the feature is turned on or off, so a lookup in flight from before is dropped.
    generation: AtomicU64,
    wake: tokio::sync::Notify,
    paused_until: Mutex<Option<Instant>>,
    stopped: AtomicBool,
    /// Accounts asked for one by one (their menu), looked up before anything else.
    priority: Mutex<Vec<i64>>,
    status: Mutex<ProfileStatus>,
}

impl ProfileQueue {
    fn set_status(&self, app: &AppHandle, status: ProfileStatus) {
        let Ok(mut current) = self.status.lock() else { return };
        if *current != status {
            *current = status;
            let _ = app.emit(STATUS_EVENT, status);
        }
    }

    fn paused_until(&self) -> Option<Instant> {
        self.paused_until.lock().ok().and_then(|until| *until)
    }

    fn pause(&self, until: Option<Instant>) {
        if let Ok(mut current) = self.paused_until.lock() {
            *current = until;
        }
    }

    /// Asked for by hand: clears the day's pause (and Stop, for the whole queue) and wakes the worker.
    fn resume(&self, all: bool) {
        if all {
            self.stopped.store(false, Ordering::SeqCst);
        }
        self.pause(None);
        self.wake.notify_one();
    }

    fn has_priority(&self) -> bool {
        self.priority.lock().is_ok_and(|list| !list.is_empty())
    }

    fn take_priority(&self) -> Vec<i64> {
        self.priority.lock().map(|mut list| std::mem::take(&mut *list)).unwrap_or_default()
    }
}

/* ---------- Commands ---------- */

/// What is known so far (the feature's state is the frontend's setting, sent with `set_profile_images`).
#[tauri::command]
pub async fn load_profiles(database: State<'_, Database>) -> Result<Vec<Profile>, String> {
    let connection = database.lock()?;
    read_profiles(&connection, &database.dir.join(FOLDER))
}

/// Turns the queue on (it starts at once) or off (it stops; what was found is kept). Called on
/// every start and whenever the setting changes; returns what is known.
#[tauri::command]
pub async fn set_profile_images(
    app: AppHandle,
    database: State<'_, Database>,
    queue: State<'_, ProfileQueue>,
    enabled: bool,
) -> Result<Vec<Profile>, String> {
    let was = queue.enabled.swap(enabled, Ordering::SeqCst);
    if was != enabled {
        queue.generation.fetch_add(1, Ordering::SeqCst);
    }
    let folder = database.dir.join(FOLDER);
    if !enabled {
        queue.pause(None);
        queue.stopped.store(false, Ordering::SeqCst);
        queue.take_priority();
        queue.set_status(&app, ProfileStatus::default());
    } else {
        queue.wake.notify_one();
    }
    let connection = database.lock()?;
    read_profiles(&connection, &folder)
}

/// Settings → Refresh now: every account is looked up again (images already kept are reused).
#[tauri::command]
pub async fn refresh_profiles(database: State<'_, Database>, queue: State<'_, ProfileQueue>) -> Result<(), String> {
    database.lock()?.execute("UPDATE account_profiles SET checked_at = ''", []).map_err(to_message)?;
    queue.resume(true);
    Ok(())
}

/// The account menu's Refresh profile: this account next, before the rest of the queue.
#[tauri::command]
pub async fn refresh_profile(database: State<'_, Database>, queue: State<'_, ProfileQueue>, account_id: i64) -> Result<(), String> {
    database
        .lock()?
        .execute("UPDATE account_profiles SET checked_at = '' WHERE account_id = ?1", [account_id])
        .map_err(to_message)?;
    if let Ok(mut list) = queue.priority.lock() {
        list.retain(|id| *id != account_id);
        list.push(account_id);
    }
    queue.resume(false);
    Ok(())
}

/// Settings → Stop: no more lookups until the next start or a refresh (one in flight still lands).
#[tauri::command]
pub async fn stop_profiles(app: AppHandle, queue: State<'_, ProfileQueue>) -> Result<(), String> {
    queue.stopped.store(true, Ordering::SeqCst);
    queue.take_priority();
    queue.set_status(&app, ProfileStatus { stopped: true, ..ProfileStatus::default() });
    queue.wake.notify_one();
    Ok(())
}

#[tauri::command]
pub async fn profile_status(queue: State<'_, ProfileQueue>) -> Result<ProfileStatus, String> {
    Ok(queue.status.lock().map(|status| *status).unwrap_or_default())
}

/// The rows, with any whose image file has gone (a backup restored on another PC, files deleted by
/// hand) made due again, so the queue fetches them anew.
fn read_profiles(connection: &Connection, folder: &Path) -> Result<Vec<Profile>, String> {
    let mut statement = connection
        .prepare("SELECT p.account_id, p.state, p.avatar, p.banner FROM account_profiles p JOIN accounts a ON a.id = p.account_id AND a.name = p.tag")
        .map_err(to_message)?;
    let rows = statement
        .query_map([], |row| {
            Ok(Profile { account_id: row.get(0)?, state: row.get(1)?, avatar: row.get(2)?, banner: row.get(3)? })
        })
        .map_err(to_message)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(to_message)?;
    let present = |name: &Option<String>| name.as_ref().is_none_or(|name| folder.join(name).is_file());
    let (kept, lost): (Vec<_>, Vec<_>) = rows.into_iter().partition(|profile| present(&profile.avatar) && present(&profile.banner));
    for profile in &lost {
        connection
            .execute("UPDATE account_profiles SET checked_at = '' WHERE account_id = ?1", [profile.account_id])
            .map_err(to_message)?;
    }
    Ok(kept)
}

/* ---------- The queue ---------- */

/// Starts the worker (once, after the database opened). It does nothing until the frontend turns
/// the feature on.
pub fn start_profile_worker(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let Ok(client) = client() else { return };
        loop {
            step(&app, &client).await;
        }
    });
}

async fn step(app: &AppHandle, client: &reqwest::Client) {
    let queue = app.state::<ProfileQueue>();
    let database = app.state::<Database>();
    if !queue.enabled.load(Ordering::SeqCst) {
        queue.set_status(app, ProfileStatus::default());
        queue.wake.notified().await;
        return;
    }
    if queue.stopped.load(Ordering::SeqCst) && !queue.has_priority() {
        queue.set_status(app, ProfileStatus { stopped: true, ..ProfileStatus::default() });
        queue.wake.notified().await;
        return;
    }
    if let Some(until) = queue.paused_until() {
        let now = Instant::now();
        if now < until {
            queue.set_status(app, ProfileStatus { paused: true, ..ProfileStatus::default() });
            tokio::select! {
                _ = queue.wake.notified() => {}
                _ = tokio::time::sleep(until - now) => queue.pause(None),
            }
            return;
        }
        queue.pause(None);
    }
    let generation = queue.generation.load(Ordering::SeqCst);
    let folder = database.dir.join(FOLDER);
    let priority = queue.take_priority();
    let stopped = queue.stopped.load(Ordering::SeqCst);
    let next = database.lock().and_then(|connection| next_account(&connection, &priority, stopped));
    // The ones asked for after this one keep their turn.
    let used = match &next {
        Ok(Some((account_id, _))) => priority.iter().position(|id| id == account_id),
        _ => None,
    };
    if let (Some(index), Ok(mut list)) = (used, queue.priority.lock()) {
        list.splice(0..0, priority[index + 1..].iter().copied());
    }
    let Ok(Some((account_id, tag))) = next else {
        queue.set_status(app, ProfileStatus { stopped, ..ProfileStatus::default() });
        if let Ok(connection) = database.lock() {
            remove_unused_images(&connection, &folder);
        }
        tokio::select! {
            _ = queue.wake.notified() => {}
            _ = tokio::time::sleep(IDLE) => {}
        }
        return;
    };
    queue.set_status(app, ProfileStatus { running: true, ..ProfileStatus::default() });
    let path = lookup_path(&tag);
    let lookup = match &path {
        Some(path) => fetch_profile(client, path).await,
        None => Lookup::Invalid,
    };
    let (state, avatar, banner) = match lookup {
        Lookup::Unavailable => {
            queue.pause(Some(Instant::now() + BACKOFF));
            return;
        }
        Lookup::Invalid => ("invalid", None, None),
        Lookup::Missing => ("missing", None, None),
        Lookup::Found { avatar, banner } => {
            ("found", download(client, &folder, avatar).await, download(client, &folder, banner).await)
        }
    };
    // Turned off (or off and on) meanwhile: this answer belongs to a queue that no longer exists.
    if queue.generation.load(Ordering::SeqCst) == generation && queue.enabled.load(Ordering::SeqCst) {
        let saved = database.lock().and_then(|connection| save(&connection, account_id, &tag, state, avatar, banner));
        if let Ok(Some(profile)) = saved {
            let _ = app.emit(CHANGED_EVENT, profile);
        }
    }
    if path.is_some() {
        tokio::time::sleep(SPACING).await;
    }
}

/// The first account asked for by hand that still exists (the rest wait in the normal queue: their
/// `checked_at` is empty), else the next one due (none while stopped).
fn next_account(connection: &Connection, priority: &[i64], stopped: bool) -> Result<Option<(i64, String)>, String> {
    for &id in priority {
        let name: Option<String> = connection
            .query_row("SELECT name FROM accounts WHERE id = ?1", [id], |row| row.get(0))
            .optional()
            .map_err(to_message)?;
        if let Some(name) = name {
            return Ok(Some((id, name)));
        }
    }
    if stopped {
        return Ok(None);
    }
    due(connection)
}

/// The next account to look up: never looked up, renamed since, due again after 7 days, or asked
/// for by Refresh now (`checked_at` empty). Names that can't be looked up wait for a rename.
fn due(connection: &Connection) -> Result<Option<(i64, String)>, String> {
    connection
        .query_row(
            "SELECT a.id, a.name FROM accounts a LEFT JOIN account_profiles p ON p.account_id = a.id
             WHERE p.account_id IS NULL OR p.tag <> a.name OR p.checked_at = ''
                OR (p.state <> 'invalid' AND p.checked_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days'))
             ORDER BY a.sort_key, a.id LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(to_message)
}

/// Keeps what was found, if the account still exists under the BattleTag it was looked up as.
fn save(
    connection: &Connection,
    account_id: i64,
    tag: &str,
    state: &str,
    avatar: Option<String>,
    banner: Option<String>,
) -> Result<Option<Profile>, String> {
    let written = connection
        .execute(
            "INSERT INTO account_profiles (account_id, tag, state, avatar, banner, checked_at)
             SELECT id, name, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM accounts WHERE id = ?1 AND name = ?2
             ON CONFLICT (account_id) DO UPDATE SET tag = excluded.tag, state = excluded.state,
                avatar = excluded.avatar, banner = excluded.banner, checked_at = excluded.checked_at",
            params![account_id, tag, state, avatar, banner],
        )
        .map_err(to_message)?;
    Ok((written > 0).then(|| Profile { account_id, state: state.to_string(), avatar, banner }))
}

/// Deletes image files no row names any more (a changed picture, a deleted account).
fn remove_unused_images(connection: &Connection, folder: &Path) {
    let Ok(entries) = fs::read_dir(folder) else { return };
    let used: std::collections::HashSet<String> = connection
        .prepare("SELECT avatar FROM account_profiles WHERE avatar IS NOT NULL UNION SELECT banner FROM account_profiles WHERE banner IS NOT NULL")
        .and_then(|mut statement| statement.query_map([], |row| row.get(0))?.collect())
        .unwrap_or_default();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !used.contains(&name) {
            let _ = fs::remove_file(entry.path());
        }
    }
}

/* ---------- owapi.eu ---------- */

#[derive(Debug, PartialEq)]
enum Lookup {
    Found { avatar: Option<String>, banner: Option<String> },
    /// Not public, or no such player.
    Missing,
    /// A name Blizzard can't look up.
    Invalid,
    /// Too many requests, an outage, no connection: try again tomorrow.
    Unavailable,
}

fn client() -> Result<reqwest::Client, String> {
    // As the updater does: rustls with ring, installed once for the process.
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::ring::default_provider().install_default();
    }
    reqwest::Client::builder()
        .timeout(TIMEOUT)
        .user_agent(concat!("RankDB/", env!("CARGO_PKG_VERSION"), " (+https://github.com/MerkDesigns/RankDB)"))
        .build()
        .map_err(|error| error.to_string())
}

/// "Name#1234" → "Name-1234" (owapi's form), or None for what can't be a BattleTag: no number,
/// spaces inside the name (around it they're trimmed), control characters.
fn lookup_path(tag: &str) -> Option<String> {
    let (name, number) = tag.trim().rsplit_once('#')?;
    let name = name.trim();
    let count = name.chars().count();
    if count == 0 || count > 32 || name.chars().any(|c| c.is_whitespace() || c.is_control() || matches!(c, '#' | '/' | '?' | '%')) {
        return None;
    }
    if !(3..=8).contains(&number.len()) || !number.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    Some(format!("{name}-{number}"))
}

async fn fetch_profile(client: &reqwest::Client, path: &str) -> Lookup {
    let Ok(mut url) = reqwest::Url::parse(API) else { return Lookup::Unavailable };
    // Path segments are percent-encoded by `url`: any name is one segment, never a path.
    if let Ok(mut segments) = url.path_segments_mut() {
        segments.pop_if_empty().push(path).push("profile");
    }
    let Ok(response) = client.get(url).send().await else { return Lookup::Unavailable };
    let status = response.status().as_u16();
    let body = response.bytes().await.unwrap_or_default();
    classify(status, &body)
}

/// owapi's answers: 400 a name it can't look up, 404 no such player, 502 one Blizzard wouldn't
/// give out (a private profile); anything else that isn't a profile means try again tomorrow.
fn classify(status: u16, body: &[u8]) -> Lookup {
    match status {
        200 => match serde_json::from_slice::<serde_json::Value>(body) {
            Ok(profile) if profile.is_object() => Lookup::Found { avatar: image_url(&profile["icon"]), banner: image_url(&profile["namecardImage"]) },
            _ => Lookup::Unavailable,
        },
        400 => Lookup::Invalid,
        404 | 502 => Lookup::Missing,
        _ => Lookup::Unavailable,
    }
}

fn image_url(value: &serde_json::Value) -> Option<String> {
    value.as_str().filter(|url| url.starts_with("https://") && url.len() <= 2048).map(str::to_string)
}

/* ---------- Images ---------- */

/// Downloads an image once: its file is named after its address, so a known one isn't fetched
/// again (Blizzard's addresses change with the picture). None if it isn't a reasonable image.
async fn download(client: &reqwest::Client, folder: &Path, url: Option<String>) -> Option<String> {
    let url = url?;
    let digest = Sha256::digest(url.as_bytes());
    let stem: String = digest.iter().take(16).map(|byte| format!("{byte:02x}")).collect();
    if let Some(name) = EXTENSIONS.iter().map(|extension| format!("{stem}.{extension}")).find(|name| folder.join(name).is_file()) {
        return Some(name);
    }
    let response = client.get(&url).send().await.ok()?;
    if !response.status().is_success() || response.content_length().is_some_and(|length| length as usize > MAX_IMAGE) {
        return None;
    }
    let bytes = response.bytes().await.ok()?;
    if bytes.len() > MAX_IMAGE {
        return None;
    }
    let name = format!("{stem}.{}", image_kind(&bytes)?);
    fs::create_dir_all(folder).ok()?;
    let partial = folder.join(format!("{name}.part"));
    fs::write(&partial, &bytes).ok()?;
    fs::rename(&partial, folder.join(&name)).ok()?;
    Some(name)
}

/// The image's type by its first bytes: PNG, JPEG or WebP, nothing else.
fn image_kind(bytes: &[u8]) -> Option<&'static str> {
    const PNG: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    if bytes.starts_with(&PNG) {
        Some("png")
    } else if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("jpg")
    } else if bytes.len() > 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        Some("webp")
    } else {
        None
    }
}

/// A file name the queue could have written: 32 hex digits and a known extension. Nothing else is
/// ever served, so no path can reach outside the folder.
fn valid_image_name(name: &str) -> Option<&'static str> {
    let (stem, extension) = name.split_once('.')?;
    if stem.len() != 32 || !stem.bytes().all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f')) {
        return None;
    }
    match extension {
        "png" => Some("image/png"),
        "jpg" => Some("image/jpeg"),
        "webp" => Some("image/webp"),
        _ => None,
    }
}

impl Database {
    /// The `profile` scheme (main.rs): a kept image's bytes and type, by file name.
    pub fn profile_image(&self, name: &str) -> Option<(Vec<u8>, &'static str)> {
        let content_type = valid_image_name(name)?;
        let bytes = fs::read(self.dir.join(FOLDER).join(name)).ok()?;
        Some((bytes, content_type))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn battletags_become_owapi_names() {
        assert_eq!(lookup_path("XP0#21919").as_deref(), Some("XP0-21919"));
        assert_eq!(lookup_path("マイクロ波#2844").as_deref(), Some("マイクロ波-2844"));
        assert_eq!(lookup_path("Thighgap7cm #2171").as_deref(), Some("Thighgap7cm-2171"));
        for tag in ["iquide", "#2231", "Name#", "Name#12", "Name#12a4", "Two words#1234", "a/b#1234", "a?b#1234"] {
            assert_eq!(lookup_path(tag), None, "{tag}");
        }
    }

    #[test]
    fn answers_are_read_as_found_missing_invalid_or_later() {
        let found = br#"{"icon":"https://cdn.example/a.png","namecardImage":"","private":false}"#;
        assert_eq!(classify(200, found), Lookup::Found { avatar: Some("https://cdn.example/a.png".into()), banner: None });
        // Only https addresses are ever downloaded.
        assert_eq!(classify(200, br#"{"icon":"http://cdn.example/a.png"}"#), Lookup::Found { avatar: None, banner: None });
        assert_eq!(classify(200, b"<html>"), Lookup::Unavailable);
        assert_eq!(classify(400, b""), Lookup::Invalid);
        assert_eq!(classify(404, b""), Lookup::Missing);
        assert_eq!(classify(502, br#"{"message":"Failed to retrieve player stats"}"#), Lookup::Missing);
        for status in [429, 500, 503, 504] {
            assert_eq!(classify(status, b""), Lookup::Unavailable);
        }
    }

    #[test]
    fn only_kept_images_can_be_served() {
        assert_eq!(image_kind(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0]), Some("png"));
        assert_eq!(image_kind(b"RIFF\0\0\0\0WEBPVP8 "), Some("webp"));
        assert_eq!(image_kind(b"<svg"), None);
        assert_eq!(valid_image_name("0123456789abcdef0123456789abcdef.png"), Some("image/png"));
        for name in ["../rankdb.sqlite3", "0123456789abcdef0123456789abcdef.svg", "0123456789ABCDEF0123456789abcdef.png", "x.png", "0123456789abcdef0123456789abcdef.png/../x"] {
            assert_eq!(valid_image_name(name), None, "{name}");
        }
    }

    #[test]
    fn the_queue_takes_new_renamed_and_stale_accounts_and_forgets_deleted_ones() {
        let dir = std::env::temp_dir().join(format!("rankdb-profiles-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let database = open_at(&dir).unwrap();
        let connection = database.lock().unwrap();
        connection
            .execute_batch("INSERT INTO accounts (id, name, sort_key) VALUES (1, 'One#1111', 0), (2, 'two words#2222', 1);")
            .unwrap();
        assert_eq!(due(&connection).unwrap(), Some((1, "One#1111".into())));
        let saved = save(&connection, 1, "One#1111", "found", Some("a.png".into()), None).unwrap();
        assert!(saved.is_some());
        assert_eq!(due(&connection).unwrap(), Some((2, "two words#2222".into())));
        save(&connection, 2, "two words#2222", "invalid", None, None).unwrap();
        assert_eq!(due(&connection).unwrap(), None);
        // An answer for a name the account no longer has is dropped; the new name is due.
        connection.execute("UPDATE accounts SET name = 'One#9999' WHERE id = 1", []).unwrap();
        assert_eq!(save(&connection, 1, "One#1111", "found", None, None).unwrap(), None);
        assert_eq!(due(&connection).unwrap(), Some((1, "One#9999".into())));
        save(&connection, 1, "One#9999", "missing", None, None).unwrap();
        // Seven days later found and missing profiles are due again; invalid names are not.
        connection.execute("UPDATE account_profiles SET checked_at = '2000-01-01T00:00:00.000Z'", []).unwrap();
        assert_eq!(due(&connection).unwrap(), Some((1, "One#9999".into())));
        connection.execute("UPDATE account_profiles SET checked_at = '' WHERE account_id = 1", []).unwrap();
        assert_eq!(due(&connection).unwrap(), Some((1, "One#9999".into())));
        // Rows whose image went missing are due again and not shown.
        save(&connection, 1, "One#9999", "found", Some("0123456789abcdef0123456789abcdef.png".into()), None).unwrap();
        assert!(read_profiles(&connection, &dir.join(FOLDER)).unwrap().iter().all(|profile| profile.account_id != 1));
        assert_eq!(due(&connection).unwrap(), Some((1, "One#9999".into())));
        // Deleting an account deletes its row.
        connection.execute("DELETE FROM accounts WHERE id = 2", []).unwrap();
        let rows: i64 = connection.query_row("SELECT COUNT(*) FROM account_profiles WHERE account_id = 2", [], |row| row.get(0)).unwrap();
        assert_eq!(rows, 0);
        drop(connection);
        drop(database);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn accounts_asked_for_go_first_and_alone_while_stopped() {
        let dir = std::env::temp_dir().join(format!("rankdb-profiles-priority-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        let database = open_at(&dir).unwrap();
        let connection = database.lock().unwrap();
        connection
            .execute_batch("INSERT INTO accounts (id, name, sort_key) VALUES (1, 'One#1111', 0), (2, 'Two#2222', 1);")
            .unwrap();
        assert_eq!(next_account(&connection, &[], false).unwrap(), Some((1, "One#1111".into())));
        // An asked-for account jumps the queue; a deleted one is skipped.
        assert_eq!(next_account(&connection, &[9, 2], false).unwrap(), Some((2, "Two#2222".into())));
        // Stopped: only accounts asked for.
        assert_eq!(next_account(&connection, &[], true).unwrap(), None);
        assert_eq!(next_account(&connection, &[2], true).unwrap(), Some((2, "Two#2222".into())));
        drop(connection);
        drop(database);
        fs::remove_dir_all(dir).unwrap();
    }
}
