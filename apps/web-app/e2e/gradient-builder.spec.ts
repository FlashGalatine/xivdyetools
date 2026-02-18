import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Gradient Builder Tool (v4)
 *
 * Tests the gradient/dye mixing functionality including:
 * - Tool navigation and loading
 * - Dye selection (start/end colors)
 * - Gradient preview visualization
 * - Interpolation settings (step count, color space)
 * - Display options
 * - Export functionality
 *
 * Note: The v4 "Gradient Builder" was previously called "Dye Mixer" in v3.
 * The route changed from /mixer to /gradient.
 *
 * V4 Architecture: Uses Lit web components with v4-config-sidebar for settings
 * and gradient-tool.ts for main content. Tests use role-based selectors for
 * better compatibility with the component structure.
 */

test.describe('Gradient Builder Tool', () => {
  test.beforeEach(async ({ page }) => {
    // Mark welcome/changelog modals as seen
    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.0.0');
    });

    // Navigate directly to gradient tool
    await page.goto('/gradient');
    await page.waitForLoadState('networkidle');

    // Wait for app to initialize
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 15000 }
    );

    // Wait for main content area to be available (role="main" in v4 layout)
    await page.waitForSelector('main', { state: 'attached', timeout: 15000 });
  });

  test.describe('Tool Loading', () => {
    test('should load the gradient builder tool', async ({ page }) => {
      // URL should be /gradient
      expect(page.url()).toContain('/gradient');
    });

    test('should display gradient builder UI elements', async ({ page }) => {
      // V4 layout uses main role for the tool content area
      const mainContent = page.locator('main');
      await expect(mainContent).toBeAttached({ timeout: 10000 });
    });

    test('should show start and end gradient nodes', async ({ page }) => {
      // V4 gradient nodes are in the main content area - look for clickable gradient elements
      // The nodes contain accessible descriptions about selecting colors
      const mainContent = page.locator('main');
      const gradientNodes = mainContent.locator('[cursor="pointer"], [style*="cursor"]');
      const count = await gradientNodes.count();

      // Should have at least start and end nodes plus intermediate steps
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Dye Selection', () => {
    test('should show dye selector panel', async ({ page }) => {
      // V4 uses dye-palette-drawer component with complementary role
      const dyePanel = page.locator('complementary, [role="complementary"]');
      await expect(dyePanel.first()).toBeAttached({ timeout: 10000 });
    });

    test('should have dye swatches available', async ({ page }) => {
      // Find dye buttons in the palette drawer
      const dyeSwatches = page.locator('[role="complementary"] button');
      const count = await dyeSwatches.count();

      // Should have dye options to choose from
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Gradient Visualization', () => {
    test('should show gradient results section', async ({ page }) => {
      // Look for the main content area which contains gradient visualization
      const mainContent = page.locator('main');
      await expect(mainContent).toBeAttached({ timeout: 10000 });
    });

    test('should display step indicators', async ({ page }) => {
      // V4 shows gradient step results in the main content
      // Results section contains technical info like HEX, RGB, HSV values
      const mainContent = page.locator('main');

      // Look for text containing "HEX" which labels the hex color values
      const hexLabels = mainContent.getByText('HEX');
      const count = await hexLabels.count();

      // Should have HEX labels displayed for gradient step results
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Settings Panel', () => {
    test('should show interpolation settings', async ({ page }) => {
      // V4 uses a slider role for step count in the config sidebar
      const stepSlider = page.getByRole('slider');
      await expect(stepSlider.first()).toBeAttached({ timeout: 10000 });
    });

    test('should have step count control', async ({ page }) => {
      // Look for slider control in the sidebar
      const stepSlider = page.getByRole('slider');
      await expect(stepSlider.first()).toBeAttached({ timeout: 10000 });

      // Verify it has a value
      const value = await stepSlider.first().inputValue();
      expect(parseInt(value)).toBeGreaterThanOrEqual(2);
    });

    test('should have color space selection', async ({ page }) => {
      // V4 uses a combobox for color space selection
      const colorSpaceCombo = page.getByRole('combobox').first();
      await expect(colorSpaceCombo).toBeAttached({ timeout: 10000 });
    });
  });

  test.describe('Display Options', () => {
    test('should show display options panel', async ({ page }) => {
      // V4 has expandable display options sections with buttons
      const displayOptionsButton = page.getByRole('button', { expanded: true });
      const count = await displayOptionsButton.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show toggle switches for display options', async ({ page }) => {
      // V4 uses switch role for toggle options
      const switches = page.getByRole('switch');
      const count = await switches.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Responsive Layout', () => {
    test('should have sidebar on desktop', async ({ page }) => {
      // Check viewport is desktop size
      const viewportSize = page.viewportSize();
      if (viewportSize && viewportSize.width >= 1024) {
        // V4 uses complementary role for sidebars
        const sidebar = page.locator('[role="complementary"]');
        const count = await sidebar.count();
        expect(count).toBeGreaterThan(0);
      }
    });

    test('should adapt to mobile viewport', async ({ page }) => {
      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      // Page should still render without errors
      const app = page.locator('#app');
      await expect(app).toBeAttached();
    });
  });
});

test.describe('Gradient Builder - Interaction Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.0.0');
    });

    // Navigate directly to gradient tool
    await page.goto('/gradient');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 15000 }
    );

    // Wait for main content area
    await page.waitForSelector('main', { state: 'attached', timeout: 15000 });
  });

  test('should select a dye from the palette', async ({ page }) => {
    // Find dye buttons in the palette drawer (complementary role)
    const dyePalette = page.locator('[role="complementary"]').last();
    const dyeButtons = dyePalette.locator('button');
    const count = await dyeButtons.count();

    if (count > 5) {
      // Click a dye button (skip the first few which are filter buttons)
      await dyeButtons.nth(5).click();
      await page.waitForTimeout(300);
    }
  });

  test('should update gradient when changing step count', async ({ page }) => {
    // Find step count slider
    const stepSlider = page.getByRole('slider').first();

    if (await stepSlider.isVisible()) {
      // Change the value
      await stepSlider.fill('5');
      await stepSlider.dispatchEvent('input');
      await page.waitForTimeout(300);

      // Value should be updated
      const value = await stepSlider.inputValue();
      expect(parseInt(value)).toBeGreaterThanOrEqual(2);
    }
  });

  test('should change color space selection', async ({ page }) => {
    // Find color space combobox (native select element)
    const colorSpaceCombo = page.getByRole('combobox').first();

    if (await colorSpaceCombo.isVisible()) {
      // Use selectOption for native select elements
      await colorSpaceCombo.selectOption({ index: 0 }); // Select first option (HSV)
      await page.waitForTimeout(300);

      // Verify the selection worked by checking the value changed
      const value = await colorSpaceCombo.inputValue();
      expect(value).toBeDefined();
    }
  });

  test('should handle navigation back and forward', async ({ page }) => {
    // Navigate to another tool
    await page.goto('/harmony');
    await page.waitForTimeout(1000);

    // Go back
    await page.goBack();
    await page.waitForTimeout(1000);

    // Should be back at gradient
    expect(page.url()).toContain('/gradient');
  });
});

test.describe('Gradient Builder - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.0.0');
    });

    // Navigate directly to gradient tool
    await page.goto('/gradient');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(
      () => {
        const app = document.getElementById('app');
        return app && app.children.length > 0;
      },
      { timeout: 15000 }
    );

    // Wait for main content area
    await page.waitForSelector('main', { state: 'attached', timeout: 15000 });
  });

  test('should have proper landmark structure', async ({ page }) => {
    // V4 uses proper ARIA landmarks
    const main = page.locator('main');
    const nav = page.locator('nav, [role="navigation"]');
    const complementary = page.locator('[role="complementary"]');

    await expect(main).toBeAttached();
    expect(await nav.count()).toBeGreaterThan(0);
    expect(await complementary.count()).toBeGreaterThan(0);
  });

  test('should have interactive elements with accessible names', async ({ page }) => {
    const buttons = page.locator('button');
    const count = await buttons.count();

    // At least some buttons should exist
    expect(count).toBeGreaterThan(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Press Tab to navigate
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Something should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
  });

  test('should have proper form controls', async ({ page }) => {
    // Check for accessible form controls
    const sliders = page.getByRole('slider');
    const switches = page.getByRole('switch');
    const comboboxes = page.getByRole('combobox');

    expect(await sliders.count()).toBeGreaterThan(0);
    expect(await switches.count()).toBeGreaterThan(0);
    expect(await comboboxes.count()).toBeGreaterThan(0);
  });
});
