import { defineConfig } from '@playwright/test';

const testPort = Number(process.env.PLAYWRIGHT_PORT ?? 5173);

export default defineConfig({
  testDir: 'e2e',
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? `/tmp/df9-playwright-${process.pid}`,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: 'list',

  use: {
    baseURL: `http://localhost:${testPort}`,
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--enable-webgl',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
        },
      },
    },
  ],

  webServer: {
    // Keep the server hostname identical to baseURL. In-app browser tab claiming
    // is origin-sensitive; binding Vite to 127.0.0.1 while using a localhost tab
    // previously produced a URL-policy rejection even though Vite was running.
    command: `npm run dev:e2e -- --port ${testPort}`,
    port: testPort,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
