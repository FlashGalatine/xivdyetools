/**
 * Shared E2E navigation helpers.
 *
 * The 5.0 shell replaced the persistent tool rail with the 2B title-menu
 * switcher, so `[data-tool]` buttons no longer exist until the menu is open.
 * Every spec had its own copy of a `waitForSelector('[data-tool]')` readiness
 * gate, which is why one deleted attribute failed 83 tests at once.
 *
 * Two ways to reach a tool, deliberately:
 * - `gotoTool` navigates by route. Use this to set up a test's subject; it is
 *   stable, fast, and independent of chrome markup.
 * - `switchToolViaMenu` drives the switcher itself. Use this when the
 *   navigation *is* what's under test.
 *
 * @module e2e/fixtures/navigation
 */

import type { Page } from '@playwright/test';

/** Route path per tool id (mirrors ROUTES in services/router-service). */
const TOOL_PATHS: Record<string, string> = {
  harmony: '/harmony',
  extractor: '/extractor',
  accessibility: '/accessibility',
  comparison: '/comparison',
  gradient: '/gradient',
  mixer: '/mixer',
  presets: '/presets',
  budget: '/budget',
  swatch: '/swatch',
};

/**
 * Wait until the shell has booted and a tool has rendered into it.
 * `v4-layout-shell` is the stable anchor — it is what every tool renders into.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('v4-layout-shell', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(
    () => {
      const shell = document.querySelector('v4-layout-shell');
      const scroll = shell?.shadowRoot?.querySelector('.v4-layout-content-scroll');
      return Boolean(scroll && scroll.childElementCount > 0);
    },
    { timeout: 15000 }
  );
  // Any modal left open swallows every subsequent click — a backdrop covers
  // the whole workspace, so readiness includes "nothing is covering it".
  await dismissBlockingOverlays(page);
}

/** Navigate straight to a tool by route, then wait for it to render. */
export async function gotoTool(page: Page, toolId: string): Promise<void> {
  const path = TOOL_PATHS[toolId];
  if (!path) throw new Error(`Unknown tool id: ${toolId}`);
  await page.goto(path);
  await waitForAppReady(page);
}

/**
 * Switch tools through the 2B title-menu switcher — open the menu, pick the
 * entry. This is the path a user takes, so it belongs in tests that cover
 * navigation rather than tests that merely need to be somewhere.
 */
export async function switchToolViaMenu(page: Page, toolId: string): Promise<void> {
  await dismissBlockingOverlays(page);
  await page.locator('button.tool-menu-btn').first().click();
  await page.locator(`button[data-tool="${toolId}"]`).first().click();
  await waitForAppReady(page);
}

/**
 * Seed the flags that suppress first-run modals.
 *
 * The version key matters: the changelog modal opens whenever the stored
 * version is older than the build, so a hardcoded 4.x value made every spec
 * race a "What's New" dialog that swallowed their clicks. A version ceiling
 * keeps it shut whatever the app is at.
 */
export async function seedStartupStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('xivdyetools_welcome_seen', 'true');
    localStorage.setItem('xivdyetools_last_version_viewed', '99.0.0');
    localStorage.setItem('xivdyetools_tutorials_disabled', 'true');
  });
}

/**
 * Close anything covering the workspace. The 16A modal system renders
 * `.m16-backdrop`; the pre-5.0 `.modal-backdrop` is kept in the selector so
 * this helper works against either.
 */
export async function dismissBlockingOverlays(page: Page): Promise<void> {
  const sel = '.m16-backdrop, .modal-backdrop';
  for (let i = 0; i < 5; i++) {
    if ((await page.locator(sel).count()) === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  await page.evaluate((s) => {
    document.querySelectorAll(s).forEach((el) => el.remove());
  }, sel);
}
