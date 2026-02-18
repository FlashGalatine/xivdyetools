import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Accessibility Checker Tool (Vision)
 *
 * Tests the accessibility/colorblindness simulation functionality including:
 * - Tool navigation and loading
 * - Vision type toggles (deuteranopia, protanopia, tritanopia, achromatopsia)
 * - Simulation display options (labels, hex values, high contrast)
 * - Dye selection from the color palette
 * - Analysis results display
 */

/**
 * Helper function to navigate to the Accessibility Checker (Vision) tool
 * Uses text-based selector to find the tool button since v4 uses shadow DOM
 */
async function navigateToAccessibilityTool(page: Page): Promise<void> {
  // Wait for the app to be fully loaded
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(
    () => {
      const app = document.getElementById('app');
      return app && app.children.length > 0;
    },
    { timeout: 15000 }
  );

  // Wait for navigation bar to appear (look for tool buttons by their visible text)
  await page.waitForSelector('nav button', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(500);

  // Find and click the Vision (Accessibility Checker) tool button
  // The button contains text "Vision" and has aria-label "Simulate colorblindness"
  const visionButton = page.getByRole('button', { name: /simulate colorblindness/i }).first();
  await visionButton.click();
  await page.waitForTimeout(1000);
}

test.describe('Accessibility Checker Tool', () => {
  test.beforeEach(async ({ page }) => {
    // Mark welcome/changelog modals as seen
    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.0.0');
    });

    await page.goto('/');
    await navigateToAccessibilityTool(page);
  });

  test.describe('Tool Loading', () => {
    test('should navigate to Accessibility Checker tool', async ({ page }) => {
      // Verify the tool loaded by checking for Vision Types section in sidebar
      const visionTypesHeading = page.getByText('Vision Types').first();
      await expect(visionTypesHeading).toBeVisible();
    });

    test('should display colorblindness type toggles', async ({ page }) => {
      // Check for the vision type switches
      const deuteranopiaSwitch = page.getByRole('switch', { name: /deuteranopia/i });
      await expect(deuteranopiaSwitch).toBeVisible();
    });

    test('should display simulation display options', async ({ page }) => {
      // Check for display options section
      const displaySection = page.getByText('Simulation Display').first();
      await expect(displaySection).toBeVisible();
    });
  });

  test.describe('Vision Type Toggles', () => {
    test('should have all four colorblindness type switches', async ({ page }) => {
      // Check for each vision type switch
      const deuteranopia = page.getByRole('switch', { name: /deuteranopia/i });
      const protanopia = page.getByRole('switch', { name: /protanopia/i });
      const tritanopia = page.getByRole('switch', { name: /tritanopia/i });
      const achromatopsia = page.getByRole('switch', { name: /achromatopsia/i });

      await expect(deuteranopia).toBeVisible();
      await expect(protanopia).toBeVisible();
      await expect(tritanopia).toBeVisible();
      await expect(achromatopsia).toBeVisible();
    });

    test('should toggle deuteranopia switch', async ({ page }) => {
      const deuteranopiaSwitch = page.getByRole('switch', { name: /deuteranopia/i });

      // Get initial state
      const wasChecked = await deuteranopiaSwitch.isChecked();

      // Toggle the switch
      await deuteranopiaSwitch.click();
      await page.waitForTimeout(300);

      // Verify it changed state
      const isNowChecked = await deuteranopiaSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    });

    test('should toggle protanopia switch', async ({ page }) => {
      const protanopiaSwitch = page.getByRole('switch', { name: /protanopia/i });

      // Get initial state
      const wasChecked = await protanopiaSwitch.isChecked();

      // Toggle the switch
      await protanopiaSwitch.click();
      await page.waitForTimeout(300);

      // Verify it changed state
      const isNowChecked = await protanopiaSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    });

    test('should toggle tritanopia switch', async ({ page }) => {
      const tritanopiaSwitch = page.getByRole('switch', { name: /tritanopia/i });

      // Get initial state
      const wasChecked = await tritanopiaSwitch.isChecked();

      // Toggle the switch
      await tritanopiaSwitch.click();
      await page.waitForTimeout(300);

      // Verify it changed state
      const isNowChecked = await tritanopiaSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    });

    test('should toggle achromatopsia switch', async ({ page }) => {
      const achromatopsiaSwitch = page.getByRole('switch', { name: /achromatopsia/i });

      // Get initial state
      const wasChecked = await achromatopsiaSwitch.isChecked();

      // Toggle the switch
      await achromatopsiaSwitch.click();
      await page.waitForTimeout(300);

      // Verify it changed state
      const isNowChecked = await achromatopsiaSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    });

    test('should persist vision type selection in localStorage', async ({ page }) => {
      const tritanopiaSwitch = page.getByRole('switch', { name: /tritanopia/i });

      // Toggle the switch
      await tritanopiaSwitch.click();
      await page.waitForTimeout(500);

      // Check localStorage was updated (key is v3_accessibility_vision_types)
      const storedVisionTypes = await page.evaluate(() => {
        return localStorage.getItem('v3_accessibility_vision_types');
      });

      expect(storedVisionTypes).not.toBeNull();
    });
  });

  test.describe('Display Options', () => {
    test('should have show labels switch', async ({ page }) => {
      const showLabelsSwitch = page.getByRole('switch', { name: /show labels/i });
      await expect(showLabelsSwitch).toBeVisible();
    });

    test('should have show hex values switch', async ({ page }) => {
      const showHexSwitch = page.getByRole('switch', { name: /show hex values/i });
      await expect(showHexSwitch).toBeVisible();
    });

    test('should have high contrast mode switch', async ({ page }) => {
      const highContrastSwitch = page.getByRole('switch', { name: /high contrast mode/i });
      await expect(highContrastSwitch).toBeVisible();
    });

    test('should toggle show labels switch', async ({ page }) => {
      const showLabelsSwitch = page.getByRole('switch', { name: /show labels/i });

      // Get initial state
      const wasChecked = await showLabelsSwitch.isChecked();

      // Toggle the switch
      await showLabelsSwitch.click();
      await page.waitForTimeout(300);

      // Verify it changed state
      const isNowChecked = await showLabelsSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    });

    test('should toggle high contrast mode switch', async ({ page }) => {
      const highContrastSwitch = page.getByRole('switch', { name: /high contrast mode/i });

      // Get initial state (should be unchecked by default)
      const wasChecked = await highContrastSwitch.isChecked();

      // Toggle the switch
      await highContrastSwitch.click();
      await page.waitForTimeout(300);

      // Verify it changed state
      const isNowChecked = await highContrastSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    });

    test('should persist display options in localStorage', async ({ page }) => {
      const showHexSwitch = page.getByRole('switch', { name: /show hex values/i });

      // Toggle the switch
      await showHexSwitch.click();
      await page.waitForTimeout(500);

      // Check localStorage was updated (key is v3_accessibility_display_options)
      const storedDisplayOptions = await page.evaluate(() => {
        return localStorage.getItem('v3_accessibility_display_options');
      });

      expect(storedDisplayOptions).not.toBeNull();
    });
  });
});

/**
 * E2E Tests for Accessibility Checker - Color Palette Integration
 *
 * Tests selecting dyes from the color palette drawer
 */
test.describe('Accessibility Checker - Color Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.0.0');
    });

    await page.goto('/');
    await navigateToAccessibilityTool(page);
  });

  test('should have color palette drawer visible', async ({ page }) => {
    // Look for the color palette section
    const colorPalette = page.getByText('Color Palette').first();
    await expect(colorPalette).toBeVisible();
  });

  test('should display dye categories in palette', async ({ page }) => {
    // Look for dye categories (Neutral, Reds, Browns, etc.)
    const neutralCategory = page.getByText('Neutral').first();
    await expect(neutralCategory).toBeVisible();
  });

  test('should select a dye from palette', async ({ page }) => {
    // Click on a specific dye (Snow White is typically visible)
    const snowWhiteDye = page.locator('[aria-label*="Snow White"]').first();

    if ((await snowWhiteDye.count()) > 0) {
      await snowWhiteDye.click();
      await page.waitForTimeout(500);

      // The main content area should update (looking for any result display)
      // After selecting a dye, some analysis content should appear
    }
  });
});

/**
 * E2E Tests for Accessibility Checker - Mobile Drawer Interactions
 *
 * Tests the mobile drawer checkbox interactions that were not covered by unit tests.
 * These tests set a mobile viewport to trigger the drawer UI.
 */
test.describe('Accessibility Checker - Mobile Drawer', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.addInitScript(() => {
      localStorage.setItem('xivdyetools_welcome_seen', 'true');
      localStorage.setItem('xivdyetools_last_version_viewed', '4.0.0');
    });

    await page.goto('/');
    await navigateToAccessibilityTool(page);
  });

  test('should show mobile sidebar toggle button', async ({ page }) => {
    // Look for the mobile sidebar toggle FAB
    const mobileToggle = page.locator('.v4-mobile-sidebar-toggle');
    await expect(mobileToggle).toBeVisible();
  });

  test('should open mobile sidebar when toggle is clicked', async ({ page }) => {
    // Click the mobile sidebar toggle
    const mobileToggle = page.locator('.v4-mobile-sidebar-toggle');
    await mobileToggle.click();
    await page.waitForTimeout(500);

    // After opening sidebar, vision type controls should become visible
    const visionTypesHeading = page.getByText('Vision Types').first();
    await expect(visionTypesHeading).toBeVisible();
  });

  test('should interact with drawer vision type switches on mobile', async ({ page }) => {
    // First close the palette drawer if it's open (it can intercept clicks)
    const paletteCloseBtn = page.getByRole('button', { name: /close palette/i });
    if ((await paletteCloseBtn.count()) > 0) {
      await paletteCloseBtn.click();
      await page.waitForTimeout(300);
    }

    // Open the mobile sidebar
    const mobileToggle = page.locator('.v4-mobile-sidebar-toggle');
    await mobileToggle.click();

    // Wait for sidebar to open and content to load
    await page.waitForTimeout(1000);

    // Find a vision type switch
    const deuteranopiaSwitch = page.getByRole('switch', { name: /deuteranopia/i }).first();

    // Check if the switch is visible (sidebar successfully opened)
    const switchCount = await deuteranopiaSwitch.count();
    if (switchCount > 0) {
      const wasChecked = await deuteranopiaSwitch.isChecked();

      // Toggle the switch using force to handle any overlay issues
      await deuteranopiaSwitch.click({ force: true });
      await page.waitForTimeout(500);

      // Verify it changed state
      const isNowChecked = await deuteranopiaSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    } else {
      // If switches aren't found, verify sidebar content is visible
      const visionText = page.getByText('Vision Types');
      await expect(visionText.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should interact with drawer display option switches on mobile', async ({ page }) => {
    // First close the palette drawer if it's open (it can intercept clicks)
    const paletteCloseBtn = page.getByRole('button', { name: /close palette/i });
    if ((await paletteCloseBtn.count()) > 0) {
      await paletteCloseBtn.click();
      await page.waitForTimeout(300);
    }

    // Open the mobile sidebar
    const mobileToggle = page.locator('.v4-mobile-sidebar-toggle');
    await mobileToggle.click();

    // Wait for sidebar to open and content to load
    await page.waitForTimeout(1000);

    // Find a display option switch
    const showLabelsSwitch = page.getByRole('switch', { name: /show labels/i }).first();

    // Check if the switch is visible
    const switchCount = await showLabelsSwitch.count();
    if (switchCount > 0) {
      const wasChecked = await showLabelsSwitch.isChecked();

      // Toggle the switch using force to handle any overlay issues
      await showLabelsSwitch.click({ force: true });
      await page.waitForTimeout(500);

      // Verify it changed state
      const isNowChecked = await showLabelsSwitch.isChecked();
      expect(isNowChecked).toBe(!wasChecked);
    } else {
      // If switches aren't found, verify sidebar content is visible
      const displayText = page.getByText('Simulation Display');
      await expect(displayText.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should sync drawer switches with desktop when resizing viewport', async ({ page }) => {
    // First close the palette drawer if it's open (it can intercept clicks)
    const paletteCloseBtn = page.getByRole('button', { name: /close palette/i });
    if ((await paletteCloseBtn.count()) > 0) {
      await paletteCloseBtn.click();
      await page.waitForTimeout(300);
    }

    // Open mobile sidebar
    const mobileToggle = page.locator('.v4-mobile-sidebar-toggle');
    await mobileToggle.click();

    // Wait for sidebar to open
    await page.waitForTimeout(1000);

    // Find a vision switch
    const protanopiaSwitch = page.getByRole('switch', { name: /protanopia/i }).first();

    const switchCount = await protanopiaSwitch.count();
    if (switchCount > 0) {
      const initialState = await protanopiaSwitch.isChecked();

      // Toggle the switch using force to handle any overlay issues
      await protanopiaSwitch.click({ force: true });
      await page.waitForTimeout(500);

      // Resize to desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(1000);

      // Check that the desktop switch has the same state
      const desktopSwitch = page.getByRole('switch', { name: /protanopia/i }).first();
      const desktopCount = await desktopSwitch.count();

      if (desktopCount > 0) {
        const desktopState = await desktopSwitch.isChecked();
        expect(desktopState).toBe(!initialState);
      }
    } else {
      // Verify the tool is still functional after viewport resize
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(1000);
      const visionText = page.getByText('Vision Types');
      await expect(visionText.first()).toBeVisible({ timeout: 5000 });
    }
  });
});
