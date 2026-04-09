# Science Writing Tracker

A classroom tool that helps special education teachers collect student writing samples, automatically identify argumentative writing moves using AI, and track growth over time.

Built for a 9th-grade resource biology classroom where students respond to IRR (Integrated Reading and Reasoning) prompts. The AI analysis is calibrated for special education contexts — it surfaces genuine, incremental growth rather than measuring against grade-level benchmarks.

## What It Does

**Organize** — Store student writing samples by assignment, class period, and date. Attach source documents, teacher notes, and student feedback to each entry.

**Auto-Tag Writing Moves** — Send a writing sample to Claude and get back structured tags: claim present, evidence cited, explanation given, source named, response incomplete, and an AI-writing flag. Tags can also be set manually.

**Track Progress** — Select 2–6 entries from a student and generate a longitudinal comparison report. The report identifies specific growth moments with quoted evidence, persistent gaps, a prioritized next instructional step, and a ready-to-use conference script.

**Visualize** — Class-wide and per-student dashboards show tag frequency, word count trends, and submission timelines.

**Export** — Print-ready student reports, assignment submission sheets, comparison reports, and CSV data export.

## Tech Stack

- **Backend:** Node.js, Express, PostgreSQL
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts
- **AI:** Anthropic Claude API (Haiku for tagging, Sonnet for progress comparison)

## Quick Start

```bash
# Clone and install
git clone https://github.com/jpetree331/student-essay-tracker.git
cd student-essay-tracker
npm install
cd frontend && npm install && cd ..

# Configure
cp .env.example .env        # Set DATABASE_URL (required), ANTHROPIC_API_KEY (optional)
cp frontend/.env.example frontend/.env

# Set up database
psql -f schema.sql
npm run db:migrate

# Run
npm run dev          # API on :3010
cd frontend && npm run dev   # UI on Vite's default port
```

AI features (auto-tagging and progress comparison) require an Anthropic API key. The app runs fine without one — those features just won't be available.

## Design Notes

- **No auth layer.** This is a local classroom tool, not a hosted service. Run it on your machine or behind a reverse proxy.
- **IEP-aware AI prompts.** The progress comparison prompt is written for students who may have IEPs and histories of being told their writing isn't good enough. It finds real growth first, then identifies gaps constructively.
- **Server-computed word counts.** The backend always calculates word count on save — the frontend never sends one.
- **Defensive JSON parsing.** The AI integration doesn't assume Claude returns perfectly bare JSON. A shared parser handles fences, prefixes, and minor output variation across model versions.

## Project Context

I'm a special education biology teacher. I built this because I needed a way to track whether my students' argumentative writing was actually improving across assignments — not just whether they turned something in. Commercial tools either don't handle science writing moves specifically or aren't designed with SpEd students in mind.

This is a working tool I use in my classroom, not a polished SaaS product.

## License

MIT
