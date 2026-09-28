//! Durable attempt snapshots and ordered event history. Execution stays in TurnRunner.
use rusqlite::{Connection, OptionalExtension, Transaction, params};
#[cfg(any(feature = "node", test))]
use std::path::PathBuf;

const KEEP_TERMINAL: i64 = 10_000;

#[cfg(any(feature = "node", test))]
fn open(path: &PathBuf) -> rusqlite::Result<Connection> {
    let db = Connection::open(path)?;
    db.pragma_update(None, "journal_mode", "WAL")?;
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS turn_attempt (
            attempt_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
            queue_message_id TEXT, provider_session_id TEXT,
            state TEXT NOT NULL, terminal_cause TEXT, updated_at TEXT NOT NULL,
            snapshot TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS turn_attempt_conversation ON turn_attempt(conversation_id, updated_at DESC, attempt_id DESC);
        CREATE INDEX IF NOT EXISTS turn_attempt_queue ON turn_attempt(queue_message_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS turn_attempt_session ON turn_attempt(provider_session_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS turn_attempt_retention ON turn_attempt(updated_at DESC, attempt_id DESC)
            WHERE state IN ('succeeded','failed','cancelled','interrupted');
        CREATE TABLE IF NOT EXISTS turn_attempt_import (name TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS turn_attempt_event (
            seq INTEGER PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, attempt_id TEXT,
            conversation_id TEXT, timestamp TEXT NOT NULL, event TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS turn_attempt_event_conversation ON turn_attempt_event(conversation_id, seq DESC);
        CREATE INDEX IF NOT EXISTS turn_attempt_event_attempt ON turn_attempt_event(attempt_id, seq DESC);",
    )?;
    Ok(db)
}

/// Import a complete v1 history in one transaction. A failed import leaves no marker or rows.
pub fn import_legacy(db: &mut Connection, rows_json: &str) -> rusqlite::Result<bool> {
    if db.query_row("SELECT 1 FROM turn_attempt_import WHERE name='jsonl-v1'", [], |_| Ok(())).optional()?.is_some() {
        return Ok(false);
    }
    let rows: Vec<serde_json::Value> =
        serde_json::from_str(rows_json).map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
    let tx = db.transaction()?;
    for row in rows {
        let event = &row["event"];
        let snapshot = &row["snapshot"];
        let event_text = serde_json::to_string(event).map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
        tx.execute(
            "INSERT OR IGNORE INTO turn_attempt_event(event_id,attempt_id,conversation_id,timestamp,event) VALUES (?1,?2,?3,?4,?5)",
            params![
                event["eventId"].as_str(),
                event["attemptId"].as_str(),
                event["conversationId"].as_str(),
                event["timestamp"].as_str(),
                event_text
            ],
        )?;
        if !snapshot.is_null() {
            tx.execute("INSERT INTO turn_attempt(attempt_id,conversation_id,queue_message_id,provider_session_id,state,terminal_cause,updated_at,snapshot)
                VALUES (?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(attempt_id) DO UPDATE SET
                provider_session_id=excluded.provider_session_id, state=excluded.state,
                terminal_cause=excluded.terminal_cause, updated_at=excluded.updated_at, snapshot=excluded.snapshot",
                params![snapshot["attemptId"].as_str(), snapshot["conversationId"].as_str(), snapshot["queueMessageId"].as_str(),
                    snapshot["providerSessionId"].as_str(), snapshot["state"].as_str(), snapshot["terminalCause"].as_str(),
                    snapshot["updatedAt"].as_str(), snapshot.to_string()])?;
        }
    }
    prune_terminal(&tx)?;
    prune_events(&tx)?;
    tx.execute("INSERT INTO turn_attempt_import(name) VALUES ('jsonl-v1')", [])?;
    tx.commit()?;
    Ok(true)
}

pub fn legacy_imported(db: &Connection) -> rusqlite::Result<bool> {
    Ok(db.query_row("SELECT 1 FROM turn_attempt_import WHERE name='jsonl-v1'", [], |_| Ok(())).optional()?.is_some())
}

// Pattern: one-write-path (docs/patterns.md#one-write-path)
// Snapshot and event commit together; an interrupted write cannot split the two read models.
pub fn append(db: &mut Connection, snapshot: Option<&str>, event: &str) -> rusqlite::Result<bool> {
    let tx = db.transaction()?;
    let e: serde_json::Value = serde_json::from_str(event).map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
    let event_id = e["eventId"].as_str().unwrap_or("");
    let inserted = tx.execute(
        "INSERT OR IGNORE INTO turn_attempt_event(event_id,attempt_id,conversation_id,timestamp,event) VALUES (?1,?2,?3,?4,?5)",
        params![event_id, e["attemptId"].as_str(), e["conversationId"].as_str(), e["timestamp"].as_str().unwrap_or(""), event],
    )?;
    if inserted == 0 {
        return Ok(false);
    }
    let mut terminal = false;
    if let Some(snapshot) = snapshot {
        let s: serde_json::Value = serde_json::from_str(snapshot).map_err(|err| rusqlite::Error::ToSqlConversionFailure(Box::new(err)))?;
        terminal = matches!(s["state"].as_str(), Some("succeeded" | "failed" | "cancelled" | "interrupted"));
        tx.execute(
            "INSERT INTO turn_attempt(attempt_id,conversation_id,queue_message_id,provider_session_id,state,terminal_cause,updated_at,snapshot)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
             ON CONFLICT(attempt_id) DO UPDATE SET provider_session_id=excluded.provider_session_id,
               state=excluded.state, terminal_cause=excluded.terminal_cause, updated_at=excluded.updated_at,
               snapshot=excluded.snapshot",
            params![s["attemptId"].as_str(), s["conversationId"].as_str(), s["queueMessageId"].as_str(),
                s["providerSessionId"].as_str(), s["state"].as_str(), s["terminalCause"].as_str(),
                s["updatedAt"].as_str(), snapshot],
        )?;
    }
    if terminal {
        prune_terminal(&tx)?;
    }
    prune_events(&tx)?;
    tx.commit()?;
    Ok(true)
}

// Indexed cutoff runs on terminal writes and legacy import, never a heartbeat.
fn prune_terminal(tx: &Transaction<'_>) -> rusqlite::Result<()> {
    let cutoff: Option<(String, String)> = tx
        .query_row(
            "SELECT updated_at, attempt_id FROM turn_attempt WHERE state IN ('succeeded','failed','cancelled','interrupted')
             ORDER BY updated_at DESC, attempt_id DESC LIMIT 1 OFFSET ?1",
            params![KEEP_TERMINAL],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((at, id)) = cutoff {
        let surplus = "SELECT attempt_id FROM turn_attempt WHERE state IN ('succeeded','failed','cancelled','interrupted')
            AND (updated_at < ?1 OR (updated_at = ?1 AND attempt_id <= ?2))";
        tx.execute(&format!("DELETE FROM turn_attempt_event WHERE attempt_id IN ({surplus})"), params![at, id])?;
        tx.execute(&format!("DELETE FROM turn_attempt WHERE attempt_id IN ({surplus})"), params![at, id])?;
    }
    Ok(())
}

fn prune_events(tx: &Transaction<'_>) -> rusqlite::Result<()> {
    // A chatty turn can exceed the attempt cap by itself; seq pruning is an indexed range delete.
    tx.execute(
        "DELETE FROM turn_attempt_event WHERE seq <=
        (SELECT MAX(seq) - 200000 FROM turn_attempt_event)",
        [],
    )?;
    Ok(())
}

pub fn get(db: &Connection, id: &str) -> rusqlite::Result<Option<String>> {
    db.query_row("SELECT snapshot FROM turn_attempt WHERE attempt_id=?1", [id], |r| r.get(0)).optional()
}

pub fn query(
    db: &Connection,
    conversation: Option<&str>,
    queue: Option<&str>,
    session: Option<&str>,
    state: Option<&str>,
    cause: Option<&str>,
    limit: u32,
) -> rusqlite::Result<Vec<String>> {
    if let (Some(conversation), None, None, None, None) = (conversation, queue, session, state, cause) {
        // The mounted thread's latest attempt uses the conversation index directly.
        let mut stmt =
            db.prepare("SELECT snapshot FROM turn_attempt WHERE conversation_id=?1 ORDER BY updated_at DESC, attempt_id DESC LIMIT ?2")?;
        return stmt.query_map(params![conversation, limit.min(1000)], |r| r.get(0))?.collect();
    }
    let mut stmt = db.prepare(
        "SELECT snapshot FROM turn_attempt WHERE (?1 IS NULL OR conversation_id=?1)
        AND (?2 IS NULL OR queue_message_id=?2) AND (?3 IS NULL OR provider_session_id=?3)
        AND (?4 IS NULL OR state=?4) AND (?5 IS NULL OR terminal_cause=?5)
        ORDER BY updated_at DESC, attempt_id DESC LIMIT ?6",
    )?;
    stmt.query_map(params![conversation, queue, session, state, cause, limit.min(1000)], |r| r.get(0))?.collect()
}

pub fn events(
    db: &Connection,
    attempt: Option<&str>,
    conversation: Option<&str>,
    since: Option<&str>,
    limit: u32,
) -> rusqlite::Result<Vec<String>> {
    if since.is_none() {
        if let (Some(attempt), None) = (attempt, conversation) {
            let mut stmt = db.prepare(
                "SELECT event FROM (SELECT seq,event FROM turn_attempt_event WHERE attempt_id=?1 ORDER BY seq DESC LIMIT ?2) ORDER BY seq",
            )?;
            return stmt.query_map(params![attempt, limit.min(1000)], |r| r.get(0))?.collect();
        }
        if let (None, Some(conversation)) = (attempt, conversation) {
            let mut stmt = db.prepare("SELECT event FROM (SELECT seq,event FROM turn_attempt_event WHERE conversation_id=?1 ORDER BY seq DESC LIMIT ?2) ORDER BY seq")?;
            return stmt.query_map(params![conversation, limit.min(1000)], |r| r.get(0))?.collect();
        }
    }
    let mut stmt = db.prepare(
        "SELECT event FROM (SELECT seq,event FROM turn_attempt_event WHERE
        (?1 IS NULL OR attempt_id=?1) AND (?2 IS NULL OR conversation_id=?2)
        AND (?3 IS NULL OR timestamp>=?3) ORDER BY seq DESC LIMIT ?4) ORDER BY seq",
    )?;
    stmt.query_map(params![attempt, conversation, since, limit.min(1000)], |r| r.get(0))?.collect()
}

pub fn recoverable(db: &Connection, boot: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = db.prepare(
        "SELECT snapshot FROM turn_attempt WHERE state IN ('queued','starting','running','stopping') ORDER BY updated_at, attempt_id",
    )?;
    let rows: Vec<String> = stmt.query_map([], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(rows
        .into_iter()
        .filter(|row| {
            serde_json::from_str::<serde_json::Value>(row)
                .ok()
                .and_then(|value| value["originServerBootId"].as_str().map(|id| id != boot))
                .unwrap_or(false)
        })
        .collect())
}

#[cfg(feature = "node")]
pub mod node {
    use super::*;
    use napi::bindgen_prelude::*;
    use napi_derive::napi;
    use std::sync::{Arc, Mutex};

    fn err(e: impl std::fmt::Display) -> Error {
        Error::from_reason(e.to_string())
    }
    async fn work<T: Send + 'static>(f: impl FnOnce() -> rusqlite::Result<T> + Send + 'static) -> Result<T> {
        tokio::task::spawn_blocking(f).await.map_err(err)?.map_err(err)
    }

    #[napi]
    pub struct TurnAttempts {
        db: Arc<Mutex<Connection>>,
    }

    #[napi]
    impl TurnAttempts {
        #[napi(factory)]
        pub async fn open(db_path: String) -> Result<Self> {
            let db = work(move || open(&PathBuf::from(db_path))).await?;
            Ok(Self { db: Arc::new(Mutex::new(db)) })
        }
        #[napi]
        pub async fn append(&self, snapshot: Option<String>, event: String) -> Result<bool> {
            let db = self.db.clone();
            work(move || super::append(&mut db.lock().expect("attempt connection poisoned"), snapshot.as_deref(), &event)).await
        }
        #[napi]
        pub async fn get(&self, id: String) -> Result<Option<String>> {
            let db = self.db.clone();
            work(move || super::get(&db.lock().expect("attempt connection poisoned"), &id)).await
        }
        #[napi]
        pub async fn query(
            &self,
            conversation: Option<String>,
            queue: Option<String>,
            session: Option<String>,
            state: Option<String>,
            cause: Option<String>,
            limit: u32,
        ) -> Result<Vec<String>> {
            let db = self.db.clone();
            work(move || {
                super::query(
                    &db.lock().expect("attempt connection poisoned"),
                    conversation.as_deref(),
                    queue.as_deref(),
                    session.as_deref(),
                    state.as_deref(),
                    cause.as_deref(),
                    limit,
                )
            })
            .await
        }
        #[napi]
        pub async fn events(
            &self,
            attempt: Option<String>,
            conversation: Option<String>,
            since: Option<String>,
            limit: u32,
        ) -> Result<Vec<String>> {
            let db = self.db.clone();
            work(move || {
                super::events(
                    &db.lock().expect("attempt connection poisoned"),
                    attempt.as_deref(),
                    conversation.as_deref(),
                    since.as_deref(),
                    limit,
                )
            })
            .await
        }
        #[napi]
        pub async fn recoverable(&self, boot: String) -> Result<Vec<String>> {
            let db = self.db.clone();
            work(move || super::recoverable(&db.lock().expect("attempt connection poisoned"), &boot)).await
        }
        #[napi]
        pub async fn import_legacy(&self, rows_json: String) -> Result<bool> {
            let db = self.db.clone();
            work(move || super::import_legacy(&mut db.lock().expect("attempt connection poisoned"), &rows_json)).await
        }
        #[napi]
        pub async fn legacy_imported(&self) -> Result<bool> {
            let db = self.db.clone();
            work(move || super::legacy_imported(&db.lock().expect("attempt connection poisoned"))).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn indexed_latest_and_same_timestamp_retention() {
        let dir = tempdir().unwrap();
        let mut db = open(&dir.path().join("attempts.sqlite")).unwrap();
        let plan: String = db.query_row(
            "EXPLAIN QUERY PLAN SELECT snapshot FROM turn_attempt WHERE conversation_id=?1 ORDER BY updated_at DESC, attempt_id DESC LIMIT 1",
            ["c"], |r| r.get(3)).unwrap();
        assert!(plan.contains("turn_attempt_conversation"), "{plan}");
        let plan: String = db.query_row(
            "EXPLAIN QUERY PLAN SELECT updated_at, attempt_id FROM turn_attempt WHERE state IN ('succeeded','failed','cancelled','interrupted') ORDER BY updated_at DESC, attempt_id DESC LIMIT 1 OFFSET 10000",
            [], |r| r.get(3)).unwrap();
        assert!(plan.contains("turn_attempt_retention"), "{plan}");
        let tx = db.transaction().unwrap();
        for i in 0..KEEP_TERMINAL {
            let id = format!("a{i:05}");
            tx.execute(
                "INSERT INTO turn_attempt(attempt_id,conversation_id,state,updated_at,snapshot) VALUES (?1,'c','failed','same', '{}')",
                [&id],
            )
            .unwrap();
        }
        tx.commit().unwrap();
        let snapshot = serde_json::json!({"attemptId":"z99999","conversationId":"c","state":"failed","terminalCause":"provider_error","updatedAt":"same"}).to_string();
        let event = serde_json::json!({"eventId":"e","attemptId":"z99999","conversationId":"c","timestamp":"same"}).to_string();
        append(&mut db, Some(&snapshot), &event).unwrap();
        let count: i64 = db.query_row("SELECT count(*) FROM turn_attempt", [], |r| r.get(0)).unwrap();
        assert_eq!(count, KEEP_TERMINAL);
        assert!(get(&db, "a00000").unwrap().is_none());
        assert!(get(&db, "z99999").unwrap().is_some());
    }

    #[test]
    fn bad_import_does_not_leave_completion_marker() {
        let dir = tempdir().unwrap();
        let mut db = open(&dir.path().join("attempts.sqlite")).unwrap();
        assert!(import_legacy(&mut db, "[{\"event\":null,\"snapshot\":{\"attemptId\":\"a\"}}]").is_err());
        assert!(!legacy_imported(&db).unwrap());
        let count: i64 = db.query_row("SELECT count(*) FROM turn_attempt", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
    }
}
