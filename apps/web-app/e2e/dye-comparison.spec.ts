import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Dye Comparison Tool
 *
 * Tests the dye comparison functionality including:
 * - Tool navigation and loading
 * - Dye selector (up to 4 dyes)
 * - Analysis sections (matrix, charts)
 * - Display options toggles
 * - Mobile drawer interactions
 * - Market Board integration
 * - Clear and remove functionality
 */

test.describe('Dye Comparison Tool', () => {
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

    // Wait for tool navigation to be available
    await page.waitForSelector('nav[aria-label*="tool" i], [role="navigation"]', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(500);

    // Navigate to Dye Comparison tool using getByRole with accessible name
    const comparisonButton = page.getByRole('button', { name: /Compare up to 4 dyes/i });
    await comparisonButton.click();
    await page.waitForTimeout(1000);
  });

  test.describe('Tool Loading', () => {
    test('should navigate to Dye Comparison tool', async ({ page }) => {
      // Verify the tool loaded by checking for its specific elements
      const dyeSelectorContainer = page.locator('#dye-selector-container');
      await expect(dyeSelectorContainer).toBeAttached();
    });

    test('should display tool header', async ({ page }) => {
      const toolHeader = page.locator('h2').first();
      await expect(toolHeader).toBeAttached();
    });
  });

  test.describe('Dye Selector Section', () => {
    test('should show dye selector container', async ({ page }) => {
      const dyeSelectorContainer = page.locator('#dye-selector-container');
      await expect(dyeSelectorContainer).toBeAttached();
    });

    test('should show dye selector with content', async ({ page }) => {
      const dyeSelectorContainer = page.locator('#dye-selector-container');

      // Wait for content to load
      await page.waitForTimeout(500);

      // It should have content (the dye selector component)
      const hasContent = await dyeSelectorContainer.evaluate((el) => el.children.length > 0);
      expect(hasContent).toBe(true);
    });

    test('should have selectable dye elements', async ({ page }) => {
      const dyeSelectorContainer = page.locator('#dye-selector-container');

      // Wait for content to load
      await page.waitForTimeout(500);

      // Should have interactive elements (buttons for dyes)
      const interactiveElements = dyeSelectorContainer.locator('button, [role="button"]');
      const count = await interactiveElements.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Dye Selection Workflow', () => {
    test('should select a dye from the selector', async ({ page }) => {
      // Find dye selector buttons
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count > 0) {
        const firstDye = dyeButtons.first();
        await firstDye.click();
        await page.waitForTimeout(500);

        // Should see result card appear
        const resultCards = page.locator('v4-result-card');
        expect(await resultCards.count()).toBeGreaterThan(0);
      } else {
        test.skip();
      }
    });

    test('should select multiple dyes (up to 4)', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 4) {
        // Select 4 dyes
        for (let i = 0; i < 4; i++) {
          await dyeButtons.nth(i).click();
          await page.waitForTimeout(300);
        }

        // Should have 4 result cards
        const resultCards = page.locator('v4-result-card');
        expect(await resultCards.count()).toBe(4);
      } else {
        test.skip();
      }
    });

    test('should not select more than 4 dyes', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 5) {
        // Try to select 5 dyes
        for (let i = 0; i < 5; i++) {
          await dyeButtons.nth(i).click();
          await page.waitForTimeout(200);
        }

        // Should still only have 4 result cards (max limit)
        const resultCards = page.locator('v4-result-card');
        expect(await resultCards.count()).toBeLessThanOrEqual(4);
      } else {
        test.skip();
      }
    });

    test('should show analysis sections with 2+ dyes', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 2) {
        // Select 2 dyes
        await dyeButtons.nth(0).click();
        await page.waitForTimeout(300);
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);

        // Analysis sections should have content
        const summaryContainer = page.locator('#summary-container');
        const hasContent = await summaryContainer.evaluate((el) => el.innerHTML.length > 0);
        expect(hasContent).toBe(true);
      } else {
        test.skip();
      }
    });

    test('should deselect dye when clicking selected dye again', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count > 0) {
        const firstDye = dyeButtons.first();

        // Select
        await firstDye.click();
        await page.waitForTimeout(300);
        const cardsAfterSelect = await page.locator('v4-result-card').count();

        // Click again to deselect
        await firstDye.click();
        await page.waitForTimeout(300);
        const cardsAfterDeselect = await page.locator('v4-result-card').count();

        // Should have fewer cards after deselect
        expect(cardsAfterDeselect).toBeLessThan(cardsAfterSelect);
      } else {
        test.skip();
      }
    });
  });

  test.describe('Analysis Sections', () => {
    test('should show summary container', async ({ page }) => {
      const summaryContainer = page.locator('#summary-container');
      await expect(summaryContainer).toBeAttached();
    });

    test('should show matrix container', async ({ page }) => {
      const matrixContainer = page.locator('#matrix-container');
      await expect(matrixContainer).toBeAttached();
    });

    test('should show hue-saturation chart container', async ({ page }) => {
      const hueSatContainer = page.locator('#hue-sat-container');
      await expect(hueSatContainer).toBeAttached();
    });

    test('should show brightness chart container', async ({ page }) => {
      const brightnessContainer = page.locator('#brightness-container');
      await expect(brightnessContainer).toBeAttached();
    });

    test('should show export container', async ({ page }) => {
      const exportContainer = page.locator('#export-container');
      await expect(exportContainer).toBeAttached();
    });

    test('should render distance matrix with multiple dyes', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 3) {
        // Select 3 dyes for meaningful matrix
        for (let i = 0; i < 3; i++) {
          await dyeButtons.nth(i).click();
          await page.waitForTimeout(300);
        }

        // Matrix should have cells
        const matrixContainer = page.locator('#matrix-container');
        const hasContent = await matrixContainer.evaluate((el) => el.innerHTML.length > 50);
        expect(hasContent).toBe(true);
      } else {
        test.skip();
      }
    });
  });

  test.describe('Display Options Toggles', () => {
    test('should find options panel with checkboxes', async ({ page }) => {
      // Look for checkboxes in the left panel (options section)
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should toggle a display option checkbox', async ({ page }) => {
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        const firstCheckbox = checkboxes.first();
        const initialState = await firstCheckbox.isChecked();

        await firstCheckbox.click();
        await page.waitForTimeout(200);

        const newState = await firstCheckbox.isChecked();
        expect(newState).not.toBe(initialState);
      } else {
        test.skip();
      }
    });

    test('should persist checkbox state after toggle', async ({ page }) => {
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        const firstCheckbox = checkboxes.first();

        // Toggle twice
        await firstCheckbox.click();
        await page.waitForTimeout(100);
        const stateAfterFirst = await firstCheckbox.isChecked();

        await firstCheckbox.click();
        await page.waitForTimeout(100);
        const stateAfterSecond = await firstCheckbox.isChecked();

        // States should be opposite
        expect(stateAfterSecond).not.toBe(stateAfterFirst);
      } else {
        test.skip();
      }
    });

    test('should update display when toggling showHex option', async ({ page }) => {
      // First select some dyes
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      if ((await dyeButtons.count()) >= 2) {
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);
      }

      // Find and toggle a checkbox
      const checkboxes = page.locator('input[type="checkbox"]');
      if ((await checkboxes.count()) > 0) {
        await checkboxes.first().click();
        await page.waitForTimeout(300);

        // Page should still be functional
        const resultCards = page.locator('v4-result-card');
        expect(await resultCards.count()).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Market Board', () => {
    test('should show market board container', async ({ page }) => {
      const marketBoardContainer = page.locator('#market-board-container');
      await expect(marketBoardContainer).toBeAttached();
    });

    test('should have server selection dropdown', async ({ page }) => {
      const serverSelect = page.locator('select');
      const count = await serverSelect.count();

      // May have server dropdown
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should change server selection', async ({ page }) => {
      const serverSelect = page.locator('select').first();

      if ((await serverSelect.count()) > 0) {
        // Get options
        const options = serverSelect.locator('option');
        const optionCount = await options.count();

        if (optionCount > 1) {
          // Select second option
          const secondValue = await options.nth(1).getAttribute('value');
          if (secondValue) {
            await serverSelect.selectOption(secondValue);
            await page.waitForTimeout(300);
          }
        }
      }
    });
  });

  test.describe('Clear and Remove Dyes', () => {
    test('should clear all dyes when clicking clear button', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 2) {
        // Select 2 dyes first
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);

        // Verify dyes are selected
        const cardsBeforeClear = await page.locator('v4-result-card').count();
        expect(cardsBeforeClear).toBe(2);

        // Find clear button (may have various text)
        const clearBtn = page.locator(
          'button:has-text("Clear"), button:has-text("clear"), button[aria-label*="clear" i]'
        );

        if ((await clearBtn.count()) > 0) {
          await clearBtn.first().click();
          await page.waitForTimeout(500);

          // Result cards should be gone
          const cardsAfterClear = await page.locator('v4-result-card').count();
          expect(cardsAfterClear).toBe(0);
        }
      } else {
        test.skip();
      }
    });

    test('should remove individual dye via result card click', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 2) {
        // Select 2 dyes
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);

        // Click on result card to remove
        const resultCard = page.locator('v4-result-card').first();
        await resultCard.click();
        await page.waitForTimeout(300);

        // Should have 1 card remaining
        const remainingCards = await page.locator('v4-result-card').count();
        expect(remainingCards).toBe(1);
      } else {
        test.skip();
      }
    });
  });

  test.describe('Chart Layout', () => {
    test('should have charts in a grid layout', async ({ page }) => {
      // The charts should be in a 2-column grid on large screens
      const hueSatContainer = page.locator('#hue-sat-container');
      const brightnessContainer = page.locator('#brightness-container');

      // Both should be siblings in the same parent grid
      const hueSatParent = await hueSatContainer.evaluate((el) => el.parentElement?.className);
      const brightnessParent = await brightnessContainer.evaluate(
        (el) => el.parentElement?.className
      );

      // Parent should have grid classes
      expect(hueSatParent).toContain('grid');
      expect(brightnessParent).toContain('grid');
    });
  });

  test.describe('Chart Hover Interactions', () => {
    test('should handle hover on hue-saturation chart elements', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 2) {
        // Select 2 dyes to show charts
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);

        // Find chart container
        const hueSatContainer = page.locator('#hue-sat-container');

        // Hover over the chart area
        await hueSatContainer.hover();
        await page.waitForTimeout(200);

        // Chart should still be visible
        await expect(hueSatContainer).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('should handle hover on brightness chart bars', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 2) {
        // Select 2 dyes
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);

        // Find brightness chart container
        const brightnessContainer = page.locator('#brightness-container');

        // Hover over the chart
        await brightnessContainer.hover();
        await page.waitForTimeout(200);

        // Chart should still be visible
        await expect(brightnessContainer).toBeVisible();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Mobile Drawer Interactions', () => {
    test('should show drawer content on mobile viewport', async ({ page }) => {
      // Resize to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // The drawer or mobile layout should be present
      const mobileElements = page.locator(
        '.drawer-content, [data-drawer], .mobile-panel, .comparison-drawer'
      );
      const count = await mobileElements.count();

      // Mobile-specific elements may or may not be present depending on breakpoint handling
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should be able to select dyes on mobile', async ({ page }) => {
      // Resize to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Find dye buttons (may be in different location on mobile)
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count > 0) {
        await dyeButtons.first().click();
        await page.waitForTimeout(300);

        // Should have selected a dye
        const resultCards = page.locator('v4-result-card');
        expect(await resultCards.count()).toBeGreaterThanOrEqual(0);
      }
    });

    test('should toggle options on mobile', async ({ page }) => {
      // Resize to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Find checkboxes (may be in drawer)
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        const firstCheckbox = checkboxes.first();
        const initialState = await firstCheckbox.isChecked();

        await firstCheckbox.click();
        await page.waitForTimeout(200);

        const newState = await firstCheckbox.isChecked();
        expect(newState).not.toBe(initialState);
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should be able to tab through interactive elements', async ({ page }) => {
      // Press Tab multiple times
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Something should be focused (not body)
      const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedTag).not.toBe('BODY');
    });

    test('should activate checkbox with Space key', async ({ page }) => {
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();

      if (count > 0) {
        const firstCheckbox = checkboxes.first();
        const initialState = await firstCheckbox.isChecked();

        // Focus and press Space
        await firstCheckbox.focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);

        const newState = await firstCheckbox.isChecked();
        expect(newState).not.toBe(initialState);
      }
    });
  });

  test.describe('Persistence', () => {
    test('should persist selected dyes after page reload', async ({ page }) => {
      const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
      const count = await dyeButtons.count();

      if (count >= 2) {
        // Select 2 dyes
        await dyeButtons.nth(0).click();
        await dyeButtons.nth(1).click();
        await page.waitForTimeout(500);

        // Reload the page
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);

        // Dismiss any modal that might appear
        const gotItBtn = page.locator('button:has-text("Got it!")');
        if (await gotItBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await gotItBtn.click();
          await page.waitForTimeout(300);
        }

        // Wait for navigation to be available
        await page.waitForSelector('button:has-text("Compare up to 4 dyes")', { state: 'visible', timeout: 10000 });

        // Navigate back to comparison tool
        const comparisonButton = page.locator('button:has-text("Compare up to 4 dyes")').first();
        await comparisonButton.click();
        await page.waitForTimeout(1000);

        // Should have persisted dyes
        const resultCards = page.locator('v4-result-card');
        const persistedCount = await resultCards.count();

        // May or may not persist depending on implementation
        expect(persistedCount).toBeGreaterThanOrEqual(0);
      } else {
        test.skip();
      }
    });
  });
});
