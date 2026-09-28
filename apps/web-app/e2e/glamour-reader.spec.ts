/**
 * The Glamour Reader (5.13.0, design 1a/1b/2c) end to end: one file shared
 * with the Swatch Matcher, the IN THE GAME verdict, a twin pick, the export
 * sheet's device-kept Acquisition edit, and a ten-chip rail that still fits
 * on a narrow desktop with a hovered label.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

/** A Midlander woman in a head dyed Snow White on channel 1. */
const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  Nickname: 'Reader Test',
  Race: 'Hyur',
  Tribe: 'Midlander',
  Gender: 'Feminine',
  REyeColor: 42,
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
});

const names = (en: string) => ({ en, ja: en, de: en, fr: en });
const group = (itemIds: number[], dyeCount: number) => ({
  itemIds,
  dyeCount,
  glamourable: true,
  wearMask: 0xffff,
  grandCompany: 0,
});
/** Dated Hempen Coif takes no dye; its twin Hempen Coif takes one. */
const RESOLVE = {
  success: true,
  data: {
    version: 'test',
    glasses: null,
    items: {
      HeadGear: {
        itemId: 372,
        names: names('Dated Hempen Coif'),
        iconId: null,
        familySize: 2,
        alternates: [
          { itemId: 2629, names: names('Hempen Coif'), acquisition: 'Crafted (WVR Lvl. 3)' },
        ],
        viaMainHand: false,
        rules: [group([372], 0), group([2629], 1)],
      },
    },
  },
};

const fileInput = (page: Page) => page.locator('input[type="file"][accept*=".chara"]');
const block = (page: Page) => page.locator('[data-role="glamour-block"]');
const headRow = (page: Page) => block(page).locator('[data-slot="HeadGear"]');

async function loadFixture(page: Page): Promise<void> {
  await fileInput(page).setInputFiles({
    name: 'reader.chara',
    mimeType: 'application/json',
    buffer: Buffer.from(FIXTURE),
  });
  // The name stays on the card's first line on a phone too; the buttons wrap under it
  await expect(page.getByText('Reader Test', { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await seedStartupStorage(page);
  await page.route('**/v1/chara/resolve', (route) => route.fulfill({ json: RESOLVE }));
});

test('one file, two tools: a file loaded in the Swatch Matcher is already in the reader', async ({
  page,
}) => {
  await gotoTool(page, 'swatch');
  await loadFixture(page);

  await page.locator('[data-role="cross-link"]').click();

  await expect(page).toHaveURL(/\/glamour/);
  await expect(page.getByRole('heading', { name: 'Glamour Reader' })).toBeVisible();
  await expect(block(page)).toBeVisible();
  await expect(fileInput(page)).toHaveCount(0);
});

test('verdict first, a twin named and picked, and an edited Acquisition line kept', async ({
  page,
}) => {
  await gotoTool(page, 'glamour');
  await loadFixture(page);

  const verdict = page.locator('[data-role="verdict"]');
  await expect(verdict).toContainText('IN THE GAME');
  await expect(verdict).toContainText('1 FIXED BY A TWIN');
  await expect(headRow(page).locator('[data-role="item-name"]')).toHaveText('Hempen Coif');

  // The export sheet: the generated line, then an edit that survives reopening
  await page.locator('[data-role="reader-actions"] [data-role="copy-list"]').click();
  const sheet = page.locator('[data-role="glamour-sheet"]');
  const field = sheet.locator('[data-role="sheet-row"][data-slot="HeadGear"] textarea');
  await expect(field).toHaveValue('Crafted (WVR Lvl. 3)');
  await field.fill('Crafted (WVR Lvl. 3) / my note');
  await expect(sheet.locator('[data-role="sheet-preview"]')).toContainText(
    'Acquisition: Crafted (WVR Lvl. 3) / my note'
  );
  await page.keyboard.press('Escape');
  await page.locator('[data-role="reader-actions"] [data-role="export-markdown"]').click();
  await expect(field).toHaveValue('Crafted (WVR Lvl. 3) / my note');
  await page.keyboard.press('Escape');

  // Pick the Dated coif: it can't take the dye, and the row says so
  await headRow(page).locator('[data-role="twin-chip"]').click();
  await page.locator('[data-role="twin-option"][data-item-id="372"]').click();
  await expect(headRow(page).locator('[data-role="item-name"]')).toHaveText('Dated Hempen Coif');
  await expect(headRow(page).locator('[data-role="piece-tag"]')).toHaveText('NO FIX');
});

test('narrow desktop: ten chips and a hovered label stay inside the rail', async ({ page }) => {
  // 769 px is the narrowest desktop width, where the rail is tightest
  await page.setViewportSize({ width: 769, height: 800 });
  await gotoTool(page, 'glamour');

  const rail = page.locator('v4-app-header .tool-rail');
  const lastChip = page.locator('v4-app-header .rail-chip[data-tool="glamour"]');
  for (const tool of ['harmony', 'glamour']) {
    await page.locator(`v4-app-header .rail-chip[data-tool="${tool}"]`).hover();
    // The label unrolls over 190 ms (max-width); measure once it has
    await page.waitForTimeout(400);
    // The rail clips (overflow: hidden), so a chip it cut off still sits inside
    // the header — measure the rail's own content instead
    const overflow = await rail.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, `hovering ${tool}`).toBeLessThanOrEqual(0);
    const railBox = await rail.boundingBox();
    const chip = await lastChip.boundingBox();
    expect(chip!.x + chip!.width, `hovering ${tool}`).toBeLessThanOrEqual(
      railBox!.x + railBox!.width + 0.5
    );
  }
});
