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

import { readFileSync } from 'node:fs';
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
 * The app's real version, read from package.json — the same source Vite feeds
 * into `__APP_VERSION__`.
 */
const APP_VERSION = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
).version as string;

/**
 * Seed the flags that suppress first-run modals.
 *
 * The version key is the fiddly one. `ChangelogModal.shouldShow()` tests
 * `lastVersion !== APP_VERSION` — an INEQUALITY, not "older than". So a
 * hardcoded 4.x seed opened the What's New dialog, and so did the 99.0.0
 * "ceiling" that replaced it: any value that is not exactly the current
 * version pops the modal, whose backdrop then eats the next click. Only the
 * exact version suppresses it, so it is read from package.json rather than
 * written down here, where it would rot at the next version bump.
 */
export async function seedStartupStorage(page: Page): Promise<void> {
  await page.addInitScript((version: string) => {
    localStorage.setItem('xivdyetools_welcome_seen', 'true');
    localStorage.setItem('xivdyetools_last_version_viewed', version);
    localStorage.setItem('xivdyetools_tutorials_disabled', 'true');
  }, APP_VERSION);
}

/**
 * Close the mobile palette drawer by tapping outside it.
 *
 * `.v4-drawer-overlay` is fixed to the whole viewport, but on a phone-width
 * screen the 320px drawer panel sits over its CENTRE — and Playwright clicks
 * element centres, so the drawer intercepts and the click is refused. Tapping
 * the top-left corner hits the part of the overlay that is genuinely outside
 * the drawer, which is also what a user does.
 */
export async function closePaletteDrawer(page: Page): Promise<void> {
  const overlay = page.locator('.v4-drawer-overlay.visible');
  if ((await overlay.count()) === 0) return;
  await overlay.first().click({ position: { x: 8, y: 8 } });
  await overlay.first().waitFor({ state: 'detached' }).catch(() => undefined);
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
