//! Copying to the Windows clipboard.
//!
//! Secrets (email, password) are marked so Windows keeps them out of clipboard history (Win+V),
//! cloud clipboard sync and clipboard monitors, and they are cleared after a delay, but only if the
//! clipboard still holds them: anything copied since is left alone.

use std::thread;
use std::time::Duration;

/// Copies `text`. With `secret`, it stays out of clipboard history and is cleared after
/// `clear_after` (if given) unless something else was copied in the meantime.
pub fn copy(text: &str, secret: bool, clear_after: Option<Duration>) -> Result<(), String> {
    let sequence = platform::write(text, secret)?;
    if let Some(delay) = clear_after {
        thread::spawn(move || {
            thread::sleep(delay);
            platform::clear_if_unchanged(sequence);
        });
    }
    Ok(())
}

#[cfg(windows)]
mod platform {
    use std::thread;
    use std::time::Duration;
    use windows::core::w;
    use windows::Win32::Foundation::{GlobalFree, HANDLE, HGLOBAL};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardSequenceNumber, OpenClipboard, RegisterClipboardFormatW,
        SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
    use windows::Win32::System::Ole::CF_UNICODETEXT;

    /// Another app may hold the clipboard for a moment; retry briefly before giving up.
    fn open() -> Result<(), String> {
        for _ in 0..10 {
            // SAFETY: no owner window; closed by the caller.
            if unsafe { OpenClipboard(None) }.is_ok() {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(20));
        }
        Err(crate::text::text("errors.clipboard.busy").into())
    }

    /// Moves `bytes` into a movable global block, as the clipboard requires.
    fn global(bytes: &[u8]) -> Result<HGLOBAL, String> {
        // SAFETY: the block is at least `bytes.len()` long, locked while written, and on success
        // owned by the clipboard (freed here only if SetClipboardData fails).
        unsafe {
            let handle = GlobalAlloc(GMEM_MOVEABLE, bytes.len().max(1)).map_err(|error| error.message())?;
            let target = GlobalLock(handle);
            if target.is_null() {
                let _ = GlobalFree(Some(handle));
                return Err(crate::text::text("errors.clipboard.copyFailed").into());
            }
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), target.cast::<u8>(), bytes.len());
            let _ = GlobalUnlock(handle);
            Ok(handle)
        }
    }

    fn set(format: u32, bytes: &[u8]) -> Result<(), String> {
        let handle = global(bytes)?;
        // SAFETY: the clipboard is open; it takes ownership of `handle` on success.
        if let Err(error) = unsafe { SetClipboardData(format, Some(HANDLE(handle.0))) } {
            // SAFETY: still ours, since the clipboard refused it.
            let _ = unsafe { GlobalFree(Some(handle)) };
            return Err(error.message());
        }
        Ok(())
    }

    pub fn write(text: &str, secret: bool) -> Result<u32, String> {
        let utf16: Vec<u8> = text
            .encode_utf16()
            .chain(std::iter::once(0))
            .flat_map(u16::to_le_bytes)
            .collect();
        open()?;
        let result = (|| -> Result<(), String> {
            // SAFETY: the clipboard is open.
            unsafe { EmptyClipboard() }.map_err(|error| error.message())?;
            set(u32::from(CF_UNICODETEXT.0), &utf16)?;
            if secret {
                // Windows' documented opt-outs: no history, no cloud sync, no monitors.
                // SAFETY: registering a format name is always safe.
                let zero = 0u32.to_le_bytes();
                set(unsafe { RegisterClipboardFormatW(w!("CanIncludeInClipboardHistory")) }, &zero)?;
                set(unsafe { RegisterClipboardFormatW(w!("CanUploadToCloudClipboard")) }, &zero)?;
                set(unsafe { RegisterClipboardFormatW(w!("ExcludeClipboardContentFromMonitorProcessing")) }, &zero)?;
            }
            Ok(())
        })();
        // SAFETY: opened above.
        let _ = unsafe { CloseClipboard() };
        result?;
        // SAFETY: plain query.
        Ok(unsafe { GetClipboardSequenceNumber() })
    }

    pub fn clear_if_unchanged(sequence: u32) {
        // SAFETY: plain query; the clipboard is only emptied while still holding our copy.
        if unsafe { GetClipboardSequenceNumber() } != sequence || open().is_err() {
            return;
        }
        unsafe {
            if GetClipboardSequenceNumber() == sequence {
                let _ = EmptyClipboard();
            }
            let _ = CloseClipboard();
        }
    }
}

#[cfg(not(windows))]
mod platform {
    pub fn write(_: &str, _: bool) -> Result<u32, String> {
        Err(crate::text::text("errors.clipboard.unsupportedPlatform").into())
    }

    pub fn clear_if_unchanged(_: u32) {}
}
