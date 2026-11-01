// Writes release/latest.json, the feed in-app updates read from the newest GitHub release
// (plugins.updater.endpoints). It points at the signed NSIS installer of this version, attached to
// the release tagged v<version>.
//
//   node scripts/write-update-feed.mjs <version>
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!version) throw new Error("usage: node scripts/write-update-feed.mjs <version>");

const config = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
const repository = config.plugins.updater.endpoints[0].match(/github\.com\/([^/]+\/[^/]+)\//)[1];
const installer = `${config.productName}_${version}_x64-setup.exe`;
const signatureFile = join(root, "src-tauri/target/release/bundle/nsis", `${installer}.sig`);
if (!existsSync(signatureFile)) throw new Error(`missing ${signatureFile}: build with the signing key first`);

const platform = {
  signature: readFileSync(signatureFile, "utf8").trim(),
  url: `https://github.com/${repository}/releases/download/v${version}/${installer}`,
};
const feed = {
  version,
  notes: `RankDB ${version}`,
  pub_date: new Date().toISOString(),
  // Both names, as tauri-action wrote them for 0.3: the installer-specific one wins where known.
  platforms: { "windows-x86_64": platform, "windows-x86_64-nsis": platform },
};
mkdirSync(join(root, "release"), { recursive: true });
writeFileSync(join(root, "release/latest.json"), `${JSON.stringify(feed, null, 2)}\n`);
console.log(`release/latest.json → ${platform.url}`);
