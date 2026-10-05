import type { MetadataRoute } from "next"

import { COMPARE_PAGES } from "@/lib/content/compare"
import { LANGUAGE_PAGES } from "@/lib/content/languages"
import { USE_CASES } from "@/lib/content/use-cases"
import { absoluteUrl } from "@/lib/config"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const entry = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly" = "monthly") => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  })
  return [
    entry("/", 1, "weekly"),
    entry("/how-it-works", 0.8),
    entry("/pricing", 0.9),
    entry("/faq", 0.7),
    entry("/use-cases", 0.8),
    ...USE_CASES.map((u) => entry(`/use-cases/${u.slug}`, 0.8)),
    entry("/voices", 0.7),
    ...LANGUAGE_PAGES.map((l) => entry(`/voices/${l.slug}`, l.indian ? 0.8 : 0.6)),
    entry("/compare", 0.6),
    ...COMPARE_PAGES.map((c) => entry(`/compare/${c.slug}`, 0.6)),
    entry("/privacy", 0.3, "yearly"),
    entry("/terms", 0.3, "yearly"),
    entry("/copyright", 0.3, "yearly"),
  ]
}
