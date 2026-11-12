/**
 * Which way this build is distributed. RankDB comes from GitHub (its own setup and updater) and
 * from the Microsoft Store (an MSIX the Store updates; docs/MICROSOFT_STORE.md). The Store build
 * is made with `VITE_RANKDB_CHANNEL=store` (scripts/build-store.mjs), and its Rust side with the
 * `store` feature, which leaves the updater out altogether.
 */
export const STORE_BUILD = import.meta.env.VITE_RANKDB_CHANNEL === "store";
