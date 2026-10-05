# AI Workflow Rules

## Approach

Build incrementally and spec-first. The context files define what to build, how, and
current progress; implement against them and do not invent behavior. Units are built in
this order, each verified before the next: (1) repo + env + DB, (2) text pipeline
(extract/clean/chunk), (3) TTS + audio pipeline + core API, (4) identity/quotas/plans,
(5) AI modes, (6) web foundation + intake, (7) options + player + library, (8) account,
pricing, billing, (9) admin + analytics, (10) SEO/GEO content, (11) deploy config, docs,
security review, full e2e.

## Scoping Rules

- Work on one feature unit at a time.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step.

## When to Split Work

Split an implementation step if it combines:

- UI changes and background task/pipeline changes
- Multiple unrelated API routes
- Behavior not clearly defined in the context files
- A schema change and the feature using it that cannot be tested together

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files.
- If a requirement is ambiguous, resolve it in the relevant context file before implementing.
- If a requirement is missing, add it as an open question in `progress-tracker.md`
  before continuing.
- Credentials the owner has not provided yet (Groq, Dodo, GA/GTM ids, domain) are
  optional env vars; the feature degrades gracefully and is documented in the README.

## Protected Files

Do not modify the following unless explicitly instructed:

- `apps/web/src/components/ui/*` — generated shadcn components (token fixes only)
- `apps/web/AGENTS.md`, `apps/web/CLAUDE.md` — written by `next dev`
- Any file under `node_modules/` or `.venv/`
- `.env*` files are never committed or echoed into docs/chat

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries
- Storage model decisions
- Code conventions or standards
- Feature scope

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. `bun run build` (web) passes and `uv run pytest` (api) passes
