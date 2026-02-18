import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 *
 * Coverage collection is enabled via the 'chromium-coverage' project.
 * Run with: npx playwright test --project=chromium-coverage
 *
 * Projects:
 * - chromium: Standard E2E tests (fast)
 * - chromium-coverage: E2E tests with V8 coverage collection
 * - mobile-chrome: Mobile viewport tests
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Global teardown for coverage merging
  globalTeardown: './e2e/global-teardown.ts',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Coverage-enabled project (Chromium only - uses CDP for V8 coverage)
    {
      name: 'chromium-coverage',
      use: {
        ...devices['Desktop Chrome'],
        // Coverage is collected via fixtures in e2e/fixtures/coverage.ts
      },
    },
    // Mobile viewport project for testing responsive behavior
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    // Uncomment to test on more browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
