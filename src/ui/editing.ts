import { useSyncExternalStore } from "react";

/**
 * Which row cell is being edited in place (one at a time), and which accounts were just added
 * (they show a "New" pill until their name is first saved). UI state only, never saved.
 */

export type Editor =
  | { readonly accountId: number; readonly kind: "name" }
  | { readonly accountId: number; readonly kind: "valuesA" | "valuesB"; readonly index: number }
  | { readonly groupId: string; readonly kind: "group" };

let editor: Editor | null = null;
let newAccounts: ReadonlySet<number> = new Set();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startEditing(next: Editor) {
  editor = next;
  emit();
}

export function stopEditing() {
  if (!editor) return;
  editor = null;
  emit();
}

export function markNew(accountId: number) {
  newAccounts = new Set([...newAccounts, accountId]);
  emit();
}

export function clearNew(accountId: number) {
  if (!newAccounts.has(accountId)) return;
  const remaining = new Set(newAccounts);
  remaining.delete(accountId);
  newAccounts = remaining;
  emit();
}

/** Whether this account's cell (name, or a currency) is the one being edited. */
export function useIsEditing(accountId: number, kind: "name" | "valuesA" | "valuesB", index = 0): boolean {
  return useSyncExternalStore(subscribe, () => {
    if (editor === null || editor.kind === "group") return false;
    return editor.accountId === accountId && editor.kind === kind && (editor.kind === "name" || editor.index === index);
  });
}

/** Whether this group's name is being edited. */
export function useIsEditingGroup(groupId: string): boolean {
  return useSyncExternalStore(subscribe, () => editor?.kind === "group" && editor.groupId === groupId);
}

export function useIsNew(accountId: number): boolean {
  return useSyncExternalStore(subscribe, () => newAccounts.has(accountId));
}
