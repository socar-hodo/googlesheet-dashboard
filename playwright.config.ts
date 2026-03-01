import { defineConfig, devices } from '@playwright/test';

// 08-02 스파크라인 브라우저 검증용 Playwright 설정
export default defineConfig({
  testDir: '.',
  testMatch: 'verify-sparkline-08-02.spec.js',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
