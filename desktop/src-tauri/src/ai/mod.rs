//! AI provider layer — Rust counterpart of lib/ai/ in the Node backend.
//! Same selection rules (explicit override, else whichever key is present),
//! same models, same error-status mapping; calls the Anthropic/OpenAI REST
//! APIs directly via reqwest. Prompts are the shared prompts/*.system.txt
//! files, embedded at compile time so they can never drift from the web app.

pub mod json;

use axum::http::StatusCode;
use serde_json::{json, Value};

use crate::error::ApiError;
use crate::settings::Settings;

#[derive(Clone, Copy)]
pub enum Kind {
    Tag,
    Compare,
}

pub struct AiResult {
    pub text: String,
    pub model: String,
    pub provider: &'static str,
}

enum Provider {
    Anthropic,
    OpenAi,
}

fn unavailable(message: &str) -> ApiError {
    ApiError::new(StatusCode::SERVICE_UNAVAILABLE, message)
}

fn resolve(settings: &Settings) -> Result<Provider, ApiError> {
    let has_anthropic = !settings.anthropic_api_key.trim().is_empty();
    let has_openai = !settings.openai_api_key.trim().is_empty();
    match settings.ai_provider.as_str() {
        "anthropic" => {
            if has_anthropic {
                Ok(Provider::Anthropic)
            } else {
                Err(unavailable("Provider is set to Anthropic but no Anthropic API key is saved — add one in Settings"))
            }
        }
        "openai" => {
            if has_openai {
                Ok(Provider::OpenAi)
            } else {
                Err(unavailable("Provider is set to OpenAI but no OpenAI API key is saved — add one in Settings"))
            }
        }
        _ => {
            if has_anthropic {
                Ok(Provider::Anthropic)
            } else if has_openai {
                Ok(Provider::OpenAi)
            } else {
                Err(unavailable("No AI provider configured — add an Anthropic or OpenAI API key in Settings"))
            }
        }
    }
}

/// Mirror the Node routes' status mapping: 503/401/429 and other 4xx/5xx pass
/// through, anything else becomes 502.
fn map_status(status: reqwest::StatusCode, message: String) -> ApiError {
    let code = status.as_u16();
    let mapped = if (400..600).contains(&code) { code } else { 502 };
    ApiError::new(
        StatusCode::from_u16(mapped).unwrap_or(StatusCode::BAD_GATEWAY),
        message,
    )
}

fn api_error_message(body: &Value, fallback: &str) -> String {
    body["error"]["message"]
        .as_str()
        .map(str::to_string)
        .unwrap_or_else(|| fallback.to_string())
}

async fn call_anthropic(
    http: &reqwest::Client,
    api_key: &str,
    system: &str,
    user: &str,
    kind: Kind,
) -> Result<AiResult, ApiError> {
    let (model, max_tokens) = match kind {
        Kind::Tag => ("claude-haiku-4-5-20251001", 2048),
        Kind::Compare => ("claude-sonnet-4-6", 8192),
    };
    let resp = http
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{ "role": "user", "content": user }],
        }))
        .send()
        .await
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, format!("Anthropic request failed: {e}")))?;

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, format!("Anthropic response unreadable: {e}")))?;
    if !status.is_success() {
        return Err(map_status(status, api_error_message(&body, "Anthropic API error")));
    }

    let text = body["content"]
        .as_array()
        .map(|blocks| {
            blocks
                .iter()
                .filter(|b| b["type"] == "text")
                .filter_map(|b| b["text"].as_str())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
        .trim()
        .to_string();

    Ok(AiResult { text, model: model.to_string(), provider: "anthropic" })
}

async fn call_openai(
    http: &reqwest::Client,
    api_key: &str,
    system: &str,
    user: &str,
    kind: Kind,
) -> Result<AiResult, ApiError> {
    // Higher caps than Anthropic's because gpt-5-family reasoning models
    // spend part of max_completion_tokens on internal reasoning.
    let (model, max_tokens) = match kind {
        Kind::Tag => ("gpt-5-mini", 8192),
        Kind::Compare => ("gpt-5", 16384),
    };
    let resp = http
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&json!({
            "model": model,
            "max_completion_tokens": max_tokens,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": user },
            ],
        }))
        .send()
        .await
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, format!("OpenAI request failed: {e}")))?;

    let status = resp.status();
    let body: Value = resp
        .json()
        .await
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, format!("OpenAI response unreadable: {e}")))?;
    if !status.is_success() {
        return Err(map_status(status, api_error_message(&body, "OpenAI API error")));
    }

    let text = body["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    Ok(AiResult { text, model: model.to_string(), provider: "openai" })
}

pub async fn complete(
    http: &reqwest::Client,
    settings: &Settings,
    system: &str,
    user: &str,
    kind: Kind,
) -> Result<AiResult, ApiError> {
    match resolve(settings)? {
        Provider::Anthropic => {
            call_anthropic(http, settings.anthropic_api_key.trim(), system, user, kind).await
        }
        Provider::OpenAi => {
            call_openai(http, settings.openai_api_key.trim(), system, user, kind).await
        }
    }
}
