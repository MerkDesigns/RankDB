//! WebView2 is Edge, and keeps Edge's browser features unless they are switched off: print and
//! save-page shortcuts, find-in-page, reload, back/forward, caret browsing, DevTools keys, pinch
//! zoom, swipe navigation, the link status bar, new windows and the page context menu. None of them
//! belong in RankDB. Form autofill and password saving are off too: account emails and passwords
//! typed into RankDB must never be offered to, or stored by, Edge's own password manager.
//!
//! Ported from TaskMap-Refactor (src-tauri/src/webview_browser_features.rs).

/// Context menu entries kept in an editable field; everything else (spelling, emoji, Inspect) goes.
const TEXT_FIELD_MENU_ITEMS: [&str; 4] = ["cut", "copy", "paste", "selectAll"];

/// One context menu entry as the filter sees it: a separator, or a named item.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MenuEntry<'a> {
    Separator,
    Item(&'a str),
}

/// Indices to remove, highest first, so the editable-field menu keeps only the editing commands
/// with no leading, trailing or doubled separators.
fn text_field_menu_removals(entries: &[MenuEntry<'_>]) -> Vec<usize> {
    let mut kept: Vec<usize> = Vec::new();
    for (index, entry) in entries.iter().enumerate() {
        let keep = match entry {
            MenuEntry::Item(name) => TEXT_FIELD_MENU_ITEMS.contains(name),
            MenuEntry::Separator => kept
                .last()
                .is_some_and(|&last| entries[last] != MenuEntry::Separator),
        };
        if keep {
            kept.push(index);
        }
    }
    if kept
        .last()
        .is_some_and(|&last| entries[last] == MenuEntry::Separator)
    {
        kept.pop();
    }
    (0..entries.len())
        .rev()
        .filter(|index| !kept.contains(index))
        .collect()
}

/// Turns off WebView2's browser features for `window`. Failures are logged: an older WebView2
/// runtime without some of these settings still runs RankDB.
pub(crate) fn disable_browser_features(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    if let Err(error) = window.with_webview(|webview| {
        // SAFETY: called on the webview's own thread by `with_webview`; COM calls on live objects.
        let result = unsafe {
            webview
                .controller()
                .CoreWebView2()
                .and_then(|core| configure(&core))
        };
        if let Err(error) = result {
            eprintln!("Failed to disable WebView2 browser features: {error}");
        }
    }) {
        eprintln!("Failed to reach the webview to disable browser features: {error}");
    }
    #[cfg(not(windows))]
    let _ = window;
}

#[cfg(windows)]
unsafe fn configure(
    core: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2,
) -> windows_core::Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Settings3, ICoreWebView2Settings4, ICoreWebView2Settings5,
        ICoreWebView2Settings6, ICoreWebView2_11,
    };
    use webview2_com::{ContextMenuRequestedEventHandler, NewWindowRequestedEventHandler};
    use windows_core::Interface;

    unsafe {
        let settings = core.Settings()?;
        // Editing keys (Ctrl+C/V/X/A/Z) stay; only keys that reach browser features are dropped.
        settings
            .cast::<ICoreWebView2Settings3>()?
            .SetAreBrowserAcceleratorKeysEnabled(false)?;
        settings.SetIsStatusBarEnabled(false)?;
        settings.SetIsZoomControlEnabled(false)?;
        let autofill = settings.cast::<ICoreWebView2Settings4>()?;
        autofill.SetIsGeneralAutofillEnabled(false)?;
        autofill.SetIsPasswordAutosaveEnabled(false)?;
        settings
            .cast::<ICoreWebView2Settings5>()?
            .SetIsPinchZoomEnabled(false)?;
        settings
            .cast::<ICoreWebView2Settings6>()?
            .SetIsSwipeNavigationEnabled(false)?;

        // A middle-click or Shift-click on a link would open the page in a new RankDB window.
        let mut token = 0;
        core.add_NewWindowRequested(
            &NewWindowRequestedEventHandler::create(Box::new(|_, args| {
                if let Some(args) = args {
                    args.SetHandled(true)?;
                }
                Ok(())
            })),
            &mut token,
        )?;

        core.cast::<ICoreWebView2_11>()?.add_ContextMenuRequested(
            &ContextMenuRequestedEventHandler::create(Box::new(|_, args| {
                if let Some(args) = args {
                    filter_context_menu(&args)?;
                }
                Ok(())
            })),
            &mut token,
        )?;
    }
    Ok(())
}

/// RankDB draws its own menus; Edge's appears only in editable fields, cut down to editing.
#[cfg(windows)]
unsafe fn filter_context_menu(
    args: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2ContextMenuRequestedEventArgs,
) -> windows_core::Result<()> {
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR;

    unsafe {
        let mut editable = windows_core::BOOL::default();
        args.ContextMenuTarget()?.IsEditable(&mut editable)?;
        if !editable.as_bool() {
            return args.SetHandled(true);
        }
        let items = args.MenuItems()?;
        let mut count = 0;
        items.Count(&mut count)?;
        let mut menu = Vec::with_capacity(count as usize);
        for index in 0..count {
            let item = items.GetValueAtIndex(index)?;
            let mut kind = Default::default();
            item.Kind(&mut kind)?;
            let mut name = windows_core::PWSTR::null();
            item.Name(&mut name)?;
            menu.push((
                kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR,
                webview2_com::take_pwstr(name),
            ));
        }
        let entries: Vec<MenuEntry<'_>> = menu
            .iter()
            .map(|(separator, name)| {
                if *separator {
                    MenuEntry::Separator
                } else {
                    MenuEntry::Item(name)
                }
            })
            .collect();
        for index in text_field_menu_removals(&entries) {
            items.RemoveValueAtIndex(index as u32)?;
        }
        let mut remaining = 0;
        items.Count(&mut remaining)?;
        if remaining == 0 {
            args.SetHandled(true)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{text_field_menu_removals, MenuEntry::*};

    #[test]
    fn keeps_only_editing_commands_in_a_text_field_menu() {
        let entries = [
            Item("emoji"),
            Separator,
            Item("undo"),
            Item("redo"),
            Separator,
            Item("cut"),
            Item("copy"),
            Item("paste"),
            Item("pasteAndMatchStyle"),
            Separator,
            Item("selectAll"),
            Separator,
            Item("spellCheck"),
            Separator,
            Item("inspectElement"),
        ];

        let removals = text_field_menu_removals(&entries);

        let kept: Vec<_> = (0..entries.len())
            .filter(|index| !removals.contains(index))
            .map(|index| entries[index])
            .collect();
        assert_eq!(
            kept,
            [
                Item("cut"),
                Item("copy"),
                Item("paste"),
                Separator,
                Item("selectAll")
            ]
        );
        assert!(removals.windows(2).all(|pair| pair[0] > pair[1]));
    }

    #[test]
    fn removes_everything_when_no_editing_command_is_offered() {
        let entries = [Item("spellCheck"), Separator, Item("inspectElement")];

        assert_eq!(text_field_menu_removals(&entries), [2, 1, 0]);
    }
}
