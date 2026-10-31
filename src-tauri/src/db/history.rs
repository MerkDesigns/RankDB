//! Rank tracking: season resets, past ranks and games dodged.

use super::*;

/* ---------- Rank tracking ---------- */

/// A rank a season reset cleared.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RankHistoryEntry {
    pub slot: String,
    pub rank: Rank,
    pub changed_at: String,
    pub reason: String,
}

/// Newest first; a long-tracked account keeps only the most recent entries on screen.
pub(crate) const HISTORY_LIMIT: i64 = 200;

#[tauri::command]
pub async fn get_rank_history(database: State<'_, Database>, account_id: i64) -> Result<Vec<RankHistoryEntry>, String> {
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    let mut statement = connection
        .prepare(
            "SELECT slot, tier, division, predicted, placements, changed_at, reason FROM rank_history
             WHERE account_id = ?1 AND reason = 'season-reset' ORDER BY changed_at DESC, id DESC LIMIT ?2",
        )
        .map_err(to_message)?;
    let rows = statement
        .query_map(params![account_id, HISTORY_LIMIT], |row| {
            Ok(RankHistoryEntry {
                slot: row.get(0)?,
                rank: Rank { tier: row.get(1)?, division: row.get(2)?, predicted: row.get(3)?, placements: row.get(4)? },
                changed_at: row.get(5)?,
                reason: row.get(6)?,
            })
        })
        .map_err(to_message)?;
    rows.collect::<Result<_, _>>().map_err(to_message)
}

/// Every season reset, newest first (the time its history entries share).
#[tauri::command]
pub async fn list_season_resets(database: State<'_, Database>) -> Result<Vec<String>, String> {
    let connection = database.lock()?;
    connection
        .prepare(
            "SELECT DISTINCT changed_at FROM rank_history WHERE reason = 'season-reset' ORDER BY changed_at DESC",
        )
        .and_then(|mut statement| statement.query_map([], |row| row.get(0))?.collect())
        .map_err(to_message)
}

/// One rank a season reset cleared (slots it doesn't list were Unranked then).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetRank {
    pub account_id: i64,
    pub slot: String,
    pub rank: Rank,
}

#[tauri::command]
pub async fn get_season_reset(database: State<'_, Database>, reset_at: String) -> Result<Vec<ResetRank>, String> {
    let connection = database.lock()?;
    let mut statement = connection
        .prepare(
            "SELECT account_id, slot, tier, division, predicted, placements FROM rank_history
             WHERE reason = 'season-reset' AND changed_at = ?1",
        )
        .map_err(to_message)?;
    let rows = statement
        .query_map([&reset_at], |row| {
            Ok(ResetRank {
                account_id: row.get(0)?,
                slot: row.get(1)?,
                rank: Rank { tier: row.get(2)?, division: row.get(3)?, predicted: row.get(4)?, placements: row.get(5)? },
            })
        })
        .map_err(to_message)?;
    rows.collect::<Result<_, _>>().map_err(to_message)
}

/// What a season reset did, so it can be undone.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonReset {
    /// Marks this reset's history entries (they all share this time).
    pub reset_at: String,
    /// Ranks that were cleared.
    pub cleared: i64,
    pub roster: Roster,
}

/// Season reset: every rank of every account (6v6 included) goes back to Unranked. Each cleared
/// rank is kept in the rank history as `season-reset`, shown under Past ranks.
#[tauri::command]
pub async fn season_reset(database: State<'_, Database>) -> Result<SeasonReset, String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    let reset_at: String = transaction
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| row.get(0))
        .map_err(to_message)?;
    let cleared = transaction
        .execute(
            "INSERT INTO rank_history (account_id, slot, tier, division, predicted, placements, changed_at, reason)
             SELECT account_id, slot, tier, division, predicted, placements, ?1, 'season-reset'
             FROM ranks WHERE tier <> 'Unranked'",
            [&reset_at],
        )
        .map_err(to_message)? as i64;
    transaction
        .execute(
            "UPDATE ranks SET tier = 'Unranked', division = 5, predicted = 0, placements = 0 WHERE tier <> 'Unranked'",
            [],
        )
        .map_err(to_message)?;
    transaction.commit().map_err(to_message)?;
    Ok(SeasonReset { reset_at, cleared, roster: read_roster(&connection)? })
}

/// Undoes a season reset: ranks it cleared come back, unless they were set again since (those
/// keep their new value). Its history entries are removed.
#[tauri::command]
pub async fn undo_season_reset(database: State<'_, Database>, reset_at: String) -> Result<Roster, String> {
    let mut connection = database.lock()?;
    let transaction = connection.transaction().map_err(to_message)?;
    transaction
        .execute(
            "UPDATE ranks SET
                tier = h.tier, division = h.division, predicted = h.predicted, placements = h.placements
             FROM (SELECT account_id, slot, tier, division, predicted, placements FROM rank_history
                   WHERE reason = 'season-reset' AND changed_at = ?1) AS h
             WHERE ranks.account_id = h.account_id AND ranks.slot = h.slot
               AND ranks.tier = 'Unranked' AND ranks.predicted = 0",
            [&reset_at],
        )
        .map_err(to_message)?;
    transaction
        .execute("DELETE FROM rank_history WHERE reason = 'season-reset' AND changed_at = ?1", [&reset_at])
        .map_err(to_message)?;
    transaction.commit().map_err(to_message)?;
    read_roster(&connection)
}

/// The old app's counter: penalties step up per dodge and reset after 20 games without one.
pub(crate) const MAX_DODGES: i64 = 10;

#[tauri::command]
pub async fn set_games_dodged(database: State<'_, Database>, account_id: i64, count: i64) -> Result<Account, String> {
    if !(0..=MAX_DODGES).contains(&count) {
        return Err(crate::text::format("errors.db.dodgesOutOfRange", &[("limit", MAX_DODGES.to_string())]));
    }
    let connection = database.lock()?;
    require_account(&connection, account_id)?;
    connection
        .execute("UPDATE accounts SET games_dodged = ?2 WHERE id = ?1", params![account_id, count])
        .map_err(to_message)?;
    account_or_gone(&connection, account_id)
}
