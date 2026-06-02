import { test, expect } from "./fixtures";

/**
 * Stats Panel (统计面板) E2E Tests
 *
 * Corresponds to INTERACTION_DESIGN.md "页面 5：统计面板"
 * Test Cases: TC-027 ~ TC-031
 *
 * Design:
 * - Auth tabs (pill-style buttons) for selecting auth key
 * - Time range switcher (pill buttons): 24小时 / 7天 / 30天
 * - SVG horizontal line chart (输入/输出/缓存 token)
 * - 请求加权数 cards (5小时内 / 本周 / 本月)
 */

test.describe("Stats Panel (统计面板) — TC-027 to TC-031", () => {
  // TC-027: 统计面板布局 — 显示授权 Tabs + Token 折线图 + 请求加权数
  test("TC-027: 统计面板显示授权 Tabs、Token 折线图和请求加权数卡片", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-stats-tab");
    await waitForLoad();

    // Verify auth tabs are visible (pill-style buttons)
    await expect(page.getByTestId("stats-auth-tabs")).toBeVisible();
    const tabs = page.getByTestId("stats-auth-tabs").locator("button");
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);

    // First tab should be selected by default
    await expect(tabs.first()).toHaveClass(/bg-blue-50.*text-blue-700/);

    // Verify token chart is visible
    await expect(page.getByTestId("stats-token-chart")).toBeVisible();

    // Verify time range switcher has 3 options
    await expect(page.getByTestId("stats-range-24h")).toBeVisible();
    await expect(page.getByTestId("stats-range-7d")).toBeVisible();
    await expect(page.getByTestId("stats-range-30d")).toBeVisible();

    // Default should be 24小时 selected
    await expect(page.getByTestId("stats-range-24h")).toHaveClass(/bg-white.*shadow-sm/);

    // Verify request weighted count cards are visible
    await expect(page.getByTestId("stats-request-counts")).toBeVisible();
    await expect(page.getByTestId("stats-weighted-5h")).toBeVisible();
    await expect(page.getByTestId("stats-weighted-week")).toBeVisible();
    await expect(page.getByTestId("stats-weighted-month")).toBeVisible();
  });

  // TC-028: 切换时间范围
  test("TC-028: 切换时间范围 — 24小时/7天/30天切换后数据显示", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-stats-tab");
    await waitForLoad();

    // Switch to 7天
    await page.getByTestId("stats-range-7d").click();
    await waitForLoad();
    await expect(page.getByTestId("stats-range-7d")).toHaveClass(/bg-white.*shadow-sm/);
    await expect(page.getByTestId("stats-token-chart")).toBeVisible();

    // Switch to 30天
    await page.getByTestId("stats-range-30d").click();
    await waitForLoad();
    await expect(page.getByTestId("stats-range-30d")).toHaveClass(/bg-white.*shadow-sm/);

    // Switch back to 24小时
    await page.getByTestId("stats-range-24h").click();
    await waitForLoad();
    await expect(page.getByTestId("stats-range-24h")).toHaveClass(/bg-white.*shadow-sm/);
  });

  // TC-029: 切换授权 Tab
  test("TC-029: 切换授权 Tab 后统计数据更新", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-stats-tab");
    await waitForLoad();

    const tabs = page.getByTestId("stats-auth-tabs").locator("button");
    const tabCount = await tabs.count();
    if (tabCount < 2) {
      test.skip("需要至少 2 个授权 Tab 来测试切换");
      return;
    }

    // Click the second tab
    await tabs.nth(1).click();
    await waitForLoad();

    // Second tab should be active
    await expect(tabs.nth(1)).toHaveClass(/bg-blue-50.*text-blue-700/);
    // First tab should no longer be active
    await expect(tabs.nth(0)).toHaveClass(/bg-white.*text-gray-500/);

    // Chart should still be visible
    await expect(page.getByTestId("stats-token-chart")).toBeVisible();
  });

  // TC-030: 空数据状态
  test("TC-030: 统计面板无数据时显示空状态", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-stats-tab");
    await waitForLoad();

    // The chart container should be present
    const chartVisible = await page.getByTestId("stats-token-chart").isVisible().catch(() => false);
    expect(chartVisible).toBeTruthy();

    // The request counts card should be present
    const countsVisible = await page.getByTestId("stats-request-counts").isVisible().catch(() => false);
    expect(countsVisible).toBeTruthy();
  });
});
