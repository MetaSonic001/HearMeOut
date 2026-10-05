# Architecture Context

## Stack

| Layer            | Technology                                              | Role                                                                 |
| ---------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Frontend         | Next.js 16 (App Router, `proxy.ts`), React 19, TS strict | Marketing/SEO pages, intake flow, player, library, admin             |
| UI               | Tailwind v4 + shadcn/ui (Base UI), lucide-react, Recharts | Simple professional components                                       |
| Package managers | bun (web), uv (api)                                     | Install/run                                                          |
| Auth             | Clerk (`@clerk/nextjs`)                                 | Sign-in/up; session JWT verified by the API; `role=admin` metadata   |
| Backend          | FastAPI (Python 3.12), SQLAlchemy Core async            | Extraction, TTS orchestration, quotas, billing, analytics            |
| Database         | Supabase Postgres (pooler) / SQLite in tests            | Metadata, chunks text, usage, purchases, events                      |
| Object storage   | Supabase Storage (private bucket `audio`) / local disk  | Synthesized MP3 chunks (content-addressed)                           |
| TTS              | Edge TTS via `edge-tts` (default)                       | Speech synthesis behind a `TTSProvider` interface; Kokoro/Piper/Azure can be added as providers |
| LLM              | GroqCloud (OpenAI-compatible HTTP) + extractive fallback | Condense / explain / quiz scripts                                    |
| Payments         | Dodo Payments (Python SDK + Standard Webhooks)          | Pro subscriptions and per-book purchases                             |
| Analytics        | GA4/GTM (consent-gated), Vercel Analytics, first-party  | Traffic and product metrics, admin dashboard                         |
| Hosting          | Vercel (web), Render or Railway (api, plain Python)     | Free-tier deploy, scale later                                        |

All libraries are permissive open source (MIT/BSD/Apache/ISC) except LGPL runtime
dependencies (edge-tts, psycopg) used unmodified. AGPL/GPL libraries are avoided
(PyMuPDF, EbookLib, mutagen intentionally not used).

## System Boundaries

- `apps/web` — everything the browser sees. Talks to the API directly over HTTPS
  (CORS-restricted) with `Authorization: Bearer <Clerk JWT>` and/or `X-Anon-Token`.
  Never holds secrets other than public keys. Owns SEO, UI state, player logic.
  `app/api/collect` is the only Next route handler: it forwards analytics events to
  the API adding geo/device hints and an internal secret.
- `apps/api/app/routers` — thin HTTP layer: validate input, resolve identity, call
  services, shape responses. No business logic.
- `apps/api/app/services` — business logic: `extract/` (PDF, DOCX, EPUB, HTML, text),
  `textprep` (cleaning), `chunking`, `plans`/`quota`, `pipeline` (chunk audio
  production + AI scripting), `tts/`, `llm/`, `billing`, `analytics`, `mp3`.
- `apps/api/app/db` — SQLAlchemy metadata (`schema.py`, single source of truth for
  tables), repository functions, and `init_db` for idempotent creation + RLS.
- `apps/api/app/storage` — `AudioStorage` protocol with Supabase and local-disk
  implementations.
- `scripts/` — operational scripts (create admin user in Clerk, DB init helpers).
- `context/` — project specs that drive development.

## Storage Model

- **Postgres**: `users` (plan, subscription ids, feed token), `drafts` (extracted
  sections with their blocks, 6h TTL; `status` ready|ocr|failed, `progress`, `error`), `documents` (settings, status, progress), `doc_sources` (sections
  for AI-mode scripting, resumable), `chunks` (text per ~900-char unit, page range,
  status, audio key, duration), `usage_daily` (seconds/AI docs per identity per day),
  `purchases`, `webhook_events` (idempotency), `events` (first-party analytics).
  RLS is enabled with no policies: only the backend's server connection reads/writes.
- **Object storage**: one MP3 per synthesized chunk, key `tts/<sha256(provider|voice|text)>.mp3`.
  Content-addressed so identical text is synthesized once across all users. Voice
  samples at `samples/<voice>.mp3`. Nothing else large is stored: full downloads and
  podcast episodes are streamed by concatenating chunk objects (MP3 frames concatenate).
- **Retention**: anonymous docs expire after 24h, free 7d, per-book/Pro 90d. A background
  sweeper deletes expired docs/chunks/drafts; orphaned audio objects are collected by
  reference-count sweep.

## OCR (scanned PDFs)

- `extract_pdf` raises `NeedsOcr(pages, page_count)` when most pages have no text layer. The upload endpoint then
  stores a placeholder draft (`status=ocr`), enforces the plan's `max_ocr_pages`, and starts a background job in
  `OcrService` (one scan at a time, in a worker thread). Live progress is held in memory and returned by
  `GET /v1/drafts/{id}`; if the process restarted mid-scan the draft is marked `failed` (no live job).
- Engine: RapidOCR + onnxruntime (Apache-2.0). Bundled multilingual model for Latin script; per-script recognition
  models (Devanagari, Tamil, Telugu, Kannada) download on first use (prefetched by `build.sh`). Script is probed on
  sample pages unless the uploader picks a language. Each page is rendered (~150 dpi) and rescaled so text lines
  are about 25 px tall (measured by a detection-only pass), because recognition quality drops sharply outside that range.
- Reading order handles two columns; junk low-confidence short lines are dropped on otherwise clean pages.
  On completion the same pipeline as any PDF (reflow, headings, outline, `build_draft_row`) fills the draft.
- Schema changes are applied by `init_db` (additive `ALTER TABLE ADD COLUMN`), so existing databases upgrade on start.

## Translate mode

- Mode `translate` is an AI mode: `make_script` translates each section faithfully (3500-char blocks) and the
  document is spoken with a voice of the target language. No extractive fallback: an LLM failure fails the document
  with a friendly message. The target language must differ from the document's.

## Auth and Access Model

- Identity is one of: `user:<clerk_id>` (verified Clerk JWT via JWKS), `anon:<id>`
  (API-issued HS256 token stored in the browser), or admin (a `user` whose Clerk
  `public_metadata.role == "admin"` or whose id is in `ADMIN_USER_IDS`).
- Every document has exactly one `owner_key`. Only the owner can read/mutate it.
  Anonymous documents are claimed by a signed-in user via `POST /v1/claim` presenting
  both tokens.
- `<audio>` elements cannot send headers, so audio URLs carry a short-lived signed
  playback token (`pt`) bound to the document id; the token is issued only to the owner.
- Admin endpoints require the admin check; the web `/admin` page also checks server-side.
- Podcast feeds are authorized by an unguessable per-user `feed_token` (Pro only).
- Dodo webhooks are authorized only by Standard Webhooks signature verification.

## Invariants

1. Request handlers never run unbounded work: extraction is bounded by file/char limits;
   synthesis happens per chunk; AI scripting and prefetch run as background tasks that
   persist progress (resumable after a cold start).
2. Quota is charged exactly once per chunk per document, when it first becomes ready, and
   always checked server-side. The client never decides entitlements.
3. Secrets live only in environment variables (`.env*` files are git-ignored). Browser
   code only receives public keys.
4. Entitlements (Pro, book unlock) are granted only from verified webhooks, never from
   redirect query parameters, and webhook handling is idempotent.
5. All DB access goes through `app/db` repository functions; routers never build SQL.
6. TTS providers and storage backends are swappable behind interfaces; nothing outside
   `services/tts` imports a TTS library.
7. User documents are private: no public URLs for user audio or text; deletion removes
   rows and unreferenced audio.
8. Every page that should rank has unique title/description/canonical/JSON-LD; app
   pages (`/listen`, `/library`, `/account`, `/admin`) are `noindex`.

## Voice engine

- Edge TTS (`edge-tts`) is the only provider; `TTSProvider` stays as the swap point. Audio is MP3 (24 kHz mono) so chunks concatenate.
- Decision (Oct 2026): keep Edge. Tested Edge "Multilingual" twins (identical audio), Edge style tags (rejected by the endpoint),
  Kokoro (0.6x real time and 570 MB on a 16-core PC, int8 2.7x slower than real time, 9 languages, Hindi grade C, not livelier),
  Orpheus on Groq (English only, 200 chars/request, paid), GPU models (Indic Parler, Chatterbox, Zonos, Veena).
- `voices.json` carries `expr` (semitone SD of pitch on a fixed passage) for the 29 offered English voices; `RETIRED` hides duplicate/near-identical English voices from the picker (29 -> 14; ids stay resolvable for old documents; offered total 73). `Voice.expressive` is
  high >= 4.3, medium >= 3.3, calm below. Featured + most expressive voices sort first; default English narrator is Emma, second Andrew.
- AI-mode prompts add `SPOKEN_STYLE` (storyteller rhythm); Translate does not (must stay faithful).
- Revisit with a GPU host: Indic Parler-TTS (Apache-2.0, 21 Indian languages, emotion prompts), Chatterbox (MIT), Orpheus.

## Deployment

- API: plain Python service (`pip install .`, `uvicorn app.main:create_app --factory`) on Render free via `render.yaml`, or Railway via `apps/api/railway.json`; `apps/api/Procfile` for any other host. Filesystem is ephemeral, so all state is in Supabase. Web: Next.js on Vercel only (Root Directory `apps/web`, config in `apps/web/vercel.json`). Browser calls the API directly (CORS_ORIGINS must equal the web origin).
- One root `.env` locally (API `ROOT_ENV`, web `loadEnvConfig`); platform dashboards in production. `NEXT_PUBLIC_*` values are baked in at web build time.
- `/healthz` (liveness, used for wake-up), `/readyz` (database + configured services). `bun run verify` exercises a live deployment.
