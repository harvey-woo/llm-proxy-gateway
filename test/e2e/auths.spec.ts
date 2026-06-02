import { test, expect } from "./fixtures";

/**
 * Auth Management (授权管理) E2E Tests
 *
 * Corresponds to E2E_TEST_CASES.md
 * Focus on page structure and basic interactions.
 */

test.describe("Auth Management (授权管理) — TC-021 to TC-026", () => {
  // TC-021: 页面基本结构
  test("TC-021: 授权管理页面加载正常", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-auths-tab");
    await waitForLoad();
    await expect(page.getByTestId("auths-title")).toBeVisible();
    await expect(page.getByTestId("auth-add-btn")).toBeVisible();
  });

  // TC-022: 添加按钮打开弹窗
  test("TC-022: 点击添加按钮弹出添加弹窗", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-auths-tab");
    await waitForLoad();
    await page.getByTestId("auth-add-btn").click();
    await expect(page.getByTestId("auth-add-modal")).toBeVisible();
    // 弹窗中有必要字段
    await expect(page.getByTestId("auth-provider-select")).toBeVisible();
    await expect(page.getByTestId("auth-key-input")).toBeVisible();
    await expect(page.getByTestId("auth-name-input")).toBeVisible();
    await expect(page.getByTestId("auth-save-btn")).toBeVisible();
    // 可关闭
    await page.getByTestId("auth-cancel-btn").click();
    await expect(page.getByTestId("auth-add-modal")).not.toBeVisible();
  });

  // TC-023: 已有授权列表
  test("TC-023: 授权列表或添加按钮可见", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-auths-tab");
    await waitForLoad();
    // Either table or nothing — add button should be visible
    await expect(page.getByTestId("auth-add-btn")).toBeVisible();
  });

  // TC-024: 弹窗中供应商下拉可选
  test("TC-024: 供应商下拉有选项", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-auths-tab");
    await waitForLoad();
    await page.getByTestId("auth-add-btn").click();
    await expect(page.getByTestId("auth-add-modal")).toBeVisible();
    const select = page.getByTestId("auth-provider-select");
    const options = await select.locator("option").all();
    // At least a placeholder option or real option
    expect(options.length).toBeGreaterThanOrEqual(1);
  });

  // TC-025: Key 输入框可输入
  test("TC-025: API Key 输入框可填写", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-auths-tab");
    await waitForLoad();
    await page.getByTestId("auth-add-btn").click();
    await expect(page.getByTestId("auth-add-modal")).toBeVisible();
    await page.getByTestId("auth-key-input").fill("sk-test-" + Date.now());
    // 验证填入
    const val = await page.getByTestId("auth-key-input").inputValue();
    expect(val).toContain("sk-test-");
  });

  // TC-026: 名称输入框可输入
  test("TC-026: 名称输入框可填写", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-auths-tab");
    await waitForLoad();
    await page.getByTestId("auth-add-btn").click();
    await expect(page.getByTestId("auth-add-modal")).toBeVisible();
    await page.getByTestId("auth-name-input").fill("E2E Test Key");
    const val = await page.getByTestId("auth-name-input").inputValue();
    expect(val).toBe("E2E Test Key");
  });
});
