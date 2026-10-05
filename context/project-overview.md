# HearMeOut

## Overview

HearMeOut turns any long document — PDF, Word file, EPUB, article link, or pasted text —
into audio you can actually learn from. Pick how deep you want to go (full read, study
version, quick revision, plain-language explanation, or a quiz you answer out loud), pick
a voice and language (English, Hindi, Hinglish and 8 more Indian languages), and start
listening in about a second. It is built for students, exam aspirants, professionals and
anyone who would rather listen than read. Single use needs no sign-up.

Problem it solves: existing text-to-audio tools cap length (30 minutes then a ₹400
paywall), read raw PDFs badly (headers, page numbers, references, tables), cannot condense or
teach, and are priced for the US. HearMeOut is length-generous, cleans the document
properly, can condense/explain/quiz, links audio back to the source page, and is priced
in INR.

## Goals

1. First audio plays within ~2 seconds of pressing "Create" for any document length
   (chunked, on-demand synthesis with a short first chunk).
2. A first-time visitor can go from landing page to playing audio with zero sign-up and
   no more than 3 clicks.
3. Cost per user-hour of audio stays near zero on the free tier (free TTS, shared audio
   cache, free hosting) so the free allowance is sustainable until payments arrive.
4. Be discoverable: strong SEO and GEO (AI answer-engine) footprint from day one.
5. Give the owner (admin) free unlimited use plus an analytics dashboard.

## Core User Flow

1. Visitor lands on `/`, pastes text, drops a file, or enters a link.
2. Backend extracts and cleans the content and returns a draft: title, page count,
   outline, and estimated listening time per mode.
3. Visitor picks a mode, language, and voice (voice preview available); optionally edits
   text or deselects sections; presses **Create audio**.
4. Browser opens `/listen/[id]`; audio starts after the first chunk is synthesized while
   the rest is prepared ahead of playback.
5. Player offers speed, skip, sleep timer, chapters, transcript with the current passage
   highlighted, and "Show source" (page number + passage).
6. When the daily allowance is reached, the player explains the options (sign in free for
   more, unlock the book for ₹99, or go Pro) without losing the user's place.
7. Signed-in users get a library, MP3 download, resume across devices; Pro users also get
   a private podcast feed so documents appear in Apple Podcasts / Spotify / any podcast app.

## Features

### Input
- Paste text; upload PDF, DOCX, EPUB, TXT, MD, HTML; paste article URL.
- Scanned PDFs are read with open-source OCR (RapidOCR/ONNX) as a background job with a progress screen: Latin script, Devanagari (Hindi, Marathi), Tamil, Telugu, Kannada; script auto-detected or picked on upload; per-plan page limits.
- Smart PDF cleaning: repeated headers/footers, page numbers, hyphenation, footnote
  markers, citations, URLs, reference sections, table noise.
- Outline detection (PDF bookmarks, DOCX headings, EPUB nav, HTML headings, "Chapter N"
  lines, otherwise automatic parts) with per-section include/exclude and inline text edit.

### Listening modes
- **Read it to me** — faithful narration of the cleaned text.
- **Translate and listen** — faithful translation into any supported language, then narrated in a voice of that language (needs Groq; fails clearly instead of reading untranslated text).
- **Study version** (~35% length), **Quick revision** (~12%) — condensed narration.
- **Explain it simply** — teacher-style explanation with examples, in the chosen language.
- **Quiz me** — questions with a think-time pause, then the answer (two voices).
- Condensed/explain/quiz modes use the Groq LLM when a key is configured and fall back to
  an extractive (non-LLM) engine otherwise.

### Voices and languages
- Free neural voices via Edge TTS, multiple voices per language, 11 Indian +
  global languages, voice preview. The engine sits behind a provider interface so a
  self-hosted open-source engine (Kokoro/Piper) or an official provider can be added.
- Output language for AI modes: English, Hindi, Hinglish, Marathi, Tamil, Telugu,
  Bengali, Gujarati, Kannada, Malayalam, Punjabi (as available).

### Player
- Streaming chunk playback with prefetch, 0.75x–2.5x speed, ±15s skip, sleep timer,
  chapter list, transcript highlight, page-linked source view, resume position,
  keyboard shortcuts, Media Session (lock-screen controls), offline-friendly blobs.

### Accounts, plans and billing
- Anonymous (20 min/day, Read mode + 1 AI doc), Free account (60 min/day), Per-book
  unlock (₹99, one document, any length), Pro (₹149/mo or ₹999/yr), Institutes
  (contact). Admin: unlimited. Payments through Dodo Payments.

### Library and delivery
- Library of documents (anonymous per-device, claimable on sign-in), rename/delete,
  MP3 download, private podcast RSS feed (Pro) with one episode per chapter.

### Growth and analytics
- SEO/GEO: metadata, JSON-LD, sitemap, robots (AI crawlers allowed), `llms.txt`,
  use-case pages, compare pages, voices pages, FAQ.
- Analytics: GA4/GTM (consent-gated), Vercel Analytics, first-party anonymous event
  analytics with an admin dashboard.

## Scope

### In Scope
- Everything above, deployable on Vercel (web) + Render (API) + Supabase (DB/storage)
  free tiers, with Clerk auth and Dodo Payments.

### Out of Scope (v1)
- Voice cloning, background music, multi-speaker script editor, native mobile apps,
  OCR for handwriting and for Bengali/Gujarati/Malayalam/Punjabi scans, real-time conversation,
  team/workspace features, public sharing of generated audio (copyright), Institutes
  self-serve (handled by contact form / email).

## Success Criteria

1. An anonymous visitor can paste text, press Create, and hear audio in under ~3 s on
   a warm API.
2. A 300-page PDF can be uploaded, cleaned, outlined, and its first chapter played
   without waiting for the rest to render.
3. A signed-in free user hits the daily limit and sees the correct upgrade options; the
   admin account never does.
4. Payment webhooks (verified) grant Pro or a per-book unlock idempotently.
5. `bun run build` (web) and `pytest` (api) pass; Playwright smoke test plays real audio.
6. Lighthouse SEO ≥ 95 on landing and use-case pages; sitemap, robots, llms.txt served.
