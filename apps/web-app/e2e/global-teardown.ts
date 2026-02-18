/**
 * Playwright Global Teardown
 *
 * Runs after all tests complete. Merges E2E coverage files
 * into a single report.
 */

import { mergeCoverage } from './fixtures/coverage';

async function globalTeardown(): Promise<void> {
  // Check if we're running with coverage
  const projectName = process.env.PLAYWRIGHT_PROJECT_NAME || '';

  if (projectName.includes('coverage')) {
    console.log('\n📊 Merging E2E coverage reports...');
    await mergeCoverage();
  }
}

export default globalTeardown;
