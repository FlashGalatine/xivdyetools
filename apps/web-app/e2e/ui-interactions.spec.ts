/**
 * E2E tests for shell UI interactions — theme picker, palette drawer, modals.
 *
 * Rewritten for the 5.0 shell. The previous version targeted pre-v4 selectors
 * (`#theme-switcher-btn`, `#favorites-panel`, `.dye-select-btn`,
 * `.saved-palettes-btn`) that no longer exist, and guarded every one with
 * `if (count === 0) test.skip()`. The result was 16 tests reporting green
 * while asserting nothing at all — worse than failing, because a skip reads
 * as "not applicable" rather than "this UI is gone".
 *
 * Two describes were deleted rather than retargeted, because their surfaces
 * were removed in 5.0 and are covered elsewhere:
 * - "Saved Palettes Modal": `.saved-palettes-btn` exists nowhere in src.
 *   Saved palettes are now palette-kind CollectionService records, covered by
 *   collection-manager.spec.ts.
 * - "Collection Manager Interactions": `#manage-collections-btn` lives in
 *   dye-selector.ts, which Q7 unmounted when the drawer replaced the
 *   persistent left column. Collections are covered by collection-manager.spec.
 *
 * Selector notes for the 5.0 DOM (verified against the running app):
 * - The theme picker is a 16A modal (`.m16-backdrop`), not a dropdown. Its
 *   options are `button[data-theme]`, and after consolidation there are
 *   exactly two: `standard-light` and `standard-dark`.
 * - The palette drawer renders inside `dye-palette-drawer`'s shadow root.
 *   Playwright's CSS engine pierces open shadow roots, so its classes are
 *   addressable directly. Swatches are `div.swatch` (NOT buttons), carrying
 *   the dye name in `title`.
 */

import { test, expect, type Page } from './fixtures/coverage';
import { seedStartupStorage, dismissBlockingOverlays, waitForAppReady } from './fixtures/navigation';

/** Open the 16A theme modal from the header's theme glyph. */
async function openThemeModal(page: Page): Promise<void> {
  // The header button is icon-only: it carries `title`/`aria-label`, no text.
  await page.locator('button.v4-header-nav-btn[aria-label*="theme" i]').first().click();
  await expect(page.locator('.m16-backdrop')).toBeVisible();
}

/** Ensure the palette drawer is open, whatever the shell's default is. */
async function openPaletteDrawer(page: Page): Promise<void> {
  const drawer = page.locator('dye-palette-drawer[is-open]');
  if ((await drawer.count()) === 0) {
    await page.locator('.v4-palette-toggle').first().click();
  }
  await expect(page.locator('dye-palette-drawer[is-open]')).toBeAttached();
}

test.describe('Shell controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('renders the header chrome trio and the tool switcher', async ({ page }) => {
    await expect(page.locator('button.tool-menu-btn').first()).toBeVisible();
    // What's New · About · locale · theme · gear
    await expect(page.locator('button.v4-header-nav-btn')).toHaveCount(5);
  });

  test('stays interactive after reload', async ({ page }) => {
    await page.reload();
    await waitForAppReady(page);

    await expect(page.locator('button.tool-menu-btn').first()).toBeVisible();
    await expect(page.locator('dye-palette-drawer')).toBeAttached();
  });
});

test.describe('Theme picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('opens the theme modal with both consolidated themes', async ({ page }) => {
    await openThemeModal(page);

    await expect(page.locator('.m16-title')).toHaveText(/theme/i);
    // 5.0 consolidated twelve themes down to Light and Dark.
    await expect(page.locator('button[data-theme]')).toHaveCount(2);
    await expect(page.locator('button[data-theme="standard-light"]')).toBeVisible();
    await expect(page.locator('button[data-theme="standard-dark"]')).toBeVisible();
  });

  test('marks exactly one option as selected', async ({ page }) => {
    await openThemeModal(page);

    await expect(page.locator('button[data-theme][aria-selected="true"]')).toHaveCount(1);
  });

  test('applies the chosen theme to the document', async ({ page }) => {
    await openThemeModal(page);

    await page.locator('button[data-theme="standard-dark"]').click();
    await expect(page.locator('html')).toHaveClass(/theme-standard-dark/);

    await page.locator('button[data-theme="standard-light"]').click();
    await expect(page.locator('html')).toHaveClass(/theme-standard-light/);
  });

  test('keeps the selected option highlighted after hovering another', async ({ page }) => {
    await openThemeModal(page);

    const selected = page.locator('button[data-theme][aria-selected="true"]');
    const chosen = await selected.getAttribute('data-theme');

    const other = page.locator(`button[data-theme]:not([data-theme="${chosen}"])`).first();
    await other.hover();
    await page.mouse.move(0, 0);

    // Hover is presentation only — it must not move the selection.
    await expect(page.locator(`button[data-theme="${chosen}"]`)).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('closes on Escape', async ({ page }) => {
    await openThemeModal(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('.m16-backdrop')).toHaveCount(0);
  });
});

test.describe('Palette drawer — favorites', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'xivdyetools_favorites',
        JSON.stringify({
          version: '1.0.0',
          favorites: [1, 2, 3, 10, 20],
          lastModified: new Date().toISOString(),
        })
      );
    });
    await page.goto('/');
    await waitForAppReady(page);
    await openPaletteDrawer(page);
  });

  test('renders one swatch per stored favorite', async ({ page }) => {
    await expect(page.locator('.favorites-section')).toBeVisible();
    // Five seeded favorites → five swatches, not "zero or more".
    await expect(page.locator('.favorites-content .swatch')).toHaveCount(5);
    await expect(page.locator('.favorites-empty')).toHaveCount(0);
  });

  test('collapses and re-expands from the section header', async ({ page }) => {
    const content = page.locator('.favorites-content');
    await expect(content).toHaveClass(/expanded/);

    await page.locator('.favorites-section .section-header').click();
    await expect(content).not.toHaveClass(/expanded/);

    await page.locator('.favorites-section .section-header').click();
    await expect(content).toHaveClass(/expanded/);
  });

  test('names each favorite swatch for assistive tech', async ({ page }) => {
    const first = page.locator('.favorites-content .swatch').first();
    const title = await first.getAttribute('title');
    expect((title ?? '').trim().length).toBeGreaterThan(0);
  });
});

test.describe('Palette drawer — swatch grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await openPaletteDrawer(page);
  });

  test('renders the full dye database', async ({ page }) => {
    // 125 standard dyes; the 11 Facewear colors are not dyes and are excluded.
    await expect(page.locator('.swatch-grid .swatch')).toHaveCount(125);
  });

  test('filters the grid by search term', async ({ page }) => {
    const grid = page.locator('.swatch-grid .swatch');
    const before = await grid.count();

    await page.locator('.search-input').fill('Snow');

    await expect(grid).not.toHaveCount(before);
    expect(await grid.count()).toBeGreaterThan(0);
    await expect(grid.first()).toHaveAttribute('title', /snow/i);
  });

  test('restores the full grid when the search is cleared', async ({ page }) => {
    const grid = page.locator('.swatch-grid .swatch');

    await page.locator('.search-input').fill('Snow');
    await expect(grid).not.toHaveCount(125);

    await page.locator('.search-input').fill('');
    await expect(grid).toHaveCount(125);
  });

  test('narrows the grid with a category filter chip', async ({ page }) => {
    const grid = page.locator('.swatch-grid .swatch');

    const metallic = page.getByRole('button', { name: /^Metallic$/i }).first();
    await metallic.click();

    await expect(metallic).toHaveClass(/active/);
    const filtered = await grid.count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(125);
  });
});

test.describe('Palette drawer — actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await openPaletteDrawer(page);
  });

  test('offers random and clear actions', async ({ page }) => {
    await expect(page.locator('.random-btn')).toBeVisible();
    await expect(page.locator('.clear-btn')).toBeVisible();
  });

  test('picks a dye when the random action fires', async ({ page }) => {
    // Harmony's share button is disabled until a base dye exists, so it reads
    // on selection. Assert the TRANSITION, not the end state — checking only
    // "not disabled" afterwards would pass even if it was never disabled.
    const share = page.locator('v4-share-button').first();
    await expect(share).toHaveAttribute('disabled', '');

    await page.locator('.random-btn').click();

    await expect(share).not.toHaveAttribute('disabled', '');
  });

  test('closes from the drawer close button', async ({ page }) => {
    await page.locator('.close-btn').first().click();
    await expect(page.locator('dye-palette-drawer[is-open]')).toHaveCount(0);
  });
});

test.describe('Modal container', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('keeps a modal root in the light DOM', async ({ page }) => {
    // Modals deliberately render OUTSIDE the shell's shadow DOM.
    await expect(page.locator('#modal-root')).toBeAttached();
  });

  test('renders an accessible dialog and restores the page on dismiss', async ({ page }) => {
    await openThemeModal(page);

    const dialog = page.locator('.m16-dialog[role="dialog"]');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    await dismissBlockingOverlays(page);
    await expect(page.locator('.m16-backdrop')).toHaveCount(0);
    await expect(page.locator('button.tool-menu-btn').first()).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('moves focus into the page on Tab', async ({ page }) => {
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => document.activeElement?.tagName ?? 'BODY');
    expect(focused).not.toBe('BODY');
  });

  test('exposes a main landmark', async ({ page }) => {
    // NOTE: there is no skip link in 5.0 — the old test asserted `count >= 0`,
    // which passed while none existed. The main landmark is what the shell
    // actually provides; a skip link targeting it is a genuine a11y gap.
    await expect(page.locator('main#main-content')).toBeAttached();
  });
});
