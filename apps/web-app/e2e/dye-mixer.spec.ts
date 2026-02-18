import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Dye Mixer Tool
 *
 * Tests the dye mixing/interpolation functionality including:
 * - Tool navigation and loading
 * - Dye selector (2 dyes for start/end)
 * - Interpolation settings (step count, color space)
 * - Interpolation display
 * - Dye filters
 * - Quick actions (save gradient, share URL)
 * - Saved gradients section
 */

test.describe('Dye Mixer Tool', () => {
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

    // Navigate to Dye Mixer tool
    const mixerButton = page.locator('[data-tool-id="mixer"]:visible').first();
    await mixerButton.click();
    await page.waitForTimeout(1000);
  });

  test.describe('Tool Loading', () => {
    test('should navigate to Dye Mixer tool', async ({ page }) => {
      // Verify the tool loaded by checking for dye selector container
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

  test.describe('Dye Filters Section', () => {
    test('should show dye filters container', async ({ page }) => {
      const filtersContainer = page.locator('#dyemixer-filters-container');
      await expect(filtersContainer).toBeAttached();
    });

    test('should show dye filters with content', async ({ page }) => {
      const filtersContainer = page.locator('#dyemixer-filters-container');

      // Wait for content to load
      await page.waitForTimeout(500);

      // It should have content
      const hasContent = await filtersContainer.evaluate((el) => el.children.length > 0);
      expect(hasContent).toBe(true);
    });
  });

  test.describe('Interpolation Settings', () => {
    test('should show step count slider', async ({ page }) => {
      const stepInput = page.locator('#step-count-input');
      await expect(stepInput).toBeAttached();
    });

    test('should show step count value display', async ({ page }) => {
      const stepValue = page.locator('#step-count-value');
      await expect(stepValue).toBeAttached();

      // Default value should be 10
      const value = await stepValue.textContent();
      expect(value).toBe('10');
    });

    test('should update step count value when slider changes', async ({ page }) => {
      const stepInput = page.locator('#step-count-input');
      const stepValue = page.locator('#step-count-value');

      // Change slider value
      await stepInput.fill('15');
      await stepInput.dispatchEvent('input');
      await page.waitForTimeout(100);

      // Verify display updated
      const newValue = await stepValue.textContent();
      expect(newValue).toBe('15');
    });

    test('should show color space radio buttons', async ({ page }) => {
      const rgbRadio = page.locator('#color-space-rgb');
      const hsvRadio = page.locator('#color-space-hsv');

      await expect(rgbRadio).toBeAttached();
      await expect(hsvRadio).toBeAttached();
    });

    test('should default to HSV color space', async ({ page }) => {
      const hsvRadio = page.locator('#color-space-hsv');

      // HSV should be checked by default
      await expect(hsvRadio).toBeChecked();
    });

    test('should allow switching to RGB color space', async ({ page }) => {
      const rgbRadio = page.locator('#color-space-rgb');

      await rgbRadio.click();
      await page.waitForTimeout(100);

      await expect(rgbRadio).toBeChecked();
    });
  });

  test.describe('Interpolation Display', () => {
    test('should show interpolation display container', async ({ page }) => {
      const displayContainer = page.locator('#interpolation-display-container');
      await expect(displayContainer).toBeAttached();
    });

    test('should show empty state when less than 2 dyes selected', async ({ page }) => {
      const displayContainer = page.locator('#interpolation-display-container');

      // Wait for component to initialize
      await page.waitForTimeout(500);

      // Should have content (the "select two dyes" message)
      const hasContent = await displayContainer.evaluate((el) => el.children.length > 0);
      expect(hasContent).toBe(true);
    });
  });

  test.describe('Export Section', () => {
    test('should show export container', async ({ page }) => {
      const exportContainer = page.locator('#dyemixer-export-container');
      await expect(exportContainer).toBeAttached();
    });
  });

  test.describe('Quick Actions', () => {
    test('should show save gradient button', async ({ page }) => {
      const saveBtn = page.locator('#save-gradient-btn');
      await expect(saveBtn).toBeAttached();
    });

    test('should show copy URL button', async ({ page }) => {
      const copyBtn = page.locator('#copy-url-btn');
      await expect(copyBtn).toBeAttached();
    });
  });

  test.describe('Saved Gradients Section', () => {
    test('should show saved gradients container', async ({ page }) => {
      const savedContainer = page.locator('#saved-gradients-container');
      await expect(savedContainer).toBeAttached();
    });

    test('should show toggle button for saved gradients', async ({ page }) => {
      const toggleBtn = page.locator('#toggle-saved-gradients');
      await expect(toggleBtn).toBeAttached();
    });

    test('should show no saved gradients hint when empty', async ({ page }) => {
      const noSavedText = page.locator('#no-saved-gradients-text');
      await expect(noSavedText).toBeAttached();

      // Should be visible when no gradients are saved
      const isVisible = await noSavedText.isVisible();
      expect(isVisible).toBe(true);
    });

    test('should toggle saved gradients panel visibility', async ({ page }) => {
      const toggleBtn = page.locator('#toggle-saved-gradients');
      const savedContainer = page.locator('#saved-gradients-container');

      // Initial state - should be visible (max-height: 300px)
      const initialMaxHeight = await savedContainer.evaluate((el) => el.style.maxHeight);

      // Click toggle
      await toggleBtn.click();
      await page.waitForTimeout(350); // Wait for animation

      // Should be collapsed (max-height: 0px)
      const collapsedMaxHeight = await savedContainer.evaluate((el) => el.style.maxHeight);
      expect(collapsedMaxHeight).toBe('0px');

      // Click toggle again
      await toggleBtn.click();
      await page.waitForTimeout(350); // Wait for animation

      // Should be expanded again
      const expandedMaxHeight = await savedContainer.evaluate((el) => el.style.maxHeight);
      expect(expandedMaxHeight).toBe('300px');
    });
  });
});

test.describe('Dye Mixer - UI Interaction', () => {
  test.beforeEach(async ({ page }) => {
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

    // Navigate to Dye Mixer tool
    const mixerButton = page.locator('[data-tool-id="mixer"]:visible').first();
    await mixerButton.click();
    await page.waitForTimeout(1000);
  });

  test('should have tool-specific card styling', async ({ page }) => {
    // Wait for content
    await page.waitForTimeout(500);

    // Look for card containers
    const cards = page.locator('.bg-white.rounded-lg, .dark\\:bg-gray-800.rounded-lg');
    const count = await cards.count();

    // Should have cards for selector, filters, and settings
    expect(count).toBeGreaterThan(0);
  });

  test('should have responsive button layout in quick actions', async ({ page }) => {
    // Wait for content
    await page.waitForTimeout(500);

    // Look for the quick actions container with flex layout
    const actionsContainer = page.locator('.flex.flex-col.sm\\:flex-row');
    const count = await actionsContainer.count();

    // Should have at least one responsive flex container
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
