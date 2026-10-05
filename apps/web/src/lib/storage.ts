/** localStorage wrappers that never throw (private mode, blocked storage, SSR). */
export function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value)
  } catch {
    /* storage unavailable: the app keeps working without persistence */
  }
}

export function removeStorage(key: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  anonToken: "hmo_anon",
  visitorId: "hmo_vid",
  consent: "hmo_consent",
  speed: "hmo_speed",
  lastDoc: "hmo_last_doc",
} as const
