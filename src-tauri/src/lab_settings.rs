//! Glass Lab settings, persisted as one JSON file in the app's config directory.
//!
//! WebView2 localStorage can lose its last writes when the dev launcher force-kills the app, so the
//! lab writes through this file instead. Writes go to a temporary file that is renamed over the
//! real one, so a kill mid-write leaves the previous settings intact.

use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const FILE_NAME: &str = "lab-settings.json";
const MAX_BYTES: usize = 64 * 1024;

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join(FILE_NAME))
}

#[tauri::command]
pub async fn load_lab_settings(app: AppHandle) -> Result<Option<String>, String> {
    match fs::read_to_string(settings_path(&app)?) {
        Ok(content) => Ok(Some(content)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub async fn save_lab_settings(app: AppHandle, settings: String) -> Result<(), String> {
    if settings.len() > MAX_BYTES {
        return Err(crate::text::text("errors.labSettings.tooLarge").into());
    }
    serde_json::from_str::<serde_json::Value>(&settings).map_err(|error| error.to_string())?;

    let path = settings_path(&app)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, settings).map_err(|error| error.to_string())?;
    fs::rename(&temporary, &path).map_err(|error| error.to_string())
}
