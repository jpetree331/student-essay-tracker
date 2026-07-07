//! Port of routes/entries.js. Word counts are always computed server-side.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Response;
use rusqlite::types::Value as Sv;
use serde_json::{json, Value};

use crate::db::{
    blocking, parse_boolean_value, query_json, query_json_dyn, to_sql_value, word_count, Pool,
    UpdateBuilder,
};
use crate::error::{ok_json, ok_with_status, ApiError};
use crate::routes::parse_id;

const ENTRY_RETURNING: &str =
    "id, student_id, assignment_id, date_submitted, writing_sample, student_feedback,
     teacher_notes, word_count, flagged_for_followup, created_at";

pub async fn get_one(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "entry")?;
    let data = blocking(&pool, move |conn| {
        let entries = query_json(
            conn,
            "SELECT e.id, e.student_id, e.assignment_id, e.date_submitted, e.writing_sample,
                    e.student_feedback, e.teacher_notes, e.word_count, e.flagged_for_followup, e.created_at,
                    a.name AS assignment_name, a.unit AS assignment_unit, a.aks_standard, a.prompt_text,
                    a.source_documents AS assignment_source_documents, a.date_assigned
             FROM entries e
             JOIN assignments a ON a.id = e.assignment_id
             WHERE e.id = ?",
            &[&id],
        )?;
        let Some(mut entry) = entries.into_iter().next() else {
            return Err(ApiError::not_found("Entry not found"));
        };

        let links = query_json(
            conn,
            "SELECT id, entry_id, label, url, created_at FROM source_links WHERE entry_id = ? ORDER BY id",
            &[&id],
        )?;
        let tags = query_json(conn, "SELECT * FROM writing_tags WHERE entry_id = ?", &[&id])?;

        entry["source_links"] = Value::Array(links);
        entry["writing_tags"] = tags.into_iter().next().unwrap_or(Value::Null);
        Ok(entry)
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn create(
    State(pool): State<Pool>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let sid = body["student_id"].as_i64();
    let aid = body["assignment_id"].as_i64();
    let date_submitted = body["date_submitted"].as_str().map(str::to_string);
    let (Some(sid), Some(aid), Some(date_submitted)) = (sid, aid, date_submitted) else {
        return Err(ApiError::bad_request(
            "student_id, assignment_id, and date_submitted are required",
        ));
    };
    if date_submitted.is_empty() {
        return Err(ApiError::bad_request(
            "student_id, assignment_id, and date_submitted are required",
        ));
    }

    let sample = body.get("writing_sample").cloned().unwrap_or(Value::Null);
    let wc = word_count(sample.as_str().unwrap_or(""));
    let flagged = body.get("flagged_for_followup").map(parse_boolean_value).unwrap_or(false);
    let feedback = to_sql_value(body.get("student_feedback").unwrap_or(&Value::Null));
    let notes = to_sql_value(body.get("teacher_notes").unwrap_or(&Value::Null));

    let data = blocking(&pool, move |conn| {
        let rows = query_json_dyn(
            conn,
            &format!(
                "INSERT INTO entries (
                   student_id, assignment_id, date_submitted, writing_sample, student_feedback,
                   teacher_notes, word_count, flagged_for_followup
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 RETURNING {ENTRY_RETURNING}"
            ),
            &[
                Sv::Integer(sid),
                Sv::Integer(aid),
                Sv::Text(date_submitted),
                to_sql_value(&sample),
                feedback,
                notes,
                Sv::Integer(wc),
                Sv::Integer(flagged as i64),
            ],
        )?;
        Ok(rows.into_iter().next().unwrap_or(Value::Null))
    })
    .await?;
    Ok(ok_with_status(StatusCode::CREATED, data))
}

pub async fn update(
    State(pool): State<Pool>,
    Path(id): Path<String>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "entry")?;

    let mut u = UpdateBuilder::new();
    if let Some(v) = body.get("assignment_id") {
        let Some(aid) = v.as_i64() else {
            return Err(ApiError::bad_request("assignment_id must be an integer"));
        };
        u.set("assignment_id", Sv::Integer(aid));
    }
    for key in ["date_submitted", "writing_sample", "student_feedback", "teacher_notes"] {
        if let Some(v) = body.get(key) {
            u.set(key, to_sql_value(v));
        }
    }
    if let Some(v) = body.get("flagged_for_followup") {
        u.set("flagged_for_followup", Sv::Integer(parse_boolean_value(v) as i64));
    }
    if u.is_empty() {
        return Err(ApiError::bad_request("No fields to update"));
    }

    let sample_update = body.get("writing_sample").cloned();

    let data = blocking(&pool, move |conn| {
        let existing: Option<Option<String>> = conn
            .query_row("SELECT writing_sample FROM entries WHERE id = ?", [id], |r| r.get(0))
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })?;
        let Some(existing_sample) = existing else {
            return Err(ApiError::not_found("Entry not found"));
        };

        // Recompute word count from whichever sample will be current.
        let next_sample = match &sample_update {
            Some(v) => v.as_str().unwrap_or("").to_string(),
            None => existing_sample.unwrap_or_default(),
        };
        let mut u = u;
        u.set("word_count", Sv::Integer(word_count(&next_sample)));

        let mut params = u.values;
        params.push(Sv::Integer(id));
        let rows = query_json_dyn(
            conn,
            &format!(
                "UPDATE entries SET {} WHERE id = ? RETURNING {ENTRY_RETURNING}",
                u.fields.join(", ")
            ),
            &params,
        )?;
        rows.into_iter().next().ok_or_else(|| ApiError::not_found("Entry not found"))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn destroy(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "entry")?;
    let data = blocking(&pool, move |conn| {
        let n = conn.execute("DELETE FROM entries WHERE id = ?", [id])?;
        if n == 0 {
            return Err(ApiError::not_found("Entry not found"));
        }
        Ok(json!({ "deleted": true, "id": id }))
    })
    .await?;
    Ok(ok_json(data))
}
