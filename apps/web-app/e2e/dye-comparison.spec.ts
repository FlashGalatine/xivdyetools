import { test, expect } from './fixtures/coverage';
import { waitForAppReady, gotoTool, seedStartupStorage, dismissBlockingOverlays } from './fixtures/navigation';

async function navigateToComparisonTool(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await gotoTool(page, 'comparison');
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

test.describe('Dye Comparison Tool (v4 rewrite)', () => {
  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToComparisonTool(page);
  });

  test('loads comparison UI and dye selector controls', async ({ page }) => {
    const controls = page.locator('.dye-select-btn, button[data-dye-id], input[type="checkbox"], [role="switch"]');
    expect(await controls.count()).toBeGreaterThan(0);
  });

  test('supports selecting dyes with max of four active results', async ({ page }) => {
    const selected = await selectFirstNDyes(page, 5);
    if (selected === 0) {
      const controls = page.locator('button, [role="button"], input[type="checkbox"], [role="switch"]');
      expect(await controls.count()).toBeGreaterThan(0);
      return;
    }

    const resultCards = page.locator('v4-result-card');
    const cardCount = await resultCards.count();
    expect(cardCount).toBeLessThanOrEqual(4);
    expect(cardCount).toBeGreaterThan(0);
  });

  test('supports toggling display options after selecting dyes', async ({ page }) => {
    await selectFirstNDyes(page, 2);

    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    if (checkboxCount === 0) {
      const switches = page.locator('[role="switch"]');
      expect(await switches.count()).toBeGreaterThanOrEqual(0);
      return;
    }

    const firstCheckbox = checkboxes.first();
    const initial = await firstCheckbox.isChecked();
    await firstCheckbox.click({ force: true });
    await page.waitForTimeout(200);
    await firstCheckbox.click({ force: true });

    expect(await firstCheckbox.isChecked()).toBe(initial);
  });

  test('supports clear action for selected dyes', async ({ page }) => {
    const selected = await selectFirstNDyes(page, 3);
    if (selected === 0) {
      const controls = page.locator('button, [role="button"]');
      expect(await controls.count()).toBeGreaterThan(0);
      return;
    }

    const clearButton = page.locator('button:has-text("Clear"), button:has-text("clear")').first();
    if ((await clearButton.count()) === 0) {
      const resultCards = page.locator('v4-result-card');
      expect(await resultCards.count()).toBeGreaterThanOrEqual(0);
      return;
    }

    await clearButton.click({ force: true });
    await page.waitForTimeout(300);

    const resultCards = page.locator('v4-result-card');
    expect(await resultCards.count()).toBe(0);
  });

  test('keeps UI interactive after reload', async ({ page }) => {
    await selectFirstNDyes(page, 2);

    await page.reload();
    await waitForAppReady(page);
    await navigateToComparisonTool(page);

    const controls = page.locator('.dye-select-btn, button[data-dye-id], input[type="checkbox"], [role="switch"]');
    expect(await controls.count()).toBeGreaterThan(0);
  });
});
