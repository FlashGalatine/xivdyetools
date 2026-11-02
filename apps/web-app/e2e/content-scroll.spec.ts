import type { Locator } from '@playwright/test';
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

test.describe('Palette drawer sideways overflow', () => {
  // Every tool with a palette; the extractor, presets and glamour have none.
  const PALETTE_TOOLS = [
    'harmony',
    'accessibility',
    'comparison',
    'gradient',
    'mixer',
    'budget',
    'swatch',
  ];

  async function expectNoSidewaysScroll(page: Page): Promise<void> {
    const content = page.locator('dye-palette-drawer .drawer-content');
    await expect(content.locator('.swatch').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const { clientWidth, scrollWidth } = await content.evaluate((el) => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  }

  /**
   * A hovered swatch's tooltip and what can clip it. A pseudo-element has no
   * rect of its own, so its box comes from the swatch's live (scaled) rect plus
   * its used position, size and transform.
   */
  function measureTooltip(swatch: Locator) {
    return swatch.evaluate((el) => {
      const tip = getComputedStyle(el, '::after');
      const rect = el.getBoundingClientRect();
      const scale = rect.width / el.offsetWidth;
      const start = el.clientLeft + parseFloat(tip.left) + new DOMMatrix(tip.transform).m41;
      const left = rect.left + start * scale;
      const top = rect.top + (el.clientTop + parseFloat(tip.top)) * scale;
      const clip = { left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity };
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(parent);
        if (overflowX === 'visible' && overflowY === 'visible') continue;
        const box = parent.getBoundingClientRect();
        const clipLeft = box.left + parent.clientLeft;
        const clipTop = box.top + parent.clientTop;
        clip.left = Math.max(clip.left, clipLeft);
        clip.right = Math.min(clip.right, clipLeft + parent.clientWidth);
        clip.top = Math.max(clip.top, clipTop);
        clip.bottom = Math.min(clip.bottom, clipTop + parent.clientHeight);
      }
      return {
        name: el.getAttribute('title'),
        left,
        right: left + parseFloat(tip.width) * scale,
        top,
        bottom: top + parseFloat(tip.height) * scale,
        swatchTop: rect.top,
        swatchBottom: rect.bottom,
        clip,
      };
    });
  }

  async function waitForHoveredTooltip(swatch: Locator): Promise<void> {
    await expect
      .poll(() => swatch.evaluate((el) => getComputedStyle(el, '::after').opacity))
      .toBe('1');
    await expect
      .poll(() => swatch.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a))
      .toBeCloseTo(1.1, 2);
  }

  async function expectTooltipWhole(swatch: Locator): Promise<void> {
    const tip = await measureTooltip(swatch);
    expect(tip.left, `${tip.name} left edge`).toBeGreaterThanOrEqual(tip.clip.left);
    expect(tip.right, `${tip.name} right edge`).toBeLessThanOrEqual(tip.clip.right);
    expect(tip.top, `${tip.name} top edge`).toBeGreaterThanOrEqual(tip.clip.top);
    expect(tip.bottom, `${tip.name} bottom edge`).toBeLessThanOrEqual(tip.clip.bottom);
  }

  /** Scroll the panel until the swatch's top is this far below the panel's top. */
  async function scrollSwatchTo(swatch: Locator, offset: number): Promise<void> {
    await swatch.evaluate((el, gap) => {
      const scroller = el.closest('.drawer-content')!;
      const current = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTop += current - gap;
    }, offset);
  }

  /** Hover where the swatch is now: Locator.hover() can scroll it first. */
  async function hoverInPlace(swatch: Locator, y?: number): Promise<void> {
    const box = (await swatch.boundingBox())!;
    await swatch.page().mouse.move(box.x + box.width / 2, box.y + (y ?? box.height / 2));
    await waitForHoveredTooltip(swatch);
  }

  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
  });

  for (const tool of PALETTE_TOOLS) {
    test(`has no sideways scroll on ${tool}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoTool(page, tool);
      await expectNoSidewaysScroll(page);
    });
  }

  for (const width of [769, 768, 390, 320]) {
    test(`has no sideways scroll at a ${width}px window`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await gotoTool(page, 'harmony');
      if (width <= 768) await page.locator('.v4-palette-toggle').click();
      await expectNoSidewaysScroll(page);
    });
  }

  // Headless Chromium hides scrollbars, so the columns here are wider than a
  // real browser's. 310px leaves the width a classic 11px scrollbar leaves.
  for (const drawerWidth of ['320px', '310px']) {
    for (const locale of ['en', 'de', 'fr', 'ja', 'ko', 'zh']) {
      test(`keeps ${locale} dye tooltips inside a ${drawerWidth} drawer`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.addInitScript(
          (code) => localStorage.setItem('xivdyetools_locale', code),
          locale
        );
        await gotoTool(page, 'harmony');
        const drawer = page.locator('dye-palette-drawer');
        await drawer.evaluate((el, width) => {
          el.style.setProperty('--v4-drawer-width', width);
        }, drawerWidth);
        await expectNoSidewaysScroll(page);

        // The longest names go in Favorites, whose grid is narrower than the
        // main one: first added, first column.
        const longestNames = await drawer.locator('.category-section .swatch').evaluateAll((els) =>
          els
            .map((el) => ({
              name: el.getAttribute('title')!,
              width: parseFloat(getComputedStyle(el, '::after').width),
            }))
            .sort((a, b) => b.width - a.width)
            .slice(0, 5)
            .map((row) => row.name)
        );
        for (const name of longestNames) {
          await drawer
            .locator(`.category-section .swatch[title="${name}"] .swatch-favorite-btn`)
            .click();
        }
        await expect(drawer.locator('.favorites-content .swatch')).toHaveCount(5);

        // Hover the widest tooltip of each column in each kind of grid.
        const targets = await drawer.locator('.swatch').evaluateAll((els) => {
          const widest = new Map<string, { index: number; width: number }>();
          els.forEach((el, index) => {
            const inFavorites = el.closest('.favorites-section') !== null;
            const column = [...el.parentElement!.children].indexOf(el) % 5;
            const key = `${inFavorites}-${column}`;
            const width = parseFloat(getComputedStyle(el, '::after').width);
            if (width > (widest.get(key)?.width ?? 0)) widest.set(key, { index, width });
          });
          return [...widest.values()].map((target) => target.index);
        });
        expect(targets).toHaveLength(10);

        for (const index of targets) {
          const swatch = drawer.locator('.swatch').nth(index);
          await swatch.hover();
          await waitForHoveredTooltip(swatch);
          await expectTooltipWhole(swatch);
        }
      });
    }
  }

  test.describe('at the top of the scrolled panel', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoTool(page, 'harmony');
      await expectNoSidewaysScroll(page);
    });

    for (const offset of [-15, 0, 10, 30, 60]) {
      test(`keeps a dye tooltip whole ${offset}px from the top`, async ({ page }) => {
        const drawer = page.locator('dye-palette-drawer');
        // One row of Favorites: nothing below it in its section to open over.
        await drawer.locator('.category-section .swatch-favorite-btn').first().click();
        await expect(drawer.locator('.favorites-content .swatch')).toHaveCount(1);

        for (const swatch of [
          drawer.locator('.favorites-content .swatch').first(),
          drawer.locator('.category-section .swatch').nth(60),
        ]) {
          await scrollSwatchTo(swatch, offset);
          await hoverInPlace(swatch);
          await expectTooltipWhole(swatch);
        }
      });
    }

    test('leaves a dye tooltip above a swatch with room for it', async ({ page }) => {
      const swatch = page.locator('dye-palette-drawer .category-section .swatch').nth(60);
      await scrollSwatchTo(swatch, 120);
      await hoverInPlace(swatch);
      const tip = await measureTooltip(swatch);
      expect(tip.bottom).toBeLessThanOrEqual(tip.swatchTop);
    });

    test('moves a dye tooltip when its swatch scrolls up under a still pointer', async ({
      page,
    }) => {
      const swatch = page.locator('dye-palette-drawer .category-section .swatch').nth(60);
      await scrollSwatchTo(swatch, 65);
      // Near the swatch's top edge, so it stays under the pointer as it rises.
      await hoverInPlace(swatch, 4);
      const before = await measureTooltip(swatch);
      expect(before.bottom).toBeLessThanOrEqual(before.swatchTop);

      await scrollSwatchTo(swatch, 20);
      await expect
        .poll(async () => {
          const tip = await measureTooltip(swatch);
          return tip.top >= tip.swatchBottom;
        })
        .toBe(true);
      await expectTooltipWhole(swatch);
    });
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
