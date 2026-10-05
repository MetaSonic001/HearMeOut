import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiClient, ApiError } from "@/lib/api/client"
import { KEYS } from "@/lib/storage"

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

describe("ApiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    window.localStorage.clear()
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it("starts a guest session on first use and reuses it", async () => {
    fetchMock.mockImplementation(async (url: string) => (url.endsWith("/v1/session") ? json({ token: "anon-1", anon_id: "a" }) : json({ ok: true })))
    const api = new ApiClient(async () => null)
    await api.request("/v1/me")
    await api.request("/v1/me")
    const sessionCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/v1/session"))
    expect(sessionCalls).toHaveLength(1)
    const meCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/me"))!
    expect((meCall[1] as RequestInit).headers).toMatchObject({ "X-Anon-Token": "anon-1" })
    expect(window.localStorage.getItem(KEYS.anonToken)).toBe("anon-1")
  })

  it("sends the Clerk token and does not create a guest session when signed in", async () => {
    fetchMock.mockResolvedValue(json({ ok: true }))
    const api = new ApiClient(async () => "clerk-jwt")
    await api.request("/v1/me")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: "Bearer clerk-jwt" })
  })

  it("turns API errors into ApiError with code, message and details", async () => {
    window.localStorage.setItem(KEYS.anonToken, "anon-1")
    fetchMock.mockResolvedValue(json({ error: { code: "quota_exceeded", message: "Limit reached.", details: { options: ["signup"] } } }, 402))
    const api = new ApiClient(async () => null)
    const error = await api.request("/v1/x").catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 402, code: "quota_exceeded", message: "Limit reached.", details: { options: ["signup"] } })
  })

  it("recovers from an expired guest token by starting a new session once", async () => {
    window.localStorage.setItem(KEYS.anonToken, "stale")
    let calls = 0
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/v1/session")) return json({ token: "fresh", anon_id: "b" })
      calls++
      return calls === 1 ? json({ error: { code: "identity_required", message: "x" } }, 401) : json({ ok: true })
    })
    const api = new ApiClient(async () => null)
    await expect(api.request("/v1/me")).resolves.toEqual({ ok: true })
    expect(window.localStorage.getItem(KEYS.anonToken)).toBe("fresh")
  })

  it("reports network failures in plain language", async () => {
    window.localStorage.setItem(KEYS.anonToken, "anon-1")
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    const api = new ApiClient(async () => null)
    await expect(api.request("/v1/me")).rejects.toMatchObject({ code: "network", status: 0 })
  })

  it("returns audio blobs with their duration", async () => {
    window.localStorage.setItem(KEYS.anonToken, "anon-1")
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "x-duration-ms": "1234" } }))
    const api = new ApiClient(async () => null)
    const { blob, durationMs } = await api.blob("/v1/docs/d/chunks/0/audio")
    expect(durationMs).toBe(1234)
    expect(blob.size).toBe(3)
  })
})
