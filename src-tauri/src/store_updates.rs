//! Updates for the Microsoft Store build (by request 2026-11-13). The Store installs updates
//! itself, but only in the background and whenever it gets round to it, so the app asks the Store
//! (Windows.Services.Store, the API Microsoft provides for this) whether a newer RankDB is waiting
//! and offers to open its Store page. Asking the Store rather than GitHub matters: a GitHub
//! release is out days before Microsoft has certified the same version.
//!
//! Only the Store build asks; every other build answers "no update" (the GitHub one has its own
//! updater, and an app not installed from the Store has nothing to ask about).

/// RankDB in the Microsoft Store (Partner Center → Product identity → Store ID).
#[cfg(windows)]
const STORE_PAGE: windows::core::PCWSTR = windows::core::w!("ms-windows-store://pdp/?productid=9N35JP1XQHVS");

/// The version of RankDB the Store has ready for this PC ("1.0.3"), or nothing when this one is
/// current.
#[tauri::command]
pub async fn store_update() -> Result<Option<String>, String> {
    #[cfg(all(windows, feature = "store"))]
    {
        tauri::async_runtime::spawn_blocking(|| {
            pending_update().map_err(|error| {
                eprintln!("Store update check: {error}");
                crate::text::text("errors.storeUpdates.checkFailed").to_string()
            })
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(not(all(windows, feature = "store")))]
    Ok(None)
}

#[cfg(all(windows, feature = "store"))]
fn pending_update() -> windows::core::Result<Option<String>> {
    use windows::Services::Store::StoreContext;
    let updates = StoreContext::GetDefault()?.GetAppAndOptionalStorePackageUpdatesAsync()?.join()?;
    // RankDB has no add-ons, so any package update is the app itself.
    if updates.Size()? == 0 {
        return Ok(None);
    }
    let version = updates.GetAt(0)?.Package()?.Id()?.Version()?;
    Ok(Some(format!("{}.{}.{}", version.Major, version.Minor, version.Build)))
}

/// Opens RankDB's page in the Microsoft Store app, where its Update button is.
#[tauri::command]
pub fn open_store_page() -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
        // ShellExecute returns a value above 32 on success.
        let result = unsafe { ShellExecuteW(None, windows::core::w!("open"), STORE_PAGE, None, None, SW_SHOWNORMAL) };
        if result.0 as isize <= 32 {
            return Err(crate::text::text("errors.storeUpdates.openFailed").into());
        }
    }
    Ok(())
}
