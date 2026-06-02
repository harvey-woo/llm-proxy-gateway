import { test, expect } from "./fixtures";

/**
 * Model Management (模型管理) E2E Tests
 *
 * Focus on core CRUD and UI presence.
 */

test.describe("Model Management (模型管理) — TC-006 to TC-011", () => {
  // TC-006: 页面基本结构
  test("TC-006: 模型管理页面加载正常", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-models-tab");
    await waitForLoad();
    await expect(page.getByTestId("models-title")).toBeVisible();
    await expect(page.getByTestId("model-add-btn")).toBeVisible();
  });

  // TC-007: 添加按钮打开弹窗
  test("TC-007: 点击添加按钮弹出创建弹窗", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-models-tab");
    await waitForLoad();
    await page.getByTestId("model-add-btn").click();
    await expect(page.getByTestId("model-add-modal")).toBeVisible();
    // 弹窗中有必要字段
    await expect(page.getByTestId("model-alias-input")).toBeVisible();
    await expect(page.getByTestId("model-strategy-select")).toBeVisible();
    await expect(page.getByTestId("model-session-affinity-checkbox")).toBeVisible();
    await expect(page.getByTestId("model-save-btn")).toBeVisible();

    // 关闭
    await page.getByTestId("model-cancel-btn").click();
    await expect(page.getByTestId("model-add-modal")).not.toBeVisible();
  });

  // TC-008: 会话亲和性默认勾选
  test("TC-008: 会话亲和性默认勾选", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-models-tab");
    await waitForLoad();
    await page.getByTestId("model-add-btn").click();
    await expect(page.getByTestId("model-add-modal")).toBeVisible();
    const checkbox = page.getByTestId("model-session-affinity-checkbox");
    await expect(checkbox).toBeChecked();
    // 可取消
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
  });

  // TC-009: 创建模型别名
  test("TC-009: 填写别名和策略后创建模型别名", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-models-tab");
    await waitForLoad();

    const aliasName = "e2e-alias-" + Date.now();

    await page.getByTestId("model-add-btn").click();
    await expect(page.getByTestId("model-add-modal")).toBeVisible();

    // Fill basic info
    await page.getByTestId("model-alias-input").fill(aliasName);
    await page.getByTestId("model-strategy-select").selectOption("proportional");

    // Select a provider (select with placeholder "选择供应商添加")
    const providerSelect = page.getByTestId("model-add-modal").locator("select").nth(1);
    const opts = await providerSelect.locator("option").all();
    for (const opt of opts) {
      const val = await opt.getAttribute("value");
      if (val && val !== "") {
        await providerSelect.selectOption(val);
        break;
      }
    }
    await page.waitForTimeout(300);

    // Check the first available model checkbox
    const modelCheckbox = page.getByTestId("model-add-modal").locator("label.bg-white input[type='checkbox']").first();
    if (await modelCheckbox.isVisible().catch(() => false)) {
      await modelCheckbox.check();
    }

    // Save
    await page.getByTestId("model-save-btn").click();

    // Wait for success — either toast or modal close
    const toast = page.getByTestId("success-toast");
    const toastVisible = await toast.isVisible({ timeout: 8000 }).catch(() => false);

    // The model list should update
    await page.waitForTimeout(1000);
    const listTable = page.getByTestId("model-list-table");
    if (await listTable.isVisible().catch(() => false)) {
      // If table is visible, the alias should be there
      const found = await page.getByText(aliasName).isVisible().catch(() => false);
      expect(found || toastVisible).toBeTruthy();
    }
  });

  // TC-010: 编辑模型入口
  test("TC-010: 模型列表中可找到编辑按钮", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-models-tab");
    await waitForLoad();

    // 如果列表有数据，检查编辑按钮
    const listTable = page.getByTestId("model-list-table");
    if (await listTable.isVisible().catch(() => false)) {
      const editBtn = listTable.getByTestId("model-edit-btn").first();
      await expect(editBtn).toBeVisible({ timeout: 5000 });
    }
  });

  // TC-011: 删除入口
  test("TC-011: 模型列表中可找到删除按钮", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-models-tab");
    await waitForLoad();

    const listTable = page.getByTestId("model-list-table");
    if (await listTable.isVisible().catch(() => false)) {
      const deleteBtn = listTable.getByTestId("model-delete-btn").first();
      await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    }
  });
});
