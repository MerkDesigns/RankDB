// Builds RankDB for the Microsoft Store: an x64 MSIX in release/store (docs/MICROSOFT_STORE.md).
// Separate from the GitHub setup (scripts/build-installer.mjs): its own Cargo target folder, its
// own app identifier, the `store` feature (no GitHub updater), nothing shared but the source.
//
//   node scripts/build-store.mjs              the package to upload (unsigned: the Store signs it)
//   node scripts/build-store.mjs --dev-sign   also a copy signed with a local test certificate,
//                                             to install on a PC that trusts that certificate
//   node scripts/build-store.mjs --skip-app   reuse rankdb.exe from the last Store build
//
// The package identity comes from Partner Center: store/identity.json (git-ignored; see
// store/identity.example.json) or RANKDB_STORE_NAME, RANKDB_STORE_PUBLISHER and
// RANKDB_STORE_PUBLISHER_DISPLAY_NAME. Without one, a local test identity is used and the package
// can't be submitted.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const devSign = args.includes("--dev-sign");
const skipApp = args.includes("--skip-app");

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: "inherit", shell: true, ...options });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed`);
};
// winapp reports to Microsoft by default; a build script shouldn't.
const winapp = (commandArgs) => run("npx", ["winapp", ...commandArgs], { env: { ...process.env, WINAPP_CLI_TELEMETRY_OPTOUT: "1" } });
const quoted = (path) => `"${path}"`;
const readJson = (file) => JSON.parse(readFileSync(join(root, file), "utf8"));

/* ---------- Identity and version ---------- */

const LOCAL_TEST_IDENTITY = { name: "RankDB.LocalTest", publisher: "CN=RankDB Local Test", publisherDisplayName: "RankDB local test" };

function readIdentity() {
  const fromEnv = {
    name: process.env.RANKDB_STORE_NAME,
    publisher: process.env.RANKDB_STORE_PUBLISHER,
    publisherDisplayName: process.env.RANKDB_STORE_PUBLISHER_DISPLAY_NAME,
  };
  const file = join(root, "store/identity.json");
  const given = Object.values(fromEnv).some(Boolean) ? fromEnv : existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  if (!given) return { ...LOCAL_TEST_IDENTITY, submittable: false };
  for (const key of ["name", "publisher", "publisherDisplayName"]) {
    if (typeof given[key] !== "string" || !given[key].trim()) throw new Error(`Store identity: "${key}" is missing`);
  }
  // Partner Center's formats (Product identity): a package name of letters, digits, dots and
  // dashes, and a publisher that is a certificate subject.
  if (!/^[A-Za-z0-9.-]{3,50}$/.test(given.name)) throw new Error(`Store identity: "${given.name}" is not a package name`);
  if (!/^(CN|O|OU|C|L|S|E)=/.test(given.publisher)) throw new Error(`Store identity: "${given.publisher}" is not a publisher (CN=…)`);
  const example = readJson("store/identity.example.json");
  if (given.name === example.name || given.publisher === example.publisher) {
    throw new Error("Store identity: these are the example values; use your own from Partner Center");
  }
  return { name: given.name, publisher: given.publisher, publisherDisplayName: given.publisherDisplayName, submittable: true };
}

const identity = readIdentity();
const appVersion = readJson("package.json").version;
if (!/^\d+\.\d+\.\d+$/.test(appVersion)) throw new Error(`package.json: version ${appVersion} is not x.y.z`);
// MSIX versions have four parts, and the Store keeps the last one for itself (it must be 0).
const packageVersion = `${appVersion}.0`;
const storeConfig = readJson("src-tauri/tauri.store.conf.json");
if (storeConfig.identifier === readJson("src-tauri/tauri.conf.json").identifier) {
  throw new Error("tauri.store.conf.json must have its own identifier: the Store build keeps its own data folder");
}

/* ---------- The app ---------- */

// Its own target folder, so the GitHub build's rankdb.exe is never replaced by this one.
const targetDir = join(root, "src-tauri/target/store");
const binary = join(targetDir, "release/rankdb.exe");
if (!skipApp) {
  run("npx", ["tauri", "build", "--no-bundle", "--features", "store", "--config", quoted(join(root, "src-tauri/tauri.store.conf.json"))], {
    env: { ...process.env, CARGO_TARGET_DIR: targetDir, VITE_RANKDB_CHANNEL: "store" },
  });
}
if (!existsSync(binary)) throw new Error(`missing ${binary}: build without --skip-app first`);

/* ---------- The package layout ---------- */

const output = join(root, "release/store");
const layout = join(output, "package");
rmSync(layout, { recursive: true, force: true });
mkdirSync(join(layout, "Assets"), { recursive: true });
copyFileSync(binary, join(layout, "rankdb.exe"));

const escapeXml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const values = { name: identity.name, publisher: identity.publisher, publisherDisplayName: identity.publisherDisplayName, version: packageVersion };
// Beside the layout, not in it: winapp packs it as AppxManifest.xml, and a second copy under its
// own name would ship too.
const manifestFile = join(output, "Package.appxmanifest");
const manifest = readFileSync(join(root, "store/Package.appxmanifest"), "utf8").replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in values)) throw new Error(`store/Package.appxmanifest: unknown value {{${key}}}`);
  return escapeXml(values[key]);
});
writeFileSync(manifestFile, manifest);
// Tiles, the taskbar icon and the Store logo, in every size Windows asks for, from the app icon.
// They are written beside the manifest, so they are made there and moved into the layout.
rmSync(join(output, "Assets"), { recursive: true, force: true });
winapp(["manifest", "update-assets", quoted(join(root, "src-tauri/icons/icon.png")), "--manifest", quoted(manifestFile), "--quiet"]);
rmSync(join(layout, "Assets"), { recursive: true, force: true });
renameSync(join(output, "Assets"), join(layout, "Assets"));
copyFileSync(join(root, "store/BackupFile.png"), join(layout, "Assets/BackupFile.png"));

/* ---------- Packing ---------- */

const packageName = `RankDB_${packageVersion}_x64`;
const pack = (file, signing) => {
  rmSync(file, { force: true });
  // What an earlier pack may have left in the layout while indexing the images.
  for (const leftover of readdirSync(layout)) {
    if (/^(pri\.resfiles|priconfig\.xml|resources(\..+)?\.pri|appxmanifest\.xml|package\.appxmanifest)$/i.test(leftover)) rmSync(join(layout, leftover));
  }
  winapp(["package", quoted(layout), "--manifest", quoted(manifestFile), "--output", quoted(file), ...signing]);
  if (!existsSync(file)) throw new Error(`winapp made no package at ${file}`);
};

const storePackage = join(output, `${packageName}.msix`);
pack(storePackage, ["--no-sign"]);

let testPackage = null;
if (devSign) {
  // A certificate only this PC trusts (after `winapp cert install`), for installing the package
  // before it is in the Store. It has to carry the manifest's publisher, so it is made again
  // when the identity changes. Never committed (.gitignore).
  const certificate = join(root, "store/devcert.pfx");
  const certificateFor = join(root, "store/devcert.publisher.txt");
  const current = existsSync(certificateFor) ? readFileSync(certificateFor, "utf8") : null;
  if (!existsSync(certificate) || current !== identity.publisher) {
    winapp(["cert", "generate", "--manifest", quoted(manifestFile), "--output", quoted(certificate), "--if-exists", "overwrite", "--export-cer", "--quiet"]);
    writeFileSync(certificateFor, identity.publisher);
  }
  testPackage = join(output, `${packageName}_test.msix`);
  pack(testPackage, ["--cert", quoted(certificate)]);
  // The certificate's public half goes with the test package: a test PC trusts it once.
  const publicHalf = join(root, "store/devcert.cer");
  if (existsSync(publicHalf)) copyFileSync(publicHalf, join(output, "RankDB_test_certificate.cer"));
}

/* ---------- Checking what was packed ---------- */

// Unpacked again and read back: what the Store receives, not what this script meant to write.
const unpacked = join(output, "unpacked");
rmSync(unpacked, { recursive: true, force: true });
winapp(["tool", "--quiet", "--", "makeappx", "unpack", "/p", quoted(storePackage), "/d", quoted(unpacked), "/o"]);
const packedManifest = readFileSync(join(unpacked, "AppxManifest.xml"), "utf8");
const attribute = (element, name) => packedManifest.match(new RegExp(`<${element}\\b[^>]*?\\b${name}="([^"]*)"`))?.[1];
const problems = [];
const expect = (what, actual, wanted) => {
  if (actual !== wanted) problems.push(`${what}: ${actual ?? "missing"}, expected ${wanted}`);
};
expect("Identity Name", attribute("Identity", "Name"), escapeXml(identity.name));
expect("Identity Publisher", attribute("Identity", "Publisher"), escapeXml(identity.publisher));
expect("Identity Version", attribute("Identity", "Version"), packageVersion);
expect("Identity ProcessorArchitecture", attribute("Identity", "ProcessorArchitecture"), "x64");
expect("Application EntryPoint", attribute("Application", "EntryPoint"), "Windows.FullTrustApplication");
if (!/<rescap:Capability\s+Name="runFullTrust"/.test(packedManifest)) problems.push("the runFullTrust capability is missing");
if (/\{\{|\$[a-z]+\$/i.test(packedManifest)) problems.push("the manifest still has unfilled values");
const executable = attribute("Application", "Executable");
if (!executable || !existsSync(join(unpacked, executable))) problems.push(`the executable ${executable} isn't in the package`);
// Only the app, its images and what packing adds (the package format's own files, the image
// index and the two small files winapp indexes the images with): no build leftovers.
const expected = /^(rankdb\.exe|Assets|AppxManifest\.xml|AppxBlockMap\.xml|\[Content_Types\]\.xml|resources(\..+)?\.pri|pri\.resfiles|priconfig\.xml|AppxSignature\.p7x|AppxMetadata)$/i;
const stray = readdirSync(unpacked).filter((file) => !expected.test(file));
if (stray.length > 0) problems.push(`files that don't belong in the package: ${stray.join(", ")}`);
// Every image the manifest names must be there, in at least one of its scales or sizes.
const images = [...packedManifest.matchAll(/(?:Logo(?:="|>)|Square\w+Logo="|Wide\w+Logo=")(Assets\\[^"<]+)/g)].map((match) => match[1]);
const packedAssets = readdirSync(join(unpacked, "Assets"));
for (const image of new Set(images)) {
  const stem = image.replace(/^Assets\\/, "").replace(/\.png$/i, "");
  if (!packedAssets.some((file) => file === `${stem}.png` || file.startsWith(`${stem}.`))) problems.push(`${image} isn't in the package`);
}
// The Store build must not be the GitHub one: no updater endpoint inside the binary.
const packedBinary = readFileSync(join(unpacked, executable ?? "rankdb.exe"));
if (!packedBinary.includes(Buffer.from(storeConfig.identifier))) problems.push(`rankdb.exe doesn't carry the identifier ${storeConfig.identifier}`);
rmSync(unpacked, { recursive: true, force: true });
if (problems.length > 0) throw new Error(`The package doesn't check out:\n  - ${problems.join("\n  - ")}`);

const size = (file) => `${(statSync(file).size / 1024 / 1024).toFixed(1)} MB`;
console.log(`\nRankDB ${appVersion} for the Microsoft Store (${identity.name}, ${identity.publisher}):`);
console.log(`  ${relative(root, storePackage)} (${size(storePackage)}, unsigned: the Store signs it)`);
if (testPackage) console.log(`  ${relative(root, testPackage)} (${size(testPackage)}, signed with store/devcert.pfx, for testing)`);
if (!identity.submittable) {
  console.log("\nThis is the local test identity: the package can't be submitted. Put your Partner Center");
  console.log("values in store/identity.json (see store/identity.example.json) and build again.");
}
