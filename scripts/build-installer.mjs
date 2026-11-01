// Builds RankDB Setup for the published app: the app's NSIS installer first, then the setup window
// that embeds it (installer/, docs/INSTALLER.md). Output: release/RankDB_<version>_installer.exe. The
// NSIS installer (and its .sig) that in-app updates download stays in
// src-tauri/target/release/bundle/nsis. The version is package.json's, like the app's.
//
//   node scripts/build-installer.mjs                   the published app
//   node scripts/build-installer.mjs --config <file>   an extra app config on top (the sandbox builds)
//   node scripts/build-installer.mjs --skip-app        reuse the NSIS installer from the last build
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const skipApp = args.includes("--skip-app");
const extraConfig = option("--config");

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit", shell: true, ...options });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed`);
};
const readJson = (file) => JSON.parse(readFileSync(resolve(root, file), "utf8"));

// The app build's configs, merged the way Tauri merges them (later files win, top-level fields).
const configs = ["src-tauri/tauri.release.conf.json"];
if (extraConfig) configs.push(resolve(extraConfig));
const merged = Object.assign({}, readJson("src-tauri/tauri.conf.json"), ...configs.map(readJson));
const productName = merged.productName;
// tauri.conf.json's version is "../package.json"; only an extra config (the sandbox) sets its own.
const version = /^\d/.test(merged.version) ? merged.version : readJson("package.json").version;
// The update signature (.sig) needs the signing key, which only GitHub has (release.yml). Without
// it, as on a PC, the installer is built unsigned: fine to install and test, not to publish.
const signed = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY);
if (!signed && merged.bundle?.createUpdaterArtifacts) {
  const unsignedFile = join(root, "src-tauri/target/installer-unsigned.conf.json");
  mkdirSync(dirname(unsignedFile), { recursive: true });
  writeFileSync(unsignedFile, JSON.stringify({ bundle: { createUpdaterArtifacts: false } }));
  configs.push(unsignedFile);
  console.log("No TAURI_SIGNING_PRIVATE_KEY: building without the update signature (for testing).");
}
// What's New shows after updating only if this version has notes (src/text/whats-new.txt).
const notes = readFileSync(join(root, "src/text/whats-new.txt"), "utf8");
const versionLine = new RegExp(`^v?${version.replaceAll(".", "\\.")}\\s*$`, "im");
if (!extraConfig && !versionLine.test(notes)) {
  throw new Error(`src/text/whats-new.txt has no notes for ${version}`);
}

if (!skipApp) {
  run("npx", ["tauri", "build", ...configs.flatMap((config) => ["--config", `"${config}"`])]);
}

const nsisFolder = join(root, "src-tauri/target/release/bundle/nsis");
const payloadName = `${productName}_${version}_x64-setup.exe`;
const payload = join(nsisFolder, payloadName);
if (!existsSync(payload)) throw new Error(`missing NSIS installer ${payload}`);

// The setup's own file version (Properties → Details) follows the app's.
const setupVersionFile = join(root, "installer/target/setup-version.conf.json");
mkdirSync(dirname(setupVersionFile), { recursive: true });
writeFileSync(setupVersionFile, JSON.stringify({ version }));
run("npx", ["tauri", "build", "--config", `"${setupVersionFile}"`], {
  cwd: join(root, "installer"),
  env: {
    ...process.env,
    RANKDB_INSTALLER_PAYLOAD: payload,
    RANKDB_INSTALLER_VERSION: version,
  },
});

// With bundling off, Tauri leaves the binary under its Cargo name.
const releaseFolder = join(root, "installer/target/release");
const binary = readdirSync(releaseFolder).find((name) => /^rankdb[-_]installer\.exe$/i.test(name));
if (!binary) throw new Error(`no setup binary in ${releaseFolder}`);

const output = join(root, "release");
mkdirSync(output, { recursive: true });
const setupName = `${productName.replaceAll(" ", "_")}_${version}_installer.exe`;
copyFileSync(join(releaseFolder, binary), join(output, setupName));
console.log(`\nRankDB Setup ready: release/${setupName} (embeds ${payloadName})`);
