//! Port of routes/analytics.js. The Postgres FILTER aggregates, ROUND casts,
//! and INTERVAL arithmetic are replaced by two flat queries aggregated in
//! Rust — trivial at classroom scale and free of SQL-dialect landmines.

use std::collections::BTreeMap;

use axum::extract::{Path, State};
use axum::response::Response;
use serde_json::{json, Map, Value};

use crate::db::{blocking, query_json, Pool};
use crate::error::{ok_json, ApiError};
use crate::routes::parse_id;

const TAG_KEYS: [&str; 6] = [
    "claim_present",
    "evidence_cited",
    "explanation_present",
    "source_named",
    "response_incomplete",
    "ai_flag",
];

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

fn tag_true(row: &Value, key: &str) -> bool {
    row[key].as_bool().unwrap_or(false)
}

fn tag_counts(rows: &[&Value]) -> Value {
    let mut out = Map::new();
    for key in TAG_KEYS {
        let n = rows.iter().filter(|r| tag_true(r, key)).count();
        out.insert(key.to_string(), json!(n));
    }
    Value::Object(out)
}

pub async fn class_summary(State(pool): State<Pool>) -> Result<Response, ApiError> {
    let data = blocking(&pool, |conn| {
        let students = query_json(conn, "SELECT id, period FROM students", &[])?;

        // One flat row per entry with everything every aggregate needs,
        // already in export order.
        let entries = query_json(
            conn,
            "SELECT e.id, e.date_submitted, e.word_count,
                    st.period, st.last_name AS student_last, st.first_name AS student_first,
                    a.name AS assignment_name, a.unit, a.aks_standard,
                    wt.claim_present, wt.evidence_cited, wt.explanation_present,
                    wt.source_named, wt.response_incomplete, wt.ai_flag,
                    SUBSTR(COALESCE(e.writing_sample, ''), 1, 200) AS writing_sample_excerpt
             FROM entries e
             JOIN students st ON st.id = e.student_id
             JOIN assignments a ON a.id = e.assignment_id
             LEFT JOIN writing_tags wt ON wt.entry_id = e.id
             ORDER BY st.period, st.last_name, st.first_name, e.date_submitted, e.id",
            &[],
        )?;

        let entries_this_week: i64 = conn.query_row(
            "SELECT COUNT(*) FROM entries
             WHERE date_submitted >= DATE('now', 'localtime', '-6 days')
               AND date_submitted <= DATE('now', 'localtime')",
            [],
            |r| r.get(0),
        )?;

        // Students per period (includes periods with zero entries).
        let mut student_count_by_period: BTreeMap<i64, i64> = BTreeMap::new();
        for s in &students {
            *student_count_by_period.entry(s["period"].as_i64().unwrap_or(0)).or_insert(0) += 1;
        }

        let mut entries_by_period: BTreeMap<i64, Vec<&Value>> = BTreeMap::new();
        for e in &entries {
            entries_by_period.entry(e["period"].as_i64().unwrap_or(0)).or_default().push(e);
        }

        // per_period mirrors the Postgres query: one row per period that has
        // students, percentages over that period's entry count, rounded to 1dp.
        let per_period: Vec<Value> = student_count_by_period
            .iter()
            .map(|(&period, &student_count)| {
                let empty = Vec::new();
                let rows = entries_by_period.get(&period).unwrap_or(&empty);
                let n = rows.len() as f64;
                let avg = if n > 0.0 {
                    round1(rows.iter().map(|r| r["word_count"].as_f64().unwrap_or(0.0)).sum::<f64>() / n)
                } else {
                    0.0
                };
                let mut row = Map::new();
                row.insert("period".into(), json!(period));
                row.insert("student_count".into(), json!(student_count));
                row.insert("entry_count".into(), json!(rows.len()));
                row.insert("avg_word_count".into(), json!(avg));
                for key in TAG_KEYS {
                    let pct = if n > 0.0 {
                        round1(100.0 * rows.iter().filter(|r| tag_true(r, key)).count() as f64 / n)
                    } else {
                        0.0
                    };
                    row.insert(format!("pct_{key}"), json!(pct));
                }
                Value::Object(row)
            })
            .collect();

        let tag_frequencies_by_period: Map<String, Value> = entries_by_period
            .iter()
            .map(|(period, rows)| (period.to_string(), tag_counts(rows)))
            .collect();

        // avg word count + entry count per (date, period), date asc, period asc.
        let mut by_date: BTreeMap<(String, i64), (f64, i64)> = BTreeMap::new();
        for e in &entries {
            let key = (
                e["date_submitted"].as_str().unwrap_or("").chars().take(10).collect::<String>(),
                e["period"].as_i64().unwrap_or(0),
            );
            let slot = by_date.entry(key).or_insert((0.0, 0));
            slot.0 += e["word_count"].as_f64().unwrap_or(0.0);
            slot.1 += 1;
        }
        let word_count_by_date: Vec<Value> = by_date
            .into_iter()
            .map(|((date, period), (sum, count))| {
                json!({
                    "date": date,
                    "period": period,
                    "avg_word_count": sum / count as f64,
                    "entry_count": count,
                })
            })
            .collect();

        let entry_export_rows: Vec<Value> = entries
            .iter()
            .map(|e| {
                let mut row = Map::new();
                row.insert("student_last".into(), e["student_last"].clone());
                row.insert("student_first".into(), e["student_first"].clone());
                row.insert("period".into(), e["period"].clone());
                row.insert("assignment_name".into(), e["assignment_name"].clone());
                row.insert("unit".into(), json!(e["unit"].as_str().unwrap_or("")));
                row.insert("aks_standard".into(), json!(e["aks_standard"].as_str().unwrap_or("")));
                row.insert(
                    "date_submitted".into(),
                    json!(e["date_submitted"]
                        .as_str()
                        .map(|s| s.chars().take(10).collect::<String>())
                        .unwrap_or_default()),
                );
                row.insert("word_count".into(), e["word_count"].clone());
                for key in TAG_KEYS {
                    row.insert(key.into(), json!(tag_true(e, key)));
                }
                row.insert(
                    "writing_sample_excerpt".into(),
                    json!(e["writing_sample_excerpt"].as_str().unwrap_or("")),
                );
                Value::Object(row)
            })
            .collect();

        let all_refs: Vec<&Value> = entries.iter().collect();
        Ok(json!({
            "total_students": students.len(),
            "total_entries": entries.len(),
            "entries_this_week": entries_this_week,
            "periods": student_count_by_period.keys().collect::<Vec<_>>(),
            "tag_frequencies": tag_counts(&all_refs),
            "tag_frequencies_by_period": tag_frequencies_by_period,
            "word_count_by_date": word_count_by_date,
            "per_period": per_period,
            "entry_export_rows": entry_export_rows,
        }))
    })
    .await?;
    Ok(ok_json(data))
}

pub async fn student(
    State(pool): State<Pool>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = parse_id(&id, "student")?;
    let data = blocking(&pool, move |conn| {
        let students = query_json(
            conn,
            "SELECT id, first_name, last_name, period, iep_flags, iep_goals,
                    writing_goal, writing_goal_summary
             FROM students WHERE id = ?",
            &[&id],
        )?;
        let Some(student) = students.into_iter().next() else {
            return Err(ApiError::not_found("Student not found"));
        };
        let entries = crate::routes::students::fetch_student_entries(conn, id)?;
        Ok(json!({ "student": student, "entries": entries }))
    })
    .await?;
    Ok(ok_json(data))
}
