//! Schema migrations, tracked by SQLite's `user_version`. Never edit a shipped one; add a new one.

/// Applied in order; `user_version` holds how many have run. Never edit one that has shipped:
/// add a new one instead.
pub(super) const MIGRATIONS: &[&str] = &[
    // 1: accounts, ranks, currencies, groups, rank history, settings.
    "
    CREATE TABLE groups (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        sort_key    REAL NOT NULL,
        collapsed   INTEGER NOT NULL DEFAULT 0,
        section     TEXT NOT NULL DEFAULT 'normal' CHECK (section IN ('normal', 'banned'))
    );
    CREATE TABLE accounts (
        id                  INTEGER PRIMARY KEY,
        name                TEXT NOT NULL,
        sort_key            REAL NOT NULL,
        group_id            TEXT REFERENCES groups(id) ON DELETE SET NULL,
        banned              INTEGER NOT NULL DEFAULT 0,
        country             TEXT NOT NULL DEFAULT '',
        notes               TEXT NOT NULL DEFAULT '',
        games_dodged        INTEGER NOT NULL DEFAULT 0,
        last_rank_change_at TEXT,
        created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE TABLE ranks (
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot        TEXT NOT NULL CHECK (slot IN ('tank', 'damage', 'support', 'sixv6')),
        tier        TEXT NOT NULL,
        division    INTEGER NOT NULL CHECK (division BETWEEN 1 AND 5),
        predicted   INTEGER NOT NULL DEFAULT 0,
        placements  INTEGER NOT NULL DEFAULT 0 CHECK (placements BETWEEN 0 AND 10),
        PRIMARY KEY (account_id, slot)
    );
    CREATE TABLE currencies (
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        kind        TEXT NOT NULL
                    CHECK (kind IN ('prisms', 'coins', 'credits', 'competitive', 'legacy')),
        value       INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (account_id, kind)
    );
    CREATE TABLE rank_history (
        id          INTEGER PRIMARY KEY,
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot        TEXT NOT NULL,
        tier        TEXT NOT NULL,
        division    INTEGER NOT NULL,
        predicted   INTEGER NOT NULL,
        placements  INTEGER NOT NULL,
        changed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        reason      TEXT NOT NULL CHECK (reason IN ('edit', 'season-reset', 'import'))
    );
    CREATE INDEX rank_history_account ON rank_history (account_id, changed_at);
    CREATE TABLE settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL
    );
    ",
    // 2: email and password, each sealed with the data key (src/secrets.rs); NULL when not set.
    "
    CREATE TABLE credentials (
        account_id  INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        email       BLOB,
        password    BLOB
    );
    ",
    // 3: a status (clean, needs SMS verification, banned) instead of the banned flag; SMS and
    // banned accounts each have their own section. Rank changes are no longer logged, only the
    // ranks season resets cleared.
    "
    ALTER TABLE accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'clean'
        CHECK (status IN ('clean', 'sms', 'banned'));
    UPDATE accounts SET status = 'banned' WHERE banned <> 0;
    ALTER TABLE accounts DROP COLUMN banned;
    DELETE FROM rank_history WHERE reason <> 'season-reset';
    ",
    // 4: explicit credential protection; fresh installations have no key dependency.
    "
    CREATE TABLE credential_security (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT NOT NULL CHECK (mode IN ('plain', 'legacy', 'password')),
        password_config TEXT,
        CHECK ((mode = 'password' AND password_config IS NOT NULL) OR (mode <> 'password' AND password_config IS NULL))
    );
    INSERT INTO credential_security (id, mode)
      SELECT 1, CASE WHEN EXISTS (SELECT 1 FROM credentials WHERE email IS NOT NULL OR password IS NOT NULL)
        THEN 'legacy' ELSE 'plain' END;
    ",
    // 5: cleanup. Groups lost their section (statuses replaced it in 3), and rank history holds
    // only season resets, so its columns get the same checks as `ranks`.
    "
    ALTER TABLE groups DROP COLUMN section;
    CREATE TABLE rank_history_v5 (
        id          INTEGER PRIMARY KEY,
        account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot        TEXT NOT NULL CHECK (slot IN ('tank', 'damage', 'support', 'sixv6')),
        tier        TEXT NOT NULL,
        division    INTEGER NOT NULL CHECK (division BETWEEN 1 AND 5),
        predicted   INTEGER NOT NULL,
        placements  INTEGER NOT NULL CHECK (placements BETWEEN 0 AND 10),
        changed_at  TEXT NOT NULL,
        reason      TEXT NOT NULL DEFAULT 'season-reset' CHECK (reason = 'season-reset')
    );
    INSERT INTO rank_history_v5 (id, account_id, slot, tier, division, predicted, placements, changed_at, reason)
        SELECT id, account_id, slot, tier, division, predicted, placements, changed_at, reason FROM rank_history
        WHERE reason = 'season-reset' AND slot IN ('tank', 'damage', 'support', 'sixv6')
          AND division BETWEEN 1 AND 5 AND placements BETWEEN 0 AND 10;
    DROP TABLE rank_history;
    ALTER TABLE rank_history_v5 RENAME TO rank_history;
    CREATE INDEX rank_history_account ON rank_history (account_id, changed_at);
    CREATE INDEX rank_history_reset ON rank_history (changed_at);
    ",
    // 6: a fourth status, `suspended` (temporarily banned), with its own section. A column's CHECK
    // can't be altered, so the status moves to a new column that takes the old one's name; no
    // table is rebuilt, so nothing that references accounts is touched.
    "
    ALTER TABLE accounts ADD COLUMN status_v6 TEXT NOT NULL DEFAULT 'clean'
        CHECK (status_v6 IN ('clean', 'sms', 'suspended', 'banned'));
    UPDATE accounts SET status_v6 = status;
    ALTER TABLE accounts DROP COLUMN status;
    ALTER TABLE accounts RENAME COLUMN status_v6 TO status;
    ",
    // 7: profile pictures and banners (experimental, db/profiles.rs): what owapi.eu had for each
    // account, looked up by its BattleTag at that time. Images live in files beside the database;
    // the rows only name them. Empty unless the feature is on.
    "
    CREATE TABLE account_profiles (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('found', 'missing', 'invalid')),
        avatar TEXT,
        banner TEXT,
        checked_at TEXT NOT NULL
    );
    ",
];
