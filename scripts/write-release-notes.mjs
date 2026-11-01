// Writes release/notes.md, the GitHub release's text: this version's What's New
// (src/text/whats-new.txt, read the same way as src/data/whatsNew.ts), each note a bold title over
// its description.
//
//   node scripts/write-release-notes.mjs <version>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!version) throw new Error("usage: node scripts/write-release-notes.mjs <version>");

const VERSION_LINE = /^v?(\d+\.\d+\.\d+)$/i;
const text = readFileSync(join(root, "src/text/whats-new.txt"), "utf8");
const notes = [];
let current = null;
for (const block of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const found = lines[0]?.match(VERSION_LINE)?.[1];
  if (found) {
    current = found;
    lines.shift();
  }
  const [title, ...description] = lines;
  if (title && current === version) notes.push([`- **${title}**`, ...description].join("\n"));
}
if (notes.length === 0) throw new Error(`no What's New notes for ${version} in src/text/whats-new.txt`);

mkdirSync(join(root, "release"), { recursive: true });
writeFileSync(join(root, "release/notes.md"), `${notes.join("\n\n")}\n`);
console.log(`release/notes.md: ${notes.length} notes for ${version}`);
