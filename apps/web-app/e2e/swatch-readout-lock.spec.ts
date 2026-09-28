/**
 * Swatch Matcher — the TRIBE & GENDER readout lasts exactly as long as the file.
 *
 * A loaded .chara file turns the sidebar's tribe and gender selectors into a
 * readout (disabled). Since 5.12.7 the file lives for the session (until SWAP,
 * a reload or closing the tab) and the lock reads it, so leaving the tool keeps
 * both. Up to 5.12.6 the lock was a persisted config flag that outlived the
 * file: a reload, or a trip to another tool, brought the drop zone back over
 * two disabled selectors.
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

/** The sidebar's two selectors under TRIBE & GENDER. */
const tribeAndGender = (page: Page) =>
  page.locator('.config-group').filter({ hasText: 'TRIBE & GENDER' }).locator('select');

const dropZone = (page: Page) => page.getByText('Drop a .chara file');

/** The file card's SWAP chip — only there while a file is loaded. */
const swapChip = (page: Page) => page.getByRole('button', { name: 'SWAP', exact: true });

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
    await page.locator('input[type="file"][accept*=".chara"]').setInputFiles({
      name: 'test.chara',
      mimeType: 'application/json',
      buffer: Buffer.from(fixture),
    });
    await expect(dropZone(page)).toHaveCount(0);
    await expectSelectors(page, 'locked');
  });

  test('leaving the tool and coming back keeps the file and the lock', async ({ page }) => {
    await switchToolViaMenu(page, 'harmony');
    await switchToolViaMenu(page, 'swatch');

    await expect(swapChip(page)).toBeVisible();
    await expect(dropZone(page)).toHaveCount(0);
    await expectSelectors(page, 'locked');
  });

  test('a reload unlocks the selectors', async ({ page }) => {
    await page.reload();
    await waitForAppReady(page);

    await expect(dropZone(page)).toBeVisible();
    await expectSelectors(page, 'unlocked');
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
