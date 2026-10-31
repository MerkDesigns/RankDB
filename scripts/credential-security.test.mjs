import { uiText } from "../src/text/index.ts";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { stripTypeScriptTypes } from "node:module";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

const source = stripTypeScriptTypes(await readFile(new URL("../src/data/credentialSecurity.ts", import.meta.url), "utf8"));
const plain = { mode: "plain", locked: false };
const locked = { mode: "password", locked: true };
async function fixture(status = plain, dialog = null) {
  const context = createContext({});
  const calls = [], errors = [];
  const model = { status, dialog, invoke: async () => model.status };
  const mocks = {
    "../text/index": { uiText },
    "@tauri-apps/api/core": { invoke: (...args) => { calls.push(args[0]); return model.invoke(...args); } },
    react: { useEffect() {}, useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    "../ui/appActions": { getOpenDialog: () => model.dialog, dialogs: { open: (value) => { model.dialog = value; } } },
    "../ui/toasts": { showError: (...args) => errors.push(args) },
  };
  const module = new SourceTextModule(source, { context });
  await module.link((name) => {
    const exports = mocks[name];
    assert.ok(exports, `Unexpected dependency: ${name}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { security: module.namespace, model, calls, errors };
}

test("plain credentials need no password prompt", async () => {
  const { security, model, calls } = await fixture();
  assert.equal(await security.ensureCredentialsUnlocked(), true);
  assert.equal(model.dialog, null);
  assert.deepEqual(calls, ["credential_security_status"]);
});

test("concurrent protected actions share one unlock prompt and resume Settings", async () => {
  const { security, model } = await fixture(locked, { kind: "settings" });
  const first = security.ensureCredentialsUnlocked();
  const second = security.ensureCredentialsUnlocked();
  await setImmediate();
  assert.equal(model.dialog.kind, "credential-security");
  assert.equal(model.dialog.action, "unlock");
  security.publishCredentialSecurity({ ...locked, locked: false });
  security.finishCredentialSecurity(true);
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(model.dialog.kind, "settings");
});

test("cancelling an unlock does not reopen the credential editor or resume its action", async () => {
  const { security, model } = await fixture(locked, { kind: "credentials", accountId: 7 });
  const pending = security.ensureCredentialsUnlocked();
  await setImmediate();
  security.finishCredentialSecurity(false);
  assert.equal(await pending, false);
  assert.equal(model.dialog, null);
});

test("successful unlock returns to the requested credential editor", async () => {
  const { security, model } = await fixture(locked, { kind: "credentials", accountId: 7 });
  const pending = security.ensureCredentialsUnlocked();
  await setImmediate();
  security.publishCredentialSecurity({ ...locked, locked: false });
  security.finishCredentialSecurity(true);
  assert.equal(await pending, true);
  assert.equal(model.dialog.kind, "credentials");
  assert.equal(model.dialog.accountId, 7);
});

test("an older status response cannot undo an explicit lock", async () => {
  const { security, model } = await fixture();
  let resolve;
  model.invoke = () => new Promise((done) => { resolve = done; });
  const pending = security.refreshCredentialSecurity();
  security.publishCredentialSecurity(locked);
  resolve({ ...locked, locked: false });
  assert.equal((await pending).locked, true);
  assert.equal(security.useCredentialSecurity().locked, true);
});

test("status failures reject protected actions without opening a password dialog", async () => {
  const { security, model, errors } = await fixture();
  model.invoke = async () => { throw new Error("fixture IPC failure"); };
  assert.equal(await security.ensureCredentialsUnlocked(), false);
  assert.equal(model.dialog, null);
  assert.equal(errors.length, 1);
});
