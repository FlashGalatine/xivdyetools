/**
 * The Swatch Matcher when its pane is narrow: both side panels open on a small
 * window. The grid panel's one-line palette tabs want about 520px, which the
 * pane doesn't have at 1024x768.
 *
 * Through 5.16.8 that panel never shrank, and the row centered it, so it hung
 * off both sides of the pane: the heading read "OLORS (192)", the Eye tab and
 * the left edge couldn't be reached, and the matches column had no width at all.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

type Viewport = { width: number; height: number };

const scroller = (page: Page) => page.locator('.v4-layout-content-scroll');
const gridPanel = (page: Page) =>
  page.locator('.glass', { has: page.locator('button[data-index]') });
const cell = (page: Page, index: number) => page.locator(`button[data-index="${index}"]`);
const heading = (page: Page) => page.getByText('Eye Colors (192)', { exact: true });
const emptyState = (page: Page) => page.locator('.v5-empty-state');
const PALETTE_TABS = ['Eye', 'Hair', 'Highlights', 'Skin', 'Tattoo / Limbal', 'Lips', 'Face paint'];

async function openSwatch(page: Page, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await seedStartupStorage(page);
  await gotoTool(page, 'swatch');
  await expect(page.locator('button[data-index]')).toHaveCount(192);
  await page.evaluate(() => document.fonts.ready);
  // At 768px and under, both panels start closed and overlay the tool when opened.
  if (viewport.width > 768) {
    await expect(page.locator('dye-palette-drawer')).toHaveAttribute('is-open');
    await expect(page.locator('v4-config-sidebar .v4-sidebar-collapse')).toBeVisible();
  }
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

/** Fully inside the scroller, side to side: nothing cut off left or right. */
async function expectWithinPane(page: Page, target: Locator): Promise<void> {
  const pane = await box(scroller(page));
  const inner = await box(target);
  expect(inner.x).toBeGreaterThanOrEqual(pane.x - 1);
  expect(inner.x + inner.width).toBeLessThanOrEqual(pane.x + pane.width + 1);
}

async function horizontalOverflow(target: Locator): Promise<number> {
  return target.evaluate((el) => el.scrollWidth - el.clientWidth);
}

test.describe('Swatch Matcher in a narrow pane', () => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
  ]) {
    test(`shows the heading, tabs and whole grid at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await openSwatch(page, viewport);

      await expectWithinPane(page, heading(page));
      for (const name of PALETTE_TABS) {
        await expectWithinPane(page, page.getByRole('button', { name, exact: true }));
      }
      // Both ends of the top row, so the whole eight-column width.
      await expectWithinPane(page, cell(page, 0));
      await expectWithinPane(page, cell(page, 7));

      expect(await horizontalOverflow(page.locator('.v4-tool-main'))).toBeLessThanOrEqual(1);
      expect(await horizontalOverflow(scroller(page))).toBeLessThanOrEqual(1);
      expect(await horizontalOverflow(gridPanel(page))).toBeLessThanOrEqual(1);

      // #372: the shell owns vertical scrolling. Count real overflow, as the
      // Mixer's test does, so that the panel's sideways scrolling can't pass.
      const scrollOwners = await scroller(page).evaluate((el) =>
        [el, ...el.querySelectorAll<HTMLElement>('*')]
          .filter(
            (node) =>
              /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) &&
              node.scrollHeight > node.clientHeight + 1
          )
          .map((node) => node.className)
      );
      expect(scrollOwners).toEqual(['v4-layout-content-scroll']);
    });
  }

  test('puts the matches under the grid and scrolls to the verdict', async ({ page }) => {
    await openSwatch(page, { width: 1024, height: 768 });

    const panel = await box(gridPanel(page));
    const empty = await box(emptyState(page));
    expect(empty.y).toBeGreaterThanOrEqual(panel.y + panel.height);

    await cell(page, 20).click();

    const card = page.locator('v4-result-card').first();
    await expect(card).toBeVisible();
    await expectWithinPane(page, card);

    // The grid panel is taller than the window, so without the scroll a click
    // would change nothing the user can see.
    const verdict = page.getByText('IN THE CREATOR', { exact: true });
    await expect
      .poll(async () => {
        const top = (await box(verdict)).y;
        const pane = await box(scroller(page));
        return top >= pane.y && top <= pane.y + pane.height;
      })
      .toBe(true);
  });

  test('moves the matches beside the grid when a panel closes, with no resize', async ({
    page,
  }) => {
    await openSwatch(page, { width: 1024, height: 768 });
    const stacked = await box(gridPanel(page));
    expect((await box(emptyState(page))).y).toBeGreaterThanOrEqual(stacked.y + stacked.height);

    await page.locator('dye-palette-drawer .close-btn').click();
    await page.locator('v4-config-sidebar .v4-sidebar-collapse').click();
    await expect(page.locator('dye-palette-drawer')).not.toHaveAttribute('is-open');

    await expect
      .poll(async () => {
        const row = await box(gridPanel(page));
        return (await box(emptyState(page))).x >= row.x + row.width;
      })
      .toBe(true);
    expect(await horizontalOverflow(scroller(page))).toBeLessThanOrEqual(1);
  });

  // 800x600 is 26px cells in a pane too narrow for them; 390x844 is a phone's
  // 44px touch cells. Through 5.16.8 a phone's grid was centered off the left of
  // its panel too, so the first column could never be scrolled to.
  for (const viewport of [
    { width: 800, height: 600 },
    { width: 390, height: 844 },
  ]) {
    test(`scrolls the grid inside its panel at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await openSwatch(page, viewport);

      const panel = gridPanel(page);
      await expectWithinPane(page, panel);
      await expectWithinPane(page, heading(page));
      const start = await box(panel);
      expect((await box(cell(page, 0))).x).toBeGreaterThanOrEqual(start.x);

      expect(await horizontalOverflow(panel)).toBeGreaterThan(1);
      await panel.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const end = await box(cell(page, 7));
      expect(end.x + end.width).toBeLessThanOrEqual(start.x + start.width);
    });
  }

  test('keeps the wide layout: tabs on one line, matches beside the grid', async ({ page }) => {
    await openSwatch(page, { width: 1920, height: 1080 });

    const first = await box(page.getByRole('button', { name: 'Eye', exact: true }));
    const last = await box(page.getByRole('button', { name: 'Face paint', exact: true }));
    expect(last.y).toBe(first.y);

    const panel = await box(gridPanel(page));
    const pane = await box(scroller(page));
    // Pane edge, then the shell's 24px and the tool's 32px of padding.
    expect(panel.x - pane.x).toBe(56);
    const empty = await box(emptyState(page));
    expect(empty.x).toBeGreaterThanOrEqual(panel.x + panel.width + 24);
    expect(empty.y).toBeLessThan(panel.y + panel.height);
  });
});
