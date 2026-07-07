//! Response envelope + error type matching the Express backend exactly:
//! every response is `{ success, data, error }` (see middleware/responses.js
//! and middleware/errorHandler.js in the Node backend).

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Value};

pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self { status, message: message.into() }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({ "success": false, "data": Value::Null, "error": self.message })),
        )
            .into_response()
    }
}

// Mirrors errorHandler.js: FK violations -> 400, unique violations -> 409.
impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        if let rusqlite::Error::SqliteFailure(f, msg) = &e {
            if f.code == rusqlite::ffi::ErrorCode::ConstraintViolation {
                let detail = msg.clone().unwrap_or_default();
                if detail.contains("UNIQUE") {
                    return ApiError::new(
                        StatusCode::CONFLICT,
                        "A record for this key already exists.",
                    );
                }
                return ApiError::bad_request(
                    "Invalid reference: a related record does not exist.",
                );
            }
        }
        ApiError::internal(e.to_string())
    }
}

impl From<r2d2::Error> for ApiError {
    fn from(e: r2d2::Error) -> Self {
        ApiError::internal(format!("database pool error: {e}"))
    }
}

pub fn ok_json(data: Value) -> Response {
    ok_with_status(StatusCode::OK, data)
}

pub fn ok_with_status(status: StatusCode, data: Value) -> Response {
    (status, Json(json!({ "success": true, "data": data, "error": Value::Null }))).into_response()
}
