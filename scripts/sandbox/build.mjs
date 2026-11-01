// Builds everything the Windows Sandbox update tests need (docs/SANDBOX-TESTING.md) into .sandbox/:
//
//   share/RankDB_0.3.0_x64-setup.exe   the real 0.3 release (GitHub)
//   share/RankDB_1.0.0_x64-setup.exe   this checkout as version 1.0.0
//   share/RankDB_1.0.1_x64-setup.exe   this checkout as version 1.0.1
//   share/latest.json                  offers 1.0.1 to 1.0.0's updater, from inside the sandbox
//   RankDB.wsb                         the sandbox configuration (`npm run sandbox:open` starts it)
//
// The test builds are the real release app (identifier, product name, version >= 1.0, so updates
// are enabled), but their updater trusts a throwaway test key and asks http://127.0.0.1:8765, which
// only exists inside the sandbox (scripts/sandbox/serve.ps1). Never run them outside the sandbox:
// they would install over the installed RankDB.
//
//   node scripts/sandbox/build.mjs          build what's missing (0.3 download, test key, installers)
//   node scripts/sandbox/build.mjs --fresh  rebuild the 1.0.x installers from the current source
//   node scripts/sandbox/build.mjs --open   then start the sandbox

import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const work = join(root, ".sandbox");
const share = join(work, "share");
const keys = join(work, "keys");
const logs = join(work, "logs");
const scripts = join(root, "scripts", "sandbox");
const bundle = join(root, "src-tauri", "target", "release", "bundle", "nsis");

const OLD_VERSION = "0.3.0";
const VERSIONS = ["1.0.0", "1.0.1"];
const PORT = 8765;
const fresh = process.argv.includes("--fresh");
const open = process.argv.includes("--open");

const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", ...options });

mkdirSync(share, { recursive: true });
mkdirSync(keys, { recursive: true });
mkdirSync(logs, { recursive: true });

/* ---------- RankDB 0.3 ---------- */

const oldInstaller = `RankDB_${OLD_VERSION}_x64-setup.exe`;
if (!existsSync(join(share, oldInstaller))) {
  console.log(`Downloading ${oldInstaller} from the v${OLD_VERSION} release…`);
  run("gh", ["release", "download", `v${OLD_VERSION}`, "--repo", "MerkDesigns/RankDB", "--pattern", oldInstaller, "--dir", share]);
}

/* ---------- WebView2 (Windows Sandbox doesn't include it; real Windows 10/11 does) ---------- */

const webView2 = "MicrosoftEdgeWebView2RuntimeInstallerX64.exe";
if (!existsSync(join(share, webView2))) {
  console.log("Downloading the WebView2 runtime (offline installer) from Microsoft…");
  // Microsoft's Evergreen Standalone Installer, x64.
  const response = await fetch("https://go.microsoft.com/fwlink/?linkid=2124701");
  if (!response.ok) throw new Error(`WebView2 download failed: ${response.status}`);
  writeFileSync(join(share, webView2), Buffer.from(await response.arrayBuffer()));
}

/* ---------- Test signing key (never the real one) ---------- */

const keyFile = join(keys, "sandbox-test.key");
if (!existsSync(keyFile)) {
  console.log("Generating a throwaway updater key for the sandbox builds…");
  run("npx", ["tauri", "signer", "generate", "--ci", "--password", '""', "--write-keys", keyFile]);
}
const privateKey = readFileSync(keyFile, "utf8").trim();
const publicKey = readFileSync(`${keyFile}.pub`, "utf8").trim();

/* ---------- 1.0.x installers ---------- */

for (const version of VERSIONS) {
  const installer = `RankDB_${version}_x64-setup.exe`;
  if (existsSync(join(share, installer)) && !fresh) continue;
  console.log(`Building ${installer}…`);
  const config = join(work, `tauri.sandbox-${version}.conf.json`);
  writeFileSync(
    config,
    JSON.stringify(
      {
        version,
        bundle: {
          active: true,
          targets: ["nsis"],
          createUpdaterArtifacts: true,
          // 0.3 used Tauri's default per-user install; the same mode installs over it in place.
          windows: { nsis: { installMode: "currentUser", installerIcon: "icons/icon.ico" } },
        },
        plugins: {
          updater: {
            endpoints: [`http://127.0.0.1:${PORT}/latest.json`],
            pubkey: publicKey,
            dangerousInsecureTransportProtocol: true,
          },
        },
      },
      null,
      2,
    ),
  );
  run("npx", ["tauri", "build", "--config", config], {
    env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: privateKey, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "" },
  });
  copyFileSync(join(bundle, installer), join(share, installer));
  copyFileSync(join(bundle, `${installer}.sig`), join(share, `${installer}.sig`));
}

/* ---------- Update feed: 1.0.0 is offered 1.0.1 ---------- */

const latest = VERSIONS[VERSIONS.length - 1];
const latestInstaller = `RankDB_${latest}_x64-setup.exe`;
writeFileSync(
  join(share, "latest.json"),
  JSON.stringify(
    {
      version: latest,
      notes: "Sandbox test update.",
      pub_date: new Date().toISOString(),
      platforms: {
        "windows-x86_64": {
          signature: readFileSync(join(share, `${latestInstaller}.sig`), "utf8").trim(),
          url: `http://127.0.0.1:${PORT}/${latestInstaller}`,
        },
      },
    },
    null,
    2,
  ),
);

/* ---------- Sandbox configuration ---------- */

const inside = "C:\\Users\\WDAGUtilityAccount\\Desktop";
writeFileSync(
  join(work, "RankDB.wsb"),
  `<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>${share}</HostFolder>
      <SandboxFolder>${inside}\\RankDB test</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>${logs}</HostFolder>
      <SandboxFolder>${inside}\\RankDB logs</SandboxFolder>
      <ReadOnly>false</ReadOnly>
    </MappedFolder>
    <MappedFolder>
      <HostFolder>${scripts}</HostFolder>
      <SandboxFolder>${inside}\\RankDB scripts</SandboxFolder>
      <ReadOnly>true</ReadOnly>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>powershell -NoProfile -ExecutionPolicy Bypass -File "${inside}\\RankDB scripts\\start.ps1"</Command>
  </LogonCommand>
  <Networking>Enable</Networking>
  <!-- Copied test passwords stay inside the sandbox; check them there with Get-Clipboard. -->
  <ClipboardRedirection>Disable</ClipboardRedirection>
</Configuration>
`,
);

console.log(`\nReady in ${work}. Checklist: docs/SANDBOX-TESTING.md`);
if (open) {
  spawn("cmd", ["/c", "start", "", join(work, "RankDB.wsb")], { detached: true, stdio: "ignore" }).unref();
}
