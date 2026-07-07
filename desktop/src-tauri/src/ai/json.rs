//! Port of lib/claudeJson.js parseModelJson — strip markdown fences, then
//! fall back to slicing between the first '{' and last '}'.

use serde_json::Value;

pub fn parse_model_json(text: &str) -> Result<Value, String> {
    let mut s = text.trim();
    if s.starts_with("```") {
        if let Some(nl) = s.find('\n') {
            let rest = &s[nl + 1..];
            if let Some(end) = rest.rfind("```") {
                s = rest[..end].trim();
            }
        }
    }
    if let Ok(v) = serde_json::from_str(s) {
        return Ok(v);
    }
    let (Some(start), Some(end)) = (s.find('{'), s.rfind('}')) else {
        return Err("Model response did not contain valid JSON".to_string());
    };
    if end <= start {
        return Err("Model response did not contain valid JSON".to_string());
    }
    serde_json::from_str(&s[start..=end])
        .map_err(|_| "Model response did not contain valid JSON".to_string())
}
