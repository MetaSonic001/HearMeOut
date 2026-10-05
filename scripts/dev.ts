/**
 * One command to run HearMeOut locally:  bun run dev
 *
 *  - checks the root .env and the ports
 *  - starts the API (FastAPI) and the web app (Next.js) with prefixed, colored logs
 *  - waits until each one is really ready (API health + database, web page served) and says so
 *  - Ctrl+C stops both
 */
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const API_PORT = Number(process.env.API_PORT ?? 8000)
const WEB_PORT = Number(process.env.WEB_PORT ?? 3000)
const API = `http://localhost:${API_PORT}`
const WEB = `http://localhost:${WEB_PORT}`

const c = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
}
const stamp = () => c.dim(new Date().toTimeString().slice(0, 8))
const say = (tag: string, msg: string) => console.log(`${stamp()} ${c.bold(tag.padEnd(5))} ${msg}`)
const ok = (msg: string) => say("✔", c.green(msg))
const warn = (msg: string) => say("!", c.yellow(msg))
const fail = (msg: string) => say("✘", c.red(msg))

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const file = join(ROOT, ".env")
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

async function portFree(port: number): Promise<boolean> {
  try {
    const server = Bun.listen({ hostname: "127.0.0.1", port, socket: { data() {} } })
    server.stop(true)
    return true
  } catch {
    return false
  }
}

async function waitFor(name: string, check: () => Promise<boolean>, timeoutMs: number, exited: () => boolean): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (exited()) return false
    try {
      if (await check()) return true
    } catch {
      /* not up yet */
    }
    await Bun.sleep(700)
  }
  fail(`${name} did not become ready within ${Math.round(timeoutMs / 1000)}s. Check the log above.`)
  return false
}

// ---------- 1. preflight ----------
console.log()
console.log(c.bold("HearMeOut dev"))
const env = readEnv()
if (!existsSync(join(ROOT, ".env"))) {
  fail("No .env at the project root. Copy .env.example to .env and fill it in.")
  process.exit(1)
}
ok("Loaded .env (one file for API + web)")
const has = (k: string) => Boolean(env[k])
const feature = (label: string, on: boolean, hint: string) =>
  on ? say("", `${c.green("●")} ${label}`) : say("", `${c.yellow("○")} ${label} ${c.dim(`(${hint})`)}`)
feature("Database (Supabase)", has("DATABASE_URL"), "using local SQLite")
feature("Audio storage", env.STORAGE_BACKEND === "supabase" && has("SUPABASE_SECRET_KEY"), "using local disk")
feature("Sign-in (Clerk)", has("CLERK_SECRET_KEY") && has("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"), "guests only")
feature("Smart modes (Groq)", has("GROQ_API_KEY"), "built-in summariser fallback")
feature("Payments (Dodo)", has("DODO_PAYMENTS_API_KEY"), "checkout disabled")
feature("Analytics (GA/GTM)", has("NEXT_PUBLIC_GA_ID") || has("NEXT_PUBLIC_GTM_ID"), "first-party analytics only")

for (const [name, port] of [["API", API_PORT], ["Web", WEB_PORT]] as const) {
  if (!(await portFree(port))) {
    fail(`${name} port ${port} is already in use. Stop the other process or set ${name.toUpperCase()}_PORT.`)
    process.exit(1)
  }
}
ok(`Ports ${API_PORT} and ${WEB_PORT} are free`)

// ---------- 2. start both ----------
const children: { name: string; proc: ReturnType<typeof Bun.spawn> }[] = []
let shuttingDown = false
const exitedFlags: Record<string, boolean> = {}

const NOISE = /"OPTIONS |POST \/v1\/events|POST \/api\/collect|\/manifest\.webmanifest|\/_next\/|\/_vercel\/|GET \/healthz|GET \/readyz|Clerk collects telemetry|The data collected|To learn more, including|scroll-behavior/
const PROBLEM = /(ERROR|CRITICAL|Traceback|Exception|Error:|FAILED|✘)|[45]\d\d (?:in |$)|" [45]\d\d /
const WARNING = /(WARNING|WARN|CONFIG:)|Warning:|⚠/

/** Errors in red, warnings in yellow, routine request noise dimmed so the useful lines stand out. */
function paint(line: string): string {
  if (PROBLEM.test(line)) return c.red(line)
  if (WARNING.test(line)) return c.yellow(line)
  if (NOISE.test(line)) return c.dim(line)
  return line
}

async function pipeLines(stream: ReadableStream<Uint8Array> | null | undefined, tag: string) {
  if (!stream) return
  const decoder = new TextDecoder()
  let buffer = ""
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    for (const line of lines) if (line.trim()) console.log(`${tag} ${paint(line)}`)
  }
  if (buffer.trim()) console.log(`${tag} ${paint(buffer)}`)
}

function start(name: string, color: (s: string) => string, cmd: string[], extraEnv: Record<string, string> = {}) {
  const tag = color(`[${name}]`.padEnd(6))
  const proc = Bun.spawn(cmd, {
    cwd: ROOT,
    env: { ...process.env, ...extraEnv, FORCE_COLOR: "1", PYTHONUNBUFFERED: "1", PYTHONUTF8: "1" },
    stdout: "pipe",
    stderr: "pipe",
  })
  children.push({ name, proc })
  void pipeLines(proc.stdout as ReadableStream<Uint8Array>, tag)
  void pipeLines(proc.stderr as ReadableStream<Uint8Array>, tag)
  void proc.exited.then((code) => {
    exitedFlags[name] = true
    if (!shuttingDown) {
      fail(`${name} stopped unexpectedly (exit code ${code}). Shutting everything down.`)
      void shutdown(1)
    }
  })
}

async function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  say("", c.dim("Stopping API and web…"))
  for (const { proc } of children) {
    try {
      // kill the whole process tree (uvicorn reloader / next dev spawn children)
      Bun.spawnSync(["taskkill", "/pid", String(proc.pid), "/T", "/F"], { stdout: "ignore", stderr: "ignore" })
      proc.kill()
    } catch {
      /* already gone */
    }
  }
  await Bun.sleep(300)
  ok("Stopped.")
  process.exit(code)
}
process.on("SIGINT", () => void shutdown(0))
process.on("SIGTERM", () => void shutdown(0))

say("", c.dim("Starting API and web…"))
start("api", c.cyan, [
  "uv", "run", "--directory", "apps/api", "--no-sync", "python", "-m", "uvicorn",
  "app.main:create_app", "--factory", "--reload", "--port", String(API_PORT),
])
start("web", c.magenta, ["bun", "run", "--cwd", "apps/web", "dev"], { PORT: String(WEB_PORT) })

// ---------- 3. readiness ----------
const apiUp = await waitFor("API", async () => (await fetch(`${API}/healthz`)).ok, 90_000, () => Boolean(exitedFlags.api))
if (apiUp) {
  ok(`API is up         ${c.dim(API)}`)
  try {
    const ready = (await (await fetch(`${API}/readyz`)).json()) as Record<string, unknown>
    if (ready.database === "ok") ok(`Database reachable (storage: ${ready.storage}, voices: ${ready.tts})`)
    else fail(`Database problem: ${String(ready.database)}. Check DATABASE_URL in .env`)
    if (ready.auth) ok("Clerk sign-in configured")
    else warn("Clerk not configured: guests only")
    if (ready.llm) ok("Groq enabled: study, revision, explain and quiz modes use the AI")
    else warn("No GROQ_API_KEY: smart modes use the built-in summariser")
    if (ready.ocr) ok("OCR on: scanned PDFs are read (English, Hindi, Marathi, Tamil, Telugu, Kannada)")
    else warn("OCR is off: scanned PDFs are rejected (install the ocr extra: uv pip install -e \".[ocr]\")")
    if (ready.billing) ok("Dodo payments configured")
    else warn("No DODO_PAYMENTS_API_KEY: checkout is off (everything else works)")
  } catch {
    warn("Could not read /readyz")
  }
}
const webUp = await waitFor("Web", async () => (await fetch(WEB, { redirect: "manual" })).status < 500, 180_000, () => Boolean(exitedFlags.web))
if (webUp) ok(`Web is up         ${c.dim(WEB)}`)

if (apiUp && webUp) {
  console.log()
  console.log(`  ${c.bold("HearMeOut is ready")}`)
  console.log(`  App       ${c.cyan(WEB)}`)
  console.log(`  API       ${c.cyan(API)}   ${c.dim(`docs: ${API}/docs`)}`)
  console.log(`  Owner     ${c.cyan(`${WEB}/admin`)}   ${c.dim("(sign in as the admin created with: bun run create-admin)")}`)
  console.log(`  ${c.dim("Press Ctrl+C to stop both.")}`)
  console.log()
} else {
  fail("Startup incomplete. Scroll up for the error from the failing service.")
  await shutdown(1)
}

await new Promise(() => {}) // keep running until Ctrl+C
