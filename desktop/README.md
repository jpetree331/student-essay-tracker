# Science Writing Tracker — Desktop (Tauri)

A Windows/Mac desktop build of the tracker. Same React frontend as the web
app; a Rust backend (axum on a loopback port) with a local SQLite database
replaces Express + Postgres. Each user's data lives on their own machine.

## Architecture

- `src-tauri/src/main.rs` — opens/creates `data.db` in the per-user app-data
  dir, applies `schema.sqlite.sql` (repo root) idempotently, binds axum to
  `127.0.0.1:<random free port>`, and injects `window.__TAURI_API_PORT__`
  into the webview before the frontend loads. `frontend/src/api/client.js`
  picks that up and everything else works unchanged.
- `src-tauri/src/routes/*.rs` — 1:1 ports of the Express `routes/*.js`
  handlers, same paths and the same `{ success, data, error }` envelope.
- Postgres-only SQL (LATERAL, DISTINCT ON, arrays, JSONB) is replaced by
  simple queries + in-memory aggregation in Rust — fine at classroom scale.

## Status

Feature-complete. All 9 API surfaces are ported (CRUD, analytics, AI), plus
two desktop-only features:

- **Settings** (gear icon): per-user Anthropic/OpenAI API key + provider
  choice, stored in `settings.json` in the app-data dir. Keys never leave the
  machine except in direct calls to the provider. AI features are optional —
  without a key they return a clear "add a key in Settings" message.
- **Demo mode** ("Show demo data" button): swaps the whole app to a separate,
  self-contained sample dataset (`demo-seed.sql`) so new teachers can explore
  safely. Reseeds pristine on every enable; real data is never touched.

AI prompts come from the shared `prompts/*.system.txt` files at the repo root
(via `include_str!`) so they can never drift from the Node backend.

## Prerequisites

1. Rust: install from https://rustup.rs (on Windows this also walks you
   through the required Visual Studio C++ Build Tools).
2. Tauri CLI: `cargo install tauri-cli --version "^2"`
3. Node deps: `npm install` in `frontend/`.

## Develop

```
cd desktop/src-tauri
cargo tauri dev
```

This starts the Vite dev server (port 5175) and opens the app pointed at it.
The SQLite file lives in the OS app-data dir
(`%APPDATA%\com.jpetree.science-writing-tracker` on Windows,
`~/Library/Application Support/com.jpetree.science-writing-tracker` on Mac).

## Build installers

```
cd desktop/src-tauri
cargo tauri build
```

Produces an NSIS installer (~4 MB) and MSI on Windows, a .dmg/.app on Mac.
Mac builds must run on a Mac — push a `desktop-v*` tag to run
`.github/workflows/desktop-release.yml`, which builds both platforms and
attaches the installers to a draft GitHub release.

The current icons are generated placeholders. To replace them, drop a square
1024px `icon.png` in `src-tauri/icons/` and run `cargo tauri icon icons/icon.png`.

Builds are unsigned: Windows users click through SmartScreen ("More info →
Run anyway"); Mac users right-click the app → Open the first time.
