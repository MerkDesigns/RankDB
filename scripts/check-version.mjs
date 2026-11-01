// One version everywhere: package.json's. tauri.conf.json names package.json as its version (so the
// app, its installers and the update feed follow it), no other Tauri config may set its own, and
// the Cargo packages (manifests and lock files) must say the same.
import assert from "node:assert/strict";
import fs from "node:fs";

const version = JSON.parse(fs.readFileSync("package.json", "utf8")).version;
assert.match(version, /^\d+\.\d+\.\d+$/, `package.json: version ${version} is not x.y.z`);

for (const file of fs.readdirSync("src-tauri").filter((name) => /^tauri.*\.conf\.json$/.test(name))) {
  const config = JSON.parse(fs.readFileSync(`src-tauri/${file}`, "utf8"));
  if (file === "tauri.conf.json") assert.equal(config.version, "../package.json", `src-tauri/${file}: version must be "../package.json"`);
  else assert.equal(config.version, undefined, `src-tauri/${file}: must not set its own version`);
}

for (const [folder, crate] of [["src-tauri", "rankdb"], ["installer", "rankdb-installer"]]) {
  const manifest = fs.readFileSync(`${folder}/Cargo.toml`, "utf8").match(/^version = "([^"]+)"/m)?.[1];
  assert.equal(manifest, version, `${folder}/Cargo.toml: version ${manifest}, package.json ${version}`);
  const lock = fs.readFileSync(`${folder}/Cargo.lock`, "utf8");
  const locked = lock.match(new RegExp(`\\[\\[package\\]\\]\\nname = "${crate}"\\nversion = "([^"]+)"`))?.[1];
  assert.equal(locked, version, `${folder}/Cargo.lock: ${crate} ${locked}, package.json ${version} (run cargo check)`);
}
console.log(`Version ${version} everywhere.`);
