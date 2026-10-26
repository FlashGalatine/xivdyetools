/**
 * The loaded `.chara` file belongs to CharaSessionService (memory only), not
 * to the Swatch Matcher's components. It survives leaving the tool and a
 * language switch, and the sidebar's CLAN & GENDER lock follows it exactly:
 * locked while a file is loaded, editable again once it is gone.
 *
 * Before 5.12.7 the lock was persisted config and the file lived in a
 * component the tool destroyed on the way out, so the file vanished while
 * the lock stayed on, across reloads too.
 *
 * Since the xivcharakit switch the file is read in a module worker
 * (`chara-inspection.worker.ts`), so every load here also runs the real worker
 * in the dev server, and a refused file gets one of the fixed toasts.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/coverage';
import {
  gotoTool,
  seedStartupStorage,
  switchToolViaMenu,
  waitForAppReady,
} from './fixtures/navigation';

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
/** The sidebar's two selectors under CLAN & GENDER: the lock covers both. */
const tribeAndGender = (page: Page) =>
  page.locator('.config-group').filter({ hasText: 'CLAN & GENDER' }).locator('select');
/**
 * The palette rail's Hair chip. CLAN & GENDER shows only while the swatch
 * config names a hair or skin sheet, and the tool opens on Eye. Before
 * BUG-001's fix (2026-10-04 deep-dive) the rail never wrote that config, so
 * the group showed on Eye only because the controller's stale default said
 * hairColors.
 */
const hairPalette = (page: Page) => page.getByRole('button', { name: 'Hair', exact: true });

async function expectSelectors(page: Page, state: 'locked' | 'unlocked'): Promise<void> {
  const selects = tribeAndGender(page);
  await expect(selects).toHaveCount(2);
  for (const select of [selects.first(), selects.last()]) {
    if (state === 'locked') await expect(select).toBeDisabled();
    else await expect(select).toBeEnabled();
  }
}
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
  await hairPalette(page).click();
});

test('locks tribe and gender while a file is loaded, and unlocks them on SWAP', async ({
  page,
}) => {
  await expectSelectors(page, 'unlocked');

  await loadFixture(page);
  await expectSelectors(page, 'locked');

  await page.getByRole('button', { name: 'SWAP', exact: true }).click();
  await expect(fileInput(page)).toBeAttached();
  await expectSelectors(page, 'unlocked');
});

test('keeps the file when you leave the tool and come back', async ({ page }) => {
  await loadFixture(page);

  await switchToolViaMenu(page, 'harmony');
  await switchToolViaMenu(page, 'swatch');

  await expect(nickname(page)).toBeVisible();
  await expect(fileInput(page)).toHaveCount(0);
  await expectSelectors(page, 'locked');
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
  // A reload boots the app again. Asserting before it is ready raced the boot
  // and failed whenever that took longer than the assertion's five seconds.
  await waitForAppReady(page);
  await hairPalette(page).click();

  await expect(fileInput(page)).toBeAttached();
  await expectSelectors(page, 'unlocked');
});

test('locks for a file that names no tribe or gender', async ({ page }) => {
  // The lock follows the file, not what the file says about the character
  await fileInput(page).setInputFiles({
    name: 'bare.chara',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ TypeName: 'Anamnesis Character File', REyeColor: 42 })),
  });

  await expect(page.getByRole('button', { name: 'SWAP', exact: true })).toBeVisible();
  await expectSelectors(page, 'locked');
});

/** THIS CHARACTER's card for one appearance slot (the library's slot key). */
const slotCard = (page: Page, slot: string) =>
  page.locator(`.chara-slots-grid [data-slot="${slot}"]`);

test('reads the file in the inspection worker and draws a confirmed eye as a pickable card', async ({
  page,
}) => {
  // The fixture names no Mouth, EnableHighlights or FacePaint, and none of those slots is in
  // it, so the eye is the only colour. It needs no control flag, so it stays a match.
  await loadFixture(page);

  const eye = slotCard(page, 'rightEye');
  await expect(eye).toHaveCount(1);
  await expect(eye).toHaveJSProperty('tagName', 'BUTTON');
  await expect(slotCard(page, 'hair')).not.toHaveJSProperty('tagName', 'BUTTON');
  // Eight cards, whatever the file holds
  await expect(page.locator('.chara-slots-grid [data-slot]')).toHaveCount(8);
});

test('a colour whose switch the file does not state is shown UNCONFIRMED and is not matched', async ({
  page,
}) => {
  // The plan's own tuple: a highlights and a face-paint index with neither EnableHighlights nor
  // FacePaint. The colours are evidence, so they are drawn; activation is unknown, so they are
  // never matched, picked or saved.
  await fileInput(page).setInputFiles({
    name: 'unconfirmed.chara',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        TypeName: 'Anamnesis Character File',
        Nickname: 'Unconfirmed Test',
        Highlights: 0,
        FacePaintColor: 0,
      })
    ),
  });
  await expect(page.getByText('Unconfirmed Test', { exact: true }).first()).toBeVisible();

  for (const slot of ['highlights', 'facePaint']) {
    const card = slotCard(page, slot);
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('UNCONFIRMED');
    // Not a button: no pick, so nothing reaches matching, the share link or SEND TO
    await expect(card).toHaveJSProperty('tagName', 'DIV');
    // No best-dye row: the only text is the label, the address, the tag and the note
    await expect(card).toContainText("The file doesn't say whether this is switched on");
    // The best-dye row's 13px dye chip (chara-sheet renderSlotCard; on a non-lip card nothing
    // else draws one) and the "→ dye" title it sets are both absent.
    await expect(card.locator('span[style*="width: 13px"]')).toHaveCount(0);
    await expect(card).not.toHaveAttribute('title', /→/);
  }
  // Both are counted as slots with a colour (D6)
  await expect(page.getByText('2 / 8', { exact: true })).toBeVisible();
  // The file card says it once per slot too
  await expect(page.getByText('UNCONFIRMED', { exact: true })).toHaveCount(4);
});

test('a file the inspector refuses gets its own toast, and the next file still loads', async ({
  page,
}) => {
  await fileInput(page).setInputFiles({
    name: 'broken.chara',
    mimeType: 'application/json',
    buffer: Buffer.from('{'),
  });
  await expect(
    page.getByText("Couldn't read this character file.", { exact: false })
  ).toBeVisible();
  // Nothing was published: the drop zone is still there and the selectors are free
  await expect(fileInput(page)).toBeAttached();
  await expectSelectors(page, 'unlocked');

  // A refusal leaves nothing behind: the inspection can run again
  await loadFixture(page);
  await expectSelectors(page, 'locked');
});

test('an oversize file is refused by size, before it is read', async ({ page }) => {
  await fileInput(page).setInputFiles({
    name: 'huge.chara',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ Nickname: 'Huge', Pad: 'x'.repeat(9000) })),
  });
  await expect(page.getByText(/over 8 KB/)).toBeVisible();
  await expect(page.getByText('Huge', { exact: true })).toHaveCount(0);
  await expect(fileInput(page)).toBeAttached();
});

test('ignores a lock that a build before 5.12.7 left in storage', async ({ page }) => {
  // Up to 5.12.6 the lock was saved with the swatch config and outlived the
  // file, so the tool opened on the drop zone over two disabled selectors.
  // This replays the original report (PR #204). The seeded hairColors is what
  // shows CLAN & GENDER, so no Hair click after this reload; the migration
  // marker keeps the one-time v3 move from replacing that sheet.
  await page.addInitScript(() => {
    localStorage.setItem(
      'xivdyetools_v4_config_swatch',
      JSON.stringify({ colorSheet: 'hairColors', fileProvided: true })
    );
    localStorage.setItem('xivdyetools_swatch_v3_migrated', 'true');
  });
  await page.reload();
  await waitForAppReady(page);

  await expect(fileInput(page)).toBeAttached();
  await expectSelectors(page, 'unlocked');
});
