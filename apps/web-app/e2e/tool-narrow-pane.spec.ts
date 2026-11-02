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
