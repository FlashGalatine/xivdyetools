import { test, expect, type Page } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

async function addLongContent(page: Page): Promise<void> {
  // Deterministic overflow through the real tool layout, without network data.
  await page
    .locator('.v4-tool-main, .glamour-tool, v4-preset-tool .preset-tool')
    .evaluate((panel) => {
      const spacer = document.createElement('div');
      spacer.style.height = '1600px';
      const end = document.createElement('p');
      end.dataset.scrollEnd = 'true';
      end.textContent = 'End of long tool content';
      panel.append(spacer, end);
    });
}

async function expectContentScrollsAtEdge(page: Page, windowEdge: boolean): Promise<void> {
  const scroller = page.locator('.v4-layout-content-scroll');
  await scroller.evaluate((el) => {
    el.scrollTop = 0;
  });
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeGreaterThan(500);
  const edge = await scroller.evaluate((el) => ({
    scroll: el.getBoundingClientRect().right,
    pane: el.parentElement!.getBoundingClientRect().right,
    window: window.innerWidth,
    horizontalOverflow: el.scrollWidth - el.clientWidth,
  }));
  expect(Math.abs(edge.scroll - edge.pane)).toBeLessThanOrEqual(1);
  if (windowEdge) expect(Math.abs(edge.scroll - edge.window)).toBeLessThanOrEqual(1);
  expect(edge.horizontalOverflow).toBeLessThanOrEqual(1);

  await scroller.hover({ position: { x: 50, y: 100 } });
  await page.mouse.wheel(0, 400);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const end = await page.locator('[data-scroll-end]').boundingBox();
  const viewport = await scroller.boundingBox();
  expect(end).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(end!.y).toBeGreaterThanOrEqual(viewport!.y);
  expect(end!.y + end!.height).toBeLessThanOrEqual(viewport!.y + viewport!.height);
}

test.describe('Main content scrolling (#368)', () => {
  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
  });

  test('scrolls beside the palette, then at the window edge with the palette closed', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoTool(page, 'harmony');
    await addLongContent(page);
    await expectContentScrollsAtEdge(page, false);
    await page.locator('dye-palette-drawer .close-btn').click();
    await expect(page.locator('dye-palette-drawer')).not.toHaveAttribute('is-open');
    await expectContentScrollsAtEdge(page, true);
  });

  test('reaches the bottom on mobile without horizontal page overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoTool(page, 'harmony');
    await addLongContent(page);
    await expectContentScrollsAtEdge(page, true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(1);
  });

  test('scrolls the sidebar-free reader and expands all content for print', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoTool(page, 'glamour');
    await addLongContent(page);
    await expectContentScrollsAtEdge(page, true);
    await page.emulateMedia({ media: 'print' });
    const printed = await page.locator('.v4-layout-content-scroll').evaluate((el) => ({
      overflow: getComputedStyle(el).overflowY,
      bottom: el.getBoundingClientRect().bottom,
      end: el.querySelector('[data-scroll-end]')!.getBoundingClientRect().bottom,
    }));
    expect(printed.overflow).toBe('visible');
    expect(printed.end).toBeLessThanOrEqual(printed.bottom);
  });

  test('scrolls the community gallery at the window edge', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoTool(page, 'presets');
    await addLongContent(page);
    await expectContentScrollsAtEdge(page, true);
  });
});

test.describe('Mixer content scrolling', () => {
  for (const viewport of [
    { width: 1718, height: 1385 },
    { width: 1920, height: 1030 },
    { width: 390, height: 844 },
  ]) {
    test(`has one content scroller at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seedStartupStorage(page);
      await page.addInitScript(() => {
        const displayOptions = {
          showHex: true,
          showRgb: true,
          showHsv: true,
          showLab: true,
          showCmyk: true,
          showPrice: true,
          showDeltaE: true,
          showAcquisition: true,
          showHue: true,
          showStain: true,
          showSpectrum: true,
        };
        localStorage.setItem(
          'xivdyetools_v4_config_mixer',
          JSON.stringify({ maxResults: 8, displayOptions })
        );
        localStorage.setItem('xivdyetools_v4_config_global', JSON.stringify({ displayOptions }));
      });
      await page.goto('/mixer?dyeA=1&dyeB=2');
      await expect(page.locator('v4-result-card')).toHaveCount(8);
      await page.evaluate(() => document.fonts.ready);

      const main = page.locator('.v4-tool-main');
      const scroller = page.locator('.v4-layout-content-scroll');
      // Count actual overflow, not just declarations: the former mixer
      // scroller could overflow by only a few pixels beside the shell's bar.
      const scrollOwners = await scroller.evaluate((el) =>
        [el, ...el.querySelectorAll<HTMLElement>('*')]
          .filter(
            (node) =>
              /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) &&
              node.scrollHeight > node.clientHeight + 1
          )
          .map((node) => node.className)
      );
      expect(scrollOwners).toEqual(['v4-layout-content-scroll']);

      const palette = page.locator('dye-palette-drawer .drawer-content');
      const options = page.locator('v4-config-sidebar .v4-sidebar-content');
      const offsets = async () => ({
        palette: await palette.evaluate((el) => el.scrollTop),
        options: await options.evaluate((el) => el.scrollTop),
      });
      const before = await offsets();
      await scroller.hover({ position: { x: 30, y: 100 } });
      await page.mouse.wheel(0, 400);
      await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      expect(await offsets()).toEqual(before);
      expect(await main.evaluate((el) => el.scrollTop)).toBe(0);

      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const last = await page.locator('v4-result-card').last().boundingBox();
      const visible = await scroller.boundingBox();
      expect(last).not.toBeNull();
      expect(visible).not.toBeNull();
      expect(last!.y + last!.height).toBeLessThanOrEqual(visible!.y + visible!.height);
      expect(last!.y).toBeGreaterThanOrEqual(visible!.y);

      const contentOffset = await scroller.evaluate((el) => el.scrollTop);
      for (const side of [palette, options]) {
        if (viewport.width <= 768) {
          await page
            .locator(side === palette ? '.v4-palette-toggle' : '.v4-options-toggle')
            .click();
        }
        const other = side === palette ? options : palette;
        const otherOffset = await other.evaluate((el) => el.scrollTop);
        expect(await side.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(1);
        await side.hover({ position: { x: 30, y: 100 } });
        await page.mouse.wheel(0, 200);
        await expect.poll(() => side.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
        expect(await scroller.evaluate((el) => el.scrollTop)).toBe(contentOffset);
        expect(await other.evaluate((el) => el.scrollTop)).toBe(otherOffset);
        if (viewport.width <= 768) {
          await page
            .locator(
              side === palette
                ? 'dye-palette-drawer .close-btn'
                : 'v4-config-sidebar .v4-sidebar-collapse'
            )
            .click();
        }
      }
      if (viewport.width > 768) await page.locator('dye-palette-drawer .close-btn').click();
      await expect(page.locator('dye-palette-drawer')).not.toHaveAttribute('is-open');
      const edge = await scroller.evaluate((el) => el.getBoundingClientRect().right);
      expect(Math.abs(edge - viewport.width)).toBeLessThanOrEqual(1);
    });
  }
});
