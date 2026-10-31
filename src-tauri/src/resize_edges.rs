//! The window's width is locked to the UI (see src/platform/window.ts); only its height can change.
//! Windows would still show the left/right resize cursor on the side edges and diagonal cursors in
//! the corners, inviting a stretch that can't happen. This intercepts the hit test Windows uses
//! to pick that cursor: side edges become a plain border (normal arrow, no resize), and corners
//! become the top or bottom edge (vertical resize only). Works with and without the native frame.
//! It also drops maximise requests: RankDB has no maximise.

use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    HTBORDER, HTBOTTOM, HTBOTTOMLEFT, HTBOTTOMRIGHT, HTLEFT, HTRIGHT, HTTOP, HTTOPLEFT,
    HTTOPRIGHT, SC_MAXIMIZE, WM_NCHITTEST, WM_SYSCOMMAND,
};

const SUBCLASS_ID: usize = 0x5244_4252; // "RDBR"

unsafe extern "system" fn hit_test(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _data: usize,
) -> LRESULT {
    // No maximise (the window is `maximizable: false`); this catches any SC_MAXIMIZE that still
    // arrives, e.g. after a decorations change re-applies window styles.
    if message == WM_SYSCOMMAND && (wparam.0 as u32 & 0xFFF0) == SC_MAXIMIZE {
        return LRESULT(0);
    }
    let result = unsafe { DefSubclassProc(hwnd, message, wparam, lparam) };
    if message != WM_NCHITTEST {
        return result;
    }
    let mapped = match result.0 as u32 {
        HTLEFT | HTRIGHT => HTBORDER,
        HTTOPLEFT | HTTOPRIGHT => HTTOP,
        HTBOTTOMLEFT | HTBOTTOMRIGHT => HTBOTTOM,
        other => other,
    };
    LRESULT(mapped as isize)
}

/// Installs the hit-test filter. Must run on the thread that owns the window (Tauri's setup does).
pub fn install(raw_hwnd: isize) {
    let hwnd = HWND(raw_hwnd as *mut core::ffi::c_void);
    unsafe {
        let _ = SetWindowSubclass(hwnd, Some(hit_test), SUBCLASS_ID, 0);
    }
}
