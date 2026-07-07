//! Port of routes/compareProgress.js — AI growth comparison across 2-6
//! chronologically-ordered entries for one student.

use axum::extract::{FromRef, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde_json::{json, Value};

use crate::ai;
use crate::ai::json::parse_model_json;
use crate::db::{blocking, Pool};
use crate::error::{ok_json, ApiError};
use crate::server::AppState;
use crate::settings;

const SYSTEM_PROMPT: &str = include_str!("../../../../prompts/compare-progress.system.txt");

fn tag_yes_no(tags: &Value, key: &str) -> &'static str {
    if tags[key] == Value::Bool(true) { "yes" } else { "no" }
}

fn build_user_message(student_name: &str, iep_flags: &Value, entries: &[Value]) -> String {
    let iep = iep_flags
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("None provided");
    let n = entries.len();

    let blocks: Vec<String> = entries
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let t = &e["tags"];
            format!(
                "--- Entry {num}: {name} ({date}) ---\nWord count: {wc}\nTags: Claim: {claim}, Evidence: {ev}, Explanation: {ex}, Source Named: {sn}, Incomplete: {inc}, AI Flag: {ai}\n\nWriting sample:\n{sample}\n",
                num = i + 1,
                name = e["assignment_name"].as_str().unwrap_or(""),
                date = e["date"].as_str().unwrap_or(""),
                wc = e["word_count"].as_i64().unwrap_or(0),
                claim = tag_yes_no(t, "claim_present"),
                ev = tag_yes_no(t, "evidence_cited"),
                ex = tag_yes_no(t, "explanation_present"),
                sn = tag_yes_no(t, "source_named"),
                inc = tag_yes_no(t, "response_incomplete"),
                ai = tag_yes_no(t, "ai_flag"),
                sample = e["writing_sample"].as_str().unwrap_or(""),
            )
        })
        .collect();

    format!(
        "Student: {student_name}\nIEP notes: {iep}\n\nI am sharing {n} writing samples from this student in chronological order. Please analyze their growth as a writer.\n\n{}\n\nAnalyze the growth across all {n} entries and return the JSON object.",
        blocks.join("\n")
    )
}

fn normalize_comparison(mut raw: Value) -> Result<Value, String> {
    if !raw.is_object() {
        return Err("Invalid comparison object".to_string());
    }
    let obj = raw.as_object_mut().unwrap();
    for key in ["overall_growth_summary", "what_stayed_strong", "conference_script"] {
        let v = obj.get(key).cloned().unwrap_or(Value::Null);
        if !v.is_string() {
            let s = match v {
                Value::Null => String::new(),
                other => other.to_string(),
            };
            obj.insert(key.to_string(), Value::String(s));
        }
    }
    for key in ["growth_moments", "persistent_gaps", "entry_by_entry"] {
        if !obj.get(key).map(Value::is_array).unwrap_or(false) {
            obj.insert(key.to_string(), json!([]));
        }
    }
    if !obj.get("next_instructional_step").map(Value::is_object).unwrap_or(false) {
        obj.insert(
            "next_instructional_step".to_string(),
            json!({ "move": "", "rationale": "", "try_this": "", "iep_connection": null }),
        );
    }
    Ok(raw)
}

pub async fn compare(
    State(state): State<AppState>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let Some(student_id) = body["student_id"].as_i64() else {
        return Err(ApiError::bad_request("student_id is required"));
    };
    let student_name = body["student_name"].as_str().unwrap_or("").trim().to_string();
    if student_name.is_empty() {
        return Err(ApiError::bad_request("student_name is required"));
    }
    let entries = body["entries"].as_array().cloned().unwrap_or_default();
    if entries.len() < 2 {
        return Err(ApiError::bad_request("At least 2 entries are required"));
    }
    if entries.len() > 6 {
        return Err(ApiError::bad_request("Maximum 6 entries per comparison"));
    }

    let mut entry_ids: Vec<i64> = Vec::with_capacity(entries.len());
    for (i, e) in entries.iter().enumerate() {
        if !e.is_object() {
            return Err(ApiError::bad_request(format!("Invalid entry at index {i}")));
        }
        let Some(eid) = e["entry_id"].as_i64() else {
            return Err(ApiError::bad_request(format!("Invalid entry_id at index {i}")));
        };
        if e["writing_sample"].as_str().map(str::trim).unwrap_or("").is_empty() {
            return Err(ApiError::bad_request(format!("Entry {eid} is missing writing_sample")));
        }
        entry_ids.push(eid);
    }
    {
        let unique: std::collections::HashSet<i64> = entry_ids.iter().copied().collect();
        if unique.len() != entry_ids.len() {
            return Err(ApiError::bad_request("Duplicate entry_id in request"));
        }
    }

    // Ownership + chronological-order verification against the active DB.
    let pool: Pool = Pool::from_ref(&state);
    let ids_for_check = entry_ids.clone();
    let generated_at = blocking(&pool, move |conn| {
        let mut stmt = conn.prepare("SELECT id, date_submitted FROM entries WHERE student_id = ?")?;
        let owned: std::collections::HashMap<i64, String> = stmt
            .query_map([student_id], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))?
            .collect::<Result<_, _>>()?;

        if !ids_for_check.iter().all(|id| owned.contains_key(id)) {
            return Err(ApiError::bad_request("One or more entries do not belong to this student"));
        }

        let mut prev: Option<(String, i64)> = None;
        for id in &ids_for_check {
            let key: String = owned[id].chars().take(10).collect();
            if let Some((prev_key, prev_id)) = &prev {
                if key < *prev_key || (key == *prev_key && *id <= *prev_id) {
                    return Err(ApiError::bad_request(
                        "entries must be in chronological order (oldest first)",
                    ));
                }
            }
            prev = Some((key, *id));
        }

        let now: String =
            conn.query_row("SELECT STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |r| r.get(0))?;
        Ok(now)
    })
    .await?;

    let user_message = build_user_message(&student_name, &body["iep_flags"], &entries);

    let config = settings::load(&state.settings_path);
    let result =
        ai::complete(&state.http, &config, SYSTEM_PROMPT, &user_message, ai::Kind::Compare).await?;

    let comparison = parse_model_json(&result.text)
        .map_err(|e| {
            eprintln!(
                "[compare-progress] JSON parse failed. Raw model text (truncated): {}",
                &result.text.chars().take(4000).collect::<String>()
            );
            ApiError::new(StatusCode::BAD_GATEWAY, format!("Could not parse comparison response: {e}"))
        })
        .and_then(|raw| {
            normalize_comparison(raw).map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, e))
        })?;

    Ok(ok_json(json!({
        "comparison": comparison,
        "student_id": student_id,
        "entry_ids_compared": entry_ids,
        "generated_at": generated_at,
        "model_used": result.model,
        "provider_used": result.provider,
    })))
}
