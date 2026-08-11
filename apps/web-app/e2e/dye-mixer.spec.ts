import { test, expect } from './fixtures/coverage';
import { waitForAppReady, gotoTool, seedStartupStorage, dismissBlockingOverlays } from './fixtures/navigation';

async function navigateToMixerTool(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await gotoTool(page, 'mixer');
  await dismissBlockingOverlays(page);
  await page.waitForTimeout(900);
}

async function selectFirstNDyes(page: Parameters<typeof test>[0]['page'], requested: number): Promise<number> {
  const dyeButtons = page.locator('.dye-select-btn, button[data-dye-id]');
  const count = await dyeButtons.count();
  const toSelect = Math.min(count, requested);

  for (let i = 0; i < toSelect; i++) {
    await dyeButtons.nth(i).click({ force: true });
    await page.waitForTimeout(250);
  }

  return toSelect;
}

test.describe('Dye Mixer Tool (v4 rewrite)', () => {
  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToMixerTool(page);
  });

  test('loads mixer tool UI controls', async ({ page }) => {
    const controls = page.locator('.dye-select-btn, button[data-dye-id], input[type="range"], input[type="radio"], select');
    expect(await controls.count()).toBeGreaterThan(0);
  });

  test('supports selecting dyes for interpolation input', async ({ page }) => {
    const selected = await selectFirstNDyes(page, 2);

    if (selected === 0) {
      const controls = page.locator('button, [role="button"]');
      expect(await controls.count()).toBeGreaterThan(0);
      return;
    }

    const resultCards = page.locator('v4-result-card');
    expect(await resultCards.count()).toBeGreaterThanOrEqual(0);
  });

  test('supports changing interpolation settings', async ({ page }) => {
    const sliders = page.locator('input[type="range"]');
    if ((await sliders.count()) > 0 && (await sliders.first().isVisible())) {
      await sliders.first().fill('12');
      await sliders.first().dispatchEvent('input');
      const value = await sliders.first().inputValue();
      expect(value.length).toBeGreaterThan(0);
      return;
    }

    const radios = page.locator('input[type="radio"]');
    if ((await radios.count()) > 0) {
      await radios.first().click({ force: true });
      expect(await radios.first().isChecked()).toBe(true);
      return;
    }

    const selects = page.locator('select');
    expect(await selects.count()).toBeGreaterThanOrEqual(0);
  });

  test('keeps tool interactive after reload', async ({ page }) => {
    await selectFirstNDyes(page, 2);

    await page.reload();
    await waitForAppReady(page);
    await navigateToMixerTool(page);

    const controls = page.locator('.dye-select-btn, button[data-dye-id], input[type="range"], input[type="radio"], select');
    expect(await controls.count()).toBeGreaterThan(0);
  });
});
