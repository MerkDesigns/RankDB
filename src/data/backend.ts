import { invoke, type InvokeArgs } from "@tauri-apps/api/core";

/**
 * Every database command goes through here, one at a time, in the order they were made.
 *
 * Rust runs commands on worker threads (so the window never waits for the database), which means
 * two commands sent at once could reach the database in either order: a quick second edit could
 * land before the first. Queuing them keeps the order the user made them in.
 */
let tail: Promise<unknown> = Promise.resolve();

export function command<T>(name: string, args?: InvokeArgs): Promise<T> {
  const run = tail.then(() => invoke<T>(name, args));
  tail = run.catch(() => undefined);
  return run;
}

/** Resolves once every command sent so far has finished (before closing or updating). */
export function whenIdle(): Promise<void> {
  const current = tail;
  return current.then(() => (tail === current ? undefined : whenIdle()));
}
