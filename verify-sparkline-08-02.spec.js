// 08-02 브라우저 검증: 스파크라인 렌더링 확인
// npx playwright test verify-sparkline-08-02.spec.js --reporter=list 로 실행
const { test, expect } = require('@playwright/test');

// 공통 로그인 헬퍼 함수
async function login(page) {
  await page.goto('/login');
  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emailInput.fill('test@example.com');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  } else {
    await page.goto('/dashboard');
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

test.use({
  baseURL: 'http://localhost:3000',
});

test('스파크라인 렌더링 검증 — Daily 탭 (지난 달)', async ({ page }) => {
  await login(page);

  // 지난 달(last-month) 기간으로 이동 — 실제 Google Sheets 데이터가 있는 기간
  // 이번 달(March 2026)에는 Google Sheets 데이터가 없어서 지난 달로 테스트
  await page.goto('/dashboard?period=last-month');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log('현재 URL:', currentUrl);

  // SVG 스파크라인 확인
  const svgElements = await page.locator('svg.recharts-surface').count();
  console.log(`SVG recharts-surface 수: ${svgElements}`);

  // recharts-area 확인
  const areaCount = await page.locator('.recharts-area').count();
  console.log(`Recharts Area 수: ${areaCount}`);

  // ResponsiveContainer 확인 (5개 KPI 카드 + 4개 차트 = 9개 이상)
  const containerCount = await page.locator('.recharts-responsive-container').count();
  console.log(`ResponsiveContainer 수: ${containerCount}`);

  // 스파크라인이 최소 5개 있어야 함 (5개 KPI 카드 스파크라인 + 4개 차트 = 9개)
  expect(containerCount).toBeGreaterThanOrEqual(9);

  // 스크린샷 저장
  await page.screenshot({ path: '.playwright-mcp/verify-08-02-daily.png' });
  console.log('Daily 스크린샷 저장 완료');
});

test('스파크라인 렌더링 검증 — Weekly 탭', async ({ page }) => {
  await login(page);

  // Weekly 탭으로 전환 (한국어: 주차별)
  await page.goto('/dashboard?tab=weekly&period=this-month');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log('현재 URL:', currentUrl);

  // "주차별" 탭이 활성화 상태인지 확인
  const weeklyTabEl = page.locator('[role="tab"]').filter({ hasText: '주차별' });
  const tabExists = await weeklyTabEl.count();
  console.log('주차별 탭 존재:', tabExists);

  if (tabExists > 0) {
    // 탭이 이미 URL 파라미터로 설정됨
    await weeklyTabEl.click();
    await page.waitForTimeout(1500);
    console.log('주차별 탭 클릭 완료');
  }

  // ResponsiveContainer 확인 (5개 KPI 카드 + 4개 차트 = 9개)
  const containerCount = await page.locator('.recharts-responsive-container').count();
  console.log(`Weekly 탭 ResponsiveContainer 수: ${containerCount}`);

  // Weekly 데이터는 항상 전체 반환 (폴백) — 스파크라인 5개 + 차트 4개
  expect(containerCount).toBeGreaterThanOrEqual(9);

  await page.screenshot({ path: '.playwright-mcp/verify-08-02-weekly.png' });
  console.log('Weekly 스크린샷 저장 완료');
});

test('다크모드 테마 전환 확인', async ({ page }) => {
  await login(page);

  // 지난 달로 이동하여 KPI 카드 데이터 확보
  await page.goto('/dashboard?period=last-month');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // 라이트모드 스크린샷 (스파크라인 포함 확인)
  const lightContainerCount = await page.locator('.recharts-responsive-container').count();
  console.log(`라이트모드 ResponsiveContainer 수: ${lightContainerCount}`);
  await page.screenshot({ path: '.playwright-mcp/verify-08-02-light.png' });

  // 테마 토글 버튼 클릭 — "테마 전환" 버튼
  const themeBtn = page.locator('button').filter({ hasText: '테마 전환' });
  const themeBtnCount = await themeBtn.count();
  if (themeBtnCount > 0) {
    await themeBtn.first().click();
    await page.waitForTimeout(1000);
    console.log('테마 토글 클릭 완료');
  } else {
    // 아이콘만 있는 버튼 찾기
    const buttons = await page.locator('button').all();
    for (const btn of buttons) {
      const html = await btn.innerHTML();
      if (html.includes('sun') || html.includes('moon')) {
        await btn.click();
        await page.waitForTimeout(1000);
        console.log('테마 토글 (아이콘) 클릭 완료');
        break;
      }
    }
  }

  await page.screenshot({ path: '.playwright-mcp/verify-08-02-dark.png' });
  console.log('다크모드 스크린샷 저장 완료');

  // 테마 전환 후에도 스파크라인 렌더링 유지 확인
  const darkContainerCount = await page.locator('.recharts-responsive-container').count();
  console.log(`다크모드 ResponsiveContainer 수: ${darkContainerCount}`);
  expect(darkContainerCount).toBeGreaterThanOrEqual(9);
});
