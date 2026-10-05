import { describe, expect, it } from "vitest"

import robots from "@/app/robots"
import sitemap from "@/app/sitemap"
import { COMPARE_PAGES } from "@/lib/content/compare"
import { FAQ, MODES } from "@/lib/content/core"
import { LANGUAGE_PAGES } from "@/lib/content/languages"
import { USE_CASES, USE_CASE_BY_SLUG } from "@/lib/content/use-cases"
import { breadcrumbLd, faqLd, howToLd } from "@/lib/seo/json-ld"
import { buildLlmsFull, buildLlmsTxt } from "@/lib/seo/llms"

describe("use-case pages", () => {
  it("have unique slugs and valid related links", () => {
    const slugs = USE_CASES.map((u) => u.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const u of USE_CASES) for (const r of u.related) expect(USE_CASE_BY_SLUG[r], `${u.slug} -> ${r}`).toBeDefined()
  })
  it("have search-friendly titles and descriptions", () => {
    for (const u of USE_CASES) {
      expect(u.metaTitle.length, u.slug).toBeLessThanOrEqual(65)
      expect(u.description.length, u.slug).toBeGreaterThanOrEqual(80)
      expect(u.description.length, u.slug).toBeLessThanOrEqual(220)
      expect(u.steps).toHaveLength(3)
      expect(u.faqs.length).toBeGreaterThan(0)
    }
  })
  it("recommend a mode that exists", () => {
    const ids = MODES.map((m) => m.id)
    for (const u of USE_CASES) expect(ids).toContain(u.mode)
  })
})

describe("language and comparison pages", () => {
  it("languages have unique slugs, codes and at least one voice", () => {
    expect(new Set(LANGUAGE_PAGES.map((l) => l.slug)).size).toBe(LANGUAGE_PAGES.length)
    expect(new Set(LANGUAGE_PAGES.map((l) => l.code)).size).toBe(LANGUAGE_PAGES.length)
    for (const l of LANGUAGE_PAGES) expect(l.voices.length, l.slug).toBeGreaterThan(0)
  })
  it("covers the Indian languages that matter", () => {
    const slugs = LANGUAGE_PAGES.map((l) => l.slug)
    for (const s of ["hindi", "hinglish", "marathi", "tamil", "telugu", "bengali", "gujarati", "kannada", "malayalam"]) expect(slugs).toContain(s)
  })
  it("comparison pages are complete and carry a disclaimer-worthy 'them' column", () => {
    for (const c of COMPARE_PAGES) {
      expect(c.rows.length, c.slug).toBeGreaterThanOrEqual(4)
      expect(c.chooseThemIf.length).toBeGreaterThan(0)
      expect(c.chooseUsIf.length).toBeGreaterThan(0)
    }
  })
  it("faq has substantive answers", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(8)
    for (const f of FAQ) expect(f.a.length).toBeGreaterThan(60)
  })
})

describe("sitemap and robots", () => {
  it("lists every public page exactly once and no private ones", () => {
    const urls = sitemap().map((s) => s.url)
    expect(new Set(urls).size).toBe(urls.length)
    for (const u of USE_CASES) expect(urls.some((x) => x.endsWith(`/use-cases/${u.slug}`))).toBe(true)
    for (const l of LANGUAGE_PAGES) expect(urls.some((x) => x.endsWith(`/voices/${l.slug}`))).toBe(true)
    for (const c of COMPARE_PAGES) expect(urls.some((x) => x.endsWith(`/compare/${c.slug}`))).toBe(true)
    for (const priv of ["/admin", "/listen", "/library", "/account", "/new", "/api"]) expect(urls.some((x) => x.includes(priv))).toBe(false)
  })
  it("welcomes AI crawlers but keeps private areas out", () => {
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules]
    const agents = rules.map((x) => x.userAgent)
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) expect(agents).toContain(bot)
    for (const rule of rules) {
      expect(rule.allow).toBe("/")
      expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/listen/", "/api/"]))
    }
    expect(r.sitemap).toMatch(/sitemap\.xml$/)
  })
})

describe("llms.txt", () => {
  it("follows the llms.txt shape and links every section of the site", () => {
    const txt = buildLlmsTxt()
    expect(txt.startsWith("# HearMeOut")).toBe(true)
    expect(txt).toContain("\n> ")
    for (const u of USE_CASES) expect(txt).toContain(`/use-cases/${u.slug}`)
    expect(txt).toContain("₹99")
    expect(txt).toContain("llms-full.txt")
  })
  it("full version includes prices, FAQ answers and modes", () => {
    const full = buildLlmsFull()
    for (const m of MODES) expect(full).toContain(m.label)
    expect(full).toContain(FAQ[0].a)
    expect(full).toContain("₹149")
  })
})

describe("structured data builders", () => {
  it("faq", () => {
    const ld = faqLd([{ q: "Q?", a: "A." }]) as { mainEntity: { name: string }[] }
    expect(ld.mainEntity[0].name).toBe("Q?")
  })
  it("breadcrumb positions start at 1", () => {
    const ld = breadcrumbLd([{ name: "Home", path: "/" }, { name: "X", path: "/x" }]) as { itemListElement: { position: number }[] }
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2])
  })
  it("howto", () => {
    const ld = howToLd("Do it", [{ name: "a", text: "b" }]) as { step: unknown[] }
    expect(ld.step).toHaveLength(1)
  })
})
