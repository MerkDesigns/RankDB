//! The NSIS installer embedded at build time, and the product facts it was built from.

use std::io;
use std::path::PathBuf;

pub const PRODUCT_NAME: &str = env!("RANKDB_PRODUCT_NAME");
pub const PRODUCT_VERSION: &str = env!("RANKDB_PRODUCT_VERSION");
/// The app's identifier: NSIS gives its shortcuts this AppUserModelID, so ours match.
pub const IDENTIFIER: &str = env!("RANKDB_IDENTIFIER");

#[cfg(embedded_payload)]
static NSIS_INSTALLER: &[u8] = include_bytes!(env!("RANKDB_PAYLOAD_PATH"));

/// Development builds carry no payload and only simulate installing.
pub const SIMULATED: bool = cfg!(not(embedded_payload));

/// The extracted NSIS installer; its private temporary folder is removed on drop.
#[cfg_attr(not(embedded_payload), allow(dead_code))]
pub struct ExtractedInstaller {
    folder: PathBuf,
    pub path: PathBuf,
}

impl Drop for ExtractedInstaller {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.folder);
    }
}

#[cfg(embedded_payload)]
pub fn extract() -> io::Result<ExtractedInstaller> {
    use std::time::{SystemTime, UNIX_EPOCH};

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_nanos());
    let folder = std::env::temp_dir().join(format!("rankdb-setup-{}-{nanos}", std::process::id()));
    // A fresh folder (create_dir fails if it exists), so nothing else can have planted the file.
    std::fs::create_dir(&folder)?;
    let extracted = ExtractedInstaller {
        path: folder.join(format!("{PRODUCT_NAME} Setup.exe")),
        folder,
    };
    std::fs::write(&extracted.path, NSIS_INSTALLER)?;
    Ok(extracted)
}

#[cfg(not(embedded_payload))]
pub fn extract() -> io::Result<ExtractedInstaller> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "development builds carry no installer",
    ))
}
