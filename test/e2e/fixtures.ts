import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared fixtures and helpers for LLM Proxy Gateway E2E tests.
 *
 * Provides:
 * - page navigation helpers
 * - mock API setup utilities
 * - common assertions
 * - test data factories
 */

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

export const testDataProvider = {
  provider_a: {
    name: "provider_a",
    url: "https://api.openai.com",
  },
  provider_b: {
    name: "provider_b",
    url: "https://api.anthropic.com",
  },
  model_alias: {
    alias: "my-smart-model",
    strategy: "proportional",
    real_models: {
      provider_a: "gpt-4",
      provider_b: "claude-sonnet-4",
    },
  },
  auth: {
    key: "sk-test-key-001",
    quota: 100,
  },
};

// ---------------------------------------------------------------------------
// Extended test fixture
// ---------------------------------------------------------------------------

type LlmProxyFixtures = {
  /** Navigate to the admin dashboard */
  gotoAdmin: () => Promise<void>;

  /** Navigate to a specific page by tab ID */
  gotoPage: (tabId: string) => Promise<void>;

  /** Fill the provider add form with test data */
  fillProviderForm: (overrides?: Partial<typeof testDataProvider.provider_a>) => Promise<void>;

  /** Fill the model alias add form with test data */
  fillModelForm: (overrides?: Partial<typeof testDataProvider.model_alias>) => Promise<void>;

  /** Fill the auth add form with test data */
  fillAuthForm: (overrides?: Partial<typeof testDataProvider.auth>) => Promise<void>;

  /** Wait for the loading spinner to disappear */
  waitForLoad: () => Promise<void>;

  /** Assert success toast is visible */
  expectSuccessToast: () => Promise<void>;

  /** Assert error toast is visible */
  expectErrorToast: () => Promise<void>;

  /** Dismiss toast by clicking its close button */
  dismissToast: () => Promise<void>;
};

export const test = base.extend<LlmProxyFixtures>({
  gotoAdmin: async ({ page }, use) => {
    await use(async () => {
      await page.goto("/");
    });
  },

  gotoPage: async ({ page }, use) => {
    await use(async (tabId: string) => {
      await page.goto("/");
      await page.getByTestId(tabId).click();
    });
  },

  fillProviderForm: async ({ page }, use) => {
    await use(async (overrides = {}) => {
      const data = { ...testDataProvider.provider_a, ...overrides };
      await page.getByTestId("provider-name-input").fill(data.name);
      await page.getByTestId("provider-url-input").fill(data.url);
    });
  },

  fillModelForm: async ({ page }, use) => {
    await use(async (overrides = {}) => {
      const data = { ...testDataProvider.model_alias, ...overrides };
      await page.getByTestId("model-alias-input").fill(data.alias);
      await page.getByTestId("model-strategy-select").click();
      await page.getByRole("option", { name: data.strategy }).click();
    });
  },

  fillAuthForm: async ({ page }, use) => {
    await use(async (overrides = {}) => {
      const data = { ...testDataProvider.auth, ...overrides };
      await page.getByTestId("auth-key-input").fill(data.key);
      await page.getByTestId("auth-quota-input").fill(String(data.quota));
    });
  },

  waitForLoad: async ({ page }, use) => {
    await use(async () => {
      // Wait for loading spinner to disappear
      const spinner = page.getByTestId("loading-spinner");
      if (await spinner.isVisible({ timeout: 2000 }).catch(() => false)) {
        await spinner.waitFor({ state: "hidden", timeout: 5000 });
      }
      // Small delay to ensure DOM is stable
      await page.waitForTimeout(300);
    });
  },

  expectSuccessToast: async ({ page }, use) => {
    await use(async () => {
      await expect(page.getByTestId("success-toast")).toBeVisible({ timeout: 5000 });
    });
  },

  expectErrorToast: async ({ page }, use) => {
    await use(async () => {
      await expect(page.getByTestId("error-toast")).toBeVisible({ timeout: 5000 });
    });
  },

  dismissToast: async ({ page }, use) => {
    await use(async () => {
      // Reka UI Toast has a Close button; try clicking it
      const closeBtn = page.locator("[data-state='open'] button:has-text('Close'), .ToastClose");
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click();
      }
      // Fallback: wait for toast to auto-dismiss
      await page.waitForTimeout(3000);
    });
  },
});

export { expect };

// ---------------------------------------------------------------------------
// Helper: create a provider via API (for test setup)
// ---------------------------------------------------------------------------

export async function createProviderViaApi(page: Page, data: { name: string; url: string }) {
  await page.goto("/");
  await page.getByTestId("nav-providers-tab").click();
  await page.getByTestId("provider-template-btn").locator("button").click();
  await page.getByTestId("provider-template-manual").click();
  await page.getByTestId("provider-name-input").fill(data.name);
  await page.getByTestId("provider-url-input").fill(data.url);
  await page.getByTestId("provider-save-btn").click();
  await expect(page.getByTestId("success-toast")).toBeVisible({ timeout: 5000 });
  // Dismiss toast
  await page.waitForTimeout(1000);
}

export async function createModelViaApi(page: Page, data: { alias: string; strategy: string }) {
  await page.goto("/");
  await page.getByTestId("nav-models-tab").click();
  await page.getByTestId("model-add-btn").click();
  await page.getByTestId("model-alias-input").fill(data.alias);
  await page.getByTestId("model-strategy-select").click();
  await page.getByRole("option", { name: data.strategy }).click();
  await page.getByTestId("model-save-btn").click();
  await expect(page.getByTestId("success-toast")).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1000);
}

export async function createAuthViaApi(page: Page, data: { key: string; quota: number }) {
  await page.goto("/");
  await page.getByTestId("nav-auths-tab").click();
  await page.getByTestId("auth-add-btn").click();
  await page.getByTestId("auth-key-input").fill(data.key);
  await page.getByTestId("auth-quota-input").fill(String(data.quota));
  await page.getByTestId("auth-save-btn").click();
  await expect(page.getByTestId("success-toast")).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1000);
}
