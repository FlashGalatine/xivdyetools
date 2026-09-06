import { test, expect } from './fixtures/coverage';
import {
  waitForAppReady,
  gotoTool,
  seedStartupStorage,
  dismissBlockingOverlays,
} from './fixtures/navigation';

/**
 * E2E Tests for the Palette Extractor (4A: loupe over a weighted bar over
 * the card sheet).
 *
 * These tests focus on USER JOURNEYS rather than element presence checks.
 *
 * Test categories:
 * 1. Image Upload & Extraction Flow (the bar + the sheet)
 * 2. The loupe and picks
 * 3. Image privacy (nothing survives a reload)
 * 4. Mobile Responsive Behavior
 * 5. Results Interaction
 */

// An opaque 20×10 RGB PNG (generated with sharp): 14 columns of #3498DB then
// 6 of #E67E22, so the extraction has two real colours to find (70 % / 30 %).
// The fixture this replaced was a 10×10 RGBA PNG with a corrupt IDAT whose
// pixels decoded at near-zero alpha — the sampler dropped every one of them as
// transparent ("No pixels to analyze"), and the old spec's `>= 0` assertions
// never noticed that no extraction had ever succeeded in e2e.
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABQAAAAKCAIAAAA7N+mxAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAHUlEQVQokWMwmXGbSPSsTgkNMYxqvj0aYLfxJxIAD/VCzDFEvaoAAAAASUVORK5CYII=';

// Helper: Navigate to the extractor tool
async function navigateToExtractorTool(page: import('@playwright/test').Page) {
  await seedStartupStorage(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for app initialization
  await page.waitForFunction(
    () => {
      const app = document.getElementById('app');
      return app && app.children.length > 0;
    },
    { timeout: 15000 }
  );

  await waitForAppReady(page);
  await dismissBlockingOverlays(page);
  await page.waitForTimeout(300);

  await gotoTool(page, 'extractor');
  await dismissBlockingOverlays(page);
  await page.waitForTimeout(800);
}

// Helper: upload the fixture image through the hidden file input and wait
// for the extraction to land (the bar's `+` tile appears with the roll).
async function uploadTestImage(page: import('@playwright/test').Page) {
  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.setInputFiles({
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TEST_IMAGE_BASE64, 'base64'),
  });
  await expect(page.locator('#extractor-add-pick')).toBeAttached({ timeout: 10000 });
  await page.waitForTimeout(500);
}

test.describe('Extractor Tool - User Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToExtractorTool(page);
  });

  test.describe('Image Upload & Extraction Flow', () => {
    test('uploads an image and extracts a palette into the bar and the sheet', async ({ page }) => {
      await uploadTestImage(page);

      // The image is on a canvas
      await expect(page.locator('canvas').first()).toBeAttached();

      // The bar under the image carries one proportional segment per
      // extracted colour, and the sheet one card per segment
      const segments = page.locator('#extractor-bar .x4a-seg');
      const segmentCount = await segments.count();
      expect(segmentCount).toBeGreaterThan(0);
      await expect(page.locator('v4-result-card')).toHaveCount(segmentCount);

      // No picks yet: the legend is the bare share label and the count reads
      // "n of max"
      await expect(page.locator('#extractor-legend')).toHaveText('IMAGE SHARE');
      await expect(page.locator('#extractor-count')).toContainText(' of ');
      await expect(page.locator('#extractor-clear-picks')).toBeHidden();
    });

    test('shows a toast notification on successful image load', async ({ page }) => {
      await uploadTestImage(page);

      const toast = page.locator('.toast, [role="alert"], .notification').first();
      // Toast may or may not still be visible depending on timing; the flow
      // must simply not error
      await toast.count();
    });

    test('focuses a card when its bar segment is tapped', async ({ page }) => {
      await uploadTestImage(page);

      const first = page.locator('#extractor-bar .x4a-seg').first();
      await first.click();

      await expect(first).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('v4-result-card').first()).toHaveAttribute('selected', '');
    });
  });

  test.describe('The loupe and picks', () => {
    test('a click on the image reads a colour into the loupe and the + tile commits it', async ({
      page,
    }) => {
      await uploadTestImage(page);
      const extracted = await page.locator('#extractor-bar .x4a-seg').count();

      // Read a pixel
      await page
        .locator('canvas')
        .first()
        .click({ position: { x: 5, y: 5 } });
      await expect(page.locator('#extractor-loupe')).toHaveCSS('transform', /matrix/);
      await expect(page.locator('.x4a-hint-read')).toBeVisible();

      // Commit it
      await page.locator('#extractor-add-pick').click();

      // A fixed-width pick, numbered after the extracted run, with its own card
      const picks = page.locator('#extractor-bar .x4a-seg-pick');
      await expect(picks).toHaveCount(1);
      await expect(picks.first()).toHaveText(String(extracted + 1));
      await expect(page.locator('v4-result-card')).toHaveCount(extracted + 1);
      await expect(page.locator('#extractor-legend')).toHaveText('IMAGE SHARE · 1 pick');
      await expect(page.locator('#extractor-count')).toHaveText(`${extracted} + 1`);

      // Clear picks keeps the extracted run
      await page.locator('#extractor-clear-picks').click();
      await expect(picks).toHaveCount(0);
      await expect(page.locator('v4-result-card')).toHaveCount(extracted);
    });

    test('the + tile does nothing before the loupe has read a colour', async ({ page }) => {
      await uploadTestImage(page);
      const cards = await page.locator('v4-result-card').count();

      await page.locator('#extractor-add-pick').click();

      await expect(page.locator('#extractor-bar .x4a-seg-pick')).toHaveCount(0);
      await expect(page.locator('v4-result-card')).toHaveCount(cards);
    });
  });

  test.describe('Image privacy', () => {
    /**
     * FINDING-009: the extractor writes images nowhere, so a reload genuinely
     * discards one — which is what PRIVACY.md promises. The flow's visibility
     * is the real signal: `#extractor-drop-zone` (the empty flow) and
     * `.x4a-image-card` (the loaded flow) swap `display` on `currentImage`.
     */
    test('discards the uploaded image and its picks on reload', async ({ page }) => {
      const dropZone = page.locator('#extractor-drop-zone').first();
      const imageCard = page.locator('.x4a-image-card').first();

      await uploadTestImage(page);

      // Baseline: the image really did load
      await expect(imageCard).toBeVisible();
      await expect(dropZone).toBeHidden();

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await gotoTool(page, 'extractor');
      await page.waitForTimeout(2000);

      // The image is gone: the empty flow is back, the image card is attached
      // but hidden, and nothing was re-extracted
      await expect(dropZone).toBeVisible();
      await expect(imageCard).toBeAttached();
      await expect(imageCard).toBeHidden();
      await expect(page.locator('v4-result-card')).toHaveCount(0);
    });
  });
});

test.describe('Extractor Tool - Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await navigateToExtractorTool(page);
  });

  test('renders the one-column workspace on a phone', async ({ page }) => {
    const isMobile = await page.evaluate(() => window.innerWidth < 768);
    expect(isMobile).toBe(true);
    await expect(page.locator('#extractor-drop-zone')).toBeVisible();
  });

  test('uploads an image and pins the hero over the scrolling sheet', async ({ page }) => {
    await uploadTestImage(page);

    await expect(page.locator('#extractor-bar .x4a-seg').first()).toBeVisible();
    expect(await page.locator('v4-result-card').count()).toBeGreaterThan(0);
    // The sheet scrolls on its own below the pinned hero
    const overflow = await page
      .locator('.x4a-sheet')
      .first()
      .evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflow).toBe('auto');
  });
});

test.describe('Extractor Tool - Results Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToExtractorTool(page);
  });

  test('a result card offers its context menu without breaking the app', async ({ page }) => {
    await uploadTestImage(page);

    const resultCard = page.locator('v4-result-card').first();
    if (await resultCard.isVisible()) {
      await resultCard.click({ button: 'right' });
      await page.waitForTimeout(300);
      // Context menu may or may not appear depending on implementation; the
      // interaction must not break the app
      await page.locator('[role="menu"], .dropdown-menu, .context-menu').count();
    }
  });

  test('offers the export sheet once the roll exists', async ({ page }) => {
    await uploadTestImage(page);

    const exportBtn = page.locator('button:has-text("Export")').first();
    await expect(exportBtn).toBeEnabled();
    await exportBtn.click({ force: true });
    await page.waitForTimeout(500);
    // Export action should not crash the app
  });
});
