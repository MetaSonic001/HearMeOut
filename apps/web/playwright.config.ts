import { defineConfig, devices } from "@playwright/test"

const WEB = "http://localhost:3000"
const API = "http://localhost:8000"

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(smoke|layout|mobile-listen)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: "uv run --directory ../api --no-sync python -m uvicorn app.main:create_app --factory --port 8000",
      url: `${API}/healthz`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "bun run dev",
      url: WEB,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
