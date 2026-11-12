//! Discord Rich Presence, as in the old app: "Managing Overwatch accounts", the (animated) RankDB icon with
//! "User since <date>", and a button to the GitHub page.
//!
//! A background worker owns the Discord connection, so connecting never blocks the app: it
//! follows the wanted state (on/off), connects when Discord is running, and retries every
//! `RETRY` while it isn't (Discord started later, or restarted).

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

const CLIENT_ID: &str = "1504897730596704266";
const GITHUB_URL: &str = "https://github.com/MerkDesigns/RankDB";
/// The animated RankDB icon, served from the repo (not bundled into the app). Discord fetches it
/// itself; keep the file at this path on `main`, or presences of installed versions lose it.
const LARGE_IMAGE_URL: &str = "https://raw.githubusercontent.com/MerkDesigns/RankDB/main/src/assets/extras/RankDB_Animated_Icon.webp";
const RETRY: Duration = Duration::from_secs(30);

enum Wanted {
    /// `activity` is the line under "RankDB", already cleaned (`clean_activity`).
    On { user_since: String, activity: String },
    Off,
}

pub struct Discord(Mutex<Sender<Wanted>>);

impl Discord {
    pub fn start() -> Self {
        let (sender, receiver) = channel::<Wanted>();
        thread::spawn(move || {
            let mut wanted = Wanted::Off;
            let mut client: Option<DiscordIpcClient> = None;
            loop {
                match &wanted {
                    Wanted::On { user_since, activity } => {
                        if client.is_none() {
                            let mut next = DiscordIpcClient::new(CLIENT_ID);
                            if next.connect().is_ok() {
                                client = Some(next);
                            }
                        }
                        // A failed update means Discord went away: drop and retry later.
                        if let Some(connected) = client.as_mut() {
                            if connected.set_activity(presence(user_since, activity)).is_err() {
                                let _ = connected.close();
                                client = None;
                            }
                        }
                    }
                    Wanted::Off => {
                        if let Some(mut connected) = client.take() {
                            let _ = connected.clear_activity();
                            let _ = connected.close();
                        }
                    }
                }
                match receiver.recv_timeout(RETRY) {
                    Ok(next) => wanted = next,
                    // Re-check periodically while on (and not connected, or to notice a lost one).
                    Err(RecvTimeoutError::Timeout) => {}
                    Err(RecvTimeoutError::Disconnected) => break,
                }
            }
            if let Some(mut connected) = client {
                let _ = connected.clear_activity();
                let _ = connected.close();
            }
        });
        Self(Mutex::new(sender))
    }
}

/// Discord's limits for the activity line: 2 to 128 UTF-16 units; 64 characters never exceed them.
const ACTIVITY_MIN: usize = 2;
const ACTIVITY_MAX: usize = 64;
/// Accent marks that stack (the "zalgo" ranges); more than two in a row are dropped.
const STACKING_MARKS: [std::ops::RangeInclusive<char>; 5] =
    ['\u{0300}'..='\u{036F}', '\u{1AB0}'..='\u{1AFF}', '\u{1DC0}'..='\u{1DFF}', '\u{20D0}'..='\u{20FF}', '\u{FE20}'..='\u{FE2F}'];

/// The custom activity line made safe to send, or None (use the default line). Same rules as the
/// frontend's `cleanActivityText` (settingsStore.ts), applied again here because this is what
/// reaches Discord: control, line-break, invisible and text-direction characters become spaces,
/// runs of whitespace one space, stacked accent marks at most two, at most 64 characters, and
/// anything under 2 characters is the default.
fn clean_activity(text: &str) -> Option<String> {
    let hidden = |c: char| {
        c.is_control()
            || matches!(c, '\u{2028}' | '\u{2029}' | '\u{200B}' | '\u{200E}' | '\u{200F}' | '\u{FEFF}')
            || ('\u{202A}'..='\u{202E}').contains(&c)
            || ('\u{2060}'..='\u{2064}').contains(&c)
            || ('\u{2066}'..='\u{2069}').contains(&c)
    };
    let mut cleaned = String::new();
    let (mut marks, mut space) = (0, false);
    for c in text.chars() {
        let c = if hidden(c) { ' ' } else { c };
        if c.is_whitespace() {
            space = !cleaned.is_empty();
            marks = 0;
            continue;
        }
        if STACKING_MARKS.iter().any(|range| range.contains(&c)) {
            marks += 1;
            if marks > 2 {
                continue;
            }
        } else {
            marks = 0;
        }
        if space {
            cleaned.push(' ');
            space = false;
        }
        cleaned.push(c);
    }
    let limited: String = cleaned.chars().take(ACTIVITY_MAX).collect();
    let limited = limited.trim_end();
    (limited.chars().count() >= ACTIVITY_MIN).then(|| limited.to_string())
}

fn presence<'a>(user_since: &'a str, activity: &'a str) -> activity::Activity<'a> {
    activity::Activity::new()
        .details(activity)
        .assets(activity::Assets::new().large_image(LARGE_IMAGE_URL).large_text(user_since))
        .buttons(vec![activity::Button::new(crate::text::text("discord.githubButton"), GITHUB_URL)])
}

/// Turns the presence on or off. `user_since` is the hover text (e.g. "User since 12 Mar 2025");
/// `activity` the user's own line instead of "Managing Overwatch accounts" ("" for that one).
#[tauri::command]
pub fn set_discord_presence(discord: tauri::State<Discord>, enabled: bool, user_since: String, activity: String) -> Result<(), String> {
    let activity = clean_activity(&activity).unwrap_or_else(|| crate::text::text("discord.activity").to_string());
    let wanted = if enabled { Wanted::On { user_since, activity } } else { Wanted::Off };
    discord
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .send(wanted)
        .map_err(|_| crate::text::text("errors.discord.workerStopped").to_string())
}

#[cfg(test)]
mod tests {
    use super::clean_activity;

    #[test]
    fn custom_activity_text_is_made_safe() {
        assert_eq!(clean_activity("  Grinding   to GM  ").as_deref(), Some("Grinding to GM"));
        // Line breaks, tabs, control, invisible and text-direction characters.
        assert_eq!(clean_activity("a\nb\r\tc\u{0}d\u{200B}e\u{202E}f\u{2028}g").as_deref(), Some("a b c d e f g"));
        // Stacked accents keep two; ordinary accents and emoji (with their joiners) stay.
        assert_eq!(clean_activity("Z\u{0301}\u{0302}\u{0303}\u{0304}x").as_deref(), Some("Z\u{0301}\u{0302}x"));
        assert_eq!(clean_activity("Café 👩‍💻").as_deref(), Some("Café 👩‍💻"));
        // At most 64 characters, cut on a character, never inside one; never over Discord's 128.
        assert_eq!(clean_activity(&"é".repeat(100)).unwrap().chars().count(), 64);
        assert_eq!(clean_activity(&"🎮".repeat(100)).unwrap().encode_utf16().count(), 128);
        // Too short or only invisible: the default line.
        for text in ["", " ", "x", "\u{200B}\u{200B}\u{200B}", "\n\n"] {
            assert_eq!(clean_activity(text), None);
        }
    }
}
