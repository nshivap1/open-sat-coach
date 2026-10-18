//! App state persisted as one JSON document in SQLite (`coach.sqlite` in the app data dir).

use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const DB_FILE: &str = "coach.sqlite";
const BACKUP_INTERVAL_MS: i64 = 60 * 60 * 1000;
const BACKUPS_KEPT: i64 = 20;

/// One lazily opened connection shared by all storage commands.
#[derive(Default)]
pub struct DbState {
    conn: Mutex<Option<Connection>>,
}

fn db_err(e: rusqlite::Error) -> String {
    format!("Database error: {e}")
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn open(dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Could not create data folder {}: {e}", dir.display()))?;
    let mut conn = Connection::open(dir.join(DB_FILE)).map_err(db_err)?;
    conn.busy_timeout(Duration::from_secs(5)).map_err(db_err)?;
    // journal_mode returns the resulting mode as a row, so read it with query_row.
    let _mode: String = conn
        .query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))
        .map_err(db_err)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(db_err)?;
    migrate(&mut conn).map_err(db_err)?;
    Ok(conn)
}

fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    if version < 1 {
        let tx = conn.transaction()?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS state (
                 id INTEGER PRIMARY KEY CHECK (id = 1),
                 json TEXT NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS state_backups (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 json TEXT NOT NULL,
                 created_at INTEGER NOT NULL
             );
             PRAGMA user_version = 1;",
        )?;
        tx.commit()?;
    }
    Ok(())
}

fn with_conn<T, F>(app: &AppHandle, f: F) -> Result<T, String>
where
    F: FnOnce(&mut Connection) -> Result<T, String>,
{
    let state = app.state::<DbState>();
    let mut guard = state
        .conn
        .lock()
        .map_err(|_| "Storage is unavailable (lock poisoned)".to_string())?;
    if guard.is_none() {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Could not locate the app data folder: {e}"))?;
        *guard = Some(open(&dir)?);
    }
    let conn = guard
        .as_mut()
        .ok_or_else(|| "Storage is unavailable".to_string())?;
    let result = f(conn);
    result
}

fn load(conn: &mut Connection) -> Result<Option<String>, String> {
    conn.query_row("SELECT json FROM state WHERE id = 1", [], |row| {
        row.get::<_, String>(0)
    })
    .optional()
    .map_err(db_err)
}

fn save(conn: &mut Connection, json: &str) -> Result<(), String> {
    let now = now_ms();
    let tx = conn.transaction().map_err(db_err)?;
    tx.execute(
        "INSERT INTO state (id, json, updated_at) VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
        params![json, now],
    )
    .map_err(db_err)?;

    let newest: Option<i64> = tx
        .query_row("SELECT MAX(created_at) FROM state_backups", [], |row| row.get(0))
        .map_err(db_err)?;
    let backup_due = match newest {
        Some(t) => now - t >= BACKUP_INTERVAL_MS,
        None => true,
    };
    if backup_due {
        tx.execute(
            "INSERT INTO state_backups (json, created_at) VALUES (?1, ?2)",
            params![json, now],
        )
        .map_err(db_err)?;
        tx.execute(
            "DELETE FROM state_backups WHERE id NOT IN
                 (SELECT id FROM state_backups ORDER BY id DESC LIMIT ?1)",
            params![BACKUPS_KEPT],
        )
        .map_err(db_err)?;
    }
    tx.commit().map_err(db_err)
}

#[tauri::command]
pub async fn load_state(app: AppHandle) -> Result<Option<String>, String> {
    crate::blocking(move || with_conn(&app, load)).await
}

#[tauri::command]
pub async fn save_state(app: AppHandle, json: String) -> Result<(), String> {
    crate::blocking(move || {
        // Never overwrite good data with something that is not JSON.
        serde_json::from_str::<serde_json::Value>(&json)
            .map_err(|e| format!("Refusing to save invalid JSON: {e}"))?;
        with_conn(&app, |conn| save(conn, &json))
    })
    .await
}
