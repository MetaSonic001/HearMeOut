import { API_URL } from "@/lib/config"
import { KEYS, readStorage, removeStorage, writeStorage } from "@/lib/storage"

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export type TokenGetter = () => Promise<string | null>

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  json?: unknown
  form?: FormData
  signal?: AbortSignal
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function toApiError(res: Response): Promise<ApiError> {
  let code = "http_error"
  let message = "Something went wrong. Please try again."
  let details: Record<string, unknown> = {}
  try {
    const body: unknown = await res.json()
    if (isRecord(body) && isRecord(body.error)) {
      code = typeof body.error.code === "string" ? body.error.code : code
      message = typeof body.error.message === "string" ? body.error.message : message
      details = isRecord(body.error.details) ? body.error.details : {}
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, code, message, details)
}

export class ApiClient {
  private sessionPromise: Promise<string> | null = null

  constructor(private getToken: TokenGetter) {}

  setTokenGetter(getter: TokenGetter) {
    this.getToken = getter
  }

  private async ensureAnon(): Promise<string> {
    const existing = readStorage(KEYS.anonToken)
    if (existing) return existing
    this.sessionPromise ??= (async () => {
      const res = await fetch(`${API_URL}/v1/session`, { method: "POST" })
      if (!res.ok) throw await toApiError(res)
      const data: unknown = await res.json()
      if (!isRecord(data) || typeof data.token !== "string") throw new ApiError(500, "bad_session", "Could not start a session.")
      writeStorage(KEYS.anonToken, data.token)
      return data.token
    })().finally(() => {
      this.sessionPromise = null
    })
    return this.sessionPromise
  }

  async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}
    const token = await this.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
    const anon = token ? readStorage(KEYS.anonToken) : await this.ensureAnon()
    if (anon) headers["X-Anon-Token"] = anon
    return headers
  }

  private async send(path: string, opts: RequestOptions, retried = false): Promise<Response> {
    const headers = await this.headers()
    let body: BodyInit | undefined
    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json"
      body = JSON.stringify(opts.json)
    } else if (opts.form) {
      body = opts.form
    }
    let res: Response
    try {
      res = await fetch(`${API_URL}${path}`, { method: opts.method ?? "GET", headers, body, signal: opts.signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error
      throw new ApiError(0, "network", "We could not reach the server. Check your connection and try again.")
    }
    if (!res.ok) {
      const err = await toApiError(res)
      // an expired/invalid guest token: start a fresh guest session once
      if (!retried && err.status === 401 && err.code === "identity_required") {
        removeStorage(KEYS.anonToken)
        return this.send(path, opts, true)
      }
      throw err
    }
    return res
  }

  async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const res = await this.send(path, opts)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  async blob(path: string, signal?: AbortSignal): Promise<{ blob: Blob; durationMs: number | null }> {
    const res = await this.send(path, { signal })
    const header = res.headers.get("x-duration-ms")
    return { blob: await res.blob(), durationMs: header ? Number(header) : null }
  }
}
