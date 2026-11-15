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

// Real scrollbars: the app's 10px gutter narrows the pane, and hidden ones would
// let the 1440 and 1536 cases below pass with less room than a player has.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

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

/** Grid cells whose centers are inside the scroller, top to bottom. */
async function cellsInView(page: Page): Promise<number> {
  const pane = await box(scroller(page));
  return page.locator('button[data-index]').evaluateAll(
    (cells, { top, bottom }) =>
      cells.filter((el) => {
        const { y, height } = el.getBoundingClientRect();
        return y + height / 2 >= top && y + height / 2 <= bottom;
      }).length,
    { top: pane.y, bottom: pane.y + pane.height }
  );
}

async function openPalette(page: Page, tab: string): Promise<void> {
  if (tab === 'Eye') return;
  await page.getByRole('button', { name: tab, exact: true }).click();
  await expect(page.locator('button[data-index]')).toHaveCount(96);
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

  test('keeps rows of the grid on screen after a grid pick', async ({ page }) => {
    await openSwatch(page, { width: 1366, height: 768 });
    // No animation, so the count below can't pass on the way past.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await cell(page, 20).click();

    const verdict = page.getByText('IN THE CREATOR', { exact: true });
    await expect
      .poll(async () => {
        const top = (await box(verdict)).y;
        const pane = await box(scroller(page));
        return top >= pane.y && top <= pane.y + pane.height;
      })
      .toBe(true);
    await expect.poll(() => cellsInView(page)).toBeGreaterThan(0);
  });

  test('brings a palette pick into view where the results sit under the grid', async ({ page }) => {
    await openSwatch(page, { width: 1366, height: 768 });
    const palette = page.locator('dye-palette-drawer .drawer-content');
    const pick = page.locator('dye-palette-drawer .category-section .swatch-pick').first();
    await pick.scrollIntoViewIfNeeded();
    const paletteTop = await palette.evaluate((el) => el.scrollTop);
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await pick.click();

    const results = page.getByText('Closest Swatches', { exact: false }).first();
    await expect
      .poll(async () => {
        const top = (await box(results)).y;
        const pane = await box(scroller(page));
        return top >= pane.y && top <= pane.y + pane.height;
      })
      .toBe(true);
    expect(await palette.evaluate((el) => el.scrollTop)).toBe(paletteTop);
    await expect.poll(() => cellsInView(page)).toBeGreaterThan(0);
  });

  test('moves nothing on a palette pick where the results sit beside the grid', async ({
    page,
  }) => {
    await openSwatch(page, { width: 1920, height: 1080 });

    await page.locator('dye-palette-drawer .category-section .swatch-pick').first().click();

    await expect(page.getByText('Closest Swatches', { exact: false }).first()).toBeVisible();
    await page.waitForTimeout(400);
    expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(0);
  });

  test('moves nothing on a grid pick when the verdict is already on screen', async ({ page }) => {
    await openSwatch(page, { width: 1366, height: 1400 });
    await openPalette(page, 'Lips');

    await cell(page, 20).click();

    await expect(page.getByText('IN THE CREATOR', { exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(0);
  });

  // A 1920x1080 screen at 125% is a 1536px window. Each of these palettes keeps
  // its results beside the grid, as it did through 5.16.8, so a pick moves nothing
  // and the tab just clicked stays under the pointer.
  for (const [width, tab] of [
    [1440, 'Eye'],
    [1536, 'Lips'],
    [1536, 'Face paint'],
  ] as const) {
    test(`keeps the matches beside the grid at ${width}px on ${tab}`, async ({ page }) => {
      await openSwatch(page, { width, height: 864 });
      const tabButton = page.getByRole('button', { name: tab, exact: true });
      const before = await box(tabButton);
      await openPalette(page, tab);
      if (tab !== 'Eye') expect((await box(tabButton)).x).toBe(before.x);

      const panel = await box(gridPanel(page));
      expect((await box(emptyState(page))).x).toBeGreaterThanOrEqual(panel.x + panel.width);

      await cell(page, 20).click();
      await expect(page.getByText('IN THE CREATOR', { exact: true })).toBeVisible();
      await page.waitForTimeout(400);
      expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(0);
    });
  }

  test('stays put on a grid pick after a palette pick when the results sit beside the grid', async ({
    page,
  }) => {
    await openSwatch(page, { width: 1536, height: 864 });
    await openPalette(page, 'Lips');

    await page.locator('dye-palette-drawer .category-section .swatch-pick').first().click();
    await expect(page.getByText('Closest Swatches', { exact: false }).first()).toBeVisible();
    await cell(page, 20).click();

    await page.waitForTimeout(400);
    expect(await scroller(page).evaluate((el) => el.scrollTop)).toBe(0);
  });

  test("brings a shared link's verdict into view where it sits under the grid", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedStartupStorage(page);
    await page.goto('/swatch?slot=eyeColors&i=20');

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

  // A pick by keyboard leaves focus on the cell. On a tall palette the verdict is too
  // far below it for both to fit, and focus staying visible wins: the next Tab or
  // Enter starts from there.
  for (const index of [0, 20, 60, 100, 180]) {
    test(`keeps the focused cell on screen after a keyboard pick of cell ${index}`, async ({
      page,
    }) => {
      await openSwatch(page, { width: 1366, height: 768 });
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await cell(page, index).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText('IN THE CREATOR', { exact: true })).toBeVisible();
      await page.waitForTimeout(400);

      await expect(cell(page, index)).toBeFocused();
      const pane = await box(scroller(page));
      const focused = await box(cell(page, index));
      // Its 3px outline, 2px off the cell, has to clear the pane's edge as well.
      expect(focused.y - 5).toBeGreaterThanOrEqual(pane.y);
      expect(focused.y + focused.height + 5).toBeLessThanOrEqual(pane.y + pane.height);
    });
  }

  test('shows the verdict on a keyboard pick when it fits with the focused cell', async ({
    page,
  }) => {
    await openSwatch(page, { width: 1366, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await cell(page, 100).focus();
    await page.keyboard.press('Enter');

    const verdict = page.getByText('IN THE CREATOR', { exact: true });
    await expect
      .poll(async () => {
        const top = (await box(verdict)).y;
        const pane = await box(scroller(page));
        return top >= pane.y && top <= pane.y + pane.height;
      })
      .toBe(true);
  });

  // Closing a panel moves stacked results up beside the grid and leaves the scroll
  // position alone, so what was just revealed ended up above the pane.
  for (const [name, close] of [
    ['options', (page: Page) => page.locator('v4-config-sidebar .v4-sidebar-collapse').click()],
    ['palette', (page: Page) => page.locator('dye-palette-drawer .close-btn').click()],
  ] as const) {
    test(`keeps a revealed verdict on screen when the ${name} panel closes`, async ({ page }) => {
      await openSwatch(page, { width: 1366, height: 768 });
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await cell(page, 20).click();
      const verdict = page.getByText('IN THE CREATOR', { exact: true });
      await expect(verdict).toBeVisible();
      await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

      await close(page);

      await expect
        .poll(async () => {
          const found = await box(verdict);
          const pane = await box(scroller(page));
          return found.y >= pane.y && found.y + found.height <= pane.y + pane.height;
        })
        .toBe(true);
      // Beside the grid now, not under it.
      const panel = await box(gridPanel(page));
      expect((await box(verdict)).x).toBeGreaterThanOrEqual(panel.x + panel.width);
    });
  }

  test('keeps revealed palette matches on screen when a panel closes', async ({ page }) => {
    await openSwatch(page, { width: 1366, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const pick = page.locator('dye-palette-drawer .category-section .swatch-pick').first();
    await pick.scrollIntoViewIfNeeded();
    await pick.click();
    const results = page.getByText('Closest Swatches', { exact: false }).first();
    await expect(results).toBeVisible();
    await expect.poll(() => scroller(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    await page.locator('v4-config-sidebar .v4-sidebar-collapse').click();

    await expect
      .poll(async () => {
        const found = await box(results);
        const pane = await box(scroller(page));
        return found.y >= pane.y && found.y + found.height <= pane.y + pane.height;
      })
      .toBe(true);
  });

  // Fixed side padding left the panel 75px at 769px, and the Evercold notice alone
  // came to 3,937px in a column that wide, so the grid started 5,440px down.
  for (const width of [769, 800, 860]) {
    test(`gives the grid panel the whole pane at ${width}px`, async ({ page }) => {
      await openSwatch(page, { width, height: 768 });

      const content = await scroller(page).evaluate((el) => {
        const { paddingLeft, paddingRight } = getComputedStyle(el);
        return el.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
      });
      expect((await box(gridPanel(page))).width).toBeCloseTo(content, 0);
      await expectWithinPane(page, gridPanel(page));
      expect(await horizontalOverflow(scroller(page))).toBeLessThanOrEqual(1);
    });
  }

  test('brings the grid up from 5,440px down at 769px', async ({ page }) => {
    await openSwatch(page, { width: 769, height: 768 });
    const pane = await box(scroller(page));
    expect((await box(cell(page, 0))).y - pane.y).toBeLessThan(1400);
  });

  // 884px: both panels open, the pane is 302px, and that's 254px of panel for 236px
  // of grid. Through 5.16.11 this took a 972px window.
  test('shows all eight columns without sideways scrolling from 884px', async ({ page }) => {
    await openSwatch(page, { width: 884, height: 768 });
    expect(await horizontalOverflow(gridPanel(page))).toBeLessThanOrEqual(1);
    await expectWithinPane(page, cell(page, 7));
  });

  // Room to spare: the padding that gives way below that is still all there.
  test('keeps the designed padding from 972px up', async ({ page }) => {
    await openSwatch(page, { width: 972, height: 768 });
    const pane = await box(scroller(page));
    const panel = await box(gridPanel(page));
    // Pane edge, then the shell's 24px and the tool's 32px of padding.
    expect(panel.x - pane.x).toBe(56);
    const inner = await gridPanel(page).evaluate((el) => getComputedStyle(el).paddingLeft);
    expect(inner).toBe('20px');
  });

  // A phone's cards are touch targets laid out for its own width, and this isn't theirs.
  for (const width of [360, 390]) {
    test(`keeps a phone's padding at ${width}px`, async ({ page }) => {
      await openSwatch(page, { width, height: 780 });
      const panel = await gridPanel(page).evaluate((el) => getComputedStyle(el).paddingLeft);
      const tool = await page
        .locator('.v4-tool-main')
        .evaluate((el) => getComputedStyle(el).paddingLeft);
      expect(panel).toBe('20px');
      expect(tool).toBe('32px');
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
