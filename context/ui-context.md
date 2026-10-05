# UI Context

## Theme

Simple, calm, professional. Light by default with a full dark theme (system-aware,
toggle in the header). No decorative animation: only functional transitions (progress,
focus, hover) and respect for `prefers-reduced-motion`. Generous whitespace, large
tap targets, plain language, one primary action per screen. Built for people with no
technical background: no jargon, every step labelled, errors say what to do next.

## Colors

shadcn token names are used (CSS custom properties in `src/app/globals.css`, OKLCH).
Components must use tokens — no hardcoded hex/rgb values.

| Role            | CSS Variable           | Light                    | Dark                     |
| --------------- | ---------------------- | ------------------------ | ------------------------ |
| Page background | `--background`         | `oklch(0.99 0.004 270)`  | `oklch(0.165 0.012 270)` |
| Surface (cards) | `--card`               | `oklch(1 0 0)`           | `oklch(0.205 0.014 270)` |
| Primary text    | `--foreground`         | `oklch(0.18 0.02 270)`   | `oklch(0.97 0.005 270)`  |
| Muted text      | `--muted-foreground`   | `oklch(0.50 0.02 270)`   | `oklch(0.72 0.02 270)`   |
| Primary accent  | `--primary`            | `oklch(0.50 0.19 268)`   | `oklch(0.72 0.14 268)`   |
| Soft accent bg  | `--accent`             | `oklch(0.96 0.02 268)`   | `oklch(0.27 0.04 268)`   |
| Border          | `--border`             | `oklch(0.92 0.01 270)`   | `oklch(1 0 0 / 11%)`     |
| Error           | `--destructive`        | `oklch(0.58 0.22 27)`    | `oklch(0.70 0.19 22)`    |
| Success         | `--success`            | `oklch(0.60 0.15 155)`   | `oklch(0.72 0.16 155)`   |
| Warning         | `--warning`            | `oklch(0.74 0.15 75)`    | `oklch(0.80 0.14 80)`    |

## Typography

| Role           | Font                   | Variable             |
| -------------- | ---------------------- | -------------------- |
| UI text        | Geist Sans             | `--font-sans`        |
| Code/mono      | Geist Mono             | `--font-mono`        |
| Indic scripts  | Noto Sans Devanagari   | `--font-devanagari`  |

Headings are semibold with tight tracking; body is 16px minimum; transcript text is
18px with 1.7 line height.

## Border Radius

| Context           | Class        |
| ----------------- | ------------ |
| Inline / small UI | `rounded-md` |
| Cards / panels    | `rounded-xl` |
| Modals / sheets   | `rounded-2xl`|
| Pills / badges    | `rounded-full` |

## Component Library

shadcn/ui (style `base-nova`, Base UI primitives) on Tailwind v4. Components live in
`src/components/ui/` and are added with `bunx shadcn@latest add <name>`; they are
generated files — do not hand-edit them except for token fixes. Composite product
components live in `src/components/` grouped by feature (`intake/`, `player/`,
`marketing/`, `admin/`, `layout/`). Patterns are inspired by HeroUI, Aceternity and
21st.dev (bento feature grids, pill tabs, soft gradient hero) but implemented with
plain Tailwind — no extra UI dependency or motion library.

## Layout Patterns

- Marketing pages: centered column, `max-w-6xl`, sections separated by whitespace,
  sticky translucent header, footer with link columns.
- Intake: a single card with tabs (Paste / Upload / Link) on the landing hero.
- Options step (`/new/[draftId]`): two columns on desktop (settings left, summary and
  estimate right), stacked on mobile; mode cards are radio cards.
- Player (`/listen/[id]`): transcript column plus a fixed bottom player bar; side sheet for
  chapters. Mobile: bar is full width, chapters open as a bottom sheet.
- Admin: stat tiles, line/bar charts (Recharts via shadcn chart), simple tables.
- Header: logo left, nav (Use cases, Pricing, Library), auth/user right, theme toggle.

## Icons

lucide-react, stroke icons only. `h-4 w-4` inline, `h-5 w-5` in buttons, `h-6 w-6`
for feature cards. Icons never carry meaning alone — always paired with a label or
`aria-label`.

## Accessibility

WCAG 2.1 AA: visible focus rings, labelled controls, 44px minimum touch targets in the
player, semantic landmarks, transcript is real text, audio controls reachable by
keyboard (Space, ←/→, J/K, ↑/↓ speed, M mark).
