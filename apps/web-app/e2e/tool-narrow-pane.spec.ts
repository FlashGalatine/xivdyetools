/**
 * Harmony, Comparison and Accessibility when their pane is narrow: both side
 * panels open on a small window, which leaves 228px at 800x600.
 *
 * Before 5.16.11 each of them centered something fixed-width in that pane: the
 * 300px wheel, the 280px result cards, the "Add Dye" slots and the vision tabs.
 * Centering splits the excess across both sides, and nothing can scroll to what
 * hangs off the left, so the left of the wheel and of every card was just gone.
 * Accessibility's share row didn't wrap either, which at 1024x768 pushed the whole
 * pane into scrolling sideways.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

type Viewport = { width: number; height: number };
type ToolId = 'harmony' | 'comparison' | 'accessibility';

// Headless Chromium hides scrollbars, which gives the pane 10px that a real window
// doesn't have. A pair chip's 4px overflow only shows with them on.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

const DYES = [5729, 5736, 5740, 5745];
const LONGEST_NAME = 48171; // Metallic Cobalt Green, in French "Vert de cobalt métallique"
const MESSAGE = /^Select (at least 2 )?dyes to /;
const scroller = (page: Page) => page.locator('.v4-layout-content-scroll');

async function openTool(
  page: Page,
  tool: ToolId,
  viewport: Viewport,
  stored: Record<string, unknown> = {}
): Promise<void> {
  await page.setViewportSize(viewport);
  await seedStartupStorage(page);
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, stored);
  await gotoTool(page, tool);
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

/** Each match sits inside the pane's padding and clear of its scrollbar, and there is at least one. */
async function expectWithinPane(page: Page, targets: Locator): Promise<void> {
  const content = await scroller(page).evaluate((el) => {
    const { paddingLeft, paddingRight } = getComputedStyle(el);
    const { left } = el.getBoundingClientRect();
    return {
      left: left + parseFloat(paddingLeft),
      right: left + el.clientWidth - parseFloat(paddingRight),
    };
  });
  // The tool renders after the panels open, and count() doesn't wait for it.
  await expect(targets.first()).toBeVisible();
  const count = await targets.count();
  for (let i = 0; i < count; i++) {
    const inner = await box(targets.nth(i));
    expect(inner.x).toBeGreaterThanOrEqual(content.left - 1);
    expect(inner.x + inner.width).toBeLessThanOrEqual(content.right + 1);
  }
}

/**
 * Everything the tool drew, shadow roots included, that starts left of the pane.
 * Scrolling can't reach any of it, so this is the failure the spec exists for.
 */
function cutOffOnTheLeft(page: Page): Promise<string[]> {
  return scroller(page).evaluate((pane) => {
    const edge = pane.getBoundingClientRect().left - 1;
    const found: string[] = [];
    const walk = (root: Element | ShadowRoot): void => {
      for (const el of root.children) {
        const rect = el.getBoundingClientRect();
        // A closed context menu keeps its box, but isn't anything the user can miss.
        const shown = getComputedStyle(el).visibility !== 'hidden';
        if (shown && rect.width > 0 && rect.height > 0 && rect.left < edge) {
          found.push(`${el.tagName.toLowerCase()} at x=${rect.left}`);
        }
        if (el.shadowRoot) walk(el.shadowRoot);
        walk(el);
      }
    };
    walk(pane);
    return found;
  });
}

/** A spoke stays 35% of the wheel, or it would poke through the ring of a smaller one. */
async function expectSpokesFollowTheWheel(page: Page): Promise<void> {
  const ring = await box(page.locator('v4-color-wheel .harmony-ring'));
  const spoke = page.locator('v4-color-wheel .harmony-line').first();
  expect(await spoke.evaluate((el: HTMLElement) => el.offsetWidth)).toBeLessThanOrEqual(
    ring.width * 0.35 + 1
  );
}

/**
 * The slots and the message still read, rather than merely fitting: with their full
 * padding at 769px there's no room left for either, and the message breaks a letter
 * at a time. The dashed box also keeps its icon and text inside its own edges.
 */
async function expectEmptyStateIsUsable(page: Page): Promise<void> {
  const slot = page.getByText('Add Dye', { exact: true }).first().locator('..');
  expect((await box(slot)).width).toBeGreaterThanOrEqual(100);

  const message = page.getByText(MESSAGE);
  expect((await box(message)).width).toBeGreaterThanOrEqual(90);
  const spilling = await message.locator('..').evaluate((outer) => {
    const { left, right } = outer.getBoundingClientRect();
    return [...outer.children].filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left < left - 1 || rect.right > right + 1;
    }).length;
  });
  expect(spilling).toBe(0);
}

/** Nothing left of the pane, no sideways scrolling, and the shell as the one vertical scroller. */
async function expectFitsThePane(page: Page): Promise<void> {
  expect(await cutOffOnTheLeft(page)).toEqual([]);
  const overflow = await scroller(page).evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // #372: the shell owns vertical scrolling. Count real overflow, as the Mixer's test does.
  const owners = await scroller(page).evaluate((el) =>
    [el, ...el.querySelectorAll<HTMLElement>('*')]
      .filter(
        (node) =>
          node !== el &&
          /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) &&
          node.scrollHeight > node.clientHeight + 1
      )
      .map((node) => node.className)
  );
  expect(owners).toEqual([]);
}

/** Side to side, inside the part of the pane that isn't its scrollbar. */
async function expectInsidePane(page: Page, target: Locator): Promise<void> {
  const pane = await scroller(page).evaluate((el) => {
    const { left } = el.getBoundingClientRect();
    return { left, right: left + el.clientWidth };
  });
  const inner = await box(target);
  expect(inner.x).toBeGreaterThanOrEqual(pane.left);
  expect(inner.x + inner.width).toBeLessThanOrEqual(pane.right);
}

/**
 * Where a pointer lands on a wheel's puck: its center, where the digit is, and how
 * many of nine points spread across it. The base puck and the hub sit above it.
 */
function puckReach(puck: Locator): Promise<{ center: boolean; points: number }> {
  return puck.evaluate((el) => {
    const landsOn = (x: number, y: number): boolean => {
      let hit = document.elementFromPoint(x, y);
      while (hit?.shadowRoot) {
        const inner = hit.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === hit) break;
        hit = inner;
      }
      return hit === el;
    };
    const { left, top, width, height } = el.getBoundingClientRect();
    const cx = left + width / 2;
    const cy = top + height / 2;
    let points = 0;
    for (const dx of [-0.3, 0, 0.3]) {
      for (const dy of [-0.3, 0, 0.3]) {
        if (landsOn(cx + dx * width, cy + dy * height)) points++;
      }
    }
    return { center: landsOn(cx, cy), points };
  });
}

/** A "What actually differs" row, found by its label, and the two dyes' values in it. */
function differsRow(page: Page, label: string): Locator {
  return page
    .locator('span[style*="font-size: 9px"]')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('..');
}

async function differsValues(row: Locator) {
  return row.evaluate((el) =>
    [...el.querySelectorAll<HTMLElement>('span')]
      .filter((span) => span.style.fontSize === '12px')
      .map((value) => ({
        width: value.getBoundingClientRect().width,
        clipped: value.scrollWidth > value.clientWidth,
      }))
  );
}

const DIFFERS_ROWS = ['LIGHTNESS', 'SATURATION', 'HUE', 'VENDOR', 'SOURCE'];

test.describe('Tools in a narrow pane', () => {
  // 769px is the narrowest window that keeps both panels inline.
  for (const viewport of [
    { width: 769, height: 700 },
    { width: 800, height: 600 },
    { width: 1024, height: 768 },
  ]) {
    const size = `${viewport.width}x${viewport.height}`;

    test(`Harmony fits the wheel with no dye at ${size}`, async ({ page }) => {
      await openTool(page, 'harmony', viewport);

      await expectWithinPane(page, page.locator('v4-color-wheel'));
      await expectSpokesFollowTheWheel(page);
      await expectFitsThePane(page);
    });

    test(`Harmony fits the wheel, hub and nodes with a dye at ${size}`, async ({ page }) => {
      await openTool(page, 'harmony', viewport, { v3_harmony_selected_dye: DYES[1] });
      await expect(page.locator('v4-color-wheel .main-swatch-display.empty')).toHaveCount(0);

      await expectWithinPane(page, page.locator('v4-color-wheel'));
      await expectWithinPane(page, page.locator('v4-color-wheel .main-swatch-display'));
      await expectWithinPane(page, page.locator('v4-color-wheel .harmony-node'));
      await expectFitsThePane(page);

      // The wheel stays round when it shrinks.
      const ring = await box(page.locator('v4-color-wheel .harmony-ring'));
      expect(ring.height).toBeCloseTo(ring.width, 1);
      // And what's on it shrinks too: the hub would sit on top of the nodes, and
      // the label would fall off the bottom.
      const hub = await box(page.locator('v4-color-wheel .main-swatch-display'));
      expect(hub.width).toBeLessThanOrEqual(ring.width * 0.46 + 1);
      await expectSpokesFollowTheWheel(page);
      const label = await box(page.locator('v4-color-wheel .harmony-label'));
      expect(label.y + label.height).toBeLessThanOrEqual(ring.y + ring.height);
    });

    test(`Comparison fits the empty slots at ${size}`, async ({ page }) => {
      await openTool(page, 'comparison', viewport);

      const labels = page.getByText('Add Dye', { exact: true });
      await expect(labels).toHaveCount(4);
      await expectWithinPane(page, labels.locator('..'));
      await expectEmptyStateIsUsable(page);
      await expectFitsThePane(page);
    });

    test(`Comparison fits a single dye's card at ${size}`, async ({ page }) => {
      await openTool(page, 'comparison', viewport, {
        v3_comparison_selected_dyes: DYES.slice(0, 1),
      });

      await expect(page.locator('v4-result-card').filter({ visible: true })).toHaveCount(1);
      await expectWithinPane(page, page.locator('v4-result-card').filter({ visible: true }));
      await expectFitsThePane(page);
    });

    test(`Comparison fits the pair chips and cards at ${size}`, async ({ page }) => {
      await openTool(page, 'comparison', viewport, {
        v3_comparison_selected_dyes: DYES,
      });

      await expect(page.locator('v4-result-card').filter({ visible: true })).toHaveCount(2);
      await expectWithinPane(page, page.locator('v4-result-card').filter({ visible: true }));
      const chips = page.getByRole('button', { name: ' × ' });
      await expect(chips).toHaveCount(6);
      await expectWithinPane(page, chips);
      await expectFitsThePane(page);
    });

    test(`Accessibility fits the empty slots at ${size}`, async ({ page }) => {
      await openTool(page, 'accessibility', viewport);

      const labels = page.getByText('Add Dye', { exact: true });
      await expect(labels).toHaveCount(4);
      await expectWithinPane(page, labels.locator('..'));
      await expectEmptyStateIsUsable(page);
      await expectFitsThePane(page);
    });

    test(`Accessibility fits the vision tabs and the share row at ${size}`, async ({ page }) => {
      await openTool(page, 'accessibility', viewport, {
        v3_accessibility_selected_dyes: DYES.slice(0, 2),
      });

      const tabs = page.getByRole('tab');
      await expect(tabs).toHaveCount(5);
      await expectWithinPane(page, tabs);
      // The lens grid's tile and the result card, each around the dye's name.
      await expectWithinPane(page, page.getByText('Snow White', { exact: true }).locator('..'));

      await expectWithinPane(page, page.getByText('As designed → as perceived', { exact: true }));
      await expectWithinPane(page, page.locator('select').filter({ visible: true }));
      await expectWithinPane(page, page.locator('v4-share-button').filter({ visible: true }));
      await expectFitsThePane(page);
    });
  }

  // A card's menu opens from its right corner and each submenu opens left of that,
  // so a card in a narrow pane put them over the side panel, where the pane clips
  // them and no pointer reaches them. A phone has no panel, just the screen's edge.
  for (const [tool, stored] of [
    ['comparison', { v3_comparison_selected_dyes: DYES }],
    ['harmony', { v3_harmony_selected_dye: DYES[1] }],
    ['accessibility', { v3_accessibility_selected_dyes: DYES.slice(0, 2) }],
  ] as Array<[ToolId, Record<string, unknown>]>) {
    for (const viewport of [
      { width: 769, height: 900 },
      { width: 814, height: 900 },
      { width: 860, height: 900 },
      { width: 1024, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const size = `${viewport.width}x${viewport.height}`;

      test(`${tool}'s card menu and submenus stay inside the pane at ${size}`, async ({ page }) => {
        // No first-run hint in the way on a phone, and no hover lift to wait out.
        await openTool(page, tool, viewport, { ...stored, xivdyetools_palette_hint_seen: true });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const card = page.locator('v4-result-card').filter({ visible: true }).first();
        await card.locator('.menu-btn').click();

        const menu = card.locator('.context-menu.open');
        await expect(menu).toBeVisible();
        await expectInsidePane(page, menu);

        // Up from the button and back down, by each row's right end: going down, that's
        // the only part of the next row that the open submenu above it leaves uncovered.
        const rows = menu.locator('.menu-item.has-submenu');
        await expect(rows).toHaveCount(3);
        for (const index of [2, 1, 0, 1, 2, 1, 0]) {
          const row = rows.nth(index);
          const { width, height } = await box(row);
          await row.hover({ position: { x: width - 12, y: height / 2 } });
          const submenu = row.locator('.submenu');
          await expect(submenu).toBeVisible();
          await expect(() => expectInsidePane(page, submenu)).toPass();
        }
        const overflow = await scroller(page).evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);

        // Inspect Dye in… Budget. A click only gets there if a pointer can reach it.
        await rows.nth(0).locator('.submenu .menu-item').nth(1).click();
        await expect(page).toHaveURL(/\/budget/);
      });
    }
  }

  // Its longest single word, Barrierefreiheitsprüfung, has to break to stay inside.
  test('breaks a long German word in a submenu at 769x900', async ({ page }) => {
    await openTool(
      page,
      'harmony',
      { width: 769, height: 900 },
      { xivdyetools_locale: 'de', v3_harmony_selected_dye: DYES[1] }
    );
    const card = page.locator('v4-result-card').filter({ visible: true }).first();
    await card.locator('.menu-btn').click();
    const row = card.locator('.context-menu.open .menu-item.has-submenu').first();
    const { width, height } = await box(row);
    await row.hover({ position: { x: width - 12, y: height / 2 } });

    const items = row.locator('.submenu .menu-item');
    await expect(items.first()).toBeVisible();
    const submenu = await box(row.locator('.submenu'));
    const spilling = await items.evaluateAll(
      (all) => all.filter((item) => item.scrollWidth > item.clientWidth).length
    );
    expect(spilling).toBe(0);
    expect(submenu.width).toBeGreaterThanOrEqual(100);
  });

  test('keeps the card menu where it was designed at 1440x900', async ({ page }) => {
    await openTool(
      page,
      'harmony',
      { width: 1440, height: 900 },
      { v3_harmony_selected_dye: DYES[1] }
    );
    const card = page.locator('v4-result-card').filter({ visible: true }).first();
    await card.locator('.menu-btn').click();

    const menu = await box(card.locator('.context-menu.open'));
    const button = await box(card.locator('.menu-btn'));
    expect(menu.width).toBe(200);
    expect(menu.x + menu.width).toBeCloseTo(button.x + button.width, 0);

    const row = card.locator('.menu-item.has-submenu').first();
    await row.hover();
    const submenu = row.locator('.submenu');
    await expect(submenu).toBeVisible();
    await expect(async () => {
      const found = await box(submenu);
      expect(found.width).toBe(200);
      expect(found.x + found.width).toBeCloseTo(menu.x - 7, 0);
    }).toPass();
  });

  // Monochromatic's two dyes share a spoke and Shades' three sit 15° apart, so a
  // wheel this small needs smaller pucks: a 42px base puck covered their digits.
  for (const harmonyType of ['monochromatic', 'shades']) {
    for (const viewport of [
      { width: 769, height: 800 },
      { width: 785, height: 800 },
      { width: 800, height: 800 },
    ]) {
      const size = `${viewport.width}x${viewport.height}`;

      test(`Harmony leaves ${harmonyType}'s numbered pucks reachable at ${size}`, async ({
        page,
      }) => {
        await openTool(page, 'harmony', viewport, {
          v3_harmony_selected_dye: DYES[1],
          xivdyetools_v4_config_harmony: { harmonyType },
        });

        const pucks = page.locator('v4-color-wheel .harmony-node:not(.main)');
        await expect(pucks.first()).toBeVisible();
        for (let i = 0; i < (await pucks.count()); i++) {
          const reach = await puckReach(pucks.nth(i));
          expect(reach.center).toBe(true);
          expect(reach.points).toBeGreaterThanOrEqual(5);
        }

        const puck = await box(pucks.first());
        expect(puck.height).toBeCloseTo(puck.width, 1);
        expect(puck.width).toBeGreaterThanOrEqual(24);
        await expectFitsThePane(page);
      });
    }
  }

  // A phone is held to the designed touch target, and 320px is the smallest in use.
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`keeps 42px pucks at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await openTool(page, 'harmony', viewport, { v3_harmony_selected_dye: DYES[1] });
      const puck = await box(page.locator('v4-color-wheel .harmony-node').first());
      // Under 0.1px short at 320px: only this test's real scrollbar makes that wheel
      // 262px rather than a phone's 272px.
      expect(puck.width).toBeCloseTo(42, 0);
      expect(puck.height).toBeCloseTo(42, 0);
    });
  }

  // 92px of label and two values on one line left the values 0 to 7px at 769 to
  // 860px, and an ellipsis was all they could show.
  for (const width of [769, 800, 830, 860]) {
    test(`Comparison wraps "What actually differs" so its values read at ${width}px`, async ({
      page,
    }) => {
      await openTool(
        page,
        'comparison',
        { width, height: 900 },
        { v3_comparison_selected_dyes: DYES.slice(0, 2) }
      );

      for (const label of DIFFERS_ROWS) {
        const row = differsRow(page, label);
        await expect(row).toBeVisible();
        const values = await differsValues(row);
        expect(values).toHaveLength(2);
        for (const value of values) {
          expect(value.width).toBeGreaterThanOrEqual(30);
          expect(value.clipped).toBe(false);
        }
      }
      await expectWithinPane(page, differsRow(page, 'SOURCE'));
      await expectFitsThePane(page);
    });
  }

  for (const width of [1024, 1440]) {
    test(`keeps each "What actually differs" row on one line at ${width}px`, async ({ page }) => {
      await openTool(
        page,
        'comparison',
        { width, height: 900 },
        { v3_comparison_selected_dyes: DYES.slice(0, 2) }
      );

      for (const label of DIFFERS_ROWS) {
        const row = differsRow(page, label);
        await expect(row).toBeVisible();
        expect((await box(row)).height).toBe(34);
      }
      const [first, second] = await differsValues(differsRow(page, 'LIGHTNESS'));
      expect(first.width).toBeCloseTo(second.width, 1);
    });
  }

  // Longer labels than English, so the header rows have to wrap at this size.
  test('Comparison wraps its German header rows at 800x600', async ({ page }) => {
    await openTool(
      page,
      'comparison',
      { width: 800, height: 600 },
      {
        xivdyetools_locale: 'de',
        v3_comparison_selected_dyes: DYES.slice(0, 2),
      }
    );

    await expectWithinPane(page, page.getByRole('button', { name: 'Exportieren' }));
    await expectWithinPane(page, page.getByText('ΔE2000', { exact: true }));
    await expectFitsThePane(page);
  });

  test('Harmony wraps its French results header at 800x600', async ({ page }) => {
    await openTool(
      page,
      'harmony',
      { width: 800, height: 600 },
      {
        xivdyetools_locale: 'fr',
        v3_harmony_selected_dye: LONGEST_NAME,
      }
    );

    await expectWithinPane(page, page.getByRole('button', { name: 'Partager' }));
    await expectFitsThePane(page);

    // The longest dye name in any language can't stretch the hub out of round.
    const hub = await box(page.locator('v4-color-wheel .main-swatch-display'));
    expect(hub.height).toBeCloseTo(hub.width, 1);
  });

  // This message has the longest single word: Barrierefreiheitsanalyse hung 4px
  // off the left.
  test('Accessibility breaks a long German word at 769x700', async ({ page }) => {
    await openTool(
      page,
      'accessibility',
      { width: 769, height: 700 },
      { xivdyetools_locale: 'de' }
    );

    await expect(scroller(page).getByText(/Barrierefreiheitsanalyse/)).toBeVisible();
    await expectFitsThePane(page);
  });

  // A phone has no side panels, but its pane was too narrow for the same row: 149px.
  test("Accessibility's share row doesn't push a phone sideways", async ({ page }) => {
    await openTool(
      page,
      'accessibility',
      { width: 390, height: 844 },
      {
        v3_accessibility_selected_dyes: DYES.slice(0, 2),
      }
    );

    await expectWithinPane(page, page.locator('select').filter({ visible: true }));
    await expectWithinPane(page, page.locator('v4-share-button').filter({ visible: true }));
    await expectFitsThePane(page);
  });

  // The narrow-pane sizing must not reach a window with room to spare.
  test('keeps the designed sizes at 1440x900', async ({ page }) => {
    await openTool(page, 'harmony', { width: 1440, height: 900 });
    expect((await box(page.locator('v4-color-wheel'))).width).toBe(300);
    expect((await box(page.locator('v4-color-wheel .main-swatch-display'))).width).toBe(114);
    // offsetWidth, because the spokes are rotated and a bounding box isn't their length.
    const spoke = page.locator('v4-color-wheel .harmony-line').first();
    expect(await spoke.evaluate((el: HTMLElement) => el.offsetWidth)).toBe(105);
  });

  test('keeps the designed card and slot sizes at 1440x900', async ({ page }) => {
    await openTool(page, 'comparison', { width: 1440, height: 900 });
    const slot = page.getByText('Add Dye', { exact: true }).first().locator('..');
    expect((await box(slot)).width).toBe(200);

    await page.evaluate((dyes) => {
      localStorage.setItem('v3_comparison_selected_dyes', JSON.stringify(dyes));
    }, DYES);
    await page.reload();
    const cards = page.locator('v4-result-card').filter({ visible: true });
    await expect(cards).toHaveCount(2);
    expect((await box(cards.first())).width).toBe(280);
  });
});
