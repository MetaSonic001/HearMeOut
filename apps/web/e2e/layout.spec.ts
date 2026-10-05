import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const PAGES = ["/", "/pricing", "/use-cases/pdf-to-audiobook", "/voices/hindi", "/faq", "/compare/notebooklm", "/library"]

test.describe("responsive layout", () => {
  for (const path of PAGES) {
    test(`${path} has no horizontal scroll`, async ({ page }, info) => {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(1)
      await page.screenshot({ path: `e2e/screenshots/${info.project.name}${path.replace(/\//g, "-") || "-home"}.png`, fullPage: true })
    })
  }
})

test.describe("accessibility (axe, WCAG 2.1 AA)", () => {
  test.skip(({ isMobile }) => isMobile, "desktop pass is enough for axe")
  for (const path of PAGES) {
    test(`${path} has no serious violations`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState("networkidle")
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
      expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([])
    })
  }
})
