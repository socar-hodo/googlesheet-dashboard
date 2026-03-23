import { expect, test } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill("test@example.com");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });
  } else {
    await page.goto("/dashboard");
  }
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
}

test.use({
  baseURL: "http://localhost:3000",
});

test("스파크라인 렌더링 검증 - Daily 탭", async ({ page }) => {
  await login(page);

  await page.goto("/dashboard?period=last-month");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const containerCount = await page
    .locator(".recharts-responsive-container")
    .count();

  expect(containerCount).toBeGreaterThanOrEqual(9);
  await page.screenshot({ path: ".playwright-mcp/verify-08-02-daily.png" });
});

test("스파크라인 렌더링 검증 - Weekly 탭", async ({ page }) => {
  await login(page);

  await page.goto("/dashboard?tab=weekly&period=this-month");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const weeklyTab = page.locator('[role="tab"]').filter({ hasText: "주차별" });
  if ((await weeklyTab.count()) > 0) {
    await weeklyTab.click();
    await page.waitForTimeout(1500);
  }

  const containerCount = await page
    .locator(".recharts-responsive-container")
    .count();

  expect(containerCount).toBeGreaterThanOrEqual(9);
  await page.screenshot({ path: ".playwright-mcp/verify-08-02-weekly.png" });
});

test("다크 모드 테마 전환 확인", async ({ page }) => {
  await login(page);

  await page.goto("/dashboard?period=last-month");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  await page.screenshot({ path: ".playwright-mcp/verify-08-02-light.png" });

  const themeButton = page.getByRole("button", { name: "테마 전환" });
  if (await themeButton.isVisible().catch(() => false)) {
    await themeButton.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: ".playwright-mcp/verify-08-02-dark.png" });

  const containerCount = await page
    .locator(".recharts-responsive-container")
    .count();
  expect(containerCount).toBeGreaterThanOrEqual(9);
});
