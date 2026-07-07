//! Port of routes/sourceLinks.js.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Response;
use rusqlite::types::Value as Sv;
use serde_json::{json, Value};

use crate::db::{blocking, query_json_dyn, Pool};
use crate::error::{ok_json, ok_with_status, ApiError};
use crate::routes::parse_id;

pub async fn create(
    State(pool): State<Pool>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let eid = body["entry_id"].as_i64();
    let label = body["label"].as_str().unwrap_or("").to_string();
    let url = body["url"].as_str().unwrap_or("").to_string();
    let (Some(eid), false, false) = (eid, label.is_empty(), url.is_empty()) else {
        return Err(ApiError::bad_request("entry_id, label, and url are required"));
    };

    let data = blocking(&pool, move |conn| {
        let exists: bool = conn
            .query_row("SELECT 1 FROM entries WHERE id = ?", [eid], |_| Ok(true))
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(false),
                other => Err(other),
            })?;
        if !exists {
            return Err(ApiError::not_found("Entry not found"));
        }

        let rows = query_json_dyn(
            conn,
            "INSERT INTO source_links (entry_id, label, url) VALUES (?, ?, ?)
             RETURNING id, entry_id, label, url, created_at",
            &[Sv::Integer(eid), Sv::Text(label), Sv::Text(url)],
        )?;
        Ok(rows.into_iter().next().unwrap_or(Value::Null))
    })
    .await?;
    Ok(ok_with_status(StatusCode::CREATED, data))
}

pub async fn destroy(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "source link")?;
    let data = blocking(&pool, move |conn| {
        let n = conn.execute("DELETE FROM source_links WHERE id = ?", [id])?;
        if n == 0 {
            return Err(ApiError::not_found("Source link not found"));
        }
        Ok(json!({ "deleted": true, "id": id }))
    })
    .await?;
    Ok(ok_json(data))
}
