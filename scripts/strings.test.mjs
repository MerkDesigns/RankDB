import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";

const original = JSON.parse(fs.readFileSync(new URL("../src/text/strings.json", import.meta.url), "utf8"));
const source = stripTypeScriptTypes(fs.readFileSync(new URL("../src/text/index.ts", import.meta.url), "utf8"));
async function fixture(edit = () => {}) {
  const catalog = structuredClone(original);
  edit(catalog);
  const context = createContext({});
  const module = new SourceTextModule(source, { context });
  await module.link(() => new SyntheticModule(["default"], function () { this.setExport("default", catalog); }, { context }));
  await module.evaluate();
  return module.namespace;
}

test("editing one catalog changes ordinary labels and rank display names", async () => {
  const text = await fixture((c) => {
    c.settings.credentialButtons.label = "My credentials";
    c.settings.credentialButtons.description = "Place these wherever you like";
    c.rankNames.Gold = "Golden";
  });
  assert.equal(text.uiText("settings.credentialButtons.label"), "My credentials");
  assert.equal(text.uiText("settings.credentialButtons.description"), "Place these wherever you like");
  assert.equal(text.rankName("Gold"), "Golden");
  assert.equal(text.rankName("unknown"), "unknown");
  // The storage model and asset keys remain fixed even when displayed words are edited.
  const accounts = fs.readFileSync(new URL("../src/data/accounts.ts", import.meta.url), "utf8");
  assert.ok(accounts.includes('| "Gold"'));
  assert.ok(!accounts.includes('"Golden"'));
});

test("named placeholders preserve counts, repetitions and literal inserted text", async () => {
  const text = await fixture((c) => { c.notifications.clipboardSuperseded = "{count}: {detail} ({count})"; });
  assert.equal(text.uiText("notifications.clipboardSuperseded", { count: 4, detail: "<b>$& {count}</b>" }), "4: <b>$& {count}</b> (4)");
});

test("missing keys and missing values stay visible for diagnosis", async () => {
  const text = await fixture();
  assert.equal(text.uiText("unknown.entry"), "unknown.entry");
  assert.equal(text.uiText("clipboard.missingCredential.title"), original.clipboard.missingCredential.title);
  assert.equal(text.uiText("clipboard.missingCredential.title", {}), original.clipboard.missingCredential.title);
});
