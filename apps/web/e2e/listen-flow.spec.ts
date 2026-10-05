import { expect, test, type Page } from "@playwright/test"

async function createFromSample(page: Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Try a sample" }).click()
  await expect(page.getByLabel("Text to listen to")).not.toHaveValue("")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page).toHaveURL(/\/new\/drf_/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "How do you want to listen?" })).toBeVisible()
}

test.describe("guest listening flow (real API, real voices)", () => {
  test("paste sample, create audio and hear it play", async ({ page }) => {
    await createFromSample(page)
    await expect(page.getByText("Detected language: English")).toBeVisible()
    await page.screenshot({ path: "e2e/screenshots/options.png", fullPage: true })

    await page.getByRole("button", { name: /Create audio/ }).click()
    await expect(page).toHaveURL(/\/listen\/doc_/, { timeout: 30_000 })
    await expect(page.getByRole("button", { name: /Start listening/ })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText("How memory works").first()).toBeVisible()
    await page.getByRole("button", { name: /Start listening/ }).click()

    const clock = page.locator(".tabular-nums").first()
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => (await clock.textContent()) ?? "0:00", { timeout: 20_000 }).not.toBe("0:00")
    const first = await clock.textContent()
    await page.waitForTimeout(2500)
    const second = await clock.textContent()
    expect(second).not.toBe(first) // the audio clock advances: real audio is playing

    await expect(page.locator('[aria-current="true"]')).toBeVisible()
    await page.screenshot({ path: "e2e/screenshots/listen.png" })

    // controls
    await page.getByRole("button", { name: "Pause" }).click()
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
    await page.getByRole("button", { name: /Speed/ }).click()
    await page.getByRole("menuitem", { name: "1.5x" }).click()
    await expect(page.getByRole("button", { name: "Speed 1.5x" })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Chapters" }).click()
    await expect(page.getByRole("heading", { name: "Chapters" })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Show source" }).click()
    await expect(page.getByRole("heading", { name: "Where this comes from" })).toBeVisible()
  })

  test("the document appears in the library and can be deleted", async ({ page }) => {
    await createFromSample(page)
    await page.getByRole("button", { name: /Create audio/ }).click()
    await expect(page).toHaveURL(/\/listen\/doc_/, { timeout: 30_000 })
    await page.goto("/library")
    await expect(page.getByRole("heading", { name: "My library" })).toBeVisible()
    await expect(page.getByText("Guest audio is kept for 24 hours")).toBeVisible()
    const card = page.getByRole("listitem").filter({ hasText: "Read it to me" }).first()
    await expect(card).toBeVisible({ timeout: 20_000 })
    await card.getByRole("button", { name: /Delete/ }).click()
    await page.getByRole("button", { name: "Delete", exact: true }).click()
    await expect(page.getByText("Nothing here yet")).toBeVisible({ timeout: 20_000 })
  })

  test("study mode prepares chapters in the background and plays", async ({ page }) => {
    await createFromSample(page)
    await page.getByText("Study version").click()
    await page.getByRole("button", { name: /Create audio/ }).click()
    await expect(page).toHaveURL(/\/listen\/doc_/, { timeout: 30_000 })
    await expect(page.getByRole("button", { name: /Start listening/ })).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText("Study version").first()).toBeVisible()
  })

  test("pasting a file upload works end to end", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("tab", { name: /Upload file/ }).click()
    const text = Buffer.from("# Notes\n\n" + "The mitochondria is the powerhouse of the cell. ".repeat(40))
    await page.setInputFiles('input[type="file"]', { name: "notes.txt", mimeType: "text/plain", buffer: text })
    await expect(page.getByText("notes.txt")).toBeVisible()
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page).toHaveURL(/\/new\/drf_/, { timeout: 30_000 })
    await expect(page.getByText("Listening time")).toBeVisible()
  })

  test("a bad link is explained in plain language", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("tab", { name: /Web link/ }).click()
    await page.getByLabel("Web address").fill("http://127.0.0.1:9/secret")
    await page.getByRole("button", { name: "Continue" }).click()
    await expect(page.locator('p[role="alert"]')).toContainText(/port we cannot open|public website|find that website/i)
  })
})
