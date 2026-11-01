import notes from "../text/whats-new.txt?raw";

/**
 * What's New, shown once after an update (and from Settings → Misc). Written as plain text in
 * src/text/whats-new.txt (docs/EDITING-TEXT.md): a line that is only a version number starts that
 * version's notes; blank lines separate notes; a note's first line is its title and the lines
 * under it are its description, line breaks kept. Newest version first.
 */
export interface WhatsNewItem {
  readonly title: string;
  readonly description: string;
}

export interface WhatsNewEntry {
  readonly version: string;
  readonly items: readonly WhatsNewItem[];
}

const VERSION_LINE = /^v?(\d+\.\d+\.\d+)$/i;

export function parseWhatsNew(text: string): WhatsNewEntry[] {
  const entries: { version: string; items: WhatsNewItem[] }[] = [];
  for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const version = lines[0]?.match(VERSION_LINE)?.[1];
    if (version) {
      entries.push({ version, items: [] });
      lines.shift();
    }
    const [title, ...description] = lines;
    if (title) entries.at(-1)?.items.push({ title, description: description.join("\n") });
  }
  return entries.filter((entry) => entry.items.length > 0);
}

export const WHATS_NEW: readonly WhatsNewEntry[] = parseWhatsNew(notes);
