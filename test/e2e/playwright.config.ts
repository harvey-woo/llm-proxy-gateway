import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for LLM Proxy Gateway
 *
 * Usage:
 *   yarn e2e                                      # Run all tests
 *   yarn e2e --grep TC-001                        # Run specific test
 *   yarn e2e --ui                                 # Run with UI
 *
 * The tests target the frontend dev server at http://localhost:5173
 * and use the real backend API at http://localhost:9000.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, // E2E tests share state, run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html"]] : "list",

  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command:
        "cd ../.. && yarn workspace @llm-proxy/frontend exec -- vite --host --port 5173",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stderr: "pipe",
      stdout: "pipe",
    },
    {
      command:
        "cd ../.. && TEMPLATE_URL=http://localhost:9998/templates.sample.json PORT=8080 yarn workspace @llm-proxy/backend exec -- tsx src/index.ts",
      url: "http://localhost:8080/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stderr: "pipe",
      stdout: "pipe",
    },
    {
      command:
        "cd ../../config && python3 -m http.server 9998",
      url: "http://localhost:9998/templates.sample.json",
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
      stderr: "pipe",
      stdout: "pipe",
    },
  ],
});
