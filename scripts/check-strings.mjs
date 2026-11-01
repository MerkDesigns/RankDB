import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseSync } from "rolldown/experimental";

const catalog = JSON.parse(fs.readFileSync("src/text/strings.json", "utf8"));
const messages = new Map();
function collect(value, prefix = "") {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `Invalid text group: ${prefix}`);
  for (const [key, entry] of Object.entries(value)) {
    assert.match(key, /^[A-Za-z][A-Za-z0-9]*$/, `Invalid key: ${prefix}.${key}`);
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") messages.set(name, entry);
    else collect(entry, name);
  }
}
collect(catalog);
const used = new Set();
const tokens = (message) => [...new Set([...message.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1]))].sort();
function check(key, supplied, where) {
  assert.ok(messages.has(key), `${where}: Missing text entry ${key}`);
  assert.deepEqual(supplied.sort(), tokens(messages.get(key)), `${where}: Placeholder mismatch for ${key}`);
  used.add(key);
}
function files(dir, extension) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory()
    ? files(path.join(dir, e.name), extension) : extension.test(e.name) ? [path.join(dir, e.name)] : []);
}
for (const file of files("src", /\.tsx?$/)) {
  const source = fs.readFileSync(file, "utf8");
  const ast = parseSync(file, source);
  assert.equal(ast.errors.length, 0, `${file}: Parse error`);
  function walk(node) {
    if (!node?.type) return;
    if (node.type === "CallExpression" && node.callee?.name === "uiText") {
      const [key, values] = node.arguments;
      assert.equal(typeof key?.value, "string", `${file}: Text keys must be static`);
      assert.ok(!values || values.type === "ObjectExpression", `${file}: Placeholders must be explicit`);
      const supplied = values?.properties.map((p) => p.key?.name ?? p.key?.value) ?? [];
      check(key.value, supplied, file);
    }
    // All literal copy in JSX must use the catalog, including accessibility labels.
    if (node.type === "JSXText") assert.equal(node.value.trim(), "", `${file}: Uncatalogued JSX text: ${node.value.trim()}`);
    if (node.type === "JSXAttribute" && ["title", "label", "aria-label", "placeholder", "alt", "heading"].includes(node.name?.name)) {
      assert.ok(node.value?.type !== "Literal" || node.value.value === "", `${file}: Uncatalogued ${node.name.name}`);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value?.type) walk(value);
    }
  }
  walk(ast.program);
}
for (const file of files("src-tauri/src", /\.rs$/)) {
  const source = fs.readFileSync(file, "utf8").split(/\r?\n#\[cfg\(test\)\]\r?\nmod tests/)[0];
  for (const match of source.matchAll(/crate::text::(text|format)\("([^"]+)"(?:,\s*&\[([^\]]*)\])?\)/g)) {
    const supplied = [...(match[3] ?? "").matchAll(/\("([^"]+)",/g)].map((m) => m[1]);
    check(match[2], supplied, file);
  }
}
// Rank names are selected using fixed data identifiers; editing these values must not alter IDs.
const accounts = fs.readFileSync("src/data/accounts.ts", "utf8");
const tiers = [...accounts.matchAll(/^  \| "(\w+)"/gm)].map((m) => m[1]);
assert.equal(tiers.length, 10, "Expected ten persisted rank identifiers");
for (const tier of tiers) { check(`rankNames.${tier}`, [], "Rank labels"); }
const unused = [...messages.keys()].filter((key) => !used.has(key));
assert.deepEqual(unused, [], `Unused catalog entries: ${unused.join(", ")}`);
console.log(`Validated ${messages.size} text entries, references and placeholders.`);
