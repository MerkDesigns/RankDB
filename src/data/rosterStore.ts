import { uiText } from "../text/index";
import type { InvokeArgs } from "@tauri-apps/api/core";
import { useSyncExternalStore } from "react";
import { labStore } from "../lab/store";
import { showError } from "../ui/toasts";
import { command } from "./backend";
import {
  generateRoster,
  type Account,
  type AccountStatus,
  type Group,
  type ListEntry,
  type Rank,
  type RankTier,
  type Records,
  type Roster,
} from "./accounts";

/**
 * The accounts on screen. Rust owns the data (src-tauri/src/db/) and this store mirrors it:
 * it loads the whole roster once at startup, and each edit is applied here at once (optimistic),
 * sent to Rust as one command, then replaced by the record Rust returns. Edits replace only the
 * edited account, so only that row re-renders. If anything doesn't go as shown (a failure, or
 * edits overtaking each other), the roster is reloaded from Rust once nothing is pending (`saved`).
 *
 * The Glass Lab can switch the source to "dummy": an in-memory roster from the generator (account
 * count and seed), used for benchmarks. Dummy edits are never saved.
 */

/** A rank slot: one of the three role ranks, or the 6v6 rank. */
export type RankSlot = 0 | 1 | 2 | "sixV6";

/** Slot names in the database. */
const SLOT_NAMES = { 0: "tank", 1: "damage", 2: "support", sixV6: "sixv6" } as const;

/** The currency columns, in header order: the lane of `Account` values and the index in it. */
export const CURRENCY_COLUMNS = {
  prisms: ["valuesA", 0],
  coins: ["valuesA", 1],
  credits: ["valuesA", 2],
  competitive: ["valuesB", 0],
  legacy: ["valuesB", 1],
} as const;
export type CurrencyColumn = keyof typeof CURRENCY_COLUMNS;

/** A column the list can be sorted by: a rank slot or a currency. */
export type SortColumn = RankSlot | CurrencyColumn;

/** A temporary column sort (never saved): best ranks or most currency first, then off. */
export interface ColumnSort {
  readonly column: SortColumn;
  readonly direction: "desc" | "asc";
}

let records: Records = { accounts: [], groups: [] };
let sort: ColumnSort | null = null;
// Empty until the first load (buildRoster's helpers are defined further down).
let roster: Roster = { entries: [], sms: [], suspended: [], banned: [], total: 0, sorted: false };
let source: "database" | "dummy" = "database";
/** The database roster is on screen (not just selected), or on its way. */
let databaseShown = false;
let databaseLoading: Promise<void> | null = null;
let dummyKey = "";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function publish(next: Records) {
  records = next;
  roster = buildRoster(shown(next), sort);
  emit();
}

/* ---------- Viewing a past season reset (temporary, never saved) ---------- */

type ResetRanks = Map<number, { ranks: [Rank, Rank, Rank]; sixV6: Rank }>;

/** The season reset whose ranks the list shows instead of today's, and those ranks. */
let viewedReset: { readonly resetAt: string; readonly ranks: ResetRanks } | null = null;
/** One overlaid copy per account record, so unchanged rows keep their identity (no re-render). */
let overlaid = new WeakMap<Account, Account>();
const resetListeners = new Set<() => void>();

const UNRANKED: Rank = { tier: "Unranked", division: 5, predicted: false, placements: 0 };

function shown(next: Records): Records {
  if (!viewedReset) return next;
  const { ranks } = viewedReset;
  return {
    ...next,
    accounts: next.accounts.map((account) => {
      let copy = overlaid.get(account);
      if (!copy) {
        const past = ranks.get(account.id);
        copy = { ...account, ranks: past?.ranks ?? [UNRANKED, UNRANKED, UNRANKED], sixV6: past?.sixV6 ?? UNRANKED };
        overlaid.set(account, copy);
      }
      return copy;
    }),
  };
}

export function useViewedReset(): string | null {
  return useSyncExternalStore(
    (listener) => {
      resetListeners.add(listener);
      return () => resetListeners.delete(listener);
    },
    () => viewedReset?.resetAt ?? null,
  );
}

export const getViewedReset = () => viewedReset?.resetAt ?? null;

/** Every season reset, newest first. */
export async function listSeasonResets(): Promise<string[]> {
  if (source !== "database") return [];
  try {
    return await command<string[]>("list_season_resets");
  } catch (error) {
    showError(uiText("rosterStore.historyListFailed"), error);
    return [];
  }
}

/** Shows the ranks a season reset cleared (null: today's ranks again). */
export async function viewSeasonReset(resetAt: string | null) {
  if (resetAt === null) {
    viewedReset = null;
  } else {
    try {
      const rows = await command<{ accountId: number; slot: string; rank: Rank }[]>("get_season_reset", { resetAt });
      const ranks: ResetRanks = new Map();
      for (const row of rows) {
        const entry = ranks.get(row.accountId) ?? { ranks: [UNRANKED, UNRANKED, UNRANKED], sixV6: UNRANKED };
        const index = ["tank", "damage", "support"].indexOf(row.slot);
        if (index >= 0) entry.ranks[index] = row.rank;
        else if (row.slot === "sixv6") entry.sixV6 = row.rank;
        ranks.set(row.accountId, entry);
      }
      viewedReset = { resetAt, ranks };
    } catch (error) {
      showError(uiText("rosterStore.historyLoadFailed"), error);
      return;
    }
  }
  overlaid = new WeakMap();
  resetListeners.forEach((listener) => listener());
  publish(records);
}

const bySortKey = <T extends { readonly sortKey: number }>(a: T, b: T) => a.sortKey - b.sortKey;

/** Old app's rank order: tier, then division (1 is best), predicted a hair above the same rank. */
const TIER_SCORE: Record<RankTier, number> = {
  Unranked: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Emerald: 5,
  Diamond: 6,
  Master: 7,
  Grandmaster: 8,
  Champion: 9,
};

function rankScore(rank: Rank): number {
  if (rank.tier === "Unranked") return 0;
  return TIER_SCORE[rank.tier] + (6 - rank.division) / 10 + (rank.predicted ? 0.01 : 0);
}

/** What a column sort compares: the rank's score, or the currency amount. */
function sortValue(account: Account, column: SortColumn): number {
  if (typeof column === "number" || column === "sixV6") return rankScore(rankAt(account, column));
  const [lane, index] = CURRENCY_COLUMNS[column];
  return account[lane][index]!;
}

/**
 * The list as shown. Normally: loose accounts and groups in their shared order (each group with
 * its accounts), then the SMS and banned sections. With a column sort: every clean account in one
 * flat list by that rank or currency (groups set aside, ties in their saved order), and each
 * section sorted the same way.
 */
function buildRoster({ accounts, groups }: Records, columnSort: ColumnSort | null): Roster {
  const sms = accounts.filter((account) => account.status === "sms").sort(bySortKey);
  const suspended = accounts.filter((account) => account.status === "suspended").sort(bySortKey);
  const banned = accounts.filter((account) => account.status === "banned").sort(bySortKey);
  const active = accounts.filter((account) => account.status === "clean");
  if (columnSort) {
    const savedOrder = new Map(flattenOrder(active, groups).map((account, index) => [account.id, index]));
    const sign = columnSort.direction === "desc" ? -1 : 1;
    const { column } = columnSort;
    const sorted = (list: readonly Account[], order: (account: Account) => number) =>
      [...list].sort((a, b) => sign * (sortValue(a, column) - sortValue(b, column)) || order(a) - order(b));
    return {
      entries: sorted(active, (account) => savedOrder.get(account.id) ?? 0).map((account) => ({ kind: "account", account })),
      sms: sorted(sms, (account) => account.sortKey),
      suspended: sorted(suspended, (account) => account.sortKey),
      banned: sorted(banned, (account) => account.sortKey),
      total: accounts.length,
      sorted: true,
    };
  }
  const groupIds = new Set(groups.map((group) => group.id));
  const top: (ListEntry & { readonly sortKey: number })[] = [
    ...active
      .filter((account) => !account.groupId || !groupIds.has(account.groupId))
      .map((account) => ({ kind: "account" as const, account, sortKey: account.sortKey })),
    ...groups.map((group) => ({
      kind: "group" as const,
      group,
      sortKey: group.sortKey,
      accounts: active.filter((account) => account.groupId === group.id).sort(bySortKey),
    })),
  ];
  return { entries: top.sort(bySortKey), sms, suspended, banned, total: accounts.length, sorted: false };
}

/** The saved order as one flat list (top level, groups expanded in place). */
function flattenOrder(active: readonly Account[], groups: readonly Group[]): Account[] {
  return buildRoster({ accounts: active, groups }, null).entries.flatMap((entry) =>
    entry.kind === "account" ? [entry.account] : entry.accounts,
  );
}

function dummyRecords(count: number, seed: number): Records {
  return generateRoster(count, seed);
}

async function loadFromDatabase() {
  let loaded = await command<Records>("load_roster");
  // A fresh development database starts with the lab's dummy accounts, so the dev app never opens
  // empty. Release builds never seed.
  if (import.meta.env.DEV && loaded.accounts.length === 0) {
    const { accountCount, seed } = labStore.get();
    loaded = await command<Records>("replace_roster", { roster: dummyRecords(accountCount, seed) });
  }
  if (source === "database") {
    databaseShown = true;
    publish(loaded);
  }
}

/** Follows the lab's data source (and, for dummy data, its account count and seed). */
async function syncSource() {
  const state = labStore.get();
  const nextSource = import.meta.env.DEV ? state.dataSource : "database";
  if (nextSource === "dummy") {
    const key = `${state.accountCount}:${state.seed}`;
    if (source === "dummy" && key === dummyKey) return;
    source = "dummy";
    databaseShown = false;
    dummyKey = key;
    publish(dummyRecords(state.accountCount, state.seed));
    return;
  }
  if (source === "database" && databaseShown) return;
  source = "database";
  dummyKey = "";
  databaseLoading ??= loadFromDatabase().finally(() => (databaseLoading = null));
  await databaseLoading;
}

/** Loads the roster before the first render, then follows lab source changes. */
export async function initRoster({ strict = false } = {}): Promise<void> {
  if (strict) await syncSource();
  else await syncSource().catch((error: unknown) => console.error(uiText("rosterStore.accountsLoadFailed"), error));
  labStore.subscribe(() => void syncSource().catch((error: unknown) => console.error(uiText("rosterStore.accountsLoadFailed"), error)));
}

export const getRoster = (): Roster => roster;

export function useRoster(): Roster {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => roster,
  );
}

export function findAccount(accountId: number): Account | undefined {
  return records.accounts.find((account) => account.id === accountId);
}

export function rankAt(account: Account, slot: RankSlot): Rank {
  return slot === "sixV6" ? account.sixV6 : account.ranks[slot];
}

function replaceAccount(next: Account) {
  publish({ ...records, accounts: records.accounts.map((account) => (account.id === next.id ? next : account)) });
}

/** Whether edits are saved (the lab's dummy roster lives in memory only). */
export const isSavedData = () => source === "database";

/* ---------- Saving ---------- */

/** Saves sent so far, and whether the screen may differ from what Rust saved. */
let issued = 0;
let stale = false;

/**
 * Sends one save. Commands run in order (backend.ts), so Rust's answer to the latest save includes
 * every earlier one. An answer that arrives while later saves are still on their way is older than
 * the screen, so it's only `latest: false`; a failure shows a toast and resolves null. Either way,
 * once nothing is pending the roster is reloaded from Rust, so the screen ends up exactly as saved
 * (never rolled back over newer edits).
 */
async function saved<T>(name: string, args: InvokeArgs, failure: string): Promise<{ readonly result: T; readonly latest: boolean } | null> {
  const sequence = ++issued;
  try {
    const result = await command<T>(name, args);
    const latest = sequence === issued;
    if (!latest) stale = true;
    return { result, latest };
  } catch (error) {
    stale = true;
    showError(failure, error);
    return null;
  } finally {
    if (sequence === issued && stale) void resync();
  }
}

async function resync() {
  stale = false;
  const sequence = issued;
  try {
    const loaded = await command<Records>("load_roster");
    if (sequence !== issued) stale = true;
    else if (source === "database") publish(loaded);
  } catch (error) {
    console.error(uiText("rosterStore.accountsLoadFailed"), error);
  }
}

/** One edit of one account: shown at once, then replaced by the record Rust returns. */
function editAccount(accountId: number, change: (account: Account) => Account, failure: string, name: string, args: InvokeArgs) {
  const previous = findAccount(accountId);
  if (!previous) return;
  replaceAccount(change(previous));
  if (source !== "database") return;
  void saved<Account>(name, args, failure).then((answer) => {
    if (answer?.latest) replaceAccount(answer.result);
  });
}

/** Replaces one rank of one account, and saves it. */
export function setRank(accountId: number, slot: RankSlot, rank: Rank) {
  editAccount(
    accountId,
    (account) => {
      const lastRankChangeAt = new Date().toISOString();
      if (slot === "sixV6") return { ...account, sixV6: rank, lastRankChangeAt };
      const ranks = [...account.ranks] as [Rank, Rank, Rank];
      ranks[slot] = rank;
      return { ...account, ranks, lastRankChangeAt };
    },
    uiText("rosterStore.rankSaveFailed"),
    "set_rank",
    { accountId, slot: SLOT_NAMES[slot], rank },
  );
}

export function renameAccount(accountId: number, name: string) {
  const trimmed = name.trim();
  const current = findAccount(accountId);
  if (!trimmed || !current || trimmed === current.name) return;
  editAccount(
    accountId,
    (account) => ({ ...account, name: trimmed }),
    uiText("rosterStore.accountRenameFailed"),
    "rename_account",
    { accountId, name: trimmed },
  );
}

/** Currency kinds in the database, in the order of `valuesA` and `valuesB`. */
const CURRENCY_KINDS = { valuesA: ["prisms", "coins", "credits"], valuesB: ["competitive", "legacy"] } as const;

export function setCurrency(accountId: number, lane: "valuesA" | "valuesB", index: number, value: number) {
  const kind = CURRENCY_KINDS[lane][index];
  const current = findAccount(accountId);
  if (!kind || !current || current[lane][index] === value) return;
  editAccount(
    accountId,
    (account) => {
      const values = [...account[lane]];
      values[index] = value;
      return { ...account, [lane]: values };
    },
    uiText("rosterStore.currencySaveFailed"),
    "set_currency",
    { accountId, kind, value },
  );
}

/** Adds an account at the end of the loose accounts and returns it (null if that failed). */
export async function addAccount(name: string): Promise<Account | null> {
  if (source !== "database") {
    const id = Math.max(0, ...records.accounts.map((account) => account.id)) + 1;
    const unranked: Rank = { tier: "Unranked", division: 5, predicted: false, placements: 0 };
    const account: Account = {
      id,
      name,
      ranks: [unranked, unranked, unranked],
      sixV6: unranked,
      valuesA: [0, 0, 0],
      valuesB: [0, 0],
      groupId: null,
      status: "clean",
      sortKey: nextTopLevelKey(),
      gamesDodged: 0,
      lastRankChangeAt: null,
      hasEmail: false,
      hasPassword: false,
    };
    publish({ ...records, accounts: [...records.accounts, account] });
    return account;
  }
  const answer = await saved<Account>("add_account", { name }, uiText("rosterStore.accountCreateFailed"));
  if (!answer) return null;
  publish({ ...records, accounts: [...records.accounts, answer.result] });
  return answer.result;
}

export function deleteAccount(accountId: number) {
  if (!findAccount(accountId)) return;
  publish({ ...records, accounts: records.accounts.filter((account) => account.id !== accountId) });
  if (source !== "database") return;
  void saved("delete_account", { accountId }, uiText("rosterStore.accountDeleteFailed"));
}

/** Saves both credentials (an empty string removes one). Resolves false if that failed. */
export async function setCredentials(accountId: number, email: string, password: string): Promise<boolean> {
  if (source !== "database") return false;
  const answer = await saved<Account>("set_credentials", { accountId, email, password }, uiText("rosterStore.credentialsSaveFailed"));
  if (answer?.latest) replaceAccount(answer.result);
  return answer !== null;
}

/** Loads the roster from Rust again (after an import added accounts behind the store's back). */
export async function reloadRoster(): Promise<void> {
  const loaded = await command<Records>("load_roster");
  if (source === "database") publish(loaded);
}

/** Development: replaces the database's accounts with the lab's dummy roster. */
export async function fillDatabaseWithDummy(): Promise<void> {
  const { accountCount, seed } = labStore.get();
  const filled = await command<Records>("replace_roster", { roster: dummyRecords(accountCount, seed) });
  if (source === "database") publish(filled);
}

/* ---------- Column sort (temporary) ---------- */

export function getColumnSort(): ColumnSort | null {
  return sort;
}

export function useColumnSort(): ColumnSort | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => sort,
  );
}

/** Old app: a click sorts best first; another click on the same column turns sorting off. */
export function cycleColumnSort(column: SortColumn) {
  sort = sort?.column === column ? null : { column, direction: "desc" };
  roster = buildRoster(shown(records), sort);
  emit();
}

/* ---------- Groups ---------- */

function replaceGroup(next: Group) {
  publish({ ...records, groups: records.groups.map((group) => (group.id === next.id ? next : group)) });
}

/** All groups in their order (for Move to). */
export function getRosterGroups(): readonly Group[] {
  return [...records.groups].sort(bySortKey);
}

export function findGroup(groupId: string): Group | undefined {
  return records.groups.find((group) => group.id === groupId);
}

/** One past the last loose account or group. */
function nextTopLevelKey(): number {
  const keys = [
    ...records.groups.map((group) => group.sortKey),
    ...records.accounts.filter((account) => account.status === "clean" && !account.groupId).map((account) => account.sortKey),
  ];
  return Math.floor(Math.max(-1, ...keys)) + 1;
}

export async function addGroup(name: string): Promise<Group | null> {
  const sortKey = nextTopLevelKey();
  if (source !== "database") {
    const group: Group = { id: `dummy-${Date.now()}`, name, collapsed: false, sortKey };
    publish({ ...records, groups: [...records.groups, group] });
    return group;
  }
  const answer = await saved<Group>("add_group", { name }, uiText("rosterStore.groupCreateFailed"));
  if (!answer) return null;
  publish({ ...records, groups: [...records.groups, answer.result] });
  return answer.result;
}

function editGroup(groupId: string, change: (group: Group) => Group, failure: string, name: string, args: InvokeArgs) {
  const previous = findGroup(groupId);
  if (!previous) return;
  replaceGroup(change(previous));
  if (source !== "database") return;
  void saved<Group>(name, args, failure).then((answer) => {
    if (answer?.latest) replaceGroup(answer.result);
  });
}

export function renameGroup(groupId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed || findGroup(groupId)?.name === trimmed) return;
  editGroup(
    groupId,
    (group) => ({ ...group, name: trimmed }),
    uiText("rosterStore.groupRenameFailed"),
    "rename_group",
    { groupId, name: trimmed },
  );
}

/** Collapsing is saved, so a group stays collapsed across restarts. */
export function setGroupCollapsed(groupId: string, collapsed: boolean) {
  editGroup(
    groupId,
    (group) => ({ ...group, collapsed }),
    uiText("rosterStore.groupSaveFailed"),
    "set_group_collapsed",
    { groupId, collapsed },
  );
}

/** Deletes a group; its accounts stay, as loose accounts where the group was. */
export function deleteGroup(groupId: string) {
  const group = findGroup(groupId);
  if (!group) return;
  const members = records.accounts.filter((account) => account.groupId === groupId && account.status === "clean").sort(bySortKey);
  const step = 1 / (members.length + 1);
  const keys = new Map(members.map((account, index) => [account.id, group.sortKey + step * index]));
  publish({
    groups: records.groups.filter((entry) => entry.id !== groupId),
    accounts: records.accounts.map((account) =>
      keys.has(account.id) ? { ...account, groupId: null, sortKey: keys.get(account.id)! } : account,
    ),
  });
  if (source !== "database") return;
  void saved<Records>("delete_group", { groupId }, uiText("rosterStore.groupDeleteFailed")).then((answer) => {
    if (answer?.latest) publish(answer.result);
  });
}

/* ---------- Status sections and moving ---------- */

/**
 * Sets an account's status: it moves to the end of the loose accounts, or of the SMS or banned
 * section, leaving its group.
 */
export function setStatus(accountId: number, status: AccountStatus) {
  if (findAccount(accountId)?.status === status) return;
  const container =
    status === "clean"
      ? [...records.accounts.filter((account) => account.status === "clean" && !account.groupId), ...records.groups]
      : records.accounts.filter((account) => account.status === status);
  const sortKey = Math.max(-1, ...container.map((item) => item.sortKey)) + 1;
  editAccount(
    accountId,
    (account) => ({ ...account, status, groupId: null, sortKey }),
    uiText("rosterStore.statusSaveFailed"),
    "set_status",
    { accountId, status },
  );
}

export type ListItem = { readonly kind: "account"; readonly id: number } | { readonly kind: "group"; readonly id: string };

/** Where a moved item goes: the top level or a group (clean), or the SMS or banned section. */
export interface Destination {
  readonly groupId: string | null;
  readonly status: AccountStatus;
}

/**
 * Moves one item and sets the order of its destination: `order` lists every item there, the moved
 * one included, top to bottom (Move to group, drag and drop).
 */
export function moveItem(item: ListItem, destination: Destination, order: readonly ListItem[]) {
  const keys = new Map(order.map((entry, index) => [`${entry.kind}:${entry.id}`, index]));
  const keyOf = (kind: string, id: string | number) => keys.get(`${kind}:${id}`);
  publish({
    accounts: records.accounts.map((account) => {
      const moved = item.kind === "account" && item.id === account.id;
      const sortKey = keyOf("account", account.id);
      if (!moved && sortKey === undefined) return account;
      return {
        ...account,
        ...(moved ? { groupId: destination.groupId, status: destination.status } : {}),
        sortKey: sortKey ?? account.sortKey,
      };
    }),
    groups: records.groups.map((group) => {
      const sortKey = keyOf("group", group.id);
      return sortKey === undefined ? group : { ...group, sortKey };
    }),
  });
  if (source !== "database") return;
  void saved<Records>("move_item", { item, destination, order }, uiText("rosterStore.moveFailed")).then((answer) => {
    if (answer?.latest) publish(answer.result);
  });
}

/** The items of a container in their current order (for building a move's `order`). */
export function containerItems(destination: Destination): ListItem[] {
  if (destination.status !== "clean") {
    return records.accounts
      .filter((account) => account.status === destination.status)
      .sort(bySortKey)
      .map((account) => ({ kind: "account", id: account.id }));
  }
  if (destination.groupId) {
    return records.accounts
      .filter((account) => account.status === "clean" && account.groupId === destination.groupId)
      .sort(bySortKey)
      .map((account) => ({ kind: "account", id: account.id }));
  }
  return buildRoster({ accounts: records.accounts.filter((account) => account.status === "clean"), groups: records.groups }, null).entries.map(
    (entry) => (entry.kind === "account" ? { kind: "account", id: entry.account.id } : { kind: "group", id: entry.group.id }),
  );
}

/** Move to group (context menu): to the end of that group, or of the loose accounts for none. */
export function moveAccountToGroup(accountId: number, groupId: string | null) {
  const destination: Destination = { groupId, status: "clean" };
  const item: ListItem = { kind: "account", id: accountId };
  const order = containerItems(destination).filter((entry) => !(entry.kind === "account" && entry.id === accountId));
  moveItem(item, destination, [...order, item]);
}

/* ---------- Rank tracking ---------- */

/** Games dodged, as in the old app: 0 to 10, each step a longer penalty. */
export const MAX_DODGES = 10;

export function setGamesDodged(accountId: number, count: number) {
  const clamped = Math.min(MAX_DODGES, Math.max(0, Math.round(count)));
  if (findAccount(accountId)?.gamesDodged === clamped) return;
  editAccount(
    accountId,
    (account) => ({ ...account, gamesDodged: clamped }),
    uiText("rosterStore.dodgesSaveFailed"),
    "set_games_dodged",
    { accountId, count: clamped },
  );
}

/**
 * Season reset: every rank goes back to Unranked, the old ones kept as Past ranks. Resolves to
 * what is needed to undo it (null when nothing was saved, e.g. dummy data or a failure).
 */
export async function seasonReset(): Promise<{ readonly resetAt: string; readonly cleared: number } | null> {
  if (source !== "database") return null;
  const answer = await saved<{ resetAt: string; cleared: number; roster: Records }>("season_reset", {}, uiText("rosterStore.rankResetFailed"));
  if (!answer) return null;
  if (answer.latest) publish(answer.result.roster);
  return { resetAt: answer.result.resetAt, cleared: answer.result.cleared };
}

/** Brings back the ranks a season reset cleared (ranks set again since keep their new value). */
export async function undoSeasonReset(resetAt: string): Promise<boolean> {
  const answer = await saved<Records>("undo_season_reset", { resetAt }, uiText("rosterStore.rankResetUndoFailed"));
  if (answer?.latest) publish(answer.result);
  return answer !== null;
}

