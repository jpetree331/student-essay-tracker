# Science Writing Tracker (Essay Organizer)

Local full-stack app: Express API + PostgreSQL + React (Vite) UI.

## Setup

1. Install API dependencies: `npm install` (repo root).
2. Install UI dependencies: `cd frontend && npm install`.
3. Copy `.env.example` to `.env` and configure `DATABASE_URL` (and `PORT` if needed; default API port is **3010**). Copy `frontend/.env.example` to `frontend/.env` so the UI points at the API, or rely on the same default port in code.
4. Run the API: `npm run dev` or `npm start`.
5. Run the UI: `cd frontend && npm run dev`.

## LLM auto-tagging

Phase 6 — LLM auto-tagging requires an Anthropic API key. Add `ANTHROPIC_API_KEY` to your `.env` file. The app runs without this key — auto-tagging will simply be unavailable if the key is missing (the API returns a clear error).

- Single-entry review: **Data** tab is unchanged for this; use **Roster → student → New/Edit entry** and **Auto-tag with AI** under the writing sample.
- Optional batch: **Data → Class View → Analyze untagged entries** (only shown when entries exist without a `writing_tags` row and sample length ≥ 50).

### Development-only test route

`GET /api/analyze-writing/test` is registered when `NODE_ENV` is not `production`. It calls Claude with a fixed snippet so you can verify connectivity without the UI. **Disable production deploys with `NODE_ENV=production`**, or remove that route before shipping.
