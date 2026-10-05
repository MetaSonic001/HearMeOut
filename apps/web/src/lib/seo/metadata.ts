import type { Metadata } from "next"

import { SITE, absoluteUrl } from "@/lib/config"

interface PageMeta {
  title: string
  description: string
  path: string
  noindex?: boolean
  type?: "website" | "article"
  keywords?: string[]
}

/** One place that builds consistent titles, canonical URLs and social cards. */
export function pageMetadata({ title, description, path, noindex, type = "website", keywords }: PageMeta): Metadata {
  const url = absoluteUrl(path)
  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE.name, type, locale: SITE.locale },
    twitter: { card: "summary_large_image", title, description },
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
  }
}

export const NOINDEX: Metadata = { robots: { index: false, follow: false } }
