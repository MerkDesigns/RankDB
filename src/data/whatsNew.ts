import { uiText } from "../text/index";
/**
 * What's New, shown once after an update (and from Settings → Misc). Newest version first; each
 * entry a title and one sentence, like the old app's whats-new.json.
 */
export interface WhatsNewItem {
  readonly title: string;
  readonly description: string;
}

export const WHATS_NEW: readonly { readonly version: string; readonly items: readonly WhatsNewItem[] }[] = [
  {
    version: "1.0.0",
    items: [
      { title: uiText("whatsNew.redesign.title"), description: uiText("whatsNew.redesign.description") },
      {
        title: uiText("whatsNew.migration.title"),
        description: uiText("whatsNew.migration.description"),
      },
      {
        title: uiText("whatsNew.credentials.title"),
        description: uiText("whatsNew.credentials.description"),
      },
      {
        title: uiText("whatsNew.history.title"),
        description: uiText("whatsNew.history.description"),
      },
      {
        title: uiText("whatsNew.reordering.title"),
        description: uiText("whatsNew.reordering.description"),
      },
    ],
  },
];
