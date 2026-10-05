import { expect, test } from "@playwright/test"

const IGNORED_CONSOLE = [/Clerk has been loaded with development keys/i, /\[Vercel/i, /Download the React DevTools/i, /\[HMR\]/i, /Failed to load resource.*_vercel/i]

test.describe("public site", () => {
  test("landing page renders with SEO essentials and no console errors", async ({ page }) => {
    const problems: string[] = []
    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type()) && !IGNORED_CONSOLE.some((re) => re.test(msg.text()))) problems.push(`${msg.type()}: ${msg.text()}`)
    })
    page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`))

    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Listen to anything")
    await expect(page).toHaveTitle(/HearMeOut/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /audio/i)
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1)
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents()
    const types = ld.flatMap((t) => (JSON.parse(t) as unknown[] | Record<string, unknown>)).flat().map((o) => (o as { "@type": string })["@type"])
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "SoftwareApplication", "FAQPage"]))
    await page.waitForTimeout(1500)
    expect(problems).toEqual([])
  })

  test("SEO and AI-discovery files are served", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text()
    expect(robots).toContain("Sitemap:")
    expect(robots).toMatch(/User-Agent: GPTBot[\s\S]*?Allow: \//i)
    expect(robots).toMatch(/Disallow: \/admin/)

    const sitemap = await request.get("/sitemap.xml")
    expect(sitemap.status()).toBe(200)
    const xml = await sitemap.text()
    expect(xml).toContain("/use-cases/pdf-to-audiobook")
    expect(xml).toContain("/voices/hindi")
    expect(xml).not.toContain("/admin")

    const llms = await request.get("/llms.txt")
    expect(llms.headers()["content-type"]).toContain("text/plain")
    expect((await llms.text()).startsWith("# HearMeOut")).toBe(true)
    expect((await (await request.get("/llms-full.txt")).text())).toContain("₹99")

    const manifest = await request.get("/manifest.webmanifest")
    expect((await manifest.json()).name).toBe("HearMeOut")
    expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png")
  })

  for (const path of ["/use-cases/pdf-to-audiobook", "/use-cases/upsc-notes-to-audio", "/voices/hindi", "/compare/speechify", "/pricing", "/faq", "/how-it-works", "/privacy", "/terms", "/copyright", "/use-cases", "/voices", "/compare"]) {
    test(`${path} has one h1, a unique title and a canonical link`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
      const title = await page.title()
      expect(title.length).toBeGreaterThan(10)
      expect(title.length).toBeLessThanOrEqual(90)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path}$`))
    })
  }

  test("unknown pages show a helpful 404", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page")
    expect(res?.status()).toBe(404)
    await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible()
  })

  test("private areas are not indexable and admin is closed to guests", async ({ page }) => {
    await page.goto("/library")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
    await page.goto("/admin")
    await page.waitForURL(/sign-in|accounts\.dev/, { timeout: 30_000 })
  })
})
