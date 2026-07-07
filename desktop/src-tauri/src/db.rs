//! SQLite pool + row-to-JSON helpers.
//!
//! Rows are converted to serde_json Values generically; columns whose names
//! match the app's known boolean fields are emitted as real JSON booleans
//! (the frontend expects true/false, not 0/1).

use std::path::Path;

use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::types::ValueRef;
use rusqlite::Connection;
use serde_json::{json, Map, Value};

use crate::error::ApiError;

pub type Pool = r2d2::Pool<SqliteConnectionManager>;

const SCHEMA: &str = include_str!("../../../schema.sqlite.sql");

// Boolean columns across all tables (including the last_* aliases used by
// the students list query).
const BOOL_COLS: &[&str] = &[
    "writing_goal",
    "flagged_for_followup",
    "claim_present",
    "evidence_cited",
    "explanation_present",
    "source_named",
    "response_incomplete",
    "ai_flag",
];

fn is_bool_col(name: &str) -> bool {
    BOOL_COLS.iter().any(|b| name == *b || name.ends_with(&format!("_{b}")))
}

pub fn init(db_path: &Path) -> Result<Pool, Box<dyn std::error::Error>> {
    let manager = SqliteConnectionManager::file(db_path).with_init(|conn| {
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
    });
    let pool = r2d2::Pool::builder().max_size(4).build(manager)?;
    pool.get()?.execute_batch(SCHEMA)?;
    Ok(pool)
}

/// Run blocking SQLite work off the async reactor.
pub async fn blocking<T, F>(pool: &Pool, f: F) -> Result<T, ApiError>
where
    F: FnOnce(&Connection) -> Result<T, ApiError> + Send + 'static,
    T: Send + 'static,
{
    let pool = pool.clone();
    tokio::task::spawn_blocking(move || {
        let conn = pool.get()?;
        f(&conn)
    })
    .await
    .map_err(|e| ApiError::internal(format!("task join error: {e}")))?
}

pub fn row_to_json(row: &rusqlite::Row) -> Result<Value, rusqlite::Error> {
    let stmt: &rusqlite::Statement = row.as_ref();
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut map = Map::new();
    for (i, name) in names.iter().enumerate() {
        let v = match row.get_ref(i)? {
            ValueRef::Null => Value::Null,
            ValueRef::Integer(n) => {
                if is_bool_col(name) {
                    Value::Bool(n != 0)
                } else {
                    json!(n)
                }
            }
            ValueRef::Real(f) => json!(f),
            ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
            ValueRef::Blob(_) => Value::Null,
        };
        map.insert(name.clone(), v);
    }
    Ok(Value::Object(map))
}

pub fn query_json(
    conn: &Connection,
    sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> Result<Vec<Value>, ApiError> {
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query(params)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        out.push(row_to_json(row)?);
    }
    Ok(out)
}

pub fn query_json_dyn(
    conn: &Connection,
    sql: &str,
    params: &[rusqlite::types::Value],
) -> Result<Vec<Value>, ApiError> {
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt.query(rusqlite::params_from_iter(params.iter()))?;
    let mut out = Vec::new();
    while let Some(row) = rows.next()? {
        out.push(row_to_json(row)?);
    }
    Ok(out)
}

/// Convert a JSON body value to a SQLite parameter value.
pub fn to_sql_value(v: &Value) -> rusqlite::types::Value {
    use rusqlite::types::Value as Sv;
    match v {
        Value::Null => Sv::Null,
        Value::Bool(b) => Sv::Integer(*b as i64),
        Value::Number(n) => n
            .as_i64()
            .map(Sv::Integer)
            .unwrap_or_else(|| Sv::Real(n.as_f64().unwrap_or(0.0))),
        Value::String(s) => Sv::Text(s.clone()),
        other => Sv::Text(other.to_string()),
    }
}

/// Port of lib/boolean.js parseBooleanValue — avoids Boolean("false") === true.
pub fn parse_boolean_value(v: &Value) -> bool {
    match v {
        Value::Bool(b) => *b,
        Value::Null => false,
        Value::String(s) => match s.as_str() {
            "" | "false" => false,
            "true" => true,
            _ => true,
        },
        Value::Number(n) => n.as_f64().map(|f| f != 0.0).unwrap_or(false),
        _ => true,
    }
}

/// Port of lib/words.js wordCount — the server always computes word counts.
pub fn word_count(text: &str) -> i64 {
    let t = text.trim();
    if t.is_empty() {
        0
    } else {
        t.split_whitespace().count() as i64
    }
}

/// Incrementally build `UPDATE ... SET a = ?, b = ?` statements the same way
/// the Express routes build `$1, $2, ...` field lists.
pub struct UpdateBuilder {
    pub fields: Vec<String>,
    pub values: Vec<rusqlite::types::Value>,
}

impl UpdateBuilder {
    pub fn new() -> Self {
        Self { fields: Vec::new(), values: Vec::new() }
    }

    pub fn set(&mut self, col: &str, v: rusqlite::types::Value) {
        self.fields.push(format!("{col} = ?"));
        self.values.push(v);
    }

    pub fn is_empty(&self) -> bool {
        self.fields.is_empty()
    }
}
