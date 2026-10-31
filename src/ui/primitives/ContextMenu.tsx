import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronRight, Info, type LucideIcon } from "lucide-react";
import { aimsAtSubmenu, type Point } from "./menuAim";

/**
 * TaskMap's context menu (src/ui/primitives/ContextMenu.tsx + contextMenu.css), ported: an opaque
 * panel at the pointer, kept inside the window. Arrow keys move between items, Enter/Space picks,
 * Escape or a press outside closes. It fades out briefly after closing.
 *
 * Submenus (the old app's Games Dodged and Move To) open beside their item on hover, click or →,
 * and close with ← or when the pointer leaves both.
 */

export interface MenuItem {
  readonly key: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly onSelect: () => void;
  readonly tone?: "danger";
  readonly disabled?: boolean;
  /** Picking it leaves the menu open (a counter's buttons, e.g. Add Dodge). */
  readonly keepOpen?: boolean;
  /** A small icon button at the item's end (e.g. Reset beside Add dodge); keeps the menu open. */
  readonly aside?: { readonly label: string; readonly Icon: LucideIcon; readonly onSelect: () => void; readonly disabled?: boolean };
}

/** An item that opens a submenu beside it. */
export interface MenuSubmenu {
  readonly key: string;
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly submenu: readonly MenuEntry[];
  readonly disabled?: boolean;
}

/** A divider between groups of items. */
export const MENU_DIVIDER = "divider" as const;
/** A small muted heading over the items that follow, optionally with a value ("Last edit: …"). */
export interface MenuSection {
  readonly section: string;
  readonly value?: string;
}
/** A read-only block: a small label, a value and an optional detail line (e.g. the next penalty). */
export interface MenuNote {
  readonly note: string;
  readonly value: string;
  readonly detail?: string;
  /** Explanation behind an info icon on the block. */
  readonly hint?: string;
}
export type MenuEntry = MenuItem | MenuSubmenu | MenuSection | MenuNote | typeof MENU_DIVIDER;

/** TaskMap's menu exit (motion.menuExit). */
const EXIT_MS = 90;
const EDGE = 8;
/** Grace for the pointer to travel from an item into its submenu. */
const SUBMENU_CLOSE_MS = 180;

export function ContextMenu({
  open,
  x,
  y,
  label,
  entries,
  onClose,
}: {
  readonly open: boolean;
  /** Where it opens (the pointer), in viewport pixels. */
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly entries: readonly MenuEntry[];
  readonly onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const subRef = useRef<HTMLElement>(null);
  const [rendered, setRendered] = useState(open);
  const [sub, setSub] = useState<{ readonly key: string; readonly anchor: DOMRect; readonly focus: boolean } | null>(null);
  const closeTimer = useRef(0);
  const aimTimer = useRef(0);
  const aimOrigin = useRef<Point | null>(null);
  const pointer = useRef<Point | null>(null);
  const pendingHover = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const shownEntries = useRef(entries);
  if (open) shownEntries.current = entries;

  // Kept rendered for its exit animation.
  useEffect(() => {
    if (open) {
      setRendered(true);
      return;
    }
    setSub(null);
    window.clearTimeout(aimTimer.current);
    window.clearTimeout(closeTimer.current);
    pendingHover.current = null;
    aimOrigin.current = null;
    const timer = setTimeout(() => setRendered(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  // At the pointer, flipped or shifted so it stays inside the window; first item focused.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!open || !rendered || !menu) return;
    setSub(null);
    window.clearTimeout(aimTimer.current);
    window.clearTimeout(closeTimer.current);
    pendingHover.current = null;
    aimOrigin.current = null;
    const left = x + menu.offsetWidth > window.innerWidth - EDGE ? x - menu.offsetWidth : x;
    const top = y + menu.offsetHeight > window.innerHeight - EDGE ? y - menu.offsetHeight : y;
    menu.style.left = `${Math.max(EDGE, left)}px`;
    menu.style.top = `${Math.max(EDGE, top)}px`;
    items(menu)[0]?.focus();
  }, [open, rendered, x, y]);

  // A submenu sits beside its item: right if it fits, else left; shifted up to stay inside.
  useLayoutEffect(() => {
    const panel = subRef.current;
    if (!sub || !panel) return;
    const { anchor } = sub;
    const right = anchor.right + 4;
    const left = right + panel.offsetWidth > window.innerWidth - EDGE ? anchor.left - 4 - panel.offsetWidth : right;
    const top = Math.min(anchor.top - 5, window.innerHeight - EDGE - panel.offsetHeight);
    panel.style.left = `${Math.max(EDGE, left)}px`;
    panel.style.top = `${Math.max(EDGE, top)}px`;
    if (sub.focus) items(panel)[0]?.focus();
  }, [sub]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !subRef.current?.contains(target)) onCloseRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    const onBlur = () => onCloseRef.current();
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [open]);

  useEffect(() => () => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(aimTimer.current);
  }, []);

  if (!rendered) return null;

  const keepSub = () => {
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(aimTimer.current);
    pendingHover.current = null;
  };
  const aiming = () => {
    const panel = subRef.current;
    return panel && aimOrigin.current && pointer.current && aimsAtSubmenu(aimOrigin.current, pointer.current, panel.getBoundingClientRect());
  };
  const hover = (action: () => void) => {
    keepSub();
    if (!aiming()) {
      action();
      return;
    }
    // Never extend indefinitely: stopping over another item eventually selects that item.
    pendingHover.current = action;
    aimTimer.current = window.setTimeout(() => {
      pendingHover.current = null;
      action();
    }, 350);
  };
  const leaveSub = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setSub(null), SUBMENU_CLOSE_MS);
  };
  const openSub = (entry: MenuSubmenu, button: HTMLElement, focus: boolean) => {
    keepSub();
    if (entry.disabled) return;
    setSub((current) =>
      current?.key === entry.key && !focus ? current : { key: entry.key, anchor: button.getBoundingClientRect(), focus },
    );
  };
  const pick = (onSelect: () => void, keepOpen = false) => {
    if (!keepOpen) onCloseRef.current();
    onSelect();
  };

  const render = (list: readonly MenuEntry[], nested: boolean) =>
    list.map((entry, index) => {
      if (entry === MENU_DIVIDER) return <span key={`divider-${index}`} className="context-menu-divider" role="separator" />;
      if ("section" in entry) {
        return (
          <span key={`section-${index}`} className="context-menu-section" role="presentation">
            {entry.section}
            {entry.value && <span className="context-menu-section-value">{entry.value}</span>}
          </span>
        );
      }
      if ("note" in entry) {
        return (
          <span key={`note-${index}`} className="context-menu-note" role="presentation">
            <span className="context-menu-note-label">
              {entry.note}
              {entry.hint && (
                // The old app's info popout: shown while the icon is hovered or focused.
                <span className="context-menu-hint">
                  <button type="button" className="context-menu-hint-button" aria-label={entry.hint}>
                    <Info size={13} strokeWidth={2.35} aria-hidden="true" />
                  </button>
                  <span className="context-menu-hint-popout" role="tooltip">
                    {entry.hint}
                  </span>
                </span>
              )}
            </span>
            {entry.value && <span className="context-menu-note-value">{entry.value}</span>}
            {entry.detail && <span className="context-menu-note-detail">{entry.detail}</span>}
          </span>
        );
      }
      if ("submenu" in entry) {
        return (
          <button
            key={entry.key}
            type="button"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={sub?.key === entry.key}
            className="context-menu-item"
            data-open={sub?.key === entry.key || undefined}
            disabled={entry.disabled}
            onPointerEnter={(event) => {
              if (nested) return;
              const button = event.currentTarget;
              pointer.current = { x: event.clientX, y: event.clientY };
              hover(() => {
                aimOrigin.current = pointer.current;
                openSub(entry, button, false);
              });
            }}
            onPointerLeave={leaveSub}
            onClick={(event) => openSub(entry, event.currentTarget, false)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                event.stopPropagation();
                openSub(entry, event.currentTarget, true);
              }
            }}
          >
            <entry.Icon size={16} strokeWidth={2.1} className="context-menu-icon" aria-hidden="true" />
            <span className="context-menu-label">{entry.label}</span>
            <ChevronRight size={15} strokeWidth={2.2} className="context-menu-chevron" aria-hidden="true" />
          </button>
        );
      }
      const item = (
        <button
          key={entry.key}
          type="button"
          role="menuitem"
          className="context-menu-item"
          data-tone={entry.tone}
          disabled={entry.disabled}
          onPointerEnter={nested ? undefined : (event) => {
            pointer.current = { x: event.clientX, y: event.clientY };
            hover(() => setSub(null));
          }}
          onClick={() => pick(entry.onSelect, entry.keepOpen)}
        >
          <entry.Icon size={16} strokeWidth={2.1} className="context-menu-icon" aria-hidden="true" />
          <span className="context-menu-label">{entry.label}</span>
        </button>
      );
      if (!entry.aside) return item;
      const { aside } = entry;
      return (
        <span key={entry.key} className="context-menu-split">
          {item}
          <button
            type="button"
            role="menuitem"
            className="context-menu-item context-menu-aside"
            title={aside.label}
            aria-label={aside.label}
            disabled={aside.disabled}
            onClick={() => pick(aside.onSelect, true)}
          >
            <aside.Icon size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      );
    });

  const navigate = (panel: HTMLElement | null, event: ReactKeyboardEvent) => {
    if (!panel) return;
    const list = items(panel);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step) {
      event.preventDefault();
      list[(index + step + list.length) % list.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? list[0] : list[list.length - 1])?.focus();
    } else if (event.key === "Tab") {
      onCloseRef.current();
    }
  };

  const submenu = sub ? shownEntries.current.find((entry): entry is MenuSubmenu => typeof entry === "object" && "submenu" in entry && entry.key === sub.key) : undefined;
  return (
    <>
      <nav
        ref={ref}
        className="context-menu"
        role="menu"
        aria-label={label}
        data-motion-state={open ? "open" : "closing"}
        onContextMenu={(event) => event.preventDefault()}
        onPointerMoveCapture={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
          const trigger = (event.target as Element).closest('[aria-expanded="true"]');
          if (trigger) aimOrigin.current = pointer.current;
          else if (pendingHover.current && !aiming()) {
            const action = pendingHover.current;
            keepSub();
            action();
          }
        }}
        onKeyDown={(event) => {
          keepSub();
          navigate(ref.current, event);
        }}
      >
        {render(shownEntries.current, false)}
      </nav>
      {submenu && (
        <nav
          ref={subRef}
          className="context-menu context-menu-sub"
          role="menu"
          aria-label={submenu.label}
          data-motion-state={open ? "open" : "closing"}
          onContextMenu={(event) => event.preventDefault()}
          onPointerEnter={keepSub}
          onPointerLeave={leaveSub}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setSub(null);
              ref.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
              return;
            }
            navigate(subRef.current, event);
          }}
        >
          {render(submenu.submenu, true)}
        </nav>
      )}
    </>
  );
}

function items(menu: HTMLElement) {
  return [...menu.querySelectorAll<HTMLButtonElement>(".context-menu-item:not(:disabled)")];
}
