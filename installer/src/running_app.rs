//! Whether the installed RankDB is running. Its files can't be replaced while it runs, and the
//! silent NSIS installer would otherwise end it without letting it save.

use std::path::Path;

use windows::core::PWSTR;
use windows::Win32::Foundation::CloseHandle;
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};

/// True when a process runs `executable` (compared by full path, ignoring case).
pub fn is_running(executable: &Path) -> bool {
    let Some(file_name) = executable.file_name().and_then(|name| name.to_str()) else {
        return false;
    };
    let wanted = executable.to_string_lossy().to_lowercase();
    // SAFETY: the snapshot handle is closed once; entries are read with their size set.
    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return false;
        };
        let mut entry = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut found = false;
        let mut more = Process32FirstW(snapshot, &mut entry).is_ok();
        while more && !found {
            let length = entry.szExeFile.iter().position(|&unit| unit == 0).unwrap_or(0);
            let name = String::from_utf16_lossy(&entry.szExeFile[..length]);
            // Only processes with the same file name are opened to compare their full path.
            if name.eq_ignore_ascii_case(file_name) {
                found = image_path(entry.th32ProcessID)
                    .is_some_and(|path| path.to_lowercase() == wanted);
            }
            more = Process32NextW(snapshot, &mut entry).is_ok();
        }
        let _ = CloseHandle(snapshot);
        found
    }
}

fn image_path(process_id: u32) -> Option<String> {
    // SAFETY: the process handle is closed once; the buffer length is passed and updated.
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id).ok()?;
        let mut buffer = [0u16; 1024];
        let mut length = buffer.len() as u32;
        let result = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut length,
        );
        let _ = CloseHandle(process);
        result.ok()?;
        Some(String::from_utf16_lossy(&buffer[..length as usize]))
    }
}
