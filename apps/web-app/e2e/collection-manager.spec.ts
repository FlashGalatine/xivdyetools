import { test, expect } from './fixtures/coverage';
import { waitForAppReady, gotoTool, seedStartupStorage, dismissBlockingOverlays } from './fixtures/navigation';

async function switchToTool(
  page: Parameters<typeof test>[0]['page'],
  toolId: string
): Promise<void> {
  await gotoTool(page, toolId);
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

    // The 2B switcher holds the tool list — open it and confirm it is populated
    await page.locator('button.tool-menu-btn').first().click();
    const allToolButtons = page.locator('button[data-tool]');
    await expect(allToolButtons.first()).toBeAttached();
    expect(await allToolButtons.count()).toBeGreaterThan(0);
  });

  test('should show tool navigation buttons', async ({ page }) => {
    // Every tool is reachable from the switcher's menu
    await page.locator('button.tool-menu-btn').first().click();
    await expect(page.locator('button[data-tool="harmony"]').first()).toBeAttached();
    expect(await page.locator('button[data-tool="extractor"]').count()).toBeGreaterThan(0);
    expect(await page.locator('button[data-tool="comparison"]').count()).toBeGreaterThan(0);
  });

  test('should be able to switch between tools', async ({ page }) => {
    await gotoTool(page, 'extractor');

    // The route changed and the tool rendered into the shell
    expect(page.url()).toContain('extractor');
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
      // Startup flags come from seedStartupStorage's init script, which
      // re-runs on the reload below. Setting a stale version here is what
      // used to pop What's New over this test.
    });
    await page.reload();
    await waitForAppReady(page);

    await expandAdvancedSettings(page);

    // Export lives in the Backup section card, which renders COLLAPSED
    // (sectionCard(..., open: false) in advanced-options-panel). Opening
    // Advanced Settings is not enough — the row has to be revealed first.
    const backupSection = page.getByRole('button', { name: /Backup/i }).first();
    await backupSection.click();

    const exportBtn = page.getByRole('button', { name: /^Export$/i }).first();
    await expect(exportBtn).toBeVisible();
    // Now that the button is genuinely reachable, require the download rather
    // than tolerating its absence — a tolerated no-op is how this test stayed
    // green while the row it clicks was buried in a collapsed section.
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      exportBtn.click(),
    ]);
    expect(download.suggestedFilename().toLowerCase()).toContain('.json');
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
      await gotoTool(page, toolId);
      // The tool rendered into the shell
      expect(page.url()).toContain(toolId);
    }
  });

  test('should persist tool state across page interactions', async ({ page }) => {
    await gotoTool(page, 'extractor');

    // The extractor stays the active tool after the shell settles
    await page.waitForTimeout(500);
    expect(page.url()).toContain('extractor');
  });
});
