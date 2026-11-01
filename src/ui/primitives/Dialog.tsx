import { uiText } from "../../text/index";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Glass } from "../../glass/Glass";
import { MODAL_PRESENCE, PRESENCE_PRESETS } from "./motion/presence";
import { usePresence } from "./motion/usePresence";
import { useWarmMount } from "./useWarmMount";

/**
 * How many dialogs are on screen. While any is, the root carries `data-dialog-open`, which stops
 * the rank effects under the scrim (rankEffects.ts): their animated layers made every frame of a dialog's
 * own motion (tabs, scrolling) re-layerize the page, at ~13 ms a frame.
 */
let dialogsShown = 0;
function markDialogShown() {
  dialogsShown += 1;
  document.documentElement.dataset.dialogOpen = "";
  return () => {
    dialogsShown -= 1;
    if (dialogsShown === 0) delete document.documentElement.dataset.dialogOpen;
  };
}

/**
 * A modal dialog, TaskMap style: a Major glass panel centred over a scrim, opening and closing with
 * TaskMap's dialog presence (material fade, the scrim fading with it). Escape, the close button or
 * a press on the scrim close it. Its content stays mounted while it animates out; with
 * `keepMounted` it stays mounted for good (hidden), so opening it again never re-renders it.
 */
export function Dialog({
  open,
  onClose,
  title,
  className,
  keepMounted = false,
  dismissible = true,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: ReactNode;
  /** The glass panel's class: its size and padding. */
  readonly className?: string;
  readonly keepMounted?: boolean;
  /** Required migrations cannot be dismissed with Escape, the scrim or a close button. */
  readonly dismissible?: boolean;
  readonly children: ReactNode;
}) {
  const titleId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // While closing, the content that was open stays on screen.
  const shown = useRef({ title, children });
  if (open) shown.current = { title, children };
  const present = usePresence(anchorRef, {
    open,
    channels: PRESENCE_PRESETS.materialFade,
    timing: MODAL_PRESENCE,
    onProgress: (progress) => {
      if (scrimRef.current) scrimRef.current.style.opacity = String(progress);
    },
  });

  useEffect(() => {
    if (!open || !present) return;
    // Focus the first field if there is one, else the dialog itself (so Escape works).
    const anchor = anchorRef.current;
    (anchor?.querySelector<HTMLElement>("[data-autofocus]") ?? anchor)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (dismissible && event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, present, dismissible]);

  const shownNow = open || present;
  useEffect(() => (shownNow ? markDialogShown() : undefined), [shownNow]);

  const warm = useWarmMount(keepMounted);
  useEffect(() => {
    // Release closed form values (including credentials/master passwords) after exit completes.
    if (!open && !present && !keepMounted) shown.current = { title: null, children: null };
  }, [open, present, keepMounted]);
  if (!present && !(keepMounted && warm)) return null;
  // The scrim is a sibling of the panel, never its ancestor: fading an ancestor would flatten the
  // panel's blur.
  return (
    <div className="dialog-layer" hidden={!present && !open}>
      <div
        ref={scrimRef}
        className="dialog-scrim"
        style={{ opacity: 0 }}
        onPointerDown={() => {
          if (open && dismissible) onCloseRef.current();
        }}
      />
      <div ref={anchorRef} className="dialog-anchor" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <Glass role="major" floating className={["dialog", className].filter(Boolean).join(" ")}>
          <div className="dialog-head">
            <h2 id={titleId}>{shown.current.title}</h2>
            {dismissible && <button type="button" className="dialog-close" aria-label={uiText("common.close")} onClick={() => onCloseRef.current()}>
              <X size={18} strokeWidth={2.2} />
            </button>}
          </div>
          {shown.current.children}
        </Glass>
      </div>
    </div>
  );
}
