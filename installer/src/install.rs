//! Runs the embedded NSIS installer silently and adds the shortcuts the user chose.

use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::{Deserialize, Serialize, Serializer};

use crate::existing_install::{self, ExistingInstall};
use crate::payload::{self, IDENTIFIER, PRODUCT_NAME, PRODUCT_VERSION, SIMULATED};
use crate::running_app;
use crate::shell_paths::{self, KnownFolder};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub location: PathBuf,
    pub start_menu_shortcut: bool,
    pub desktop_shortcut: bool,
    /// Updating an existing installation keeps its location and shortcuts.
    pub update: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallStage {
    Preparing,
    Installing,
    Shortcuts,
    Finishing,
}

#[derive(Debug)]
pub enum InstallError {
    InvalidLocation,
    Prepare,
    Start,
    Failed,
    NotFound,
    Shortcut,
    /// RankDB is open; it must close (and save) before its files are replaced.
    AppRunning,
    /// A newer RankDB is installed. An older app refuses a newer database, so no downgrades.
    NewerInstalled,
}

/// The UI receives a stable kind, never paths or OS error text.
impl Serialize for InstallError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(match self {
            Self::InvalidLocation => "invalidLocation",
            Self::Prepare => "prepare",
            Self::Start => "start",
            Self::Failed => "failed",
            Self::NotFound => "notFound",
            Self::Shortcut => "shortcut",
            Self::AppRunning => "appRunning",
            Self::NewerInstalled => "newerInstalled",
        })
    }
}

/// Dotted numeric versions; missing or non-numeric parts count as 0.
pub fn version_parts(version: &str) -> [u32; 3] {
    let mut parts = version.split('.').map(|part| part.trim().parse().unwrap_or(0));
    [(); 3].map(|_| parts.next().unwrap_or(0))
}

pub fn newer_installed(existing: Option<&ExistingInstall>) -> bool {
    existing.is_some_and(|install| version_parts(&install.version) > version_parts(PRODUCT_VERSION))
}

pub fn app_running() -> bool {
    !SIMULATED
        && existing_install::find(PRODUCT_NAME)
            .is_some_and(|install| running_app::is_running(&install.executable))
}

/// NSIS flags: `/S` silent; fresh installs skip NSIS's own shortcuts (`/NS`) because the chosen ones
/// are created afterwards, and updates keep the existing ones (`/UPDATE`).
fn nsis_flags(update: bool) -> [&'static str; 2] {
    if update {
        ["/S", "/UPDATE"]
    } else {
        ["/S", "/NS"]
    }
}

/// NSIS reads `/D=` raw: it must be the last argument and must not be quoted, even with spaces.
fn nsis_directory_argument(location: &Path) -> Result<String, InstallError> {
    let text = location.to_str().ok_or(InstallError::InvalidLocation)?;
    if !location.is_absolute() || text.contains(['"', '\r', '\n']) {
        return Err(InstallError::InvalidLocation);
    }
    Ok(format!("/D={}", text.trim_end_matches(['\\', '/'])))
}

/// The same names the NSIS uninstaller removes, so uninstalling cleans them up.
fn shortcut_path(folder: KnownFolder) -> Result<PathBuf, InstallError> {
    Ok(shell_paths::known_folder(folder)
        .ok_or(InstallError::Shortcut)?
        .join(format!("{PRODUCT_NAME}.lnk")))
}

/// Updates refresh existing shortcuts; fresh installs create the chosen ones (the UI lists the same).
fn has_shortcut_stage(request: &InstallRequest) -> bool {
    request.update || request.start_menu_shortcut || request.desktop_shortcut
}

pub fn run(request: &InstallRequest, report: impl Fn(InstallStage)) -> Result<(), InstallError> {
    let existing = existing_install::find(PRODUCT_NAME);
    if newer_installed(existing.as_ref()) {
        return Err(InstallError::NewerInstalled);
    }
    let directory = nsis_directory_argument(&request.location)?;
    if SIMULATED {
        return simulate(request, report);
    }
    if app_running() {
        return Err(InstallError::AppRunning);
    }

    report(InstallStage::Preparing);
    let installer = payload::extract().map_err(|_| InstallError::Prepare)?;

    report(InstallStage::Installing);
    let status = Command::new(&installer.path)
        .args(nsis_flags(request.update))
        .raw_arg(directory)
        .status()
        .map_err(|_| InstallError::Start)?;
    if !status.success() {
        return Err(InstallError::Failed);
    }

    let installed = existing_install::find(PRODUCT_NAME).ok_or(InstallError::NotFound)?;
    if has_shortcut_stage(request) {
        report(InstallStage::Shortcuts);
    }
    for (wanted, folder) in [
        (request.start_menu_shortcut, KnownFolder::StartMenuPrograms),
        (request.desktop_shortcut, KnownFolder::Desktop),
    ] {
        let link = shortcut_path(folder)?;
        // An update rewrites the shortcuts that exist (RankDB 0.3's carry its old identity and
        // would split the taskbar); a fresh install creates the chosen ones.
        let write = if request.update { link.exists() } else { wanted };
        if write {
            shell_paths::create_shortcut(&link, &installed.executable, IDENTIFIER)
                .map_err(|_| InstallError::Shortcut)?;
        }
    }

    report(InstallStage::Finishing);
    drop(installer);
    Ok(())
}

/// Development builds walk through the stages without touching the system.
fn simulate(request: &InstallRequest, report: impl Fn(InstallStage)) -> Result<(), InstallError> {
    let pause = || std::thread::sleep(Duration::from_millis(700));
    report(InstallStage::Preparing);
    pause();
    report(InstallStage::Installing);
    pause();
    pause();
    if has_shortcut_stage(request) {
        report(InstallStage::Shortcuts);
        pause();
    }
    report(InstallStage::Finishing);
    pause();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_installs_skip_nsis_shortcuts_and_updates_keep_them() {
        assert_eq!(nsis_flags(false), ["/S", "/NS"]);
        assert_eq!(nsis_flags(true), ["/S", "/UPDATE"]);
    }

    #[test]
    fn the_directory_argument_is_raw_and_unquoted_even_with_spaces() {
        let argument = nsis_directory_argument(Path::new(r"C:\Program Files\RankDB\")).unwrap();
        assert_eq!(argument, r"/D=C:\Program Files\RankDB");
    }

    #[test]
    fn relative_or_quoted_locations_are_rejected() {
        for location in [r"RankDB", r#"C:\Rank"DB"#] {
            assert!(matches!(
                nsis_directory_argument(Path::new(location)),
                Err(InstallError::InvalidLocation)
            ));
        }
    }

    #[test]
    fn versions_compare_numerically() {
        assert!(version_parts("0.3.10") > version_parts("0.3.9"));
        assert!(version_parts("1.0") == version_parts("1.0.0"));
        assert!(version_parts("") < version_parts("0.3.0"));
    }

    #[test]
    fn errors_reach_the_ui_as_content_free_kinds() {
        assert_eq!(serde_json::to_string(&InstallError::Start).unwrap(), "\"start\"");
        assert_eq!(serde_json::to_string(&InstallError::AppRunning).unwrap(), "\"appRunning\"");
    }
}
