//! Port of routes/writingTags.js — upsert merging incoming fields over the
//! previous row, 201 on first insert / 200 on update.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Response;
use rusqlite::types::Value as Sv;
use serde_json::Value;

use crate::db::{blocking, parse_boolean_value, query_json, query_json_dyn, Pool};
use crate::error::{ok_with_status, ApiError};

const TAG_KEYS: [&str; 6] = [
    "claim_present",
    "evidence_cited",
    "explanation_present",
    "source_named",
    "response_incomplete",
    "ai_flag",
];

pub async fn upsert(
    State(pool): State<Pool>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let Some(eid) = body["entry_id"].as_i64() else {
        return Err(ApiError::bad_request("entry_id is required"));
    };

    let (data, status) = blocking(&pool, move |conn| {
        let exists: bool = conn
            .query_row("SELECT 1 FROM entries WHERE id = ?", [eid], |_| Ok(true))
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(false),
                other => Err(other),
            })?;
        if !exists {
            return Err(ApiError::not_found("Entry not found"));
        }

        let prev = query_json(
            conn,
            "SELECT claim_present, evidence_cited, explanation_present, source_named,
                    response_incomplete, ai_flag, notes
             FROM writing_tags WHERE entry_id = ?",
            &[&eid],
        )?
        .into_iter()
        .next();

        // Incoming field wins; otherwise previous value; otherwise false/null.
        let merge_bool = |key: &str| -> bool {
            match body.get(key) {
                Some(v) => parse_boolean_value(v),
                None => prev
                    .as_ref()
                    .and_then(|p| p[key].as_bool())
                    .unwrap_or(false),
            }
        };
        let notes: Sv = match body.get("notes") {
            Some(v) => crate::db::to_sql_value(v),
            None => prev
                .as_ref()
                .and_then(|p| p["notes"].as_str())
                .map(|s| Sv::Text(s.to_string()))
                .unwrap_or(Sv::Null),
        };

        let mut params: Vec<Sv> = vec![Sv::Integer(eid)];
        params.extend(TAG_KEYS.iter().map(|k| Sv::Integer(merge_bool(k) as i64)));
        params.push(notes);

        let rows = query_json_dyn(
            conn,
            "INSERT INTO writing_tags (
               entry_id, claim_present, evidence_cited, explanation_present, source_named,
               response_incomplete, ai_flag, notes
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (entry_id) DO UPDATE SET
               claim_present = excluded.claim_present,
               evidence_cited = excluded.evidence_cited,
               explanation_present = excluded.explanation_present,
               source_named = excluded.source_named,
               response_incomplete = excluded.response_incomplete,
               ai_flag = excluded.ai_flag,
               notes = excluded.notes
             RETURNING id, entry_id, claim_present, evidence_cited, explanation_present,
                       source_named, response_incomplete, ai_flag, notes, created_at",
            &params,
        )?;

        let status = if prev.is_some() { StatusCode::OK } else { StatusCode::CREATED };
        Ok((rows.into_iter().next().unwrap_or(Value::Null), status))
    })
    .await?;
    Ok(ok_with_status(status, data))
}
