/**
 * First-visit welcome modal.
 *
 * `welcome-modal.ts` is one of the modules `vitest.config.ts` removes from the
 * unit-coverage denominator, and the E2E suite never reached it either (3 of
 * its 12 functions ran across the whole `chromium-coverage` pass) — because
 * every other spec calls `seedStartupStorage()`, which sets `welcome_seen`
 * precisely so the modal stays out of the way. This file is the one that does
 * NOT seed it.
 *
 * The load-bearing block is BUG-077. `markAsSeen()` runs from `onClose`, so
 * *every* dismissal — the Get-started button, the X, Escape, a backdrop tap —
 * has to persist. When it only ran from the confirm button, the modal nagged
 * on every visit, and because `markAsSeen` is also the first writer of
 * `last_version_viewed` it permanently suppressed the changelog popup for
 * anyone who closed it any other way. That is a two-page-load, real-storage
 * behaviour: it needs a browser, not jsdom.
 */
import { test, expect } from './fixtures/coverage';
import type { Page } from './fixtures/coverage';
import { waitForAppReady, seedStartupStorage } from './fixtures/navigation';

const WELCOME_SEEN = 'xivdyetools_welcome_seen';
const LAST_VERSION = 'xivdyetools_last_version_viewed';

/** Land on a genuinely first visit — nothing seeded. */
async function firstVisit(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForAppReady(page).catch(() => undefined);
}

const dialog = (page: Page) =>
  page.getByRole('dialog').filter({ hasText: /Welcome to XIV Dye Tools/i });

async function storage(page: Page, key: string): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

test.describe('Welcome modal — first visit', () => {
  test('greets a brand-new visitor', async ({ page }) => {
    await firstVisit(page);

    const modal = dialog(page).first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('FIRST VISIT');
    await expect(modal).toContainText('Welcome to XIV Dye Tools');
    await expect(modal).toContainText(/Every dye in the game, measured/i);
  });

  test('leads with the four headline tools', async ({ page }) => {
    await firstVisit(page);
    const modal = dialog(page).first();

    // The four `WELCOME_LEADS` entries, not the full nine-tool list.
    await expect(modal).toContainText(/Harmony/i);
    await expect(modal).toContainText(/Extractor|Palette Extractor/i);
    await expect(modal).toContainText(/Mixer/i);
    await expect(modal).toContainText(/Gradient/i);
  });

  test('offers both a tour and a skip', async ({ page }) => {
    await firstVisit(page);

    await expect(page.getByRole('button', { name: /Get started/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Take the tour/i }).first()).toBeVisible();
  });

  test('stays away from a returning visitor', async ({ page }) => {
    await seedStartupStorage(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(1500);

    await expect(dialog(page)).toHaveCount(0);
  });
});

test.describe('Welcome modal — BUG-077: every close counts as seen', () => {
  /**
   * Dismiss the modal the given way, then assert both storage keys were
   * written and that a fresh load does not show it again. The reload is the
   * point: a modal that hides itself in-memory but never persists looks
   * identical until the next visit.
   */
  async function assertDismissalSticks(page: Page, dismiss: () => Promise<void>): Promise<void> {
    await firstVisit(page);
    await expect(dialog(page).first()).toBeVisible();

    await dismiss();
    await expect(dialog(page)).toHaveCount(0);

    expect(await storage(page, WELCOME_SEEN)).not.toBeNull();
    // markAsSeen is the first writer of LAST_VERSION_VIEWED. If it is left
    // unset here the changelog auto-popup is suppressed forever for this user.
    expect(await storage(page, LAST_VERSION)).not.toBeNull();

    await page.reload();
    await waitForAppReady(page).catch(() => undefined);
    await page.waitForTimeout(1500);
    await expect(dialog(page)).toHaveCount(0);
  }

  test('via the Get started button', async ({ page }) => {
    await assertDismissalSticks(page, async () => {
      await page
        .getByRole('button', { name: /Get started/i })
        .first()
        .click();
    });
  });

  test('via Escape', async ({ page }) => {
    await assertDismissalSticks(page, async () => {
      await page.keyboard.press('Escape');
    });
  });

  test('via the close control', async ({ page }) => {
    await assertDismissalSticks(page, async () => {
      // `.m16-close` specifically: a bare name=/close/i also matches the
      // shell's "Close sidebar" button, which is not this modal's X.
      await page.locator('.m16-close').first().click();
    });
  });

  test('via a backdrop tap', async ({ page }) => {
    await assertDismissalSticks(page, async () => {
      // Click the corner: the backdrop covers the viewport but the panel sits
      // over its centre, and Playwright clicks element centres.
      await page
        .locator('.m16-backdrop, .modal-backdrop')
        .first()
        .click({
          position: { x: 8, y: 8 },
        });
    });
  });
});

test.describe('Welcome modal — where it sends you', () => {
  test('Get started lands on the default tool', async ({ page }) => {
    await firstVisit(page);

    await page
      .getByRole('button', { name: /Get started/i })
      .first()
      .click();
    await expect(dialog(page)).toHaveCount(0);

    // RouterService.getDefaultTool() — asserted as "a real tool route", not a
    // hardcoded name, since the default is allowed to move.
    await expect
      .poll(() => page.evaluate(() => location.pathname))
      .toMatch(
        /^\/(harmony|extractor|accessibility|comparison|gradient|mixer|presets|budget|swatch)?$/
      );
  });

  test('Take the tour dismisses and marks seen too', async ({ page }) => {
    await firstVisit(page);

    await page
      .getByRole('button', { name: /Take the tour/i })
      .first()
      .click();
    await expect(dialog(page)).toHaveCount(0);

    expect(await storage(page, WELCOME_SEEN)).not.toBeNull();
  });
});
