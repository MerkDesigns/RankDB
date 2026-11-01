import { settingsStore, type Design } from "../data/settingsStore";
import { labStore, type BackdropId } from "../lab/store";

/** The backdrop each design shows. */
export const DESIGN_BACKDROPS: Readonly<Record<Design, BackdropId>> = { flat: "flat", haze: "ambient" };

/**
 * Keeps the backdrop on the chosen design (Settings → Visuals → Designs). The backdrop itself stays
 * lab state, which the glass engine and Backdrop read. In dev builds the lab can still preview other
 * backdrops: one of those is left alone at startup, and picking a design replaces it.
 */
export function startDesigns() {
  let design = settingsStore.get().design;
  const apply = () => {
    if (labStore.get().backdrop !== DESIGN_BACKDROPS[design]) labStore.set({ backdrop: DESIGN_BACKDROPS[design] });
  };
  const designBackdrops: readonly BackdropId[] = Object.values(DESIGN_BACKDROPS);
  if (!import.meta.env.DEV || designBackdrops.includes(labStore.get().backdrop)) apply();
  settingsStore.subscribe(() => {
    if (settingsStore.get().design === design) return;
    design = settingsStore.get().design;
    apply();
  });
}
