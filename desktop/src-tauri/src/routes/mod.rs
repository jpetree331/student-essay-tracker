pub mod analytics;
pub mod analyze_writing;
pub mod assignments;
pub mod compare_progress;
pub mod comparisons;
pub mod demo;
pub mod entries;
pub mod source_links;
pub mod students;
pub mod writing_tags;

use crate::error::ApiError;

/// Mirrors the Express routes' `Number(req.params.id)` + `Number.isInteger`
/// validation, including the per-resource error wording.
pub fn parse_id(raw: &str, what: &str) -> Result<i64, ApiError> {
    raw.trim()
        .parse::<i64>()
        .map_err(|_| ApiError::bad_request(format!("Invalid {what} id")))
}
