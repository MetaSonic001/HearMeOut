"use client"

import { useAuth } from "@clerk/nextjs"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { ApiClient } from "@/lib/api/client"
import type { AppConfig, Me } from "@/lib/api/types"
import { API_URL } from "@/lib/config"
import { debug, warn } from "@/lib/debug"
import { KEYS, readStorage, removeStorage } from "@/lib/storage"

interface SessionValue {
  api: ApiClient
  me: Me | null
  config: AppConfig | null
  /** True once Clerk has loaded and we know who the visitor is. */
  ready: boolean
  /** True when the public configuration could not be loaded after several tries. */
  configError: boolean
  reloadConfig: () => void
  isSignedIn: boolean
  refreshMe: () => Promise<Me | null>
}

const SessionContext = createContext<SessionValue | null>(null)

/** The API may be waking up or restarting, so retry with a growing delay instead of giving up silently. */
async function fetchConfigWithRetry(api: ApiClient): Promise<AppConfig | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const next = await api.request<AppConfig>("/v1/config")
      debug("session", "config loaded", { languages: next.languages.length, llm: next.llm, ocr: next.ocr })
      return next
    } catch (err) {
      warn("session", `config request failed (attempt ${attempt + 1}/6)`, err)
      await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 8000)))
    }
  }
  return null
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error("useSession must be used inside <SessionProvider>")
  return value
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth()
  const [api] = useState(() => new ApiClient(async () => null))
  const [me, setMe] = useState<Me | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [ready, setReady] = useState(false)
  const [configError, setConfigError] = useState(false)

  const refreshMe = useCallback(async () => {
    try {
      const next = await api.request<Me>("/v1/me")
      setMe(next)
      return next
    } catch {
      return null
    }
  }, [api])

  // keep the client's token getter pointing at Clerk (declared first so it runs before any request below)
  useEffect(() => {
    api.setTokenGetter(async () => (await getToken()) ?? null)
  }, [api, getToken])

  const applyConfig = useCallback((next: AppConfig | null) => {
    if (next) setConfig(next)
    setConfigError(next === null)
  }, [])

  // Wake the API (free hosting sleeps when idle) and load the public configuration, retrying while it wakes up.
  useEffect(() => {
    let cancelled = false
    void fetch(`${API_URL}/healthz`).catch(() => undefined)
    void fetchConfigWithRetry(api).then((next) => !cancelled && applyConfig(next))
    return () => {
      cancelled = true
    }
  }, [api, applyConfig])

  // Identify the visitor; after sign-in, move this browser's guest documents into the account.
  useEffect(() => {
    if (!isLoaded) return
    let cancelled = false
    void (async () => {
      if (isSignedIn && readStorage(KEYS.anonToken)) {
        try {
          await api.request("/v1/claim", { method: "POST" })
          removeStorage(KEYS.anonToken)
        } catch {
          /* claiming is best effort; documents stay reachable through the guest token */
        }
      }
      await refreshMe()
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [api, isLoaded, isSignedIn, userId, refreshMe])

  const value = useMemo<SessionValue>(
    () => ({ api, me, config, ready, configError, reloadConfig: () => {
        setConfigError(false)
        void fetchConfigWithRetry(api).then(applyConfig)
      }, isSignedIn: Boolean(isSignedIn), refreshMe }),
    [api, me, config, ready, configError, applyConfig, isSignedIn, refreshMe],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
