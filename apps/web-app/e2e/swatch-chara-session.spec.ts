/**
 * The loaded `.chara` file belongs to CharaSessionService (memory only), not
 * to the Swatch Matcher's components. It survives leaving the tool and a
 * language switch, and the sidebar's TRIBE & GENDER lock follows it exactly:
 * locked while a file is loaded, editable again once it is gone.
 *
 * Before 5.12.5 the lock was persisted config and the file lived in a
 * component the tool destroyed on the way out, so the file vanished while
 * the lock stayed on, across reloads too.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage, switchToolViaMenu } from './fixtures/navigation';

const FIXTURE = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  Nickname: 'Session Test',
  Race: 'Hyur',
  Tribe: 'Highlander',
  Gender: 'Feminine',
  REyeColor: 42,
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
});

const fileInput = (page: Page) => page.locator('input[type="file"][accept*=".chara"]');
/** The sidebar's tribe select: the one grouped by race. */
const tribeSelect = (page: Page) => page.locator('select.config-select:has(optgroup)').first();
/** The character's own name on the file card; it reads the same in every language. */
const nickname = (page: Page) => page.getByText('Session Test', { exact: true }).first();

async function loadFixture(page: Page): Promise<void> {
  await fileInput(page).setInputFiles({
    name: 'session.chara',
    mimeType: 'application/json',
    buffer: Buffer.from(FIXTURE),
  });
  await expect(nickname(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await seedStartupStorage(page);
  await page.route('**/v1/chara/resolve', (route) =>
    route.fulfill({ json: { success: true, data: { items: {}, glasses: null, version: 'test' } } })
  );
  await gotoTool(page, 'swatch');
});

test('locks tribe and gender while a file is loaded, and unlocks them on SWAP', async ({
  page,
}) => {
  await expect(tribeSelect(page)).toBeEnabled();

  await loadFixture(page);
  await expect(tribeSelect(page)).toBeDisabled();

  await page.getByRole('button', { name: 'SWAP', exact: true }).click();
  await expect(fileInput(page)).toBeAttached();
  await expect(tribeSelect(page)).toBeEnabled();
});

test('keeps the file when you leave the tool and come back', async ({ page }) => {
  await loadFixture(page);

  await switchToolViaMenu(page, 'harmony');
  await switchToolViaMenu(page, 'swatch');

  await expect(nickname(page)).toBeVisible();
  await expect(fileInput(page)).toHaveCount(0);
  await expect(tribeSelect(page)).toBeDisabled();
});

test('keeps the file through a language switch', async ({ page }) => {
  await loadFixture(page);

  await page.keyboard.press('Shift+L');

  await expect(page.locator('html')).not.toHaveAttribute('lang', 'en');
  await expect(nickname(page)).toBeVisible();
  await expect(fileInput(page)).toHaveCount(0);
});

test('a reload clears the file and the lock with it, since the file is never stored', async ({
  page,
}) => {
  await loadFixture(page);

  await page.reload();

  await expect(fileInput(page)).toBeAttached();
  await expect(tribeSelect(page)).toBeEnabled();
});
