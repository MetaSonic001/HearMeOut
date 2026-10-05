# HearMeOut

**Turn any document into audio you can learn from.** Paste text, drop a PDF, Word or EPUB file, or add a link, then listen in about a second. There is no 30-minute cap and no sign-up for a first listen. A whole book starts playing instantly because audio is prepared in small pieces just ahead of the listener.

Study modes go beyond reading aloud: a shorter *study version*, *quick revision*, *explain it simply* (in your language) and *quiz me* with think-time pauses. 21 languages including Hindi, Hinglish and 8 more Indian languages, with 322 voices.

```
apps/web     Next.js 16 (App Router) + Tailwind v4 + shadcn/ui + Clerk    -> Vercel
apps/api     FastAPI (Python 3.12), async SQLAlchemy, edge-tts, Groq      -> Render or Railway
scripts/     dev launcher, owner-account creator, post-deploy verifier
context/     product, architecture, UI and workflow specs that drive development
Supabase     Postgres + a private Storage bucket (audio)
Clerk        sign-in        Dodo Payments  checkout + webhooks        Groq  smart modes
```

## Contents

1. [Features](#features) · 2. [Quick start](#quick-start) · 3. [Commands](#commands) · 4. [Environment](#environment) · 5. [Owner account](#your-owner-account) · 6. [Deploy](#deploy) · 7. [Payments](#payments-dodo) · 8. [Tests](#tests) · 9. [How it works](#how-it-works) · 10. [Project layout](#project-layout) · 11. [Known limits](#known-limits) · 12. [What was built](#what-was-built)

## Features

**Listening**
- Instant start: a short first chunk (about 280 characters), then about 900-character chunks, prepared 3 ahead.
- Player with chapters, "show source" (page number), speed, sleep timer, resume where you left off, keyboard shortcuts and lock-screen controls.
- Modes: Read it to me, **Translate and listen**, Study version, Quick revision, Explain simply, Quiz me (second voice, silent think-time baked into the audio).
- **Translate and listen:** an English document (or any language) is translated faithfully, section by section, into any of the 21 languages and read aloud. If the AI service is down it fails with a clear message and never reads untranslated text in the wrong voice.
- **Pick your voice:** a curated list of 73 voices across the 21 languages (2 to 6 per language, 14 for English), grouped by accent (US, UK, India, Australia...), with a preview button. Duplicates and near-identical voices are left out so the choice stays easy.
- 21 languages, per-language voice pages for search.

**Content in**
- Text, PDF (bookmarks become chapters, headers/footers/page numbers removed), DOCX, EPUB, web links (SSRF-guarded).
- **Scanned PDFs (OCR):** pictures of pages are read with open-source OCR on our own server, with a progress screen. English and other Latin-script text, plus Hindi and Marathi (Devanagari), Tamil, Telugu and Kannada. The language is detected automatically, or picked on upload. Plan limits: guest 15 scanned pages per file, free 60, Pro 500.
- Edit extracted text and untick sections *before* creating audio.

**Access and plans** (as approved)

| Plan | Price | Listening | Extras |
| --- | --- | --- | --- |
| Guest | ₹0, no sign-up | about 20 min/day | kept 24 hours on this browser |
| Free account | ₹0 | about 60 min/day | library kept 7 days, on every device |
| Per book | ₹99 one-time | that book, unlimited | kept 90 days |
| Pro | ₹149/month or ₹999/year | effectively unlimited | MP3 download, private podcast feed, 90-day library |
| Institutes | custom | | contact form |

Quota is seconds of *newly prepared* audio per person per day (resets at IST midnight). Re-listening and shared cached audio are free. Guests also share a per-IP daily cap.

**For the owner**
- A strong auto-generated owner login that never hits the payment wall and opens `/admin`: visitors, page views, referrers, countries, devices, documents, minutes of audio, sign-ups, funnel, revenue. Your own visits are not counted.
- First-party, cookieless analytics plus optional Google Analytics 4 / Tag Manager (behind a consent banner, Consent Mode v2) and Vercel Analytics.

**Findable (SEO + AI search)**
- 12 use-case pages, 22 language/voice pages, 4 comparison pages, how-it-works, FAQ, pricing.
- JSON-LD structured data, sitemap, robots that welcome AI crawlers, `llms.txt` and `llms-full.txt`, social image, web manifest.

**Quality**
- Everything works with no keys at all: without Groq the smart modes use a built-in extractive summariser; without Dodo, checkout is hidden; without GA, no Google tags load.
- Row Level Security on every table (no policies: only the API connects), signed guest tokens, verified webhooks, security headers, rate limits.

## Quick start

Prerequisites: [bun](https://bun.sh), [uv](https://docs.astral.sh/uv/), Python 3.11+. (ffmpeg is optional.)

```bash
cp .env.example .env                              # ONE env file for the API and the web app: fill it in
(cd apps/api && uv venv .venv && uv pip install -e ".[dev]")
(cd apps/web && bun install)
bun run dev                                       # starts API (:8000) and web (:3000) together
```

`bun run dev` does the following:
1. Checks `.env` and that ports 8000 and 3000 are free.
2. Prints which services are configured: database, storage, Clerk, Groq, Dodo, analytics.
3. Starts both servers with colour-coded `[api]` / `[web]` logs.
4. Waits until each is really ready, including a database check, then prints a "HearMeOut is ready" summary with the URLs.
5. Stops both on Ctrl+C. If either one crashes, it shuts the other down.

Tables are created automatically when the API starts (idempotent), so there is no separate migration step. With no `DATABASE_URL` it uses a local SQLite file, and with `STORAGE_BACKEND=local` it keeps audio on disk, so you can try it with an almost empty `.env`.

Open <http://localhost:3000>.

## Commands

Run from the repo root.

| Command | What it does |
| --- | --- |
| `bun run dev` | Start API + web together with logs and readiness checks |
| `bun run dev:api` / `bun run dev:web` | Start only one side |
| `bun run test:api` | 114 backend tests (pytest) |
| `bun run test:web` | 45 web unit tests (vitest) |
| `bun run test:e2e` | Real-browser flows, SEO files, accessibility (Playwright + axe) |
| `bun run lint:api` / `bun run lint:web` | ruff / eslint |
| `bun run build:web` | Production build of the web app |
| `bun run db:init` | Create tables manually (the API also does this on start) |
| `bun run create-admin -- --email you@example.com` | Create or promote the owner account |
| `bun run verify -- --web <url> --api <url>` | Check a live deployment end to end |

## Environment

One file, `.env` at the repo root, is read by the API, the web app and the scripts. It is git-ignored; `.env.example` lists every variable. In production there is no file: set the API rows on Render and the web rows on Vercel (same names).

**API (Render)**

| Variable | Required | Notes |
| --- | --- | --- |
| `ENVIRONMENT` | yes | `production` in deploys (turns on the startup configuration warnings). |
| `APP_SECRET` | yes | Signs guest tokens. 32+ random characters; keep it stable. |
| `INTERNAL_API_SECRET` | yes | Shared with the web app (`/api/collect` analytics forwarding). |
| `SITE_URL`, `CORS_ORIGINS`, `API_PUBLIC_URL` | yes | Your website URL (twice, no trailing slash) and this API's public URL. |
| `DATABASE_URL` | yes | `postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres` (transaction pooler). |
| `STORAGE_BACKEND`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_BUCKET` | yes | `supabase` in production; the private `audio` bucket is created automatically. |
| `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | yes | Verifies session tokens and reads `publicMetadata.role`. |
| `ADMIN_USER_IDS` | no | Comma-separated Clerk user ids that are always the owner. |
| `GROQ_API_KEY`, `GROQ_MODEL` | no | Smart modes. Default `openai/gpt-oss-120b`, fallback `openai/gpt-oss-20b`. |
| `OCR_ENABLED` | no | `true` by default. Reads scanned PDFs; needs the `ocr` extra and about 300 MB of RAM while a scan is being read. Set `false` on very small hosts. |
| `DODO_PAYMENTS_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENVIRONMENT`, `DODO_PRODUCT_PRO_MONTHLY`, `DODO_PRODUCT_PRO_YEARLY`, `DODO_PRODUCT_BOOK` | no | Payments. See [Payments](#payments-dodo). |

In production the API logs a `CONFIG:` warning at startup for anything that is fine on a laptop but wrong on a live site: a `localhost` URL, development Clerk keys, SQLite, a missing webhook secret, and similar.

**Web (Vercel)**

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Your production URL (canonical links, sitemap, structured data). Baked in at build time. |
| `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL` | The Render API URL. `NEXT_PUBLIC_*` is baked in at build time: redeploy after changing it. |
| `INTERNAL_API_SECRET` | Same value as the API. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk keys. |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GTM_ID` | Optional Google Analytics 4 / Tag Manager (consent-gated). |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Shown on legal/Institutes pages; Search Console verification. |

## Your owner account

Run once, from the repo root, with your own email:

```bash
bun run create-admin -- --email you@example.com
```

It creates (or promotes) a Clerk user with `publicMetadata.role = "admin"`, generates a strong random username and password, and prints them **once** in your terminal. Sign in at `/sign-in`: you get unlimited listening, no payment wall, and the **/admin** dashboard. To use a username instead of email at sign-in, enable "Username" in Clerk (User & authentication). Already signed up normally? Run the command with the same email to promote that account, or put your Clerk user id in `ADMIN_USER_IDS`.

## Deploy

### What goes where

| Piece | Where | Config in the repo |
| --- | --- | --- |
| **Web** (Next.js) | **Vercel** | `apps/web/vercel.json` (set Root Directory to `apps/web`) |
| **API** (FastAPI) | **Render** (free, sleeps when idle) **or Railway** (no always-free plan, always on) | `render.yaml`, `apps/api/railway.json`, `apps/api/Procfile` |
| Database + audio files | Supabase | tables are created on the API's first start |
| Sign-in | Clerk | production instance needs your own domain |
| Payments | Dodo Payments | webhook to the API |

The API is a plain Python service (no containers): the host runs `bash build.sh` (installs the API with OCR, swaps in the headless OpenCV build that small hosts need, and downloads the OCR language models once) and starts it with `uvicorn app.main:create_app --factory`. Any host that runs Python and gives you a `$PORT` works the same way (the `Procfile` has the start command).

**Vercel notes**
- `apps/web/vercel.json` pins the framework (Next.js), uses bun for install and build, and runs the site's server functions in Mumbai (`bom1`) close to your Indian users and to Supabase. Not strictly required (Vercel detects all of it), but it makes the setup explicit. Delete the `regions` line if your plan only allows its default region.
- Vercel's free **Hobby** plan is for non-commercial use only, and its rules count anything that takes payments as commercial. Test on Hobby; move to **Pro** (about $20/month) before you charge.
- Only the `NEXT_PUBLIC_*` values are baked in at build time: change one, then redeploy.

**API host notes**
- **OCR on a small host:** reading a scan needs about 300 MB of RAM on top of the API. If the free instance runs out of memory, scans fail and the service restarts: either move to a paid size, or set `OCR_ENABLED=false` (scanned PDFs then ask the person to run OCR elsewhere, and everything else keeps working). Scans are read one at a time.
- **Render free:** 512 MB RAM and a small share of one CPU, sleeps after 15 minutes without traffic (about a minute to wake), 750 free hours a month (one always-on service fits). The filesystem is wiped on every restart, which is why audio lives in Supabase. The website pings `/healthz` on load to wake the API, and a free uptime monitor (UptimeRobot, cron-job.org) hitting `/healthz` every 10 minutes keeps it warm.
- **Railway:** no permanent free plan as far as I found (a trial, then a small monthly usage fee: check current pricing). It stays on, so there is no cold start.
- Set the API variables from the table above on whichever host you pick. `SITE_URL`, `CORS_ORIGINS` and `NEXT_PUBLIC_SITE_URL` must be your real website address, `API_PUBLIC_URL` the API's own address.

### Step by step

1. **Supabase** (already created). Nothing to run: the API creates the tables, with Row Level Security on and no policies, on first start. Optional: a separate Supabase project for production keeps test data out.
2. **GitHub.** `git init` is done: commit and push. CI (`.github/workflows/ci.yml`) runs lint, tests and the web build on every push.
3. **API on Render.** Dashboard, New, Blueprint, pick the repo (it reads `render.yaml`). Enter the `sync: false` variables. `APP_SECRET` is generated for you. Until you have a domain, set `SITE_URL` and `CORS_ORIGINS` to the `*.vercel.app` address you expect, and `API_PUBLIC_URL` to the `onrender.com` address Render shows. Check the logs for `CONFIG:` warnings.
   **API on Railway instead.** New Project, Deploy from GitHub repo, then Settings: Root Directory `apps/api`. `apps/api/railway.json` supplies the start command and health check. Add the same variables, then Settings, Networking, Generate Domain.
4. **Web on Vercel.** Add New, Project, import the repo, Root Directory `apps/web`. Add the web variables (`NEXT_PUBLIC_API_URL` = your API address, `NEXT_PUBLIC_SITE_URL` = your site address). Deploy.
5. **Close the loop.** Put the real Vercel (or custom domain) address into the API's `SITE_URL` and `CORS_ORIGINS` and redeploy the API if you guessed it earlier.
6. **Verify.** Checks the API, database, CORS, the webhook route, a real guest listening flow with audio, the SEO files, and that the web build points at your API:
   ```bash
   bun run verify -- --web https://your-site.vercel.app --api https://hearmeout-api.onrender.com
   ```
7. **Clerk production.** Create a Production instance, add your domain (it needs a domain you own, not `*.vercel.app`), and swap the keys on both hosts. Run `bun run create-admin` with the production keys to create your owner login there. Until then, development keys work for testing.
8. **Google.** Add the site in Search Console (paste the token into `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`), submit `/sitemap.xml`, and create a GA4 property for `NEXT_PUBLIC_GA_ID`.
9. **Payments.** See below, then re-run `bun run verify`.

### Payments (Dodo)

Create three products in Dodo: **Pro monthly** (subscription, ₹149), **Pro yearly** (subscription, ₹999) and **Per book** (one-time, ₹99). Put their ids in `DODO_PRODUCT_*`. Add a webhook endpoint `https://<api-domain>/v1/webhooks/dodo` subscribed to `payment.succeeded` and all `subscription.*` events, and copy its signing secret to `DODO_WEBHOOK_SECRET`. Entitlements are granted only from verified webhooks, idempotently. Test in `test_mode` first with a real purchase, then switch `DODO_ENVIRONMENT=live_mode`. Confirm in the Dodo dashboard that INR and UPI are available for your account.

## Tests

```bash
bun run test:api      # 114 backend tests: extraction, OCR, chunking, API flows, quota, AI modes, translate, billing + admin, config
bun run test:web      # 45 unit tests
bun run test:e2e      # real browser: listening flow, translate, scanned-PDF upload, voice picker, SEO files, layout, axe accessibility, mobile player
bun run lint:api && bun run lint:web
```

The e2e suite starts both servers if they are not already running and uses the real API with real voices. Backend tests use SQLite, a fake voice engine and a fake auth provider, and never read your real `.env`.

## How it works

1. **Intake.** Text, a file or a URL becomes a *draft*: cleaned text split into sections (chapters from PDF bookmarks, EPUB structure, headings).
2. **Create.** You choose a mode, language and voices. A *document* is created with a list of chunks; chunk 0 is prepared immediately.
3. **Listen.** The player asks for chunk *n*. The API synthesises it on demand, stores it content-addressed (`tts/<sha256(provider|voice|pause|text)>`, so identical text is shared across users), and prepares the next 3.
4. **Smart modes.** Groq rewrites each section (summary, revision points, plain-language explanation, quiz questions). If Groq is missing or fails, an extractive fallback produces the script. Scripting resumes after a restart.
5. **Quota and billing.** Newly prepared seconds are charged once per chunk to the person's daily quota. Dodo webhooks grant Pro or a per-book unlock.
6. **Downloads and podcast feed.** Pro can download an MP3 or subscribe to a private RSS feed (one episode per chapter, HTTP Range supported). Chunks are concatenated on the fly because Supabase's free tier caps objects at 50 MB.

Identity is a signed guest token (HS256), a Clerk session JWT (RS256, verified against Clerk's JWKS), or an owner role from `publicMetadata.role=admin` / `ADMIN_USER_IDS`. After sign-in, the browser's guest documents move into the account.

## Project layout

```
apps/api/app/
  main.py, config.py, deps.py, errors.py, schemas.py, state.py
  routers/     public, drafts, docs, billing, admin, feed
  services/    extract/ (pdf, docx, epub, html, text, fetch), textprep, outline, chunking, estimate,
               tts/ (edge, voices), llm/ (groq, scripts, extractive), pipeline, documents, plans, quota,
               identity, tokens, auth, billing, analytics, ratelimit, sweeper, mp3, languages
  db/          schema (10 tables), engine, init_db, repo, stats
  storage/     local, supabase
apps/web/src/
  app/         routes: /, /new/[draftId], /listen/[id], /library, /account, /pricing, /admin,
               /use-cases, /voices, /compare, /how-it-works, /faq, legal pages, SEO files
  components/  layout, intake, options, player, library, account, marketing, admin, ui (shadcn)
  lib/         api client, player hook, content data, SEO helpers, formatting
scripts/       dev.ts, create-admin.ts, verify-deploy.ts
context/       project-overview, architecture, ui-context, code-standards, ai-workflow-rules, progress-tracker
```

## Known limits

- **Voices:** the engine is the free Edge TTS service through the open-source `edge-tts` client. It is unofficial: Microsoft has not granted explicit commercial rights, so **decide on a licensed or self-hosted engine before you rely on paid revenue.** The code keeps a `TTSProvider` interface for that swap. See [Voice engine decision](#voice-engine-decision) for what was tested and why Edge stays for now.
- **Tested against real services:** Supabase (database and storage), Edge TTS, Clerk token verification, and Groq (checked live in English and Hindi). **Not yet tested against the real service:** Dodo checkout and webhooks (tested with a simulated API and correctly signed webhooks), a real owner login at `/admin` (the dashboard is tested with sample data). The API's plain-Python install (`pip install .`) and start command were checked in a clean environment.
- **Free-tier limits:** Supabase free storage is 1 GB (about 45 hours of audio). Guest audio expires after 24 hours, free accounts 7 days, paid 90 days. Render free cold-starts.
- **OCR quality:** clean, straight scans read very well (English tested at 99% confidence; a Hindi scan read near-perfectly). Blurry, skewed or handwritten pages do not, and stylised headings can be skipped. Tamil, Telugu and Kannada models are wired in but I have not tested them on real scans; Bengali, Gujarati, Malayalam and Punjabi scans are not supported yet. Every scan is flagged so the person can fix words with Edit.
- **Not supported yet:** handwriting, voice cloning, background music, DRM-protected ebooks.
- **Legal pages** (privacy, terms, copyright) are sensible starting drafts, not legal advice. Have them reviewed, add a refund policy, and set `NEXT_PUBLIC_CONTACT_EMAIL`.
- **Licences:** dependencies are MIT/BSD/Apache/ISC, plus LGPL (`edge-tts`, unmodified). AGPL/GPL libraries (PyMuPDF, EbookLib, mutagen) are deliberately avoided.
- **Dev-only advisory:** `bun audit` reports one `braces` advisory inside build tooling, not shipped code.
- **Secrets:** rotate any credential that was ever pasted into a chat or ticket before launch.

## Voice engine decision

Edge voices can sound flat. In October 2026 I tested whether a free alternative sounds more human, covers our languages, and runs without a GPU. The audio samples are in `voice-samples/` (git-ignored) so you can judge by ear.

| Option | Result |
| --- | --- |
| **Edge "Multilingual / Expressive" voices** | Same audio as the older versions (Emma, Brian and Neerja measured identical; Ava slightly livelier; Andrew slightly flatter). No upgrade. |
| **Edge emotion / style tags** | Rejected by the free endpoint (no audio comes back). Only rate and pitch work, and shaping them by punctuation moved pitch by under 1%. Not worth shipping. |
| **Kokoro-82M** (Apache-2.0) | Best open model that runs on a CPU, but only 9 languages and Hindi is its weakest (graded C). Pitch movement is no better than Edge's lively voices (Hindi is flatter). **Measured on a 16-core PC: 0.6x real time at full precision with 570 MB of RAM; the small int8 version was 2.7x slower than real time.** Too heavy for free hosting and not better, so not integrated. |
| **Orpheus on Groq** | Genuinely emotional ([cheerful], [whisper]) but English only, limited to 200 characters per request, and paid ($22 per million characters). |
| **Indic Parler-TTS (AI4Bharat), Chatterbox, Orpheus, Veena, Zonos** | Emotional and multilingual, but 0.5-3B parameters and built for a GPU. Revisit if you move to a GPU host (roughly $0.4-0.8 an hour on a rented T4/L4), and check each model's licence. |
| **Piper** | Fast, but the current version is GPL and quality varies by language; avoided. |
| **Supertonic 3** | Fast and multilingual (31 languages, Hindi included) but its licence adds use restrictions and I could not confirm Tamil, Telugu or Kannada. Worth re-checking later. |

What I changed instead, based on measurements:
- **Better default voice.** I measured the pitch movement of 29 English voices. The old default narrator, Ava, was among the flattest. The default is now **Emma** (lively, same family) with **Andrew** as the second voice, and the most dynamic voices (Ryan, Andrew, Emma, Neerja, Prabhat...) are listed first and tagged "Expressive". Flat ones are tagged "Calm". The English list was then trimmed from 29 to 14: duplicate "Multilingual" twins (identical audio), two child voices and near-identical accents were retired. Retired voices still play in documents you already made.
- **More natural scripts.** In the AI modes (Study, Revision, Explain, Quiz) the prompt now asks for how a storyteller talks: varied sentence length, contractions, the occasional question. Translate is excluded because it must stay faithful.

Limits of this evidence: pitch movement is a proxy for liveliness, not for quality, and other languages were not measured. If you want a real step up in emotion, it needs a GPU host and a model such as Indic Parler-TTS (Indian languages) or Chatterbox/Orpheus (English), which is a hosting-cost decision rather than a code one.

## What was built

1. **Research and validation:** text-to-audiobook tools cap length at about 30 minutes and then charge ₹400 or more. That pain is real and under-served, especially for Indian languages and students. The product is a no-cap, instant, study-focused listener priced in rupees.
2. **Core build (11 units):** repo and environment, Supabase schema, text extraction and chunking, voices and lazy audio pipeline, identity and quota, AI modes, billing, podcast feed and downloads, analytics and admin, the web app, and SEO/GEO and deploy files.
3. **Verification:** backend, unit, real-browser and accessibility tests, plus live runs against real Supabase and real voices.
4. **Developer experience:** one root `.env`, one `bun run dev` command with readiness logs, `bun run verify` for live deployments, CI.
5. **Translate and OCR:** a Translate mode with free choice of language and voice; scanned PDFs read in the background with progress; the options page can no longer leave the Create button silently disabled (it loads voices on its own, retries the server, and always shows why it is waiting); readable startup and request logs.
6. **Voice engine review:** compared Edge's newer voices, Kokoro, Orpheus and the GPU models on quality, languages, licence and hardware; kept Edge, set measured-better defaults, tagged expressive voices, and made AI-mode scripts more conversational.
7. **Fixes along the way:** Groq's retired Llama models replaced with `gpt-oss`; the admin dashboard now counts the IST day correctly; bun 1.3.14's broken `--cwd` flag worked around.

The project history and decisions are kept in `context/` (`progress-tracker.md` is the running log).
