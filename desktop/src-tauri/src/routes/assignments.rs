//! Port of routes/assignments.js. The Postgres DISTINCT ON in
//! print-submissions is replaced by an ordered scan keeping the first row
//! per student.

use std::collections::HashSet;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Response;
use rusqlite::types::Value as Sv;
use serde_json::Value;

use crate::db::{blocking, query_json, query_json_dyn, to_sql_value, Pool, UpdateBuilder};
use crate::error::{ok_json, ok_with_status, ApiError};
use crate::routes::parse_id;

const ASSIGNMENT_COLS: &str =
    "id, name, unit, aks_standard, prompt_text, source_documents, date_assigned, created_at";

pub async fn list(State(pool): State<Pool>) -> Result<Response, ApiError> {
    let data = blocking(&pool, |conn| {
        let rows = query_json(
            conn,
            &format!("SELECT {ASSIGNMENT_COLS} FROM assignments ORDER BY date_assigned DESC, id"),
            &[],
        )?;
        Ok(Value::Array(rows))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn get_one(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "assignment")?;
    let data = blocking(&pool, move |conn| {
        let rows = query_json(
            conn,
            &format!("SELECT {ASSIGNMENT_COLS} FROM assignments WHERE id = ?"),
            &[&id],
        )?;
        rows.into_iter().next().ok_or_else(|| ApiError::not_found("Assignment not found"))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn print_submissions(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "assignment")?;
    let data = blocking(&pool, move |conn| {
        let assignments = query_json(
            conn,
            &format!("SELECT {ASSIGNMENT_COLS} FROM assignments WHERE id = ?"),
            &[&id],
        )?;
        let Some(assignment) = assignments.into_iter().next() else {
            return Err(ApiError::not_found("Assignment not found"));
        };

        // Latest entry per student for this assignment (ordered newest-first
        // per student; keep the first row seen per student).
        let rows = query_json(
            conn,
            "SELECT e.student_id, s.first_name, s.last_name, e.writing_sample, e.teacher_notes
             FROM entries e
             INNER JOIN students s ON s.id = e.student_id
             WHERE e.assignment_id = ?
             ORDER BY e.student_id, e.date_submitted DESC, e.id DESC",
            &[&id],
        )?;
        let mut seen = HashSet::new();
        let mut students: Vec<Value> = rows
            .into_iter()
            .filter(|r| seen.insert(r["student_id"].as_i64().unwrap_or(0)))
            .collect();

        students.sort_by(|a, b| {
            let key = |v: &Value, k: &str| {
                v[k].as_str().unwrap_or("").to_lowercase()
            };
            key(a, "last_name")
                .cmp(&key(b, "last_name"))
                .then_with(|| key(a, "first_name").cmp(&key(b, "first_name")))
        });

        Ok(serde_json::json!({ "assignment": assignment, "students": students }))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn create(
    State(pool): State<Pool>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let name = body["name"].as_str().unwrap_or("").to_string();
    let unit = body["unit"].as_str().unwrap_or("").to_string();
    let date_assigned = body["date_assigned"].as_str().unwrap_or("").to_string();
    if name.is_empty() || unit.is_empty() || date_assigned.is_empty() {
        return Err(ApiError::bad_request("name, unit, and date_assigned are required"));
    }

    let aks = to_sql_value(body.get("aks_standard").unwrap_or(&Value::Null));
    let prompt = to_sql_value(body.get("prompt_text").unwrap_or(&Value::Null));
    let sources = to_sql_value(body.get("source_documents").unwrap_or(&Value::Null));

    let data = blocking(&pool, move |conn| {
        let rows = query_json_dyn(
            conn,
            &format!(
                "INSERT INTO assignments (name, unit, aks_standard, prompt_text, source_documents, date_assigned)
                 VALUES (?, ?, ?, ?, ?, ?)
                 RETURNING {ASSIGNMENT_COLS}"
            ),
            &[Sv::Text(name), Sv::Text(unit), aks, prompt, sources, Sv::Text(date_assigned)],
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
    let id = parse_id(&id, "assignment")?;

    let mut u = UpdateBuilder::new();
    for key in ["name", "unit", "aks_standard", "prompt_text", "source_documents", "date_assigned"] {
        if let Some(v) = body.get(key) {
            u.set(key, to_sql_value(v));
        }
    }
    if u.is_empty() {
        return Err(ApiError::bad_request("No fields to update"));
    }

    let data = blocking(&pool, move |conn| {
        let mut params = u.values;
        params.push(Sv::Integer(id));
        let rows = query_json_dyn(
            conn,
            &format!(
                "UPDATE assignments SET {} WHERE id = ? RETURNING {ASSIGNMENT_COLS}",
                u.fields.join(", ")
            ),
            &params,
        )?;
        rows.into_iter().next().ok_or_else(|| ApiError::not_found("Assignment not found"))
    })
    .await?;
    Ok(ok_json(data))
}
