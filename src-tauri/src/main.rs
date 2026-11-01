// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clipboard;
mod credential_security;
mod db;
mod discord;
mod legacy;
#[cfg(debug_assertions)]
mod lab_settings;
mod secrets;
mod text;
#[cfg(windows)]
mod resize_edges;
mod webview_browser_features;

use std::time::Duration;
use tauri::Manager;

/// The window starts hidden so the frontend can apply its saved window frame first and then show
/// it. If the frontend never gets that far, show the window anyway rather than run invisibly.
const SHOW_FALLBACK: Duration = Duration::from_secs(3);

/// The identifier of the published app (dev builds have their own).
const RELEASE_IDENTIFIER: &str = "com.merkdesigns.rankdb.next";

/// Update checks only in the published app (release build, its own identifier) from 1.0 on. Dev
/// builds never check: the release channel may carry a version they'd take for an "update" (it
/// still carries the old RankDB 0.3).
#[tauri::command]
fn updates_enabled(app: tauri::AppHandle) -> bool {
    let version = app.package_info().version.clone();
    !cfg!(debug_assertions) && app.config().identifier == RELEASE_IDENTIFIER && version.major >= 1
}

/// Opens the folder that holds the database (shown when it can't be opened, for recovery).
#[tauri::command]
fn open_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    #[cfg(windows)]
    {
        use windows::core::{w, HSTRING};
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        let path = HSTRING::from(dir.as_os_str());
        // ShellExecute returns a value above 32 on success.
        let result = unsafe { ShellExecuteW(None, w!("open"), &path, None, None, SW_SHOWNORMAL) };
        if result.0 as isize <= 32 {
            return Err(crate::text::text("errors.main.folderOpenFailed").into());
        }
    }
    Ok(())
}

/// Opens Battle.net's account settings in the default browser (Account info). The page only ever
/// asks for this one fixed address.
#[tauri::command]
fn open_battlenet() -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::core::w;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        // ShellExecute returns a value above 32 on success.
        let result = unsafe { ShellExecuteW(None, w!("open"), w!("https://eu.account.battle.net/"), None, None, SW_SHOWNORMAL) };
        if result.0 as isize <= 32 {
            return Err(crate::text::text("errors.main.browserOpenFailed").into());
        }
    }
    Ok(())
}

fn main() {
    // The dummy-roster command exists only in development builds.
    #[cfg(debug_assertions)]
    let builder = tauri::Builder::default().invoke_handler(tauri::generate_handler![
        lab_settings::load_lab_settings,
        lab_settings::save_lab_settings,
        db::load_roster,
        db::database_problem,
        db::prepare_for_update,
        db::take_old_app_import,
        db::old_app_status,
        db::import_old_app,
        db::choose_transfer_file,
        db::export_backup,
        db::import_backup,
        db::import_legacy_export,
        open_data_folder,
        db::credential_security_status,
        db::unlock_credentials,
        db::lock_credentials,
        db::configure_credential_encryption,
        db::change_master_password,
        db::set_rank,
        db::load_settings,
        db::save_settings,
        db::add_account,
        db::rename_account,
        db::set_currency,
        db::delete_account,
        db::get_account_details,
        db::set_account_details,
        db::get_credentials,
        db::set_credentials,
        db::copy_secret,
        db::copy_text,
        db::add_group,
        db::rename_group,
        db::set_group_collapsed,
        db::delete_group,
        db::set_status,
        db::move_item,
        db::get_rank_history,
        db::list_season_resets,
        db::get_season_reset,
        open_battlenet,
        db::season_reset,
        db::undo_season_reset,
        db::set_games_dodged,
        db::installed_on,
        discord::set_discord_presence,
        updates_enabled,
        db::replace_roster
    ]);
    #[cfg(not(debug_assertions))]
    let builder = tauri::Builder::default().invoke_handler(tauri::generate_handler![
        db::load_roster,
        db::database_problem,
        db::prepare_for_update,
        db::take_old_app_import,
        db::old_app_status,
        db::import_old_app,
        db::choose_transfer_file,
        db::export_backup,
        db::import_backup,
        db::import_legacy_export,
        open_data_folder,
        db::credential_security_status,
        db::unlock_credentials,
        db::lock_credentials,
        db::configure_credential_encryption,
        db::change_master_password,
        db::set_rank,
        db::load_settings,
        db::save_settings,
        db::add_account,
        db::rename_account,
        db::set_currency,
        db::delete_account,
        db::get_account_details,
        db::set_account_details,
        db::get_credentials,
        db::set_credentials,
        db::copy_secret,
        db::copy_text,
        db::add_group,
        db::rename_group,
        db::set_group_collapsed,
        db::delete_group,
        db::set_status,
        db::move_item,
        db::get_rank_history,
        db::list_season_resets,
        db::get_season_reset,
        open_battlenet,
        db::season_reset,
        db::undo_season_reset,
        db::set_games_dodged,
        db::installed_on,
        discord::set_discord_presence,
        updates_enabled
    ]);

    // One copy at a time: a second start brings the running window forward instead of opening the
    // same database twice. Registered first, so a second copy exits before doing anything else.
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        // Position and size only: the frame, visibility and maximise are the app's own. Restored
        // while the window is still hidden; a spot no longer on any monitor isn't restored.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::POSITION | tauri_plugin_window_state::StateFlags::SIZE)
                .build(),
        )
        .manage(discord::Discord::start())
        .setup(|app| {
            // A database that can't be opened (damaged, from a newer version) doesn't stop the app:
            // it shows the problem instead of the list, and the file stays untouched.
            match db::open(app.handle()) {
                Ok(database) => {
                    app.manage(database);
                    app.manage(db::StartupProblem(None));
                }
                Err(problem) => {
                    app.manage(db::StartupProblem(Some(problem)));
                }
            }
            if let Some(window) = app.get_webview_window("main") {
                // No print, find, reload, zoom, browser menus, autofill: it's an app, not a page.
                webview_browser_features::disable_browser_features(&window);
                // Width is locked to the UI: no left/right or diagonal resize cursors.
                #[cfg(windows)]
                if let Ok(hwnd) = window.hwnd() {
                    resize_edges::install(hwnd.0 as isize);
                }
                std::thread::spawn(move || {
                    std::thread::sleep(SHOW_FALLBACK);
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                    }
                });
            }
            Ok(())
        });

    #[cfg(all(debug_assertions, feature = "mcp-development"))]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    builder
        .build(tauri::generate_context!())
        .expect("error while running RankDB")
        .run(|app, event| {
            // Everything written ends up in the database file itself, not only its log.
            if let tauri::RunEvent::Exit = event {
                if let Some(database) = app.try_state::<db::Database>() {
                    database.checkpoint();
                }
                // A secret copied with a clear delay doesn't outlive the app.
                clipboard::clear_pending();
            }
        });
}
