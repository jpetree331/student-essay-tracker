//! Demo mode (desktop only): a toggle that swaps the API between the real
//! database and a self-contained sample dataset so new teachers can explore
//! the app. The demo database is wiped and reseeded every time demo mode is
//! turned on, so it always starts pristine.

use std::sync::atomic::Ordering;

use axum::extract::State;
use axum::response::Response;
use serde_json::{json, Value};

use crate::db::blocking;
use crate::error::{ok_json, ApiError};
use crate::server::AppState;

const DEMO_SEED: &str = include_str!("../../demo-seed.sql");

pub async fn get_mode(State(state): State<AppState>) -> Result<Response, ApiError> {
    Ok(ok_json(json!({ "enabled": state.demo_on.load(Ordering::Relaxed) })))
}

pub async fn set_mode(
    State(state): State<AppState>,
    axum::Json(body): axum::Json<Value>,
) -> Result<Response, ApiError> {
    let Some(enabled) = body["enabled"].as_bool() else {
        return Err(ApiError::bad_request("enabled must be true or false"));
    };

    if enabled {
        blocking(&state.demo, |conn| {
            conn.execute_batch(
                "DELETE FROM comparison_reports;
                 DELETE FROM writing_tags;
                 DELETE FROM source_links;
                 DELETE FROM entries;
                 DELETE FROM assignments;
                 DELETE FROM students;",
            )?;
            conn.execute_batch(DEMO_SEED)?;
            Ok(())
        })
        .await?;
    }

    state.demo_on.store(enabled, Ordering::Relaxed);
    Ok(ok_json(json!({ "enabled": enabled })))
}
