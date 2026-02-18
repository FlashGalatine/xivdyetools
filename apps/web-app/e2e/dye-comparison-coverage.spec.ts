/**
 * E2E Tests for Dye Comparison Tool - With Coverage Collection
 *
 * This file imports from the coverage fixtures to enable V8 coverage collection.
 * Run with: npx playwright test --project=chromium-coverage dye-comparison-coverage
 *
 * For regular testing without coverage overhead, use dye-comparison.spec.ts
 */

import { test, expect } from './fixtures/coverage';

test.describe('Dye Comparison Tool (Coverage)', () => {
  test.beforeEach(async ({ page }) => {
    // Mark welcome/changelog modals as seen (use current version to prevent changelog)
    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.0.0');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for app to load
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 15000 }
    );

    // Dismiss any modal that might appear (fallback)
    const gotItBtn = page.locator('button:has-text("Got it!")');
    if (await gotItBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await gotItBtn.click();
      await page.waitForTimeout(500);
    }

    // Dismiss offline alert if present using JavaScript click (bypasses viewport issues)
    await page.evaluate(() => {
      const dismissBtn = document.querySelector('button[aria-label*="dismiss"], [role="alert"] button');
      if (dismissBtn) {
        (dismissBtn as HTMLButtonElement).click();
      }
    });
    await page.waitForTimeout(300);

    // Wait for tool navigation to be available (use button text as the selector)
    await page.waitForSelector('button:has-text("Compare up to 4 dyes")', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);

    // Navigate to Dye Comparison tool using accessible name
    const comparisonButton = page.locator('button:has-text("Compare up to 4 dyes")').first();
    await comparisonButton.click();
    await page.waitForTimeout(1000);
  });

  test.describe('Core Functionality Coverage', () => {
    test('should load comparison tool and select dyes', async ({ page }) => {
      // Verify tool loaded
      const dyeSelectorContainer = page.locator('#dye-selector-container');
      await expect(dyeSelectorContainer).toBeAttached();

      // Select multiple dyes to exercise comparison logic
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 3) {
        for (let i = 0; i < 3; i++) {
          await dyeButtons.nth(i).click();
          await page.waitForTimeout(300);
        }

        // Verify result cards
        const resultCards = page.locator('v4-result-card');
        expect(await resultCards.count()).toBe(3);
      }
    });

    test('should toggle all display options', async ({ page }) => {
      // Select dyes first
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      if ((await dyeButtons.count()) >= 2) {
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);
      }

      // Toggle each checkbox to cover all option branches
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      for (let i = 0; i < count; i++) {
        const checkbox = checkboxes.nth(i);
        // Toggle on
        await checkbox.click();
        await page.waitForTimeout(100);
        // Toggle off
        await checkbox.click();
        await page.waitForTimeout(100);
      }
    });

    test('should exercise chart interactions', async ({ page }) => {
      // Select dyes
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      if ((await dyeButtons.count()) >= 2) {
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);
      }

      // Hover over hue-saturation chart
      const hueSatContainer = page.locator('#hue-sat-container');
      if ((await hueSatContainer.count()) > 0) {
        await hueSatContainer.hover();
        await page.waitForTimeout(200);
      }

      // Hover over brightness chart
      const brightnessContainer = page.locator('#brightness-container');
      if ((await brightnessContainer.count()) > 0) {
        await brightnessContainer.hover();
        await page.waitForTimeout(200);
      }

      // Hover over matrix
      const matrixContainer = page.locator('#matrix-container');
      if ((await matrixContainer.count()) > 0) {
        await matrixContainer.hover();
        await page.waitForTimeout(200);
      }
    });

    test('should exercise clear and remove functionality', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 2) {
        // Select dyes
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(300);

        // Click result card to remove
        const resultCard = page.locator('v4-result-card').first();
        await resultCard.click();
        await page.waitForTimeout(200);

        // Clear remaining
        const clearBtn = page.locator('button:has-text("Clear"), button:has-text("clear")');
        if ((await clearBtn.count()) > 0) {
          await clearBtn.first().click();
          await page.waitForTimeout(200);
        }
      }
    });

    test('should exercise server dropdown', async ({ page }) => {
      const serverSelect = page.locator('select').first();

      if ((await serverSelect.count()) > 0) {
        const options = serverSelect.locator('option');
        const optionCount = await options.count();

        // Cycle through server options
        for (let i = 0; i < Math.min(optionCount, 3); i++) {
          const value = await options.nth(i).getAttribute('value');
          if (value) {
            await serverSelect.selectOption(value);
            await page.waitForTimeout(200);
          }
        }
      }
    });
  });

  test.describe('Mobile Coverage', () => {
    test('should exercise mobile viewport code paths', async ({ page }) => {
      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Select dyes on mobile
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      if ((await dyeButtons.count()) > 0) {
        await dyeButtons.first().click();
        await page.waitForTimeout(300);
      }

      // Toggle checkboxes on mobile
      const checkboxes = page.locator('input[type="checkbox"]');
      if ((await checkboxes.count()) > 0) {
        await checkboxes.first().click();
        await page.waitForTimeout(100);
      }

      // Resize back to desktop
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);
    });
  });

  test.describe('Keyboard Navigation Coverage', () => {
    test('should exercise keyboard interactions', async ({ page }) => {
      // Tab through elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);
      }

      // Focus and activate checkbox
      const checkboxes = page.locator('input[type="checkbox"]');
      if ((await checkboxes.count()) > 0) {
        await checkboxes.first().focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(100);
      }
    });
  });

  test.describe('Edge Cases Coverage', () => {
    test('should handle max dye limit', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 5) {
        // Try to select more than max (4)
        for (let i = 0; i < 5; i++) {
          await dyeButtons.nth(i).click();
          await page.waitForTimeout(150);
        }

        // Verify max limit
        const resultCards = page.locator('v4-result-card');
        expect(await resultCards.count()).toBeLessThanOrEqual(4);
      }
    });

    test('should handle select and deselect same dye', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');

      if ((await dyeButtons.count()) > 0) {
        const firstDye = dyeButtons.first();

        // Select
        await firstDye.click();
        await page.waitForTimeout(200);

        // Deselect
        await firstDye.click();
        await page.waitForTimeout(200);

        // Select again
        await firstDye.click();
        await page.waitForTimeout(200);
      }
    });
  });
});
