/**
 * Slot-aware picking: tapping a dye slot in a tool opens the palette for that
 * slot, a pick on a phone closes it again, and the palette marks the dyes the
 * tool holds. The phone flows run in `mobile-chrome`; the desktop case runs in
 * `chromium`.
 *
 * Slots live inside `<v4-layout-shell>`'s shadow root and the palette is its
 * own shadow-rooted element; Playwright's CSS engine pierces both.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

const palette = (page: Page): Locator => page.locator('dye-palette-drawer');
const targetLine = (page: Page): Locator => palette(page).locator('.drawer-target-line');
const roundButton = (page: Page): Locator => page.locator('.v4-palette-toggle');
const slot = (page: Page, index: number): Locator =>
  page.locator(`[data-palette-slot="${index}"]`).filter({ visible: true }).first();
const resultCards = (page: Page): Locator =>
  page.locator('.comparison-cards-container > v4-result-card');

async function open(page: Page, tool: string): Promise<void> {
  await seedStartupStorage(page);
  await gotoTool(page, tool);
  await page.waitForTimeout(600);
}

async function expectOpen(page: Page): Promise<void> {
  await expect(palette(page)).toHaveAttribute('is-open');
}

async function expectClosed(page: Page): Promise<void> {
  await expect(palette(page)).not.toHaveAttribute('is-open');
}

/** Open the palette with the round button (no target). */
async function openWithButton(page: Page): Promise<void> {
  await roundButton(page).click();
  await expectOpen(page);
  await expect(targetLine(page)).toHaveText('');
}

/** Pick the nth dye the palette does not mark as held; returns its name. */
async function pickUnmarked(page: Page, nth = 0): Promise<string> {
  const pick = palette(page).locator('.swatch:not(.in-use) .swatch-pick').nth(nth);
  const name = (await pick.getAttribute('aria-label')) ?? '';
  expect(name).not.toBe('');
  await pick.click();
  return name;
}

/**
 * The element holding focus plus its ancestors across shadow boundaries, as
 * descriptors, so a test can ask "is focus on a slot / inside the wheel".
 */
async function focusChain(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const chain: string[] = [];
    let node: Node | null = active;
    while (node) {
      if (node instanceof Element) {
        let d = node.tagName.toLowerCase();
        if (node.hasAttribute('data-palette-slot')) d += '[data-palette-slot]';
        if (node.classList.contains('v4-palette-toggle')) d += '.v4-palette-toggle';
        chain.push(d);
      }
      node = node.parentNode ?? (node as ShadowRoot).host ?? null;
    }
    return chain;
  });
}

test.describe('slot-aware picking: phone', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'phone flows run in mobile-chrome');
  });

  test('Dye Comparison: tap an empty slot, pick, palette closes, slot filled', async ({ page }) => {
    await open(page, 'comparison');
    await slot(page, 0).click();
    await expectOpen(page);
    await expect(targetLine(page)).not.toHaveText('');

    await pickUnmarked(page);

    await expectClosed(page);
    await expect(resultCards(page)).toHaveCount(1);

    // Focus returns to the slot that opened the palette, or the round button.
    await expect
      .poll(async () => {
        const chain = await focusChain(page);
        return chain.some(
          (d) => d.includes('[data-palette-slot]') || d.includes('.v4-palette-toggle')
        );
      })
      .toBe(true);
  });

  test('Dye Comparison: Add dye tile adds the second dye and the palette closes', async ({
    page,
  }) => {
    await open(page, 'comparison');
    await slot(page, 0).click();
    await pickUnmarked(page);
    await expectClosed(page);

    const tile = slot(page, 1);
    await expect(tile).toBeVisible();
    await tile.click();
    await expectOpen(page);
    await pickUnmarked(page);

    await expectClosed(page);
    // With two dyes held the Add dye tile moves on to the third slot.
    await expect(slot(page, 2)).toBeVisible();
  });

  test('Dye Comparison: round button, two picks, palette stays open, marks show in-use', async ({
    page,
  }) => {
    await open(page, 'comparison');
    await openWithButton(page);

    await pickUnmarked(page);
    await pickUnmarked(page);

    await expectOpen(page);
    await expect(palette(page).locator('.swatch.in-use')).toHaveCount(2);
    await expect(slot(page, 2)).toBeVisible();
  });

  test('Dye Comparison: target chip 1 in the strip, pick, first dye replaced, header line gone', async ({
    page,
  }) => {
    await open(page, 'comparison');
    await openWithButton(page);
    const first = await pickUnmarked(page);
    const second = await pickUnmarked(page);

    await palette(page).locator('.slot-chip').nth(0).click();
    await expect(palette(page).locator('.slot-chip').nth(0)).toHaveClass(/is-target/);
    await expect(targetLine(page)).not.toHaveText('');

    const replacement = await pickUnmarked(page);

    // Opened with the round button, so the palette stays open after the pick.
    await expectOpen(page);
    await expect(targetLine(page)).toHaveText('');
    await expect(
      palette(page).locator(`.swatch-pick[aria-label="${replacement}, in slot 1"]`)
    ).toHaveCount(1);
    await expect(
      palette(page).locator(`.swatch-pick[aria-label="${second}, in slot 2"]`)
    ).toHaveCount(1);
    // The replaced dye is no longer held.
    await expect(palette(page).locator(`.swatch-pick[aria-label="${first}"]`)).toHaveCount(1);
    await expect(palette(page).locator('.swatch.in-use')).toHaveCount(2);
  });

  test('Dye Comparison: tapping a marked swatch removes that dye', async ({ page }) => {
    await open(page, 'comparison');
    await openWithButton(page);
    const first = await pickUnmarked(page);
    await pickUnmarked(page);
    await expect(slot(page, 2)).toBeVisible();

    await palette(page).locator(`.swatch-pick[aria-label="${first}, in slot 1"]`).click();

    await expect(slot(page, 1)).toBeVisible();
    await expect(slot(page, 2)).toHaveCount(0);
    await expect(palette(page).locator('.swatch.in-use')).toHaveCount(1);
    await expect(palette(page).locator(`.swatch-pick[aria-label="${first}"]`)).toHaveCount(1);
  });

  test('Dye Mixer: tap slot B first, pick, B is filled and A is still empty', async ({ page }) => {
    await open(page, 'mixer');
    await slot(page, 1).click();
    await expectOpen(page);
    await expect(targetLine(page)).not.toHaveText('');

    await pickUnmarked(page);
    await expectClosed(page);

    await openWithButton(page);
    const chips = palette(page).locator('.slot-chip');
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0).locator('.slot-chip-swatch.empty')).toHaveCount(1);
    await expect(chips.nth(1).locator('.slot-chip-swatch.empty')).toHaveCount(0);
  });

  test('Gradient Builder: tap FROM, pick, palette closes; TO chip is enabled afterwards', async ({
    page,
  }) => {
    await open(page, 'gradient');
    await slot(page, 0).click();
    await expectOpen(page);
    await expect(palette(page).locator('.slot-chip').nth(1)).toBeDisabled();

    await pickUnmarked(page);
    await expectClosed(page);

    await openWithButton(page);
    await expect(palette(page).locator('.slot-chip').nth(1)).toBeEnabled();
  });

  test('Harmony Explorer: hub tap, pick, palette closes, swatch is marked in use', async ({
    page,
  }) => {
    await open(page, 'harmony');
    // Give the wheel a base dye first, then use the hub itself.
    await slot(page, 0).click();
    await expectOpen(page);
    await pickUnmarked(page);
    await expectClosed(page);

    const hub = page.locator('v4-color-wheel .main-swatch-display');
    await expect(hub).toBeVisible();
    await hub.click();
    await expectOpen(page);
    const chosen = await pickUnmarked(page);
    await expectClosed(page);

    // Focus returns to the wheel's hub.
    await expect
      .poll(async () => (await focusChain(page)).some((d) => d.startsWith('v4-color-wheel')))
      .toBe(true);

    await openWithButton(page);
    await expect(palette(page).locator('.swatch.in-use')).toHaveCount(1);
    await expect(
      palette(page).locator(`.swatch.in-use .swatch-pick[aria-label^="${chosen}"]`)
    ).toHaveCount(1);
  });
});

test.describe('slot-aware picking: desktop', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'desktop case runs in chromium');
  });

  test('desktop: a slot click sets the target and the docked palette stays open after the pick', async ({
    page,
  }) => {
    await open(page, 'comparison');
    await expectOpen(page);

    await slot(page, 0).click();
    await expectOpen(page);
    await expect(targetLine(page)).not.toHaveText('');

    await pickUnmarked(page);

    await expectOpen(page);
    await expect(targetLine(page)).toHaveText('');
    await expect(resultCards(page)).toHaveCount(1);
  });
});
