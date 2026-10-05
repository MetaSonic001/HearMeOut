# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Complete: v1 built, tested end to end, deployment config written. Awaiting owner credentials and deploy.

## Current Goal

- Deploy: Render or Railway (API, plain Python) + Vercel (web; Pro once charging), add Dodo / GA keys, run `bun run create-admin`, then `bun run verify`.

## Completed

- Units 1-11 from `ai-workflow-rules.md`:
  - Repo, env, Supabase schema (10 tables, RLS on, private `audio` bucket).
  - Text pipeline: PDF (pypdfium2), DOCX, EPUB, HTML/URL (SSRF-guarded), text; cleaning, outline, sentence chunking, listening-time estimates.
  - TTS + audio pipeline: lazy per-chunk synthesis, content-addressed shared cache, prefetch, instant first chunk, resumable AI scripting, MP3 utilities (duration, silence, concat).
  - Identity (Clerk JWT + signed guest tokens), plans, daily quota, admin role.
  - AI modes with Groq (mocked in tests) + extractive fallback; quiz mode with baked-in think time and second voice.
  - Billing: Dodo checkout, portal, verified idempotent webhooks (Pro, per-book unlock).
  - Podcast feed (Pro) with HTTP Range; MP3 download; claim guest docs on sign-in.
  - First-party analytics + admin stats endpoint and dashboard.
  - Web: landing, options, player, library, account, pricing, admin, auth, legal; 12 use-case pages, 22 language pages, 4 compare pages, FAQ, how-it-works; sitemap, robots (AI crawlers allowed), llms.txt, llms-full.txt, JSON-LD, OG image, manifest.
  - Deploy: render.yaml, railway.json, Procfile, vercel.json, security headers, README.
- Tests: 95 backend (pytest), 35 web unit (vitest), Playwright e2e (smoke, real listening flow, layout, axe a11y, mobile player). Live smoke against real Supabase + Edge TTS.

- Deployment tooling: `scripts/verify-deploy.ts` (live check incl. real guest audio), `.github/workflows/ci.yml` (lint, tests, web build), `Settings.production_problems()` logged as `CONFIG:` warnings at API start, `render.yaml` (native Python), `railway.json`, `vercel.json`. README rewritten end to end.
- Hosting (Oct 2026): owner chose Vercel (web) + Render/Railway (API); no containers anywhere. Vercel Hobby is non-commercial (Pro needed once charging); Render free = 512 MB, sleeps after 15 min, 750 h/month.

- Options page fix: Create could stay disabled with no explanation when the one `/v1/config` request failed (voice defaults came only from config). Now config retries with backoff and surfaces an error + retry, voices load from `/v1/voices` as a fallback, and a visible status line always says why Create is waiting (`createBlocker`, unit-tested).
- Translate and listen mode (Groq, any target language, free voice choice grouped by accent); voice picker shows loading/failed/preview states.
- OCR for scanned PDFs (RapidOCR): background job with progress screen, auto script detection (Latin, Devanagari, Tamil, Telugu, Kannada), adaptive page scaling, two-column order, plan limits (15/60/500/3000 pages), `OCR_ENABLED`, `build.sh` for hosts (headless OpenCV + model prefetch), additive DB migration in `init_db`.
- Logging: API logs configured for `hearmeout`/`app` loggers (documents, drafts, audio made, scripts, OCR, services summary, config warnings); launcher colours errors red, warnings yellow, dims request noise.
- Tests now: 114 backend, 45 web unit, 78 e2e (7 skipped by design), lint + typecheck + production build clean.

- Voice engine review (Oct 2026): Edge kept. Measured defaults (Emma/Andrew), `expressive` tags and ordering in the picker, spoken-style prompt for AI modes (not Translate). Kokoro/Piper settings and extras removed (not integrated). Audio samples in `voice-samples/` (git-ignored). Tests now 118 backend, 45 web unit.

## In Progress

- None.

## Next Up

- Deploy and set production keys; Dodo products and webhook (test real purchase); Clerk production instance (needs own domain).
- API plain-Python install (`pip install .`) + start command verified in a clean venv; real hosts not yet deployed.
- Long-term TTS engine: Edge stays for now (evaluated, see architecture.md). Revisit with a GPU host or an officially licensed engine before relying on paid revenue.
- Optional: Kokoro/Piper provider for self-hosting, OCR for Bengali/Gujarati/Malayalam/Punjabi and handwriting, Institutes self-serve, blog content.
- Verify Tamil/Telugu/Kannada OCR on real scans (wired in, not yet tested on real pages); watch API memory on Render free while OCR runs.

## Open Questions

- Production domain name (SITE_URL, Clerk production instance, CORS, contact email).
- Dodo product ids, webhook secret and API key (billing is off until provided).
- GA4 measurement id / GTM id (tags are no-ops until provided).
- TTS licensing: Edge TTS has no explicit commercial grant; plan a licensed or self-hosted engine before scale.
- Legal pages need review by a professional.

## Architecture Decisions

- Name stays **HearMeOut**. No Turborepo (two independent toolchains).
- Browser calls the API directly (Vercel body limit 4.5MB vs 50MB uploads).
- Permissive/LGPL dependencies only: pypdfium2 (not PyMuPDF), hand-written EPUB parser (not EbookLib), own MP3 parser (not mutagen).
- SQLAlchemy Core async + asyncpg (psycopg async does not run on Windows' default loop); SQLite in tests, Supabase Postgres in prod.
- Chunk audio is content-addressed and shared; downloads and feeds stream concatenated chunks (Supabase free caps objects at 50MB). Feed episodes are per chapter.
- Draft sections carry their blocks (enables per-section include/exclude and in-place edits).
- Quota meters seconds of newly readied audio per identity per day (IST midnight), charged once per chunk; guests also capped per IP.
- Chunk 0 is prewarmed when a read document is created; pipeline shutdown is bounded (never hangs).

## Session Notes

- Secrets live in ONE root `.env` (git-ignored); `.env.example` is secret-free. API reads it via `ROOT_ENV` in `config.py`; web via `loadEnvConfig` in `next.config.ts`; `scripts/create-admin.ts` reads it too.
- `bun run dev` (scripts/dev.ts) starts API + web with prefixed logs and readiness checks (`/healthz`, `/readyz`). `bun --cwd` is broken in bun 1.3.14: use `bun run --cwd`.
- Groq: the Llama models were retired; default is `openai/gpt-oss-120b` (fallback `openai/gpt-oss-20b`), verified live in en + hi.
- Admin stats window ends on the later of UTC/IST day (usage is booked on the IST day).
- The owner account is created by the owner with `bun run create-admin -- --email ...`.
