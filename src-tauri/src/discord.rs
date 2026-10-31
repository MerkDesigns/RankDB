//! Discord Rich Presence, as in the old app: "Managing Overwatch accounts", the RankDB icon with
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
const LARGE_IMAGE_URL: &str = "https://raw.githubusercontent.com/MerkDesigns/RankDB/main/public/app-icon-512.png";
const RETRY: Duration = Duration::from_secs(30);

enum Wanted {
    On { user_since: String },
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
                    Wanted::On { user_since } => {
                        if client.is_none() {
                            let mut next = DiscordIpcClient::new(CLIENT_ID);
                            if next.connect().is_ok() {
                                client = Some(next);
                            }
                        }
                        // A failed update means Discord went away: drop and retry later.
                        if let Some(connected) = client.as_mut() {
                            if connected.set_activity(presence(user_since)).is_err() {
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

fn presence(user_since: &str) -> activity::Activity<'_> {
    activity::Activity::new()
        .details(crate::text::text("discord.activity"))
        .assets(activity::Assets::new().large_image(LARGE_IMAGE_URL).large_text(user_since))
        .buttons(vec![activity::Button::new(crate::text::text("discord.githubButton"), GITHUB_URL)])
}

/// Turns the presence on or off. `user_since` is the hover text (e.g. "User since 12 Mar 2025").
#[tauri::command]
pub fn set_discord_presence(discord: tauri::State<Discord>, enabled: bool, user_since: String) -> Result<(), String> {
    let wanted = if enabled { Wanted::On { user_since } } else { Wanted::Off };
    discord
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .send(wanted)
        .map_err(|_| crate::text::text("errors.discord.workerStopped").to_string())
}
