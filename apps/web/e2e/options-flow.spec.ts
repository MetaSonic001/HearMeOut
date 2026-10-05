import path from "node:path"

import { expect, test, type Page } from "@playwright/test"

const API = process.env.E2E_API_URL ?? "http://localhost:8000"

async function toOptions(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Try a sample" }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page).toHaveURL(/\/new\/drf_/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "How do you want to listen?" })).toBeVisible()
}

async function apiConfig(page: Page): Promise<{ llm: boolean; ocr: boolean }> {
  return page.request.get(`${API}/v1/config`).then((r) => r.json())
}

test.describe("options page never leaves the person guessing", () => {
  test("Create audio still works when the configuration request fails", async ({ page }) => {
    // the bug: language and voice defaults came only from /v1/config, so one failed request disabled Create for good
    await page.route("**/v1/config", (route) => route.abort())
    await toOptions(page)
    const create = page.getByRole("button", { name: /Create audio/ })
    await expect(create).toBeEnabled({ timeout: 20_000 }) // voices come from /v1/voices instead
    await create.click()
    await expect(page).toHaveURL(/\/listen\/doc_/, { timeout: 30_000 })
  })

  test("a disabled Create button always shows why", async ({ page }) => {
    await toOptions(page)
    const create = page.getByRole("button", { name: /Create audio/ })
    await expect(create).toBeEnabled({ timeout: 20_000 })
    await page.getByRole("checkbox", { name: /^Include / }).first().click() // untick the only section
    await expect(create).toBeDisabled()
    await expect(page.locator("#create-status")).toContainText("Tick at least one section")
    await page.getByRole("checkbox", { name: /^Include / }).first().click()
    await expect(create).toBeEnabled()
    await expect(page.locator("#create-status")).not.toContainText("Tick at least one section")
  })

  test("editing a section keeps Create available", async ({ page }) => {
    await toOptions(page)
    await page.getByRole("button", { name: /^Edit / }).first().click()
    await page.getByLabel("Section text").fill("A short edited section. It has a few sentences so that it can be read aloud properly. Here is the last one.")
    await page.getByRole("button", { name: /Save/ }).click()
    await expect(page.getByText("Section updated")).toBeVisible()
    await expect(page.getByRole("button", { name: /Create audio/ })).toBeEnabled()
  })

  test("voices are grouped by accent and every voice of the language is offered", async ({ page }) => {
    await toOptions(page)
    await expect(page.getByText(/\d+ voices/)).toBeVisible({ timeout: 20_000 })
    await page.getByRole("combobox", { name: "Voice" }).click()
    await expect(page.getByRole("option", { name: /Emma · Female · US/ })).toBeVisible()
    await expect(page.getByText("India", { exact: true })).toBeVisible()
    await expect(page.getByText("UK", { exact: true })).toBeVisible()
  })
})

test.describe("translate and listen", () => {
  test("an English document can be translated into Hindi and heard in a Hindi voice", async ({ page }) => {
    test.skip(!(await apiConfig(page)).llm, "needs the AI service (GROQ_API_KEY)")
    test.setTimeout(120_000)
    await toOptions(page)
    await page.getByRole("radio", { name: /Translate and listen/ }).check({ force: true })
    await expect(page.getByLabel("Translate into", { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/translated into Hindi/)).toBeVisible() // a sensible default target
    await expect(page.getByRole("combobox", { name: "Voice" })).toContainText(/Swara|Madhur/)
    const create = page.getByRole("button", { name: /Create audio/ })
    await expect(create).toBeEnabled({ timeout: 20_000 })
    await create.click()
    await expect(page).toHaveURL(/\/listen\/doc_/, { timeout: 60_000 })
    // the transcript is in Devanagari: it really was translated
    await expect(page.getByText(/[ऀ-ॿ]{4,}/).first()).toBeVisible({ timeout: 90_000 })
  })
})

test.describe("scanned PDFs (OCR)", () => {
  test("a scanned PDF is read, shows progress, then continues like any document", async ({ page }) => {
    test.skip(!(await apiConfig(page)).ocr, "OCR is not installed on the API")
    test.setTimeout(180_000)
    await page.goto("/")
    await page.getByRole("tab", { name: /Upload file/ }).click()
    await expect(page.getByText("Scanned PDF?")).toBeVisible({ timeout: 20_000 })
    await page.getByLabel("Upload a document").setInputFiles(path.join(__dirname, "fixtures", "scanned-notes.pdf"))
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page).toHaveURL(/\/new\/drf_/, { timeout: 30_000 })

    // either we catch the progress screen, or the scan was quick; both must end on the options page
    await expect(page.getByRole("heading", { name: /Reading your scanned pages|How do you want to listen/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: "How do you want to listen?" })).toBeVisible({ timeout: 150_000 })
    await expect(page.getByText(/Scanned pages were read with OCR/)).toBeVisible()

    await page.getByRole("button", { name: /Create audio/ }).click()
    await expect(page).toHaveURL(/\/listen\/doc_/, { timeout: 30_000 })
    await expect(page.getByText(/quantum/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test("the progress screen is shown while a scan is being read", async ({ page }) => {
    test.skip(!(await apiConfig(page)).ocr, "OCR is not installed on the API")
    // make the first poll look like a scan in progress, without waiting for real OCR
    await page.route("**/v1/drafts/drf_*", async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      await route.fulfill({
        response,
        json: { ...body, status: "ocr", sections: [], ocr: { stage: "reading", done: 3, total: 12, script: "latin", seconds: 9 } },
      })
    })
    await page.goto("/")
    await page.getByRole("button", { name: "Try a sample" }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByRole("heading", { name: "Reading your scanned pages" })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("Page 4 of 12")).toBeVisible()
    await expect(page.getByText(/seconds left|min left/)).toBeVisible()
  })
})

test.describe("accessibility and layout of the new screens", () => {
  async function serious(page: Page) {
    const { default: AxeBuilder } = await import("@axe-core/playwright")
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
    return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)
  }

  test("options page (translate mode with voice list) has no serious violations and does not scroll sideways", async ({ page }) => {
    await toOptions(page)
    await expect(page.getByText(/\d+ voices/)).toBeVisible({ timeout: 20_000 })
    if ((await apiConfig(page)).llm) await page.getByRole("radio", { name: /Translate and listen/ }).check({ force: true })
    expect(await serious(page)).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test("scan progress screen has no serious violations and does not scroll sideways", async ({ page }) => {
    await page.route("**/v1/drafts/drf_*", async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      await route.fulfill({ response, json: { ...body, status: "ocr", sections: [], ocr: { stage: "reading", done: 5, total: 20, script: "latin", seconds: 12 } } })
    })
    await page.goto("/")
    await page.getByRole("button", { name: "Try a sample" }).click()
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.getByRole("heading", { name: "Reading your scanned pages" })).toBeVisible({ timeout: 30_000 })
    expect(await serious(page)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  })
})
