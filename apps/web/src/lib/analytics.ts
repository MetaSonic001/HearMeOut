"use client"

import { KEYS, readStorage, writeStorage } from "@/lib/storage"

type Meta = Record<string, string | number | boolean | null>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

export type Consent = "granted" | "denied" | null

export function getConsent(): Consent {
  const value = readStorage(KEYS.consent)
  return value === "granted" || value === "denied" ? value : null
}

export function setConsent(value: "granted" | "denied") {
  writeStorage(KEYS.consent, value)
  if (typeof window !== "undefined") {
    window.gtag?.("consent", "update", {
      analytics_storage: value,
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
    window.dispatchEvent(new Event("hmo-consent"))
  }
}

/** A random id that lives only in this browser; used to count unique visitors. */
export function visitorId(): string {
  let id = readStorage(KEYS.visitorId)
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "").slice(0, 20)
    writeStorage(KEYS.visitorId, id)
  }
  return id
}

export function track(name: string, meta: Meta = {}, path?: string) {
  if (typeof window === "undefined") return
  const payload = {
    name,
    path: path ?? window.location.pathname,
    referrer: document.referrer || undefined,
    anon_id: visitorId(),
    meta,
  }
  try {
    const body = JSON.stringify(payload)
    if (!navigator.sendBeacon?.("/api/collect", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/collect", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true })
    }
  } catch {
    /* analytics must never break the app */
  }
  window.gtag?.("event", name, meta)
}
