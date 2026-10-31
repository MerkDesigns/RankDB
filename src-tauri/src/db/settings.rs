//! App settings: one JSON value per key in the `settings` table.

use super::*;

/* ---------- Settings ---------- */

/// One JSON value per setting. The frontend validates what it reads (src/data/settingsStore.ts);
/// this only keeps keys and values to a sane size.
pub(crate) const MAX_SETTING_KEY: usize = 64;
pub(crate) const MAX_SETTING_BYTES: usize = 4096;

#[tauri::command]
pub async fn load_settings(database: State<'_, Database>) -> Result<HashMap<String, serde_json::Value>, String> {
    let connection = database.lock()?;
    let mut statement = connection.prepare("SELECT key, value FROM settings").map_err(to_message)?;
    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(to_message)?;
    let mut settings = HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(to_message)?;
        // A value that no longer parses is skipped (the frontend falls back to its default).
        if let Ok(value) = serde_json::from_str(&value) {
            settings.insert(key, value);
        }
    }
    Ok(settings)
}

/// Saves the given settings (only those; others keep their values).
#[tauri::command]
pub async fn save_settings(database: State<'_, Database>, values: HashMap<String, serde_json::Value>) -> Result<(), String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    for (key, value) in values {
        let json = value.to_string();
        if key.is_empty() || key.len() > MAX_SETTING_KEY || json.len() > MAX_SETTING_BYTES {
            return Err(crate::text::format("errors.db.settingTooLarge", &[("key", key.to_string())]));
        }
        transaction
            .execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                params![key, json],
            )
            .map_err(to_message)?;
    }
    transaction.commit().map_err(to_message)
}
