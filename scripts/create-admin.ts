/**
 * Create (or promote) the HearMeOut owner account in Clerk.
 *
 *   bun run create-admin -- --email you@example.com
 *   bun run create-admin -- --email you@example.com --username my-own-name
 *   bun run create-admin -- --email you@example.com --reset-password
 *
 * The owner account is marked with public metadata { role: "admin" }, which the API and the
 * /admin page treat as unlimited access with no payment wall plus the analytics dashboard.
 * A strong random password is generated and printed ONCE in this terminal. Nothing is written to disk.
 */
import { randomBytes, randomInt } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const CLERK_API = "https://api.clerk.com/v1"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(`--${name}`)

function loadSecret(): string {
  if (process.env.CLERK_SECRET_KEY) return process.env.CLERK_SECRET_KEY
  const file = join(import.meta.dir, "..", ".env")
  if (existsSync(file)) {
    const match = readFileSync(file, "utf8").match(/^CLERK_SECRET_KEY=(.+)$/m)
    if (match) return match[1].trim()
  }
  console.error("CLERK_SECRET_KEY not found. Set it in the root .env or the environment.")
  process.exit(1)
}

function strongPassword(length = 28): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*-_=+?"]
  const all = sets.join("")
  const chars = sets.map((s) => s[randomInt(s.length)])
  while (chars.length < length) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}

const secret = loadSecret()

async function clerk(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  })
  const text = await res.text()
  let body: any = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { ok: res.ok, status: res.status, body }
}

function explain(body: any): string {
  const errors = body?.errors as { message?: string; long_message?: string; code?: string }[] | undefined
  return errors?.map((e) => e.long_message ?? e.message ?? e.code).join("; ") ?? JSON.stringify(body)
}

async function main() {
  const email = arg("email")
  if (!email || !email.includes("@")) {
    console.error("Usage: bun run create-admin -- --email you@example.com [--username name] [--reset-password]")
    process.exit(1)
  }
  const username = arg("username") ?? `owner-${randomBytes(5).toString("hex")}`

  const found = await clerk(`/users?email_address=${encodeURIComponent(email)}`)
  if (!found.ok) {
    console.error(`Could not reach Clerk (${found.status}): ${explain(found.body)}`)
    process.exit(1)
  }
  const existing = Array.isArray(found.body) ? found.body[0] : null

  if (existing) {
    const meta = await clerk(`/users/${existing.id}/metadata`, { method: "PATCH", body: JSON.stringify({ public_metadata: { role: "admin" } }) })
    if (!meta.ok) {
      console.error(`Could not promote the existing user: ${explain(meta.body)}`)
      process.exit(1)
    }
    console.log(`\nUser ${email} (${existing.id}) is now the HearMeOut owner.`)
    if (flag("reset-password")) {
      const password = strongPassword()
      const reset = await clerk(`/users/${existing.id}`, { method: "PATCH", body: JSON.stringify({ password, skip_password_checks: false, sign_out_of_other_sessions: true }) })
      if (!reset.ok) {
        console.error(`Could not reset the password: ${explain(reset.body)}`)
        process.exit(1)
      }
      console.log(`\nNew password (shown once, store it in a password manager):\n  ${password}`)
    } else {
      console.log("Password unchanged. Use --reset-password to generate a new one.")
    }
    return
  }

  const password = strongPassword()
  const base = { email_address: [email], password, public_metadata: { role: "admin" }, skip_legal_checks: true }
  let created = await clerk("/users", { method: "POST", body: JSON.stringify({ ...base, username }) })
  let usedUsername = true
  if (!created.ok && /username/i.test(explain(created.body))) {
    // username sign-in is not enabled for this Clerk instance: fall back to email + password
    usedUsername = false
    created = await clerk("/users", { method: "POST", body: JSON.stringify(base) })
  }
  if (!created.ok) {
    console.error(`Could not create the owner account: ${explain(created.body)}`)
    process.exit(1)
  }

  console.log("\nOwner account created. Save these now: the password is not stored anywhere.\n")
  console.log(`  Sign in with : ${usedUsername ? `${username}  (or ${email})` : email}`)
  console.log(`  Password     : ${password}`)
  console.log(`  Clerk user id: ${created.body.id}`)
  if (!usedUsername) console.log("\n  Tip: to also sign in with a username, enable 'Username' in the Clerk dashboard (User & authentication).")
  console.log("\nSign in at /sign-in. You get unlimited listening with no payment wall, plus /admin analytics.")
}

await main()
