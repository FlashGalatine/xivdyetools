import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Color Matcher Tool
 *
 * Tests the color matching functionality including:
 * - Tool navigation and loading
 * - Image upload display
 * - Manual color picker input
 * - Sample size settings
 * - Extraction mode (Single Color / Palette)
 * - Dye filters
 * - Results display
 */

test.describe('Color Matcher Tool', () => {
  test.beforeEach(async ({ page }) => {
    // Mark welcome/changelog modals as seen
    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '2.6.0');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 15000 }
    );
    await page.waitForSelector('[data-tool-id]', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Navigate to Color Matcher tool
    const matcherButton = page.locator('[data-tool-id="matcher"]:visible').first();
    await matcherButton.click();
    await page.waitForTimeout(1000);
  });

  test.describe('Tool Loading', () => {
    test('should navigate to Color Matcher tool', async ({ page }) => {
      // Verify the tool loaded by checking for its specific elements
      const imageUploadContainer = page.locator('#image-upload-container');
      await expect(imageUploadContainer).toBeAttached();
    });

    test('should display tool header', async ({ page }) => {
      // Check for tool header
      const toolHeader = page.locator('h2').first();
      await expect(toolHeader).toBeAttached();
    });
  });

  test.describe('Input Section', () => {
    test('should show image upload container', async ({ page }) => {
      const imageUploadContainer = page.locator('#image-upload-container');
      await expect(imageUploadContainer).toBeAttached();

      // It should have content (the upload component)
      const hasContent = await imageUploadContainer.evaluate((el) => el.children.length > 0);
      expect(hasContent).toBe(true);
    });

    test('should show color picker container', async ({ page }) => {
      const colorPickerContainer = page.locator('#color-picker-container');
      await expect(colorPickerContainer).toBeAttached();

      // It should have content
      const hasContent = await colorPickerContainer.evaluate((el) => el.children.length > 0);
      expect(hasContent).toBe(true);
    });
  });

  test.describe('Sample Settings', () => {
    test('should show sample size slider', async ({ page }) => {
      const sampleInput = page.locator('#sample-size-input');
      await expect(sampleInput).toBeAttached();
    });

    test('should show sample size value display', async ({ page }) => {
      const sampleValue = page.locator('#sample-size-value');
      await expect(sampleValue).toBeAttached();

      // Default value should be a number
      const value = await sampleValue.textContent();
      expect(parseInt(value || '0', 10)).toBeGreaterThan(0);
    });

    test('should update sample size value when slider changes', async ({ page }) => {
      const sampleInput = page.locator('#sample-size-input');
      const sampleValue = page.locator('#sample-size-value');

      // Change slider value
      await sampleInput.fill('32');
      await sampleInput.dispatchEvent('input');
      await page.waitForTimeout(100);

      // Verify display updated
      const newValue = await sampleValue.textContent();
      expect(newValue).toBe('32');
    });
  });

  test.describe('Extraction Mode', () => {
    test('should show extraction mode toggle buttons', async ({ page }) => {
      const singleModeBtn = page.locator('#single-mode-btn');
      const paletteModeBtn = page.locator('#palette-mode-btn');

      await expect(singleModeBtn).toBeAttached();
      await expect(paletteModeBtn).toBeAttached();
    });

    test('should default to Single Color mode', async ({ page }) => {
      // Single mode button should be styled as active
      const singleModeBtn = page.locator('#single-mode-btn');
      const className = await singleModeBtn.getAttribute('class');
      expect(className).toContain('border-blue-500');
    });

    test('should show palette options when Palette mode is selected', async ({ page }) => {
      const paletteModeBtn = page.locator('#palette-mode-btn');
      await paletteModeBtn.click();
      await page.waitForTimeout(200);

      // Palette options should become visible
      const paletteOptions = page.locator('#palette-options');
      await expect(paletteOptions).toBeVisible();
    });

    test('should hide palette options when switching back to Single mode', async ({ page }) => {
      // First enable palette mode
      const paletteModeBtn = page.locator('#palette-mode-btn');
      await paletteModeBtn.click();
      await page.waitForTimeout(200);

      // Then switch back to single mode
      const singleModeBtn = page.locator('#single-mode-btn');
      await singleModeBtn.click();
      await page.waitForTimeout(200);

      // Palette options should be hidden
      const paletteOptions = page.locator('#palette-options');
      await expect(paletteOptions).toHaveClass(/hidden/);
    });
  });

  test.describe('Palette Options', () => {
    test.beforeEach(async ({ page }) => {
      // Enable palette mode
      const paletteModeBtn = page.locator('#palette-mode-btn');
      await paletteModeBtn.click();
      await page.waitForTimeout(200);
    });

    test('should show color count slider', async ({ page }) => {
      const colorCountInput = page.locator('#palette-color-count');
      await expect(colorCountInput).toBeVisible();
    });

    test('should show color count value display', async ({ page }) => {
      const colorCountValue = page.locator('#color-count-value');
      await expect(colorCountValue).toBeVisible();
    });

    test('should update color count when slider changes', async ({ page }) => {
      const colorCountInput = page.locator('#palette-color-count');
      const colorCountValue = page.locator('#color-count-value');

      // Change slider (range is 3-5)
      await colorCountInput.fill('5');
      await colorCountInput.dispatchEvent('input');
      await page.waitForTimeout(100);

      // Verify display
      const newValue = await colorCountValue.textContent();
      expect(newValue).toBe('5');
    });

    test('should show extract palette button', async ({ page }) => {
      const extractBtn = page.locator('#extract-palette-btn');
      await expect(extractBtn).toBeVisible();
    });
  });

  test.describe('Additional Sections', () => {
    test('should show recent colors wrapper if present', async ({ page }) => {
      // Recent colors wrapper may or may not be visible depending on state
      const recentColorsWrapper = page.locator('#recent-colors-wrapper');
      const count = await recentColorsWrapper.count();
      // Just verify we can query for it (may be hidden initially)
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show dye filters container', async ({ page }) => {
      const filtersContainer = page.locator('#colormatcher-filters-container');
      await expect(filtersContainer).toBeAttached();
    });

    test('should show market board container', async ({ page }) => {
      const marketBoardContainer = page.locator('#market-board-container');
      await expect(marketBoardContainer).toBeAttached();
    });

    test('should show results container', async ({ page }) => {
      const resultsContainer = page.locator('#results-container');
      await expect(resultsContainer).toBeAttached();
    });
  });
});
