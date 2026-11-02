/**
 * The hover color of controls that take the accent, in both themes: a toggle that is
 * on, and the palette drawer's Apply and Random buttons.
 *
 * Before 5.16.14 no theme defined `--theme-primary-hover`, so the toggle and Apply
 * turned gold on hover: the fallback each one kept from the retired themes. Random's
 * tint was the same gold, written out. Only a real browser resolves the token through
 * `themes.css` and the palette ThemeService applies, and each test switches theme with
 * the page open, because the colors have to follow that.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

const THEMES = [
  { name: 'standard-light', rest: 'rgb(206, 34, 34)', hover: 'rgb(176, 28, 28)' },
  { name: 'standard-dark', rest: 'rgb(234, 65, 51)', hover: 'rgb(255, 98, 87)' },
];

/** Polled: both controls ease into their hover color. */
async function expectBackground(locator: Locator, color: string): Promise<void> {
  await expect
    .poll(() => locator.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(color);
}

/** What the browser computes for a 10% tint of the accent, in whatever form it reports. */
function accentTint(page: Page, accent: string): Promise<string> {
  return page.evaluate((color) => {
    const probe = document.createElement('div');
    probe.style.background = `color-mix(in srgb, ${color} 10%, transparent)`;
    document.body.append(probe);
    const computed = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return computed;
  }, accent);
}

async function pickTheme(page: Page, theme: string): Promise<void> {
  await page.locator('button.v4-header-nav-btn[aria-label*="theme" i]').first().click();
  await page.locator(`button[data-theme="${theme}"]`).click();
  await expect(page.locator('html')).toHaveClass(new RegExp(`theme-${theme}`));
  await page.keyboard.press('Escape');
  await expect(page.locator('.m16-backdrop')).toHaveCount(0);
  await page.mouse.move(0, 0);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedStartupStorage(page);
  await gotoTool(page, 'harmony');
});

test('a toggle that is on hovers in the color of each theme', async ({ page }) => {
  const toggle = page.locator('v4-config-sidebar v4-toggle-switch').first();
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('checked')) === null) await toggle.click();
  await expect(toggle).toHaveAttribute('checked');
  const track = toggle.locator('.toggle-track');

  for (const { name, rest, hover } of THEMES) {
    await pickTheme(page, name);
    await expectBackground(track, rest);
    await track.hover();
    await expectBackground(track, hover);
  }
});

test('the Apply button hovers in the color of each theme', async ({ page }) => {
  const apply = page.locator('dye-palette-drawer .custom-apply-btn');

  for (const { name, rest, hover } of THEMES) {
    await pickTheme(page, name);
    await apply.scrollIntoViewIfNeeded();
    await expectBackground(apply, rest);
    await apply.hover();
    await expectBackground(apply, hover);
  }
});

test('the Random button hovers in a tint of the accent of each theme', async ({ page }) => {
  const random = page.locator('dye-palette-drawer .random-btn');

  for (const { name, rest } of THEMES) {
    await pickTheme(page, name);
    await random.hover();
    await expectBackground(random, await accentTint(page, rest));
  }
});
