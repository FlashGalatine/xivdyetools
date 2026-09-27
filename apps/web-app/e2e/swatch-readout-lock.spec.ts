/**
 * Swatch Matcher — the TRIBE & GENDER readout lasts exactly as long as the file.
 *
 * A loaded .chara file turns the sidebar's tribe and gender selectors into a
 * readout (disabled). The lock used to outlive the file: leaving the tool and
 * coming back, or reloading, brought the drop zone back with both selectors
 * still disabled, and only loading another file and pressing SWAP undid it.
 * A language switch is not a way out: it used to drop the file, and now the
 * file and the lock both stay.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import {
  gotoTool,
  seedStartupStorage,
  switchToolViaMenu,
  waitForAppReady,
} from './fixtures/navigation';

/** Nothing but an eye colour: parses, and has no gear to resolve over the network. */
const fixture = JSON.stringify({ TypeName: 'Anamnesis Character File', REyeColor: 42 });

/**
 * The sidebar's two selectors under TRIBE & GENDER. Found by the gender
 * option's value, which a language switch does not translate.
 */
const tribeAndGender = (page: Page) =>
  page
    .locator('.config-group')
    .filter({ has: page.locator('option[value="Male"]') })
    .locator('select');

const dropZone = (page: Page) => page.getByText('Drop a .chara file');
/** The drop zone's file input: there only while no file is loaded, in any language. */
const charaInput = (page: Page) => page.locator('input[type="file"][accept*=".chara"]');

/** Switch the app's language from the header's locale button, as a user does. */
async function switchLanguage(page: Page, locale: string): Promise<void> {
  await page
    .locator('button.v4-header-nav-btn')
    .filter({ has: page.locator('.lang-code') })
    .click();
  await page.locator(`button[data-locale="${locale}"]`).click();
  await expect(page.locator('.lang-code')).toHaveText(locale.toUpperCase());
}

async function expectSelectors(page: Page, state: 'locked' | 'unlocked'): Promise<void> {
  const selects = tribeAndGender(page);
  await expect(selects).toHaveCount(2);
  for (const select of [selects.first(), selects.last()]) {
    await expect(select).toBeVisible();
    if (state === 'locked') await expect(select).toBeDisabled();
    else await expect(select).toBeEnabled();
  }
}

test.describe('with a file loaded', () => {
  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
    await gotoTool(page, 'swatch');
    await expectSelectors(page, 'unlocked');
    await charaInput(page).setInputFiles({
      name: 'test.chara',
      mimeType: 'application/json',
      buffer: Buffer.from(fixture),
    });
    await expect(dropZone(page)).toHaveCount(0);
    await expectSelectors(page, 'locked');
  });

  test('leaving the tool and coming back unlocks the selectors', async ({ page }) => {
    await switchToolViaMenu(page, 'harmony');
    await switchToolViaMenu(page, 'swatch');

    await expect(dropZone(page)).toBeVisible();
    await expectSelectors(page, 'unlocked');
  });

  test('a reload unlocks the selectors', async ({ page }) => {
    await page.reload();
    await waitForAppReady(page);

    await expect(dropZone(page)).toBeVisible();
    await expectSelectors(page, 'unlocked');
  });

  test('a language switch keeps the file and the lock', async ({ page }) => {
    await switchLanguage(page, 'ja');

    // The file card is drawn again, in Japanese, and the drop zone stays away
    await expect(page.getByRole('button', { name: 'キャラクターの色を保存' })).toBeVisible();
    await expect(charaInput(page)).toHaveCount(0);
    await expectSelectors(page, 'locked');
  });
});

test('a lock an earlier build left in storage is ignored', async ({ page }) => {
  // What the bug left behind: the lock saved with the rest of the swatch config
  await page.addInitScript(() => {
    localStorage.setItem(
      'xivdyetools_v4_config_swatch',
      JSON.stringify({ colorSheet: 'hairColors', fileProvided: true })
    );
  });
  await seedStartupStorage(page);
  await gotoTool(page, 'swatch');

  await expect(dropZone(page)).toBeVisible();
  await expectSelectors(page, 'unlocked');
});
