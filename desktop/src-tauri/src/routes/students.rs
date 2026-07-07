//! Port of routes/students.js. The Postgres LATERAL "last submission per
//! student" join is replaced by one ordered query reduced in memory.

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::Response;
use rusqlite::types::Value as Sv;
use rusqlite::Connection;
use serde_json::{json, Value};

use crate::db::{
    blocking, parse_boolean_value, query_json, query_json_dyn, to_sql_value, Pool, UpdateBuilder,
};
use crate::error::{ok_json, ok_with_status, ApiError};
use crate::routes::parse_id;

const STUDENT_COLS: &str =
    "id, first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary, created_at";

fn tag_bool(e: &Value, key: &str) -> bool {
    e.get(key).and_then(Value::as_bool).unwrap_or(false)
}

fn last_submission_json(e: &Value, entry_id_key: &str, date_key: &str, name_key: &str) -> Value {
    json!({
        "entry_id": e[entry_id_key],
        "date_submitted": e[date_key],
        "assignment_name": e[name_key].as_str().unwrap_or(""),
        "tags": {
            "claim_present": tag_bool(e, "claim_present"),
            "evidence_cited": tag_bool(e, "evidence_cited"),
            "explanation_present": tag_bool(e, "explanation_present"),
            "source_named": tag_bool(e, "source_named"),
            "response_incomplete": tag_bool(e, "response_incomplete"),
            "ai_flag": tag_bool(e, "ai_flag"),
        }
    })
}

/// Entries for one student with assignment fields, tags, and source links —
/// shared by GET /:id, GET /:id/entries, and the analytics student view.
pub(crate) fn fetch_student_entries(conn: &Connection, student_id: i64) -> Result<Vec<Value>, ApiError> {
    let mut entries = query_json(
        conn,
        "SELECT e.id, e.student_id, e.assignment_id, e.date_submitted, e.writing_sample,
                e.student_feedback, e.teacher_notes, e.word_count, e.flagged_for_followup, e.created_at,
                a.name AS assignment_name, a.unit AS assignment_unit, a.aks_standard AS assignment_aks_standard,
                a.date_assigned AS assignment_date_assigned,
                a.source_documents AS assignment_source_documents,
                wt.claim_present, wt.evidence_cited, wt.explanation_present, wt.source_named,
                wt.response_incomplete, wt.ai_flag, wt.notes AS tag_notes
         FROM entries e
         JOIN assignments a ON a.id = e.assignment_id
         LEFT JOIN writing_tags wt ON wt.entry_id = e.id
         WHERE e.student_id = ?
         ORDER BY e.date_submitted ASC, e.id ASC",
        &[&student_id],
    )?;

    let links = query_json(
        conn,
        "SELECT id, entry_id, label, url FROM source_links
         WHERE entry_id IN (SELECT id FROM entries WHERE student_id = ?)
         ORDER BY entry_id, id",
        &[&student_id],
    )?;
    let mut links_by_entry: HashMap<i64, Vec<Value>> = HashMap::new();
    for l in links {
        let eid = l["entry_id"].as_i64().unwrap_or(0);
        links_by_entry.entry(eid).or_default().push(json!({
            "id": l["id"], "label": l["label"], "url": l["url"],
        }));
    }

    for e in entries.iter_mut() {
        let eid = e["id"].as_i64().unwrap_or(0);
        e["source_links"] = Value::Array(links_by_entry.remove(&eid).unwrap_or_default());
    }
    Ok(entries)
}

fn student_exists(conn: &Connection, id: i64) -> Result<bool, ApiError> {
    let found: Option<i64> = conn
        .query_row("SELECT 1 FROM students WHERE id = ?", [id], |r| r.get(0))
        .map(Some)
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;
    Ok(found.is_some())
}

pub async fn list(State(pool): State<Pool>) -> Result<Response, ApiError> {
    let data = blocking(&pool, |conn| {
        let mut students = query_json(
            conn,
            &format!("SELECT {STUDENT_COLS} FROM students ORDER BY period, last_name, first_name"),
            &[],
        )?;

        // Ordered newest-first per student; the first row seen per student is
        // their latest submission (replaces the Postgres LATERAL join).
        let rows = query_json(
            conn,
            "SELECT e.student_id, e.id AS entry_id, e.date_submitted, a.name AS assignment_name,
                    wt.claim_present, wt.evidence_cited, wt.explanation_present, wt.source_named,
                    wt.response_incomplete, wt.ai_flag
             FROM entries e
             JOIN assignments a ON a.id = e.assignment_id
             LEFT JOIN writing_tags wt ON wt.entry_id = e.id
             ORDER BY e.student_id, e.date_submitted DESC, e.id DESC",
            &[],
        )?;
        let mut last: HashMap<i64, Value> = HashMap::new();
        for r in rows {
            let sid = r["student_id"].as_i64().unwrap_or(0);
            last.entry(sid).or_insert(r);
        }

        for s in students.iter_mut() {
            let sid = s["id"].as_i64().unwrap_or(0);
            s["last_submission"] = last
                .get(&sid)
                .map(|e| last_submission_json(e, "entry_id", "date_submitted", "assignment_name"))
                .unwrap_or(Value::Null);
        }
        Ok(Value::Array(students))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn entries(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "student")?;
    let data = blocking(&pool, move |conn| {
        if !student_exists(conn, id)? {
            return Err(ApiError::not_found("Student not found"));
        }
        Ok(Value::Array(fetch_student_entries(conn, id)?))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn comparisons(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "student")?;
    let data = blocking(&pool, move |conn| {
        if !student_exists(conn, id)? {
            return Err(ApiError::not_found("Student not found"));
        }
        let mut rows = query_json(
            conn,
            "SELECT id, student_id, entry_ids, report_json, generated_at
             FROM comparison_reports WHERE student_id = ? ORDER BY generated_at DESC",
            &[&id],
        )?;
        // entry_ids / report_json are stored as JSON text; expose real JSON.
        for r in rows.iter_mut() {
            for key in ["entry_ids", "report_json"] {
                if let Some(s) = r[key].as_str() {
                    if let Ok(parsed) = serde_json::from_str::<Value>(s) {
                        r[key] = parsed;
                    }
                }
            }
        }
        Ok(Value::Array(rows))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn get_one(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "student")?;
    let data = blocking(&pool, move |conn| {
        let students = query_json(
            conn,
            &format!("SELECT {STUDENT_COLS} FROM students WHERE id = ?"),
            &[&id],
        )?;
        let Some(student) = students.into_iter().next() else {
            return Err(ApiError::not_found("Student not found"));
        };

        let entries = fetch_student_entries(conn, id)?;
        let last_submission = entries
            .last()
            .map(|e| last_submission_json(e, "id", "date_submitted", "assignment_name"))
            .unwrap_or(Value::Null);

        let mut out = student;
        out["entries"] = Value::Array(entries);
        out["last_submission"] = last_submission;
        Ok(out)
    })
    .await?;
    Ok(ok_json(data))
}

fn clip_goal_summary(v: &Value) -> Sv {
    let t = if v.is_null() { String::new() } else { v.as_str().map(str::to_string).unwrap_or_else(|| v.to_string()) };
    let t = t.trim().to_string();
    let clipped: String = t.chars().take(500).collect();
    if clipped.is_empty() { Sv::Null } else { Sv::Text(clipped) }
}

pub async fn create(
    State(pool): State<Pool>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let first_name = body["first_name"].as_str().unwrap_or("").to_string();
    let last_name = body["last_name"].as_str().unwrap_or("").to_string();
    let period = &body["period"];
    if first_name.is_empty() || last_name.is_empty() || period.is_null() {
        return Err(ApiError::bad_request("first_name, last_name, and period are required"));
    }
    let Some(p) = period.as_i64().or_else(|| period.as_str().and_then(|s| s.parse().ok())) else {
        return Err(ApiError::bad_request("period must be an integer"));
    };

    let wg = body.get("writing_goal").map(parse_boolean_value).unwrap_or(false);
    let wgs = body.get("writing_goal_summary").map(clip_goal_summary).unwrap_or(Sv::Null);
    let iep_flags = to_sql_value(body.get("iep_flags").unwrap_or(&Value::Null));
    let iep_goals = to_sql_value(body.get("iep_goals").unwrap_or(&Value::Null));

    let data = blocking(&pool, move |conn| {
        let rows = query_json_dyn(
            conn,
            &format!(
                "INSERT INTO students (first_name, last_name, period, iep_flags, iep_goals, writing_goal, writing_goal_summary)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 RETURNING {STUDENT_COLS}"
            ),
            &[
                Sv::Text(first_name),
                Sv::Text(last_name),
                Sv::Integer(p),
                iep_flags,
                iep_goals,
                Sv::Integer(wg as i64),
                wgs,
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
    let id = parse_id(&id, "student")?;

    let mut u = UpdateBuilder::new();
    for key in ["first_name", "last_name", "iep_flags", "iep_goals"] {
        if let Some(v) = body.get(key) {
            u.set(key, to_sql_value(v));
        }
    }
    if let Some(v) = body.get("period") {
        let Some(p) = v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())) else {
            return Err(ApiError::bad_request("period must be an integer"));
        };
        u.set("period", Sv::Integer(p));
    }
    if let Some(v) = body.get("writing_goal") {
        u.set("writing_goal", Sv::Integer(parse_boolean_value(v) as i64));
    }
    if let Some(v) = body.get("writing_goal_summary") {
        u.set("writing_goal_summary", clip_goal_summary(v));
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
                "UPDATE students SET {} WHERE id = ? RETURNING {STUDENT_COLS}",
                u.fields.join(", ")
            ),
            &params,
        )?;
        rows.into_iter().next().ok_or_else(|| ApiError::not_found("Student not found"))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn destroy(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "student")?;
    let data = blocking(&pool, move |conn| {
        let n = conn.execute("DELETE FROM students WHERE id = ?", [id])?;
        if n == 0 {
            return Err(ApiError::not_found("Student not found"));
        }
        Ok(json!({ "deleted": true, "id": id }))
    })
    .await?;
    Ok(ok_json(data))
}
