//! Port of routes/analyzeWriting.js — auto-tag one writing sample.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Response;
use serde_json::{json, Map, Value};

use crate::ai;
use crate::ai::json::parse_model_json;
use crate::db::{blocking, query_json, Pool};
use crate::error::{ok_json, ApiError};
use crate::server::AppState;
use crate::settings;

const SYSTEM_PROMPT: &str = include_str!("../../../../prompts/analyze-writing.system.txt");

const TAG_KEYS: [&str; 6] = [
    "claim_present",
    "evidence_cited",
    "explanation_present",
    "source_named",
    "response_incomplete",
    "ai_flag",
];

const REASONING_KEYS: [&str; 6] = [
    "claim_reasoning",
    "evidence_reasoning",
    "explanation_reasoning",
    "source_named_reasoning",
    "response_incomplete_reasoning",
    "ai_flag_reasoning",
];

fn normalize_bool(v: &Value) -> Result<bool, String> {
    match v {
        Value::Bool(b) => Ok(*b),
        Value::String(s) if s == "true" => Ok(true),
        Value::String(s) if s == "false" => Ok(false),
        Value::Number(n) if n.as_i64() == Some(1) => Ok(true),
        Value::Number(n) if n.as_i64() == Some(0) => Ok(false),
        _ => Err("Invalid boolean in model output".to_string()),
    }
}

fn validate_and_shape_suggestions(raw: &Value) -> Result<Value, String> {
    if !raw.is_object() {
        return Err("Model returned invalid object".to_string());
    }
    let mut out = Map::new();
    for key in TAG_KEYS {
        let v = raw.get(key).ok_or_else(|| format!("Missing key: {key}"))?;
        out.insert(key.to_string(), Value::Bool(normalize_bool(v)?));
    }
    for key in REASONING_KEYS.iter().chain(std::iter::once(&"overall_note")) {
        let v = raw.get(*key).ok_or_else(|| format!("Missing key: {key}"))?;
        let s = match v {
            Value::Null => String::new(),
            Value::String(s) => s.trim().to_string(),
            other => other.to_string(),
        };
        if s.is_empty() {
            return Err(format!("Missing or invalid: {key}"));
        }
        out.insert(key.to_string(), Value::String(s));
    }
    Ok(Value::Object(out))
}

fn now_iso(pool: &Pool) -> String {
    pool.get()
        .ok()
        .and_then(|c| {
            c.query_row("SELECT STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |r| r.get(0)).ok()
        })
        .unwrap_or_default()
}

pub async fn analyze(
    State(state): State<AppState>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let sample = body["writing_sample"].as_str().unwrap_or("").trim().to_string();
    if sample.chars().count() < 50 {
        return Err(ApiError::bad_request("writing_sample must be at least 50 characters"));
    }
    let ctx = body["assignment_context"]
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Not provided");

    let user_message = format!(
        "Assignment context: {ctx}\n\nStudent writing sample:\n{sample}\n\nAnalyze this writing sample and return the JSON object."
    );

    let config = settings::load(&state.settings_path);
    let result = ai::complete(&state.http, &config, SYSTEM_PROMPT, &user_message, ai::Kind::Tag).await?;

    let suggestions = parse_model_json(&result.text)
        .and_then(|raw| validate_and_shape_suggestions(&raw))
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, format!("Auto-tag failed: {e}")))?;

    Ok(ok_json(json!({
        "suggestions": suggestions,
        "model_used": result.model,
        "provider_used": result.provider,
        "analyzed_at": now_iso(&state.real),
    })))
}

pub async fn untagged_entries(State(pool): State<Pool>) -> Result<Response, ApiError> {
    let data = blocking(&pool, |conn| {
        let rows = query_json(
            conn,
            "SELECT e.id AS entry_id,
                    e.writing_sample,
                    a.name AS assignment_name,
                    a.unit AS assignment_unit,
                    a.prompt_text AS assignment_prompt
             FROM entries e
             JOIN assignments a ON a.id = e.assignment_id
             LEFT JOIN writing_tags wt ON wt.entry_id = e.id
             WHERE wt.id IS NULL
               AND e.writing_sample IS NOT NULL
               AND LENGTH(TRIM(e.writing_sample)) >= 50
             ORDER BY e.id ASC",
            &[],
        )?;
        let entries: Vec<Value> = rows
            .into_iter()
            .map(|r| {
                let parts: Vec<&str> = [r["assignment_name"].as_str(), r["assignment_unit"].as_str()]
                    .into_iter()
                    .flatten()
                    .filter(|s| !s.is_empty())
                    .collect();
                let parts = parts.join(" — ");
                let prompt = r["assignment_prompt"].as_str().map(str::trim).unwrap_or("");
                let assignment_context = if !prompt.is_empty() {
                    format!("{parts}\n\nPrompt:\n{prompt}")
                } else if !parts.is_empty() {
                    parts
                } else {
                    "Not provided".to_string()
                };
                json!({
                    "entry_id": r["entry_id"],
                    "writing_sample": r["writing_sample"],
                    "assignment_context": assignment_context,
                })
            })
            .collect();
        Ok(json!({ "entries": entries, "count": entries.len() }))
    })
    .await?;
    Ok(ok_json(data))
}
