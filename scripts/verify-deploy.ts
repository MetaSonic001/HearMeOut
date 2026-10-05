/**
 * Post-deploy check:  bun run verify -- --web https://your-site.com --api https://your-api.onrender.com
 *
 * Verifies the live deployment end to end: API health + database, CORS for your site, the payment webhook route,
 * a real guest listening flow (paste text -> create -> receive MP3 audio), and the SEO files on the web app.
 * It uses a guest session and deletes the document it creates. Exit code 1 if anything fails.
 */
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1]?.replace(/\/$/, "") : undefined
}
const WEB = arg("web")
const API = arg("api")
if (!WEB || !API) {
  console.error("Usage: bun run verify -- --web https://your-site.com --api https://your-api.onrender.com")
  process.exit(2)
}

let failures = 0
let warnings = 0
const pass = (m: string) => console.log(`\x1b[32m✔\x1b[0m ${m}`)
const fail = (m: string) => (failures++, console.log(`\x1b[31m✘ ${m}\x1b[0m`))
const warn = (m: string) => (warnings++, console.log(`\x1b[33m! ${m}\x1b[0m`))
const check = (ok: boolean, good: string, bad: string) => (ok ? pass(good) : fail(bad))

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = performance.now()
  const v = await fn()
  return [v, Math.round(performance.now() - t)]
}

async function main() {
  console.log(`\nChecking  web: ${WEB}\n          api: ${API}\n`)

  // 1. API wakes up (free hosting sleeps) and is healthy
  try {
    const [res, ms] = await timed(() => fetch(`${API}/healthz`, { signal: AbortSignal.timeout(120_000) }))
    check(res.ok, `API is up (${ms} ms${ms > 8000 ? ", it was asleep" : ""})`, `API /healthz returned ${res.status}`)
  } catch (e) {
    fail(`API unreachable: ${String(e)}`)
    return
  }
  const ready = (await (await fetch(`${API}/readyz`)).json()) as Record<string, unknown>
  check(ready.database === "ok", "Database reachable", `Database problem: ${String(ready.database)}`)
  check(ready.storage === "supabase", "Audio storage is Supabase", `Storage is "${String(ready.storage)}": audio will vanish on restart`)
  check(Boolean(ready.auth), "Clerk sign-in configured", "Clerk is not configured on the API")
  ready.llm ? pass("Groq enabled") : warn("No Groq key: smart modes use the basic summariser")
  ready.billing ? pass("Dodo payments configured") : warn("No Dodo key: checkout is off")

  // 2. CORS: the browser on your site must be allowed to call the API
  const cors = await fetch(`${API}/v1/config`, { headers: { Origin: WEB! } })
  check(
    cors.headers.get("access-control-allow-origin") === WEB,
    "CORS allows your website origin",
    `CORS does not allow ${WEB}. Set CORS_ORIGINS on the API to exactly this origin (no trailing slash).`,
  )

  // 3. Payment webhook route exists and rejects unsigned calls
  const hook = await fetch(`${API}/v1/webhooks/dodo`, { method: "POST", body: "{}", headers: { "content-type": "application/json" } })
  if (hook.status === 503 && !ready.billing) warn("Dodo webhook route is off until DODO_PAYMENTS_API_KEY is set")
  else check([400, 401, 403].includes(hook.status), `Dodo webhook route rejects unsigned requests (${hook.status})`, `Webhook route returned ${hook.status} (expected 400/401)`)

  // 4. Real guest flow: text -> document -> audio
  const session = (await (await fetch(`${API}/v1/session`, { method: "POST" })).json()) as { token: string }
  const auth = { "X-Anon-Token": session.token, "content-type": "application/json" }
  const text =
    "HearMeOut deployment check. This short paragraph is turned into audio to prove that the whole pipeline works from end to end. " +
    "If you can hear this sentence, text extraction, speech synthesis, storage and delivery are all healthy."
  const draftRes = await fetch(`${API}/v1/drafts/text`, { method: "POST", headers: auth, body: JSON.stringify({ text, title: "Deploy check" }) })
  if (!draftRes.ok) return fail(`Creating a draft failed (${draftRes.status}): ${(await draftRes.text()).slice(0, 200)}`)
  const draft = (await draftRes.json()) as { id: string }
  const docRes = await fetch(`${API}/v1/docs`, { method: "POST", headers: auth, body: JSON.stringify({ draft_id: draft.id, mode: "read" }) })
  if (!docRes.ok) return fail(`Creating a document failed (${docRes.status}): ${(await docRes.text()).slice(0, 200)}`)
  const doc = (await docRes.json()) as { id: string }
  const [audio, ms] = await timed(() => fetch(`${API}/v1/docs/${doc.id}/chunks/0/audio`, { headers: auth }))
  const bytes = audio.ok ? (await audio.arrayBuffer()).byteLength : 0
  check(
    audio.ok && (audio.headers.get("content-type") ?? "").includes("audio") && bytes > 2000,
    `Guest listening works: ${Math.round(bytes / 1024)} KB of audio in ${ms} ms`,
    `Audio failed (${audio.status}). Is Edge TTS reachable from the host? ${audio.ok ? "" : (await audio.text()).slice(0, 200)}`,
  )
  await fetch(`${API}/v1/docs/${doc.id}`, { method: "DELETE", headers: auth }).catch(() => undefined)

  // 5. Web app + SEO files
  for (const path of ["/", "/pricing", "/robots.txt", "/sitemap.xml", "/llms.txt", "/manifest.webmanifest", "/use-cases", "/voices"]) {
    const res = await fetch(`${WEB}${path}`, { redirect: "follow" })
    check(res.ok, `GET ${path} → ${res.status}`, `GET ${path} → ${res.status}`)
  }
  const sitemap = await (await fetch(`${WEB}/sitemap.xml`)).text()
  check(!sitemap.includes("localhost"), "Sitemap uses your real domain", "Sitemap contains localhost: set NEXT_PUBLIC_SITE_URL on the web host and redeploy")
  const home = await fetch(WEB!)
  check(Boolean(home.headers.get("strict-transport-security")), "Security headers present", "Security headers missing")
  const html = await home.text()
  check(html.includes('application/ld+json'), "Structured data (JSON-LD) present", "JSON-LD missing from the home page")
  const scripts = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]).slice(0, 40)
  const bundles = await Promise.all(scripts.map((src) => fetch(`${WEB}${src}`).then((r) => r.text()).catch(() => "")))
  check(
    bundles.some((js) => js.includes(API!)),
    "Web build is wired to this API (NEXT_PUBLIC_API_URL)",
    `The web build does not contain ${API}: set NEXT_PUBLIC_API_URL on the web host and redeploy (it is baked in at build time)`,
  )
  if (html.includes("pk_test_")) warn("Web is using Clerk development keys (pk_test_)")
  else pass("Clerk production key in use")
}

await main()
console.log(`\n${failures ? `\x1b[31m${failures} check(s) failed\x1b[0m` : "\x1b[32mAll checks passed\x1b[0m"}${warnings ? `, ${warnings} warning(s)` : ""}\n`)
process.exit(failures ? 1 : 0)
