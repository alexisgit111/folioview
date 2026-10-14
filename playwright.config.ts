import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against the production build (`vite preview`).
 *
 * Browsers: by default Playwright uses its own downloaded Chromium
 * (`npx playwright install chromium`). In locked-down environments you can
 * point it at any Chromium binary with PW_CHROMIUM_PATH.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined
const chromiumArgs = executablePath
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--in-process-gpu']
  : []

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath, args: chromiumArgs },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath, args: chromiumArgs } },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
