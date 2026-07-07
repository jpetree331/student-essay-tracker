// Science Writing Tracker — desktop shell.
//
// Architecture: the same React frontend as the web app, served by Tauri's
// webview, talking HTTP to a loopback axum server embedded in this process
// (so frontend/src/api/client.js works unchanged). Data lives in a local
// SQLite file in the per-user app-data directory.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod db;
mod error;
mod routes;
mod server;
mod settings;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let state = server::AppState {
                real: db::init(&data_dir.join("data.db"))
                    .map_err(|e| format!("failed to open database: {e}"))?,
                demo: db::init(&data_dir.join("demo.db"))
                    .map_err(|e| format!("failed to open demo database: {e}"))?,
                demo_on: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
                settings_path: data_dir.join("settings.json"),
                http: reqwest::Client::new(),
            };

            // Port 0 = OS-assigned free port; no conflicts, no firewall prompt
            // (loopback only).
            let listener = std::net::TcpListener::bind(("127.0.0.1", 0))?;
            let port = listener.local_addr()?.port();
            listener.set_nonblocking(true)?;

            let router = server::router(state);
            tauri::async_runtime::spawn(async move {
                let listener = tokio::net::TcpListener::from_std(listener)
                    .expect("failed to adopt API listener");
                axum::serve(listener, router).await.expect("API server crashed");
            });

            // The window is created here (not in tauri.conf.json) so the port
            // can be injected via an initialization script, which is
            // guaranteed to run before any page script — including the
            // frontend's module bundle, which reads window.__TAURI_API_PORT__
            // at module-eval time (frontend/src/api/client.js).
            let script = format!("window.__TAURI_API_PORT__ = {port};");
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
                .title("Science Writing Tracker")
                .inner_size(1400.0, 900.0)
                .min_inner_size(1000.0, 700.0)
                .initialization_script(script.as_str())
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
