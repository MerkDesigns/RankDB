//! Upgrade tests: older databases keep every record across migrations.

use super::*;

fn folder() -> std::path::PathBuf {
    let mut suffix = [0u8; 8];
    getrandom::fill(&mut suffix).unwrap();
    let path = std::env::temp_dir().join(format!("rankdb-db-test-{}-{:x}", std::process::id(), u64::from_le_bytes(suffix)));
    fs::create_dir_all(&path).unwrap();
    path
}

fn table_sql(connection: &Connection) -> Vec<String> {
    connection
        .prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name")
        .unwrap()
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .map(|sql| sql.unwrap().split_whitespace().collect::<Vec<_>>().join(" "))
        .collect()
}

/// A database as version 4 left it, with a bit of everything.
fn version_4(dir: &Path) {
    let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
    connection.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    for migration in &MIGRATIONS[..4] {
        connection.execute_batch(migration).unwrap();
    }
    connection
        .execute_batch(
            "PRAGMA user_version = 4;
             INSERT INTO groups (id, name, sort_key, section) VALUES ('g', 'Mains', 0, 'normal');
             INSERT INTO accounts (id, name, sort_key, group_id, status, notes) VALUES (1, 'One#1', 0, 'g', 'clean', 'note');
             INSERT INTO accounts (id, name, sort_key, status) VALUES (2, 'Two#2', 1, 'banned');
             INSERT INTO ranks VALUES (1, 'tank', 'Gold', 3, 0, 0), (1, 'sixv6', 'Diamond', 1, 1, 4);
             INSERT INTO currencies VALUES (1, 'coins', 1200);
             INSERT INTO credentials VALUES (1, CAST('a@b.c' AS BLOB), NULL);
             UPDATE credential_security SET mode = 'plain';
             INSERT INTO rank_history (account_id, slot, tier, division, predicted, placements, changed_at, reason)
                VALUES (1, 'tank', 'Master', 2, 0, 0, '2026-01-01T00:00:00.000Z', 'season-reset'),
                       (2, 'damage', 'Silver', 5, 0, 0, '2026-01-01T00:00:00.000Z', 'season-reset');
             INSERT INTO settings VALUES ('uiScale', '1.1');",
        )
        .unwrap();
}

#[test]
fn upgrade_keeps_every_record_and_copies_the_old_file_first() {
    let dir = folder();
    version_4(&dir);
    let database = open_at(&dir).unwrap();
    {
        let connection = database.lock().unwrap();
        assert_eq!(schema_version(&connection).unwrap() as usize, MIGRATIONS.len());
        let roster = read_roster(&connection).unwrap();
        assert_eq!(roster.accounts.len(), 2);
        let one = &roster.accounts[0];
        assert_eq!((one.name.as_str(), one.group_id.as_deref()), ("One#1", Some("g")));
        assert_eq!((one.ranks[0].tier.as_str(), one.ranks[0].division), ("Gold", 3));
        assert_eq!((one.six_v6.tier.as_str(), one.six_v6.placements), ("Diamond", 4));
        assert_eq!(one.values_a, [0, 1200, 0]);
        assert!(one.has_email && !one.has_password);
        assert!(matches!(roster.accounts[1].status, Status::Banned));
        assert_eq!(roster.groups.len(), 1);
        let history: i64 = connection.query_row("SELECT COUNT(*) FROM rank_history", [], |row| row.get(0)).unwrap();
        assert_eq!(history, 2);
        let scale: String = connection.query_row("SELECT value FROM settings WHERE key = 'uiScale'", [], |row| row.get(0)).unwrap();
        assert_eq!(scale, "1.1");
    }
    drop(database);
    // The copy is the database exactly as version 4 had it.
    let copy = Connection::open(dir.join(UPGRADE_COPIES).join("rankdb-schema-v4.sqlite3")).unwrap();
    assert_eq!(schema_version(&copy).unwrap(), 4);
    let accounts: i64 = copy.query_row("SELECT COUNT(*) FROM accounts", [], |row| row.get(0)).unwrap();
    assert_eq!(accounts, 2);
    drop(copy);
    // Opening again changes nothing and copies nothing.
    drop(open_at(&dir).unwrap());
    assert_eq!(fs::read_dir(dir.join(UPGRADE_COPIES)).unwrap().count(), 1);
    fs::remove_dir_all(dir).unwrap();
}

/// Migration 6 moves the status to a column that also takes `suspended`: every status comes
/// through, with everything attached to the accounts, and the new one can be stored.
#[test]
fn statuses_survive_the_new_status_column() {
    let dir = folder();
    version_4(&dir);
    {
        let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
        connection.execute_batch(MIGRATIONS[4]).unwrap();
        connection
            .execute_batch(
                "PRAGMA user_version = 5;
                 INSERT INTO accounts (id, name, sort_key, status) VALUES (3, 'Three#3', 0, 'sms');",
            )
            .unwrap();
    }
    let database = open_at(&dir).unwrap();
    let connection = database.lock().unwrap();
    let status = |id: i64| -> String { connection.query_row("SELECT status FROM accounts WHERE id = ?1", [id], |row| row.get(0)).unwrap() };
    assert_eq!((status(1).as_str(), status(2).as_str(), status(3).as_str()), ("clean", "banned", "sms"));
    let roster = read_roster(&connection).unwrap();
    assert!(roster.accounts.iter().any(|account| account.name == "One#1" && account.has_email && account.values_a == [0, 1200, 0]));
    connection.execute("UPDATE accounts SET status = 'suspended' WHERE id = 3", []).unwrap();
    assert!(connection.execute("UPDATE accounts SET status = 'gone' WHERE id = 3", []).is_err());
    assert!(read_roster(&connection).unwrap().accounts.iter().any(|account| matches!(account.status, Status::Suspended)));
    drop(connection);
    drop(database);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn profiles_arrive_empty_and_follow_their_accounts() {
    let dir = folder();
    version_4(&dir);
    {
        let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
        connection.execute_batch(MIGRATIONS[4]).unwrap();
        connection.execute_batch(MIGRATIONS[5]).unwrap();
        connection.execute_batch("PRAGMA user_version = 6;").unwrap();
    }
    let database = open_at(&dir).unwrap();
    let connection = database.lock().unwrap();
    let count = |sql: &str| -> i64 { connection.query_row(sql, [], |row| row.get(0)).unwrap() };
    assert_eq!(count("SELECT COUNT(*) FROM account_profiles"), 0);
    assert_eq!(read_roster(&connection).unwrap().accounts.len(), 2);
    connection
        .execute_batch("INSERT INTO account_profiles VALUES (1, 'One#1', 'found', 'a.png', NULL, '2026-01-01T00:00:00.000Z');")
        .unwrap();
    assert!(connection.execute("INSERT INTO account_profiles VALUES (2, 'Two#2', 'odd', NULL, NULL, '')", []).is_err());
    assert!(connection.execute("INSERT INTO account_profiles VALUES (99, 'No#9', 'found', NULL, NULL, '')", []).is_err());
    connection.execute("DELETE FROM accounts WHERE id = 1", []).unwrap();
    assert_eq!(count("SELECT COUNT(*) FROM account_profiles"), 0);
    drop(connection);
    drop(database);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn upgraded_schema_matches_a_fresh_one() {
    let fresh_dir = folder();
    let fresh = open_at(&fresh_dir).unwrap();
    assert!(!fresh_dir.join(UPGRADE_COPIES).exists());
    let upgraded_dir = folder();
    version_4(&upgraded_dir);
    let upgraded = open_at(&upgraded_dir).unwrap();
    assert_eq!(table_sql(&fresh.lock().unwrap()), table_sql(&upgraded.lock().unwrap()));
    drop((fresh, upgraded));
    fs::remove_dir_all(fresh_dir).unwrap();
    fs::remove_dir_all(upgraded_dir).unwrap();
}

#[test]
fn database_from_a_newer_version_is_refused_untouched() {
    let dir = folder();
    drop(open_at(&dir).unwrap());
    let newer = MIGRATIONS.len() + 1;
    Connection::open(dir.join(FILE_NAME)).unwrap().execute_batch(&format!("PRAGMA user_version = {newer};")).unwrap();
    assert!(open_at(&dir).is_err());
    let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
    assert_eq!(schema_version(&connection).unwrap() as usize, newer);
    drop(connection);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn a_failing_migration_leaves_the_database_at_its_old_version() {
    let dir = folder();
    version_4(&dir);
    // An index on the column migration 5 drops makes it fail halfway.
    let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
    connection.execute_batch("CREATE INDEX groups_section ON groups (section);").unwrap();
    drop(connection);
    assert!(open_at(&dir).is_err());
    let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
    assert_eq!(schema_version(&connection).unwrap(), 4);
    let section: i64 = connection
        .query_row("SELECT COUNT(*) FROM pragma_table_info('groups') WHERE name = 'section'", [], |row| row.get(0))
        .unwrap();
    assert_eq!(section, 1);
    drop(connection);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn old_windows_key_database_is_refused_untouched() {
    let dir = folder();
    version_4(&dir);
    Connection::open(dir.join(FILE_NAME)).unwrap().execute_batch("UPDATE credential_security SET mode = 'legacy';").unwrap();
    assert!(open_at(&dir).is_err());
    let connection = Connection::open(dir.join(FILE_NAME)).unwrap();
    let email: Vec<u8> = connection.query_row("SELECT email FROM credentials", [], |row| row.get(0)).unwrap();
    assert_eq!(email, b"a@b.c");
    drop(connection);
    fs::remove_dir_all(dir).unwrap();
}
