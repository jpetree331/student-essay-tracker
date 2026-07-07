//! Per-user desktop settings: AI provider choice and API keys, stored as a
//! plain JSON file in the app-data dir (masked in the UI, never sent back to
//! the frontend). Settings live outside the demo-mode DB swap on purpose.

use std::path::{Path, PathBuf};

use axum::extract::State;
use axum::response::Response;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{ok_json, ApiError};
use crate::server::AppState;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Settings {
    /// "" = auto (anthropic if its key is set, else openai), or an explicit
    /// "anthropic" / "openai" override — mirrors the web AI_PROVIDER env var.
    #[serde(default)]
    pub ai_provider: String,
    #[serde(default)]
    pub anthropic_api_key: String,
    #[serde(default)]
    pub openai_api_key: String,
}

pub fn load(path: &Path) -> Settings {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(path: &PathBuf, settings: &Settings) -> Result<(), ApiError> {
    let text = serde_json::to_string_pretty(settings)
        .map_err(|e| ApiError::internal(e.to_string()))?;
    std::fs::write(path, text)
        .map_err(|e| ApiError::internal(format!("failed to save settings: {e}")))
}

/// What the frontend sees — key presence only, never the keys themselves.
fn public_view(s: &Settings) -> Value {
    json!({
        "ai_provider": s.ai_provider,
        "has_anthropic_key": !s.anthropic_api_key.trim().is_empty(),
        "has_openai_key": !s.openai_api_key.trim().is_empty(),
    })
}

pub async fn get_settings(State(state): State<AppState>) -> Result<Response, ApiError> {
    Ok(ok_json(public_view(&load(&state.settings_path))))
}

pub async fn put_settings(
    State(state): State<AppState>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let mut settings = load(&state.settings_path);

    if let Some(v) = body.get("ai_provider") {
        let p = v.as_str().unwrap_or("").trim().to_lowercase();
        if !p.is_empty() && p != "anthropic" && p != "openai" {
            return Err(ApiError::bad_request(
                "ai_provider must be \"anthropic\", \"openai\", or empty for auto",
            ));
        }
        settings.ai_provider = p;
    }
    // A present key field always overwrites; an empty string clears the key.
    if let Some(v) = body.get("anthropic_api_key") {
        settings.anthropic_api_key = v.as_str().unwrap_or("").trim().to_string();
    }
    if let Some(v) = body.get("openai_api_key") {
        settings.openai_api_key = v.as_str().unwrap_or("").trim().to_string();
    }

    save(&state.settings_path, &settings)?;
    Ok(ok_json(public_view(&settings)))
}
