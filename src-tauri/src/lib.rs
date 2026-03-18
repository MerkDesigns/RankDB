use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
struct StoredCredentials {
    email: String,
    password: String,
}

#[cfg(windows)]
mod secure_credentials {
    use super::StoredCredentials;
    use std::iter::once;
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::{GetLastError, ERROR_NOT_FOUND};
    use windows::Win32::Security::Credentials::{
        CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE,
        CRED_TYPE_GENERIC,
    };

    fn target_name(account_id: i64) -> String {
        format!("RankDB/account/{account_id}/credentials")
    }

    fn wide_null(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(once(0)).collect()
    }

    pub fn save(account_id: i64, email: String, password: String) -> Result<(), String> {
        let target_name = target_name(account_id);
        let target_name_wide = wide_null(&target_name);
        let username_wide = wide_null(&email);
        let payload = serde_json::to_vec(&StoredCredentials { email, password })
            .map_err(|error| error.to_string())?;

        let credential = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_name_wide.as_ptr() as *mut _),
            CredentialBlobSize: payload.len() as u32,
            CredentialBlob: payload.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            UserName: PWSTR(username_wide.as_ptr() as *mut _),
            ..Default::default()
        };

        unsafe { CredWriteW(&credential, 0) }
            .map_err(|error| error.message().to_string())
    }

    pub fn load(account_id: i64) -> Result<Option<StoredCredentials>, String> {
        let target_name = target_name(account_id);
        let target_name_wide = wide_null(&target_name);
        let mut credential_ptr = std::ptr::null_mut();

        let read_result = unsafe {
            CredReadW(
                PCWSTR(target_name_wide.as_ptr()),
                CRED_TYPE_GENERIC,
                Some(0),
                &mut credential_ptr,
            )
        };

        if let Err(error) = read_result {
            if unsafe { GetLastError() } == ERROR_NOT_FOUND {
                return Ok(None);
            }

            return Err(error.message().to_string());
        }

        let stored = unsafe {
            let credential = &*credential_ptr;
            let blob = std::slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            );
            let parsed = serde_json::from_slice::<StoredCredentials>(blob);
            CredFree(credential_ptr as _);
            parsed.map_err(|error| error.to_string())?
        };

        Ok(Some(stored))
    }

    pub fn delete(account_id: i64) -> Result<(), String> {
        let target_name = target_name(account_id);
        let target_name_wide = wide_null(&target_name);

        let delete_result =
            unsafe { CredDeleteW(PCWSTR(target_name_wide.as_ptr()), CRED_TYPE_GENERIC, Some(0)) };

        if let Err(error) = delete_result {
            if unsafe { GetLastError() } == ERROR_NOT_FOUND {
                return Ok(());
            }

            return Err(error.message().to_string());
        }

        Ok(())
    }
}

#[cfg(not(windows))]
mod secure_credentials {
    use super::StoredCredentials;

    pub fn save(_account_id: i64, _email: String, _password: String) -> Result<(), String> {
        Err("Windows Credential Manager is only available on Windows.".into())
    }

    pub fn load(_account_id: i64) -> Result<Option<StoredCredentials>, String> {
        Ok(None)
    }

    pub fn delete(_account_id: i64) -> Result<(), String> {
        Ok(())
    }
}

#[tauri::command]
fn save_account_credentials(account_id: i64, email: String, password: String) -> Result<(), String> {
    secure_credentials::save(account_id, email, password)
}

#[tauri::command]
fn load_account_credentials(account_id: i64) -> Result<Option<StoredCredentials>, String> {
    secure_credentials::load(account_id)
}

#[tauri::command]
fn delete_account_credentials(account_id: i64) -> Result<(), String> {
    secure_credentials::delete(account_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            save_account_credentials,
            load_account_credentials,
            delete_account_credentials
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
