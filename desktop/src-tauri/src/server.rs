//! axum router mirroring server.js — same paths, same envelope.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use axum::extract::FromRef;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Router;
use serde_json::json;
use tower_http::cors::CorsLayer;

use crate::db::Pool;
use crate::error::{ok_json, ApiError};
use crate::routes;

/// Real + demo database pools, the demo-mode switch, and shared AI plumbing.
/// Handlers that take `State<Pool>` transparently get whichever pool is
/// active via `FromRef`, so demo mode swaps the entire API's data source in
/// one place. Settings deliberately live outside the demo swap.
#[derive(Clone)]
pub struct AppState {
    pub real: Pool,
    pub demo: Pool,
    pub demo_on: Arc<AtomicBool>,
    pub settings_path: std::path::PathBuf,
    pub http: reqwest::Client,
}

impl FromRef<AppState> for Pool {
    fn from_ref(state: &AppState) -> Pool {
        if state.demo_on.load(Ordering::Relaxed) {
            state.demo.clone()
        } else {
            state.real.clone()
        }
    }
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(|| async { ok_json(json!({ "ok": true })) }))
        // students
        .route("/api/students", get(routes::students::list).post(routes::students::create))
        .route(
            "/api/students/:id",
            get(routes::students::get_one)
                .put(routes::students::update)
                .delete(routes::students::destroy),
        )
        .route("/api/students/:id/entries", get(routes::students::entries))
        .route("/api/students/:id/comparisons", get(routes::students::comparisons))
        // assignments
        .route(
            "/api/assignments",
            get(routes::assignments::list).post(routes::assignments::create),
        )
        .route(
            "/api/assignments/:id",
            get(routes::assignments::get_one).put(routes::assignments::update),
        )
        .route(
            "/api/assignments/:id/print-submissions",
            get(routes::assignments::print_submissions),
        )
        // entries
        .route("/api/entries", post(routes::entries::create))
        .route(
            "/api/entries/:id",
            get(routes::entries::get_one)
                .put(routes::entries::update)
                .delete(routes::entries::destroy),
        )
        // source links
        .route("/api/source-links", post(routes::source_links::create))
        .route("/api/source-links/:id", axum::routing::delete(routes::source_links::destroy))
        // writing tags
        .route("/api/writing-tags", post(routes::writing_tags::upsert))
        // comparisons
        .route("/api/comparisons", post(routes::comparisons::create))
        // analytics
        .route("/api/analytics/class-summary", get(routes::analytics::class_summary))
        .route("/api/analytics/student/:id", get(routes::analytics::student))
        // AI
        .route("/api/analyze-writing", post(routes::analyze_writing::analyze))
        .route(
            "/api/analyze-writing/untagged-entries",
            get(routes::analyze_writing::untagged_entries),
        )
        .route("/api/compare-progress", post(routes::compare_progress::compare))
        // desktop-only concepts (no Express equivalent)
        .route("/api/demo-mode", get(routes::demo::get_mode).put(routes::demo::set_mode))
        .route(
            "/api/settings",
            get(crate::settings::get_settings).put(crate::settings::put_settings),
        )
        .fallback(|| async { ApiError::not_found("Not found").into_response() })
        .layer(CorsLayer::permissive())
        .with_state(state)
}
