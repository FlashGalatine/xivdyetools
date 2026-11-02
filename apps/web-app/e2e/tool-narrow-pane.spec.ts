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
type ToolId = 'harmony' | 'comparison' | 'accessibility' | 'mixer' | 'gradient';

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

/**
 * The Mixer and the Gradient Builder keep 32px of side padding of their own inside
 * the pane's 24px, which at 769px left them 75px. Before 5.16.13 the Mixer's field
 * wouldn't go under 348px and its results header wouldn't wrap, which scrolled the
 * pane sideways by 217px, and the Gradient's endpoint cards had no room for what
 * they print: the swatch spilled out of the card and the text had a width of 0.
 */
const MIXER_PAIR = { v4_mixer_selected_dyes: [DYES[0], DYES[1], null] };
const GRADIENT_PAIR = { v3_mixer_selected_dyes: DYES.slice(0, 2) };
const RATIOS = ['10/90', '30/70', '50/50', '70/30', '90/10'];
const fieldCells = (page: Page) => page.locator('button[title*=" · #"]');

/** The box of the text itself, which an element's own box doesn't show when it spills. */
function textBox(target: Locator) {
  return target.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const { left, right } = range.getBoundingClientRect();
    return { left, right };
  });
}

/** What a cell prints stays in it, and the ratio headings don't run together. */
async function expectFieldReads(page: Page): Promise<void> {
  const spilling = await fieldCells(page).evaluateAll((cells) =>
    cells
      .filter((cell) => {
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        const { left, right } = cell.getBoundingClientRect();
        return text.left < left || text.right > right;
      })
      .map((cell) => cell.textContent)
  );
  expect(spilling).toEqual([]);

  let previous = -Infinity;
  for (const ratio of RATIOS) {
    const text = await textBox(page.getByText(ratio, { exact: true }));
    expect(text.left).toBeGreaterThan(previous);
    previous = text.right;
  }
}

/** The swatch and the label stay in the card, and the dye's name gets room to start. */
async function expectEndpointReads(card: Locator): Promise<void> {
  const parts = await card.evaluate((el) => {
    const [swatch, column] = [...el.children];
    const [label, name] = [...column.children];
    const range = document.createRange();
    range.selectNodeContents(label);
    return {
      right: el.getBoundingClientRect().right,
      swatchRight: swatch.getBoundingClientRect().right,
      labelRight: range.getBoundingClientRect().right,
      nameWidth: name.getBoundingClientRect().width,
    };
  });
  expect(parts.swatchRight).toBeLessThanOrEqual(parts.right);
  expect(parts.labelRight).toBeLessThanOrEqual(parts.right);
  expect(parts.nameWidth).toBeGreaterThanOrEqual(28);
}

test.describe('Mixer and Gradient in a narrow pane', () => {
  for (const viewport of [
    { width: 769, height: 700 },
    { width: 800, height: 600 },
    { width: 860, height: 700 },
    { width: 960, height: 700 },
    { width: 1024, height: 768 },
  ]) {
    const size = `${viewport.width}x${viewport.height}`;

    test(`Mixer fits its empty slots at ${size}`, async ({ page }) => {
      await openTool(page, 'mixer', viewport);

      const message = page
        .getByText('Select two dyes to blend and find matching colors')
        .filter({ visible: true });
      // The row of slots, and the tool's icon under it.
      const parts = message.locator('..').locator('> div');
      await expect(parts).toHaveCount(2);
      await expectWithinPane(page, parts);
      await expectFitsThePane(page);
    });

    test(`Mixer fits the field and the results header at ${size}`, async ({ page }) => {
      await openTool(page, 'mixer', viewport, MIXER_PAIR);

      await expect(fieldCells(page)).toHaveCount(30);
      await expectWithinPane(page, fieldCells(page));
      await expectFieldReads(page);
      await expectWithinPane(page, page.locator('.mixer-result-slot'));
      await expectWithinPane(page, page.getByRole('button', { name: 'Save mix' }));
      await expectWithinPane(page, page.getByTestId('mixer-export'));
      await expectWithinPane(page, page.locator('v4-share-button').filter({ visible: true }));
      // Its first word whole, rather than squeezed beside the actions and broken.
      const title = await box(page.getByText('Matching Dyes', { exact: true }));
      expect(title.width).toBeGreaterThanOrEqual(80);
      await expectFitsThePane(page);
    });

    test(`Gradient fits its endpoint cards with no dye at ${size}`, async ({ page }) => {
      await openTool(page, 'gradient', viewport);

      await expectWithinPane(page, page.getByTestId('gradient-start-node'));
      await expectWithinPane(page, page.getByTestId('gradient-end-node'));
      await expectEndpointReads(page.getByTestId('gradient-start-node'));
      await expectEndpointReads(page.getByTestId('gradient-end-node'));
      await expectFitsThePane(page);
    });

    test(`Gradient fits the rail and the results header with a pair at ${size}`, async ({
      page,
    }) => {
      await openTool(page, 'gradient', viewport, GRADIENT_PAIR);

      await expect(page.locator('.v5-grad-row')).toHaveCount(8);
      await expectEndpointReads(page.getByTestId('gradient-start-node'));
      await expectEndpointReads(page.getByTestId('gradient-end-node'));
      await expectWithinPane(page, page.getByTestId('gradient-swap-button'));
      await expectWithinPane(page, page.locator('.v5-grad-row'));
      await expectWithinPane(page, page.getByTestId('gradient-export'));
      await expectWithinPane(page, page.locator('v4-share-button').filter({ visible: true }));
      // Its first word whole, rather than squeezed beside the controls and broken.
      const label = await box(page.getByText('Gradient Results', { exact: true }));
      expect(label.width).toBeGreaterThanOrEqual(70);
      await expectFitsThePane(page);
    });
  }

  // A pointer has to land on it, and the redraw it starts has to fit as well.
  test('the far corner of the field takes a click at 769x700', async ({ page }) => {
    await openTool(page, 'mixer', { width: 769, height: 700 }, MIXER_PAIR);

    const corner = fieldCells(page).last();
    const hex = (await corner.getAttribute('title'))!.split(' · ')[2];
    await corner.click();

    await expect(page.locator('.mixer-result-slot')).toContainText(hex);
    await expectWithinPane(page, fieldCells(page));
    await expectFitsThePane(page);
  });

  // A side panel changes the pane's width with no window resize for a media query to see.
  test('the field follows a panel closing at 769x700', async ({ page }) => {
    await openTool(page, 'mixer', { width: 769, height: 700 }, MIXER_PAIR);

    const name = page.getByText('Spectral', { exact: true });
    const firstCell = fieldCells(page).nth(5);
    const nameBox = await box(name);
    expect((await box(firstCell)).y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height);

    await page.locator('v4-config-sidebar .v4-sidebar-collapse').click();

    // Beside the name again, with the name's 68px and the 4px gap between them.
    await expect
      .poll(async () => (await box(firstCell)).x - (await box(name)).x)
      .toBeCloseTo(72, 1);
    await expectFitsThePane(page);
  });

  // OKLab prints three decimals, which is the widest a cell's ΔE gets.
  test('the widest ΔE stays in its cell at 769x700', async ({ page }) => {
    await openTool(
      page,
      'mixer',
      { width: 769, height: 700 },
      { ...MIXER_PAIR, xivdyetools_v4_config_mixer: { matchingMethod: 'oklab' } }
    );

    await expect(fieldCells(page).first()).toHaveText(/^\d\.\d{3}$/);
    await expectFieldReads(page);
    await expectFitsThePane(page);
  });

  // Longer labels than English, with one word wider than the 139px that 769px leaves.
  for (const [locale, title, exportLabel] of [
    ['de', 'Passende Farbstoffe', 'Exportieren'],
    ['fr', 'Teintures correspondantes', 'Exporter'],
  ]) {
    test(`Mixer wraps its ${locale} results header at 769x700`, async ({ page }) => {
      await openTool(
        page,
        'mixer',
        { width: 769, height: 700 },
        { ...MIXER_PAIR, xivdyetools_locale: locale }
      );

      await expectWithinPane(page, page.getByText(title, { exact: true }));
      await expectWithinPane(page, page.getByRole('button', { name: exportLabel }));
      await expectWithinPane(page, page.locator('v4-share-button').filter({ visible: true }));
      await expectFitsThePane(page);
    });
  }

  for (const [locale, title, exportLabel] of [
    ['de', 'Verlaufsergebnisse', 'Exportieren'],
    ['fr', 'Résultats du Dégradé', 'Exporter'],
  ]) {
    test(`Gradient wraps its ${locale} results header at 769x700`, async ({ page }) => {
      await openTool(
        page,
        'gradient',
        { width: 769, height: 700 },
        { ...GRADIENT_PAIR, xivdyetools_locale: locale }
      );

      await expect(page.locator('.v5-grad-row')).toHaveCount(8);
      await expectWithinPane(page, page.getByText(title, { exact: true }));
      await expectWithinPane(page, page.getByRole('button', { name: exportLabel }));
      await expectWithinPane(page, page.locator('v4-share-button').filter({ visible: true }));
      await expectFitsThePane(page);
    });
  }

  // A phone has the Mixer's bug too: 56px of padding and a 348px field need 404px.
  // Only the field gives way there, so its padding and results header don't move.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    test(`Mixer's field doesn't push a ${viewport.width}px phone sideways`, async ({ page }) => {
      await openTool(page, 'mixer', viewport, MIXER_PAIR);

      await expectWithinPane(page, fieldCells(page));
      await expectFieldReads(page);
      await expectFitsThePane(page);
      const padding = await page
        .locator('.v4-tool-main')
        .evaluate((el) => getComputedStyle(el).paddingLeft);
      expect(padding).toBe('32px');

      const title = await box(page.getByText('Matching Dyes', { exact: true }));
      const exportButton = await box(page.getByTestId('mixer-export'));
      expect(exportButton.y).toBeLessThan(title.y + title.height);
    });
  }

  test("a phone's Gradient keeps its padding and its one row of cards", async ({ page }) => {
    await openTool(page, 'gradient', { width: 390, height: 844 }, GRADIENT_PAIR);

    const workspace = page.locator('.v5-grad-workspace');
    expect(await workspace.evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('12px');
    const from = await box(page.getByTestId('gradient-start-node'));
    const to = await box(page.getByTestId('gradient-end-node'));
    expect(to.y).toBe(from.y);
    await expectFitsThePane(page);
  });

  // The narrow-pane sizing must not reach a window where the design fits. The Mixer's
  // field needs 412px with its padding, and the first window that gives it that is 1042px.
  for (const { viewport, cell } of [
    { viewport: { width: 1046, height: 800 }, cell: 52.8 },
    { viewport: { width: 1440, height: 900 }, cell: 94.4 },
  ]) {
    test(`keeps the Mixer's designed field at ${viewport.width}px`, async ({ page }) => {
      await openTool(page, 'mixer', viewport, MIXER_PAIR);

      const padding = await page
        .locator('.v4-tool-main')
        .evaluate((el) => getComputedStyle(el).paddingLeft);
      expect(padding).toBe('32px');
      expect((await box(page.getByText('Spectral', { exact: true }))).width).toBe(68);
      expect((await box(fieldCells(page).first())).width).toBeCloseTo(cell, 1);
      expect((await box(fieldCells(page).nth(5))).y).toBeGreaterThan(
        (await box(fieldCells(page).first())).y
      );
    });
  }

  // Likewise the Gradient, whose cards have what they print from a 934px window up.
  for (const viewport of [
    { width: 934, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`keeps the Gradient's padding and rows at ${viewport.width}px`, async ({ page }) => {
      await openTool(page, 'gradient', viewport, GRADIENT_PAIR);

      const workspace = page.locator('.v5-grad-workspace');
      expect(await workspace.evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('32px');
      const from = await box(page.getByTestId('gradient-start-node'));
      const swap = await box(page.getByTestId('gradient-swap-button'));
      const to = await box(page.getByTestId('gradient-end-node'));
      expect(to.y).toBe(from.y);
      expect(swap.x).toBeGreaterThan(from.x + from.width);
      expect(to.x).toBeGreaterThan(swap.x + swap.width);
      // The label and the cluster share the header's line, however the cluster wraps inside.
      const label = await box(page.getByText('Gradient Results', { exact: true }));
      const cluster = await box(page.locator('.section-header > div').filter({ visible: true }));
      expect(cluster.y).toBeLessThan(label.y + label.height);
    });
  }
});
