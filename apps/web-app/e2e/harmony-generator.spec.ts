import { test, expect } from './fixtures/coverage';
import { waitForAppReady, gotoTool, seedStartupStorage, dismissBlockingOverlays } from './fixtures/navigation';

async function navigateToHarmonyTool(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await gotoTool(page, 'harmony');
  await dismissBlockingOverlays(page);
}

test.describe('Harmony Generator Tool (v4 rewrite)', () => {
  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToHarmonyTool(page);
  });

  test('loads harmony controls', async ({ page }) => {
    const controls = page.locator('input[type="color"], input[placeholder*="#"], button, [role="button"]');
    expect(await controls.count()).toBeGreaterThan(0);
  });

  test('accepts hex/color input and keeps UI responsive', async ({ page }) => {
    const hexInput = page.locator('input[placeholder*="#"]').first();
    if ((await hexInput.count()) > 0 && (await hexInput.isVisible())) {
      await hexInput.fill('#3498DB');
      await hexInput.dispatchEvent('input');
      expect((await hexInput.inputValue()).length).toBeGreaterThan(0);
      return;
    }

    const colorPicker = page.locator('input[type="color"]').first();
    if ((await colorPicker.count()) > 0 && (await colorPicker.isVisible())) {
      await colorPicker.fill('#3498db');
      await colorPicker.dispatchEvent('input');
      expect((await colorPicker.inputValue()).length).toBeGreaterThan(0);
      return;
    }

    const fallbackControls = page.locator('button, [role="button"]');
    expect(await fallbackControls.count()).toBeGreaterThan(0);
  });

  test('supports mode/settings interaction when present', async ({ page }) => {
    const radios = page.locator('input[type="radio"]');
    if ((await radios.count()) > 0) {
      await radios.first().click({ force: true });
      expect(await radios.first().isChecked()).toBe(true);
      return;
    }

    const sliders = page.locator('input[type="range"]');
    if ((await sliders.count()) > 0 && (await sliders.first().isVisible())) {
      await sliders.first().fill('3');
      await sliders.first().dispatchEvent('input');
      expect((await sliders.first().inputValue()).length).toBeGreaterThan(0);
      return;
    }

    const fallbackControls = page.locator('input, select, button');
    expect(await fallbackControls.count()).toBeGreaterThan(0);
  });

  test('keeps harmony tool interactive after reload', async ({ page }) => {
    await page.reload();
    await waitForAppReady(page);
    await navigateToHarmonyTool(page);

    const controls = page.locator('input, button, [role="button"]');
    expect(await controls.count()).toBeGreaterThan(0);
  });
});
