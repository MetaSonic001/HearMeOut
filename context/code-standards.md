# Code Standards

## General

- Keep modules small and single-purpose; one concern per file.
- Fix root causes; do not layer workarounds or silent fallbacks that hide failures.
- Do not mix unrelated concerns in one component, router, or service.
- Prefer boring, readable code; comments only for non-obvious "why".
- Permissive open-source dependencies only (MIT/BSD/Apache/ISC; LGPL used unmodified).
  Check the license before adding a library.

## TypeScript

- `strict` is required. No `any`; use explicit interfaces or `unknown` + narrowing.
- Validate unknown external input (API responses, `localStorage`, query params) at the
  boundary with zod or explicit guards before trusting it.
- Shared API types live in `src/lib/api/types.ts`; the API client in `src/lib/api/client.ts`.

## Next.js

- Default to server components; add `"use client"` only for browser interactivity
  (intake, player, library, charts, consent banner).
- Next 16: request APIs (`params`, `searchParams`, `cookies()`, `headers()`) are async —
  always `await` them. Middleware is `src/proxy.ts`.
- SEO pages export `generateMetadata`/`metadata` with unique title, description,
  canonical and Open Graph; structured data via a `<JsonLd>` component.
- Route handlers do one thing. The only one is `app/api/collect`.
- No secrets in client code; only `NEXT_PUBLIC_*` values are read in the browser.

## Python

- Python 3.11+ with type hints everywhere; Pydantic v2 models for all request/response
  bodies; `ruff` clean (`uv run ruff check`).
- Async all the way for I/O; CPU-bound work (PDF parsing) runs in a thread via
  `asyncio.to_thread`.
- Dependencies are injected with FastAPI `Depends` (identity, repository, services) so
  tests can override them.
- No global mutable state except the explicit `AppState` created in lifespan.

## Styling

- Tailwind utility classes with the CSS-variable tokens from `ui-context.md`; no
  hardcoded colors. Follow the radius scale in `ui-context.md`.
- Mobile first; every page must work at 360px width without horizontal scroll.

## API Routes

- Validate and parse request input (Pydantic) before any logic runs.
- Resolve identity first; enforce ownership before any read or mutation of a document.
- Consistent error shape: `{"error": {"code": "snake_case", "message": "Human text",
  "details": {...}}}` with correct HTTP status. 402 = quota/plan, 401 = identity,
  403 = not owner/admin, 404 = missing, 409 = not ready, 413 = too large, 429 = rate.
- Cheap endpoints must not do heavy work; long work is scheduled and tracked in the DB.
- Rate-limit expensive endpoints (extract, create, preview) per IP.

## Data and Storage

- Metadata and text chunks belong in Postgres; audio and other large blobs in object
  storage. Never store audio bytes in the database.
- Schema is defined once in `app/db/schema.py`; apply with `python -m app.db.init_db`.
- Use content-addressed keys for audio so identical text is stored once.
- Usage counters use atomic upserts (`ON CONFLICT DO UPDATE`).
- Every table has RLS enabled (no policies); only the server connection is used.

## Testing

- Backend: `pytest` with SQLite + local storage + fake TTS/LLM providers; live tests
  (real Edge TTS, real Supabase) are marked `live` and opt-in.
- Frontend: `vitest` for pure logic; Playwright for the end-to-end smoke flow.
- Every bug fix gets a regression test where practical.

## File Organization

- `apps/api/app/routers/` — HTTP endpoints grouped by resource.
- `apps/api/app/services/` — business logic (extract, textprep, chunking, pipeline, tts, llm, billing).
- `apps/api/app/db/` — schema, engine, repository functions.
- `apps/api/app/storage/` — audio storage backends.
- `apps/api/tests/` — pytest suite mirroring `app/`.
- `apps/web/src/app/` — routes (marketing, tool, app, admin, SEO files).
- `apps/web/src/components/` — feature components; `ui/` holds shadcn primitives.
- `apps/web/src/lib/` — API client, constants, formatters, SEO data, analytics.
- `apps/web/tests/` — vitest unit tests; `apps/web/e2e/` — Playwright specs.
