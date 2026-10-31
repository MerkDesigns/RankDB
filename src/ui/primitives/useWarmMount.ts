import { useEffect, useState } from "react";

/**
 * For surfaces kept mounted while hidden (Settings, the rank picker): false until the app is idle
 * after startup, then true for good. Mounting them then, hidden, means opening one never pays for
 * a React render; while hidden they are `display: none` and cost nothing.
 */
export function useWarmMount(enabled = true): boolean {
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (!enabled || warm) return;
    const handle = requestIdleCallback(() => setWarm(true), { timeout: 2000 });
    return () => cancelIdleCallback(handle);
  }, [enabled, warm]);
  return warm;
}
