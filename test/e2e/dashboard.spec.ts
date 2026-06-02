import { test, expect } from "./fixtures";

/**
 * Dashboard (仪表盘) E2E Tests
 *
 * Corresponds to E2E_TEST_CASES.md "页面 1：仪表盘"
 * Test Cases: TC-001 ~ TC-005
 *
 * Note: Sections show tables only when data exists, otherwise EmptyState.
 */

test.describe("Dashboard (仪表盘) — TC-001 to TC-005", () => {
  // TC-001: 查看仪表盘概览 — 三张概览卡片
  test("TC-001: 仪表盘显示三张概览卡片（总花费/总请求数/限流次数）", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-dashboard-tab");
    await waitForLoad();

    // 三张概览卡片可见
    await expect(page.getByTestId("dashboard-total-cost-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-total-requests-card")).toBeVisible();
    await expect(page.getByTestId("dashboard-total-rate-limited-card")).toBeVisible();

    // 卡片内数值元素可见
    for (const id of ["dashboard-total-cost-card", "dashboard-total-requests-card", "dashboard-total-rate-limited-card"]) {
      const card = page.getByTestId(id);
      // Has a bold numeric value
      await expect(card.locator(".text-3xl, .text-2xl, .font-bold").first()).toBeVisible();
    }
  });

  // TC-002: 按请求倍率区块可见（可能有数据或空状态）
  test("TC-002: 按请求倍率区块可见", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-dashboard-tab");
    await waitForLoad();

    const section = page.getByTestId("dashboard-section-per-request-weighted");
    await expect(section).toBeVisible();

    // 区块标题可见（h2 heading）
    await expect(section.getByRole("heading", { name: "按请求加权" })).toBeVisible();
  });

  // TC-003: 按 Token 区块可见
  test("TC-003: 按 Token 区块可见", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-dashboard-tab");
    await waitForLoad();

    const section = page.getByTestId("dashboard-section-per-model-token");
    await expect(section).toBeVisible();

    // 区块标题可见
    await expect(section.getByRole("heading", { name: "按 Token" })).toBeVisible();
  });

  // TC-004: 订阅制区块可见
  test("TC-004: 订阅制区块可见", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-dashboard-tab");
    await waitForLoad();

    const section = page.getByTestId("dashboard-section-subscription");
    await expect(section).toBeVisible();

    // 区块标题可见
    await expect(section.getByRole("heading", { name: "订阅制" })).toBeVisible();
  });

  // TC-005: 限流状态一览区块可见
  test("TC-005: 限流状态一览区块可见", async ({
    page,
    gotoPage,
    waitForLoad,
  }) => {
    await gotoPage("nav-dashboard-tab");
    await waitForLoad();

    const section = page.getByTestId("dashboard-rate-limited-auths-section");
    await expect(section).toBeVisible();

    // 区块标题包含"限流状态一览"
    await expect(section.getByText("限流状态一览")).toBeVisible();

    // 说明文字可见
    await expect(section.getByText("只显示被限流的授权")).toBeVisible();
  });
});
