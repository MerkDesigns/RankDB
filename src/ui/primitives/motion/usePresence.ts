import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPresence, type Presence, type PresenceChannels, type PresenceTiming } from "./presence";

/**
 * Keeps a surface mounted while it animates out (TaskMap's ModalPresence / usePresenceMotion).
 * Returns whether to render it; `ref` must point at the surface once it renders.
 */
export function usePresence(
  ref: RefObject<HTMLElement | null>,
  {
    open,
    channels,
    timing,
    onProgress,
    onExited,
  }: {
    readonly open: boolean;
    readonly channels: PresenceChannels | (() => PresenceChannels);
    readonly timing: { readonly enter: PresenceTiming; readonly exit: PresenceTiming };
    readonly onProgress?: (progress: number) => void;
    readonly onExited?: () => void;
  },
): boolean {
  const [present, setPresent] = useState(open);
  const motion = useRef<Presence | null>(null);
  const latest = useRef({ open, onProgress, onExited });
  latest.current = { open, onProgress, onExited };

  useLayoutEffect(() => {
    if (open && !present) setPresent(true);
  }, [open, present]);

  useLayoutEffect(() => {
    const surface = ref.current;
    if (!present || !surface) return;
    const presence = createPresence(surface, {
      channels,
      ...timing,
      onProgress: (progress) => latest.current.onProgress?.(progress),
      onComplete: (endpoint) => {
        if (endpoint !== "hidden" || latest.current.open) return;
        setPresent(false);
        latest.current.onExited?.();
      },
    });
    motion.current = presence;
    return () => {
      presence.destroy();
      motion.current = null;
    };
    // Channels and timing are constants per surface.
  }, [present, ref]);

  useLayoutEffect(() => {
    if (!present) return;
    if (open) motion.current?.show();
    else motion.current?.hide();
  }, [open, present]);

  return present;
}
