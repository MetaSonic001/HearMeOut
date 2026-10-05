/** Dev-only diagnostics in the browser console. Silent in production builds. */
const enabled = process.env.NODE_ENV !== "production"

export function debug(scope: string, message: string, data?: unknown): void {
  if (enabled) console.debug(`%c[hearmeout:${scope}]`, "color:#0d9488;font-weight:600", message, data ?? "")
}

/** Problems worth seeing in every environment (kept terse; never includes personal data). */
export function warn(scope: string, message: string, data?: unknown): void {
  console.warn(`[hearmeout:${scope}] ${message}`, data ?? "")
}
