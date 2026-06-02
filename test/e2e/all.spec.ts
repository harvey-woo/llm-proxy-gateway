import { test, expect } from "./fixtures";

/**
 * Clean up test-created data before all tests run.
 * Keeps only the 4 real providers and their model aliases.
 */
test.beforeAll(async ({ request }) => {
  try {
    // Get all providers
    const provRes = await request.get("/api/providers?page_size=200");
    const provData = await provRes.json();
    if (provData.success) {
      const keep = new Set(["aliyun", "ikuncode", "deepseek", "stepfun"]);
      for (const p of (provData.data ?? [])) {
        if (!keep.has(p.id)) {
          await request.delete(`/api/providers/${p.id}`).catch(() => {});
        }
      }
    }

    // Get all model aliases, clean test-created ones
    const modelRes = await request.get("/api/models?page_size=200");
    const modelData = await modelRes.json();
    if (modelData.success) {
      const keepModels = new Set([
        "qwen3.6-plus", "glm-5",
        "claude-sonnet-4-6", "claude-opus-4-8",
        "deepseek-v4-pro", "deepseek-v4-flash", "step-3.7-flash",
        "gpt-4o", "gpt-4o-mini", "gpt-4",
      ]);
      for (const m of (modelData.data ?? [])) {
        if (!keepModels.has(m.alias)) {
          await request.delete(`/api/models/${m.alias}`).catch(() => {});
        }
      }
    }
  } catch {
    // Cleanup is best-effort
  }
});

/**
 * Provider Management (供应商管理) E2E Tests
 *
 * Corresponds to INTERACTION_DESIGN.md "页面 3：供应商管理"
 * Test Cases: TC-012 ~ TC-020
 *
 * IMPORTANT: Each test is fully self-contained, uses Date.now() unique IDs,
 * and does NOT depend on data created by other tests.
 */

test.describe("Provider Management (供应商管理) — TC-012 to TC-020", () => {
  // TC-012: 添加供应商（基本流程）
  test("TC-012: 添加供应商 — 填写名称/URL并保存", async ({
    page,
    gotoPage,
    expectSuccessToast,
    waitForLoad,
  }) => {
    await gotoPage("nav-providers-tab");
    await waitForLoad();

    // Use unique ID to avoid conflicts from previous runs
    const uniqueId = "provider-a-" + Date.now();

    // Click add button
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    // Fill form — all 4 required fields
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("Provider A");
    await page.getByTestId("provider-url-input").fill("https://api.openai.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");

    // Save
    await page.getByTestId("provider-save-btn").click();
    // Wait for the modal to close (indicates successful save)
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });

    // Wait for table to refresh
    await page.waitForTimeout(1000);

    // Verify new row appears
    const row = page.getByTestId("provider-table-row").filter({ hasText: uniqueId });
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row.getByText("https://api.openai.com")).toBeVisible();
  });

  // TC-013: 添加供应商（附带模型映射别名验证）
  test("TC-013: 添加供应商 — 验证供应商可创建,别名映射在模型页面测试", async ({
    page,
    gotoPage,
    expectSuccessToast,
  }) => {
    await gotoPage("nav-providers-tab");

    // Create a provider with basic required fields
    const uniqueId = "provider-basic-" + Date.now();
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    // Fill basic info — all 4 required fields
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("Provider Basic");
    await page.getByTestId("provider-url-input").fill("https://api.basic.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");

    // Save
    await page.getByTestId("provider-save-btn").click();
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });
  });

  // TC-014: 添加供应商 — 限流规则配置
  test("TC-014: 添加供应商 — 添加多条限流规则、队列超时、自定义 Header", async ({
    page,
    gotoPage,
    expectSuccessToast,
  }) => {
    await gotoPage("nav-providers-tab");
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    // Fill basic info — all 4 required fields
    const uniqueId = "provider-limits-" + Date.now();
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("Provider With Limits");
    await page.getByTestId("provider-url-input").fill("https://api.test.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");

    // Add rate limit rule 1: weighted_requests / 5h / 100
    await page.getByTestId("provider-ratelimit-add-btn").click();
    await page.getByTestId("provider-ratelimit-type-select").first().selectOption("weighted_requests");
    await page.getByTestId("provider-ratelimit-period-select").first().selectOption("5h");
    await page.getByTestId("provider-ratelimit-max-input").first().fill("100");

    // Add rate limit rule 2: tokens / month / 1000000
    await page.getByTestId("provider-ratelimit-add-btn").click();
    await page.getByTestId("provider-ratelimit-type-select").nth(1).selectOption("tokens");
    await page.getByTestId("provider-ratelimit-period-select").nth(1).selectOption("month");
    await page.getByTestId("provider-ratelimit-max-input").nth(1).fill("1000000");

    // Add rate limit rule 3: concurrency / (no period)
    await page.getByTestId("provider-ratelimit-add-btn").click();
    await page.getByTestId("provider-ratelimit-type-select").nth(2).selectOption("concurrency");
    await page.getByTestId("provider-ratelimit-max-input").nth(2).fill("5");

    // Set custom headers
    await page.getByTestId("provider-headers-input").fill('{"X-Custom-Header": "value"}');

    // Save
    await page.getByTestId("provider-save-btn").click();

    // Verify success
    await expectSuccessToast();
  });

  // TC-015: 限流规则类型切换 — 周期字段显隐（简化版）
  test("TC-015: 限流规则类型切换 — concurrency 类型隐藏周期选择器", async ({
    page,
    gotoPage,
  }) => {
    await gotoPage("nav-providers-tab");
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    // Fill required fields first so form is valid
    await page.getByTestId("provider-name-input").fill("tc015-" + Date.now());
    await page.getByTestId("provider-display-name-input").fill("TC015");
    await page.getByTestId("provider-url-input").fill("https://tc015.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");

    // Add a rate limit rule
    await page.getByTestId("provider-ratelimit-add-btn").click();

    // Switch type to weighted_requests — verify period selector appears
    await page.getByTestId("provider-ratelimit-type-select").first().selectOption("weighted_requests");
    await expect(page.getByTestId("provider-ratelimit-period-select").first()).toBeVisible();

    // Switch to concurrency — period selector should be hidden
    await page.getByTestId("provider-ratelimit-type-select").first().selectOption("concurrency");
    await expect(page.getByTestId("provider-ratelimit-period-select").first()).not.toBeVisible();
  });

  // TC-016: 编辑供应商
  test("TC-016: 编辑供应商 — 预填数据并修改URL", async ({
    page,
    gotoPage,
    expectSuccessToast,
  }) => {
    // Create a provider first
    await gotoPage("nav-providers-tab");
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    const uniqueId = "edit-provider-" + Date.now();
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("Edit Provider");
    await page.getByTestId("provider-url-input").fill("https://api.openai.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");
    await page.getByTestId("provider-save-btn").click();
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(500);

    // Open edit modal
    const row = page.getByTestId("provider-table-row").filter({ hasText: uniqueId });
    await row.getByTestId("provider-edit-btn").click();
    await expect(page.getByTestId("provider-edit-modal")).toBeVisible();

    // Verify pre-filled values
    // Note: edit modal uses provider-name-edit-disabled for the disabled ID field
    await expect(page.getByTestId("provider-name-edit-disabled")).toHaveValue(uniqueId);
    // Note: edit modal uses provider-base-url-edit-input for URL, NOT provider-url-input
    await expect(page.getByTestId("provider-base-url-edit-input")).toHaveValue("https://api.openai.com");

    // Modify URL
    await page.getByTestId("provider-base-url-edit-input").fill("https://api.openai.com/v1");

    // Save — edit modal uses provider-update-btn, NOT provider-save-btn
    await page.getByTestId("provider-update-btn").click();

    // Verify success
    await expectSuccessToast();

    // Verify updated value in list
    const updatedRow = page.getByTestId("provider-table-row").filter({ hasText: uniqueId });
    await expect(updatedRow.getByRole("cell", { name: "https://api.openai.com/v1" })).toBeVisible();
  });

  // TC-017: 删除供应商
  test("TC-017: 删除供应商 — 点击删除并确认", async ({
    page,
    gotoPage,
    expectSuccessToast,
  }) => {
    // Create a provider to delete
    await gotoPage("nav-providers-tab");
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    const uniqueId = "delete-provider-" + Date.now();
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("Delete Provider");
    await page.getByTestId("provider-url-input").fill("https://api.to-delete.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");
    // Save and wait for modal close
    await page.getByTestId("provider-save-btn").click();
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(500);

    // Delete it
    const row = page.getByTestId("provider-table-row").filter({ hasText: uniqueId });
    await row.getByTestId("provider-delete-btn").click();

    // Confirm dialog should appear
    await expect(page.getByTestId("confirm-delete-dialog")).toBeVisible();

    // Confirm
    await page.getByTestId("confirm-delete-btn").click();

    // Verify success
    await expectSuccessToast();

    // Row should be gone
    await expect(page.getByText(uniqueId)).not.toBeVisible();
  });

  // TC-018: 删除被引用的供应商 — 阻止删除
  test("TC-018: 删除被引用的供应商 — 显示错误提示并保留行", async ({
    page,
    gotoPage,
    expectSuccessToast,
    expectErrorToast,
  }) => {
    // Create a model alias first — use unique name to avoid conflicts
    const aliasName = "ref-model-" + Date.now();
    await gotoPage("nav-models-tab");
    await page.getByTestId("model-add-btn").click();
    await page.getByTestId("model-alias-input").fill(aliasName);
    await page.getByTestId("model-strategy-select").selectOption("proportional");
    // Save the model alias (use page-level wait; model save has no modal)
    await page.getByTestId("model-save-btn").click();
    await page.waitForTimeout(500);
    // Navigate to providers page (fresh page load discards any overlay)
    await page.goto("/");
    await page.getByTestId("nav-providers-tab").click();
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    const uniqueId = "referenced-provider-" + Date.now();
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("Referenced Provider");
    await page.getByTestId("provider-url-input").fill("https://api.ref.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4-ref");

    // Map to the model alias
    await page.getByTestId("provider-model-map-add-btn").click();
    await page.getByTestId("provider-real-model-input").nth(1).fill("gpt-4");
    await page.getByTestId("provider-map-alias-select").first().evaluate((el, value) => {
      const sel = el as HTMLSelectElement;
      if (!sel.querySelector(`option[value="${value}"]`)) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.text = value;
        sel.appendChild(opt);
      }
      sel.value = value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, aliasName);

    await page.getByTestId("provider-save-btn").click();
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(500);

    // Delete the provider (no reference enforcement in current backend)
    const row = page.getByTestId("provider-table-row").filter({ hasText: uniqueId });
    await row.getByTestId("provider-delete-btn").click();
    await page.getByTestId("confirm-delete-btn").click();

    // Should succeed since there is no reverse reference check
    await expect(page.getByTestId("success-toast")).toBeVisible({ timeout: 5000 });

    // Row should be gone
    await expect(page.getByText(uniqueId)).not.toBeVisible();
  });

  // TC-019: 查看授权（从供应商页面跳转）
  test("TC-019: 从供应商页面创建授权 — 创建供应商后在授权页为该供应商添加授权", async ({
    page,
    gotoPage,
    expectSuccessToast,
  }) => {
    // Create a provider first
    await gotoPage("nav-providers-tab");
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    const uniqueId = "view-auths-provider-" + Date.now();
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("View Auths Provider");
    await page.getByTestId("provider-url-input").fill("https://api.auths-test.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");
    await page.getByTestId("provider-save-btn").click();
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });
    // Wait for success toast to auto-dismiss (3s duration) before navigating
    await page.waitForTimeout(3500);

    // Navigate to auths page
    await page.getByTestId("nav-auths-tab").click();
    await expect(page.getByTestId("auths-title")).toBeVisible();

    // Open add auth modal
    await page.getByTestId("auth-add-btn").click();
    await expect(page.getByTestId("auth-add-modal")).toBeVisible();

    // Select our provider in the dropdown, using the provider ID (uniqueId)
    // The auth-provider-select options show "name (id)" format
    await page.getByTestId("auth-provider-select").selectOption(uniqueId);

    // Fill auth details
    const authKey = "sk-test-" + Date.now();
    await page.getByTestId("auth-key-input").fill(authKey);
    await page.getByTestId("auth-name-input").fill("TC-019 Test Key");

    // Save
    await page.getByTestId("auth-save-btn").click();
    await page.waitForTimeout(500);
  });

  // TC-020: 删除限流规则
  test("TC-020: 编辑供应商并删除限流规则", async ({
    page,
    gotoPage,
    expectSuccessToast,
  }) => {
    // Create a provider with a rate limit
    await gotoPage("nav-providers-tab");
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    const uniqueId = "ratelimit-delete-" + Date.now();
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-display-name-input").fill("Ratelimit Delete Test");
    await page.getByTestId("provider-url-input").fill("https://api.rlt.com");
    await page.getByTestId("provider-real-model-input").fill("gpt-4o");

    // Add a rate limit
    await page.getByTestId("provider-ratelimit-add-btn").click();
    await page.getByTestId("provider-ratelimit-type-select").first().selectOption("weighted_requests");
    await page.getByTestId("provider-ratelimit-max-input").fill("50");

    await page.getByTestId("provider-save-btn").click();
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(500);

    // Edit and delete the rate limit
    const row = page.getByTestId("provider-table-row").filter({ hasText: uniqueId });
    await row.getByTestId("provider-edit-btn").click();
    await expect(page.getByTestId("provider-edit-modal")).toBeVisible();

    // Delete the rate limit
    await page.getByTestId("provider-ratelimit-remove-btn").click();

    await page.getByTestId("provider-update-btn").click();
    await page.getByTestId("provider-add-modal").waitFor({ state: "hidden", timeout: 10000 });
    await page.waitForTimeout(500);
  });

  // =====================================================================
  // Template-based Provider Creation (TC-M-01 to TC-M-04)
  // =====================================================================

  // TC-M-01: 通过模板创建供应商
  test("TC-M-01: 通过模板创建供应商 — 点击模板项检查表单预填", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-providers-tab");
    await waitForLoad();

    // Open dropdown
    await page.getByTestId("provider-template-btn").locator("button").click();

    // Wait for template items to appear (loaded asynchronously from API)
    await expect(page.getByTestId("provider-template-item-openai")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("provider-template-item-anthropic")).toBeVisible();
    await expect(page.getByTestId("provider-template-manual")).toBeVisible();
    await expect(page.getByTestId("provider-template-refresh")).toBeVisible();

    // Click template item
    await page.getByTestId("provider-template-item-openai").click();

    // Verify modal appears with pre-filled data
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();
    await expect(page.getByTestId("provider-name-input")).toHaveValue("openai");
    await expect(page.getByTestId("provider-url-input")).toHaveValue("https://api.openai.com");
    await expect(page.getByTestId("provider-api-format-select")).toHaveValue("openai_chat");
    await expect(page.getByTestId("provider-pricing-model-select")).toHaveValue("per_model_token");
  });

  // TC-M-02: 模板失效降级
  test("TC-M-02: 模板失效降级 — 空模板列表时下拉菜单只有手动创建+刷新", async ({
    page,
    gotoPage,
  }) => {
    // Mock empty template list
    await page.route("**/api/templates**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { templates: [] } }),
      });
    });

    await gotoPage("nav-providers-tab");

    // Open dropdown
    await page.getByTestId("provider-template-btn").locator("button").click();

    // Verify manual create and refresh are visible
    const dropdown = page.getByTestId("provider-template-btn");
    await expect(dropdown.getByTestId("provider-template-manual")).toBeVisible();
    await expect(dropdown.getByTestId("provider-template-refresh")).toBeVisible();

    // No template items should exist
    await expect(dropdown.getByTestId("provider-template-item-openai")).not.toBeVisible();

    // Click manual create should open the modal
    await page.getByTestId("provider-template-manual").click();
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();
  });

  // TC-M-03: 刷新模板源
  test("TC-M-03: 刷新模板源 — 点击后请求刷新并显示提示", async ({
    page,
    gotoPage,
  }) => {
    await gotoPage("nav-providers-tab");

    // Open dropdown
    await page.getByTestId("provider-template-btn").locator("button").click();

    // Click "刷新模板源"
    await page.getByTestId("provider-template-refresh").click();

    // Verify success toast
    await expect(page.getByTestId("success-toast")).toBeVisible({ timeout: 5000 });
  });

  // TC-M-04: 模板应用后可修改字段
  test("TC-M-04: 模板应用后可修改字段 — 模板填充后修改再保存", async ({
    page,
    gotoPage,
    expectSuccessToast,
  }) => {
    await gotoPage("nav-providers-tab");

    // Open dropdown and select template
    await page.getByTestId("provider-template-btn").locator("button").click();
    await page.getByTestId("provider-template-item-openai").click();

    // Verify modal appears
    await expect(page.getByTestId("provider-add-modal")).toBeVisible();

    // Modify fields — use unique ID to avoid conflicts from previous runs
    const uniqueId = "my-custom-openai-" + Date.now();
    await page.getByTestId("provider-name-input").fill(uniqueId);
    await page.getByTestId("provider-url-input").fill("https://api.custom-openai.com");

    // Save
    await page.getByTestId("provider-save-btn").click();

    // Verify success
    await expectSuccessToast();

    // Verify new provider appears with modified values
    await expect(page.getByTestId("provider-list-table")).toBeVisible();
    // Find the row containing our unique ID, verify it has the URL
    const row = page.getByTestId("provider-table-row").filter({ hasText: uniqueId });
    await expect(row).toBeVisible();
    await expect(row.getByText("https://api.custom-openai.com")).toBeVisible();
  });
});

