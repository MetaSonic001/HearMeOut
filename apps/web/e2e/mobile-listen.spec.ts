import { expect, test } from "@playwright/test"

test("player is usable on a phone", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Try a sample" }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page).toHaveURL(/\/new\/drf_/, { timeout: 30_000 })
  await page.getByRole("button", { name: /Create audio/ }).click()
  await expect(page).toHaveURL(/\/listen\/doc_/, { timeout: 30_000 })
  await page.getByRole("button", { name: /Start listening/ }).click()
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 30_000 })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  // every control stays inside the screen
  for (const name of ["Pause", "Back 15 seconds", "Forward 15 seconds", "Chapters", "Show source"]) {
    const box = await page.getByRole("button", { name }).first().boundingBox()
    expect(box, name).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1)
  }
  await page.screenshot({ path: "e2e/screenshots/mobile-listen.png" })
})
