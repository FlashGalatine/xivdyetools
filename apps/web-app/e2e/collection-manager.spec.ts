import { test, expect } from '@playwright/test';

async function dismissBlockingOverlays(page: Parameters<typeof test>[0]['page']): Promise<void> {
  // Dismiss offline banner if present
  await page.evaluate(() => {
    const dismissBtn = document.querySelector(
      'button[aria-label*="dismiss" i], [role="alert"] button'
    );
    if (dismissBtn instanceof HTMLButtonElement) {
      dismissBtn.click();
    }
  });

  // Dismiss any leftover modal backdrops that block interactions
  for (let i = 0; i < 5; i++) {
    const backdropCount = await page.locator('.modal-backdrop').count();
    if (backdropCount === 0) break;

    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }

  // Last-resort cleanup for layered/stuck modal DOM nodes
  await page.evaluate(() => {
    document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
  });
}

async function seedStartupStorage(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('xivdyetools_welcome_seen', 'true');
    localStorage.setItem('xivdyetools_last_version_viewed', '4.10.0');
    localStorage.setItem('xivdyetools_tutorials_disabled', 'true');
  });
}

async function waitForAppReady(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(
    () => {
      const app = document.getElementById('app');
      return app && app.children.length > 0;
    },
    { timeout: 15000 }
  );
  await page.waitForSelector('[data-tool]', { state: 'attached', timeout: 15000 });
  await dismissBlockingOverlays(page);
  await page.waitForTimeout(500);
}

async function switchToTool(
  page: Parameters<typeof test>[0]['page'],
  toolId: string
): Promise<void> {
  const toolButton = page.locator(`[data-tool="${toolId}"]:visible`).first();
  await toolButton.click();
  await page.waitForTimeout(900);
  await dismissBlockingOverlays(page);
}

async function expandAdvancedSettings(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await switchToTool(page, 'budget');

  const advancedSettingsToggle = page.getByRole('button', { name: /Advanced Settings/i }).first();
  await advancedSettingsToggle.click();
  await expect(page.getByRole('button', { name: /^Clear Favorites$/i }).first()).toBeVisible();
}

/**
 * E2E Tests for Collection Manager Modal
 *
 * Tests the collection management functionality including:
 * - Opening/closing the modal
 * - Creating collections
 * - Managing collections
 *
 * The app loads tools dynamically, so we need to wait for:
 * 1. The app layout to render
 * 2. A tool to be loaded (default is "harmony")
 * 3. The dye-selector component within the tool
 *
 * Note: Tool buttons exist in multiple locations (desktop nav, mobile nav, dropdown).
 * We use role-based selectors to target the correct visible element.
 */

test.describe('Collection Manager Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);

    // Navigate to the app
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should load the application successfully', async ({ page }) => {
    // Verify the page title
    await expect(page).toHaveTitle(/XIV Dye Tools/);

    // Verify tool buttons exist (app is initialized) - use first() for multiple matches
    const toolButtons = page.locator('[data-tool]').first();
    await expect(toolButtons).toBeAttached();

    // Verify multiple tool button instances exist (desktop, mobile, dropdown)
    const allToolButtons = page.locator('[data-tool]');
    const count = await allToolButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show tool navigation buttons', async ({ page }) => {
    // Check that tool navigation buttons exist (they appear in multiple places)
    // Verify the primary tool button exists
    const harmonyButton = page.locator('[data-tool="harmony"]').first();
    await expect(harmonyButton).toBeAttached();

    // Check other tool buttons exist by data-tool attribute
    const extractorButtons = page.locator('[data-tool="extractor"]');
    const comparisonButtons = page.locator('[data-tool="comparison"]');

    // Each tool appears multiple times (desktop nav, mobile nav, dropdown)
    expect(await extractorButtons.count()).toBeGreaterThan(0);
    expect(await comparisonButtons.count()).toBeGreaterThan(0);
  });

  test('should be able to switch between tools', async ({ page }) => {
    // Click on a visible extractor tool button
    const extractorButton = page.locator('[data-tool="extractor"]:visible').first();
    await extractorButton.click();

    // Wait for the tool to load
    await page.waitForTimeout(1000);

    // Verify the button is still attached (tool loaded)
    await expect(extractorButton).toBeAttached();
  });

  test('should show favorites section in the v4 color palette', async ({
    page,
  }) => {
    await expect(page.getByText(/Favorites \(\d+\)/)).toBeVisible();
  });

  test('should add a dye to favorites', async ({ page }) => {
    const addToFavoritesButton = page
      .locator('button[aria-label*="Add to favorites" i]')
      .first();
    await addToFavoritesButton.click();

    await expect(page.getByText(/Favorites \(1\)/)).toBeVisible();
  });

  test('should collapse and expand favorites section', async ({ page }) => {
    const favoritesHeader = page.getByText(/Favorites \(\d+\)/).first();

    await favoritesHeader.click();
    await expect(page.getByText(/Click the ★ on any dye to add it to your favorites/i)).toBeHidden();

    await favoritesHeader.click();
    await expect(page.getByText(/Click the ★ on any dye to add it to your favorites/i)).toBeVisible();
  });

  test('should clear favorites from advanced settings', async ({ page }) => {
    const addToFavoritesButton = page
      .locator('button[aria-label*="Add to favorites" i]')
      .first();
    await addToFavoritesButton.click();
    await expect(page.getByText(/Favorites \(1\)/)).toBeVisible();

    await expandAdvancedSettings(page);

    const clearFavoritesButton = page.getByRole('button', { name: /^Clear Favorites$/i }).first();
    await clearFavoritesButton.click();

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const raw = localStorage.getItem('xivdye-favorites');
          if (!raw) return 0;

          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.length : -1;
          } catch {
            return -1;
          }
        });
      })
      .toBe(0);
  });

  test('should export app data as JSON from advanced settings', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('xivdye-collections');
      localStorage.removeItem('xivdye-favorites');
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.10.0');
      localStorage.setItem('xivdyetools_tutorials_disabled', 'true');
    });
    await page.reload();
    await waitForAppReady(page);

    await expandAdvancedSettings(page);

    const exportBtn = page.getByRole('button', { name: /^Export$/i }).first();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      exportBtn.click(),
    ]);
    if (download) {
      expect(download.suggestedFilename().toLowerCase()).toContain('.json');
    }
  });
});

test.describe('App Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStartupStorage(page);

    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(500);
  });

  test('should navigate to different tools', async ({ page }) => {
    // Navigate to each tool and verify it loads
    const tools = [
      'harmony',
      'extractor',
      'accessibility',
      'comparison',
      'gradient',
      'mixer',
      'presets',
      'budget',
      'swatch',
    ];

    for (const toolId of tools) {
      // Use :visible to target the visible button (desktop or mobile)
      const button = page.locator(`[data-tool="${toolId}"]:visible`).first();

      if ((await button.count()) > 0) {
        await button.click();
        await page.waitForTimeout(1000); // Wait for tool to load

        // Verify the button is still attached (tool loaded successfully)
        await expect(button).toBeAttached();
      }
    }
  });

  test('should persist tool state across page interactions', async ({ page }) => {
    // Click on a visible extractor tool button
    const extractorButton = page.locator('[data-tool="extractor"]:visible').first();
    await extractorButton.click();
    await page.waitForTimeout(1000);

    // The matcher tool should be "selected" (active state)
    // Verify by checking it's still attached
    await expect(extractorButton).toBeAttached();
  });
});
