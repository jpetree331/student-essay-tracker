//! Port of routes/comparisons.js — save an AI comparison report.
//! entry_ids (Postgres INTEGER[]) and report_json (JSONB) are stored as JSON
//! text in SQLite and exposed as real JSON in responses.

use std::collections::HashSet;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Response;
use rusqlite::types::Value as Sv;
use serde_json::Value;

use crate::db::{blocking, query_json_dyn, Pool};
use crate::error::{ok_with_status, ApiError};

pub async fn create(
    State(pool): State<Pool>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let Some(sid) = body["student_id"].as_i64() else {
        return Err(ApiError::bad_request("student_id is required"));
    };

    let ids: Vec<i64> = body["entry_ids"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_i64).collect())
        .unwrap_or_default();
    if ids.len() < 2 || ids.len() > 6 {
        return Err(ApiError::bad_request("entry_ids must have 2 to 6 integers"));
    }
    if ids.iter().collect::<HashSet<_>>().len() != ids.len() {
        return Err(ApiError::bad_request("entry_ids must not contain duplicates"));
    }

    let report = body.get("report_json").cloned().unwrap_or(Value::Null);
    if !report.is_object() {
        return Err(ApiError::bad_request("report_json must be a JSON object"));
    }

    let data = blocking(&pool, move |conn| {
        let student_exists: bool = conn
            .query_row("SELECT 1 FROM students WHERE id = ?", [sid], |_| Ok(true))
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(false),
                other => Err(other),
            })?;
        if !student_exists {
            return Err(ApiError::not_found("Student not found"));
        }

        // Ownership check without a dynamic IN clause: fetch the student's
        // entry ids and verify membership in memory.
        let mut stmt = conn.prepare("SELECT id FROM entries WHERE student_id = ?")?;
        let owned: HashSet<i64> = stmt
            .query_map([sid], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        if !ids.iter().all(|id| owned.contains(id)) {
            return Err(ApiError::bad_request("One or more entries do not belong to this student"));
        }

        let rows = query_json_dyn(
            conn,
            "INSERT INTO comparison_reports (student_id, entry_ids, report_json)
             VALUES (?, ?, ?)
             RETURNING id, student_id, entry_ids, report_json, generated_at",
            &[
                Sv::Integer(sid),
                Sv::Text(serde_json::to_string(&ids).unwrap_or_else(|_| "[]".into())),
                Sv::Text(report.to_string()),
            ],
        )?;

        let mut row = rows.into_iter().next().unwrap_or(Value::Null);
        for key in ["entry_ids", "report_json"] {
            if let Some(s) = row[key].as_str() {
                if let Ok(parsed) = serde_json::from_str::<Value>(s) {
                    row[key] = parsed;
                }
            }
        }
        Ok(row)
    })
    .await?;
    Ok(ok_with_status(StatusCode::CREATED, data))
}
