export const SITE = {
  name: "HearMeOut",
  tagline: "Listen to anything. Learn faster.",
  description:
    "Turn any PDF, notes, article or book into audio you can actually learn from. Pick a voice and language, get a study version, a quick revision or a quiz, and start listening in seconds. Free, no sign-up needed.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@hearmeout.app",
  locale: "en_IN",
} as const

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")

/** Server-side API base (can be a private URL; falls back to the public one). */
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? API_URL).replace(/\/$/, "")

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? ""
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? ""

export function absoluteUrl(path = "/"): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`
}
