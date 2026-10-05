import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { API_INTERNAL_URL } from "@/lib/config"

export const runtime = "nodejs"

const Body = z.object({
  name: z.string().min(1).max(48).regex(/^[a-z0-9_]+$/),
  path: z.string().max(300).optional(),
  referrer: z.string().max(300).optional(),
  anon_id: z.string().max(40).optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
})

function deviceFrom(userAgent: string): string {
  if (!userAgent) return "unknown"
  if (/bot|crawler|spider|crawling|headless|lighthouse|preview/i.test(userAgent)) return "bot"
  return /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent) ? "mobile" : "desktop"
}

/** Receives browser events, adds country/device hints and forwards them to the API. Never fails loudly. */
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_API_SECRET
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await request.json())
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (!secret) return new NextResponse(null, { status: 202 })

  const forwardedFor = request.headers.get("x-forwarded-for") ?? ""
  try {
    await fetch(`${API_INTERNAL_URL}/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
        "X-Country": request.headers.get("x-vercel-ip-country") ?? "",
        "X-Device": deviceFrom(request.headers.get("user-agent") ?? ""),
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
      },
      body: JSON.stringify(parsed),
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    })
  } catch {
    /* analytics is best effort */
  }
  return new NextResponse(null, { status: 202 })
}
