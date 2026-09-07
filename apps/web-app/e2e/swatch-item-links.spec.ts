import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

const names = {
  en: 'Oval Spectacles',
  ja: 'オーバルグラス',
  de: 'Ovale Brille',
  fr: 'Lunettes ovales',
};
const fixture = JSON.stringify({
  TypeName: 'Anamnesis Character File',
  REyeColor: 42,
  HeadGear: { ModelBase: 361, ModelVariant: 5, DyeId: 1, DyeId2: 0 },
  Glasses: { GlassesId: 5 },
});
const equipment = {
  items: {
    HeadGear: {
      itemId: 18085,
      names: { ...names, en: 'Beech Mask of Casting' },
      iconId: null,
      familySize: 1,
      alternates: [],
      viaMainHand: false,
    },
  },
  glasses: { id: 5, names: { ...names, en: 'White Oval Spectacles' }, iconId: null },
  version: 'test',
};

test.beforeEach(async ({ page }) => {
  await seedStartupStorage(page);
  await page.addInitScript(() => localStorage.setItem('xivdyetools_swatch_glamour_show_all', 'on'));
  await page.route('**/v1/chara/resolve', (route) =>
    route.fulfill({ json: { success: true, data: equipment } })
  );
  await gotoTool(page, 'swatch');
  await page.locator('input[type="file"][accept*=".chara"]').setInputFiles({
    name: 'test.chara',
    mimeType: 'application/json',
    buffer: Buffer.from(fixture),
  });
  await expect(page.locator('[data-slot="HeadGear"] [data-role="item-name"]')).toHaveText(
    'Beech Mask of Casting'
  );
});

test('keyboard navigation does not scroll, and Tab continues from the shadow-root trigger', async ({
  page,
}) => {
  const icon = page.locator('[data-slot="HeadGear"] [data-role="item-icon"]');
  const name = page.locator('[data-slot="HeadGear"] [data-role="item-name"]');
  const menu = page.locator('[data-role="item-links-menu"]');
  const submenu = page.locator('[data-role="item-links-lodestone"]');
  await icon.scrollIntoViewIfNeeded();
  await icon.focus();
  await page.keyboard.press('Space');
  await expect(menu.locator('[data-link="mirapri"]')).toBeFocused();
  const scroll = page.locator('.v4-layout-content-scroll');
  const initialScroll = await scroll.evaluate((node) => node.scrollTop);
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('[data-link="garlandTools"]')).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowRight');
  await expect(submenu.locator('[data-region="na"]')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(submenu.locator('[data-region="fr"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(submenu).toHaveCount(0);
  await expect(menu.locator('[data-link="lodestone"]')).toBeFocused();
  expect(await scroll.evaluate((node) => node.scrollTop)).toBe(initialScroll);
  await page.keyboard.press('Tab');
  await expect(menu).toHaveCount(0);
  await expect(name).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu.locator('[data-link="mirapri"]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(icon).toBeFocused();
});

test('tinted facewear stays focused while loading, then opens the unlock-item wiki page', async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/chara/resolve', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ gear: [], glasses: 1 });
    await pending;
    await route.fulfill({
      json: {
        success: true,
        data: {
          items: {},
          glasses: { id: 1, names, iconId: null },
          version: 'test',
        },
      },
    });
  });
  const trigger = page.locator('[data-slot="Facewear"] [data-role="item-name"]');
  const menu = page.locator('[data-role="item-links-menu"]');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await page.keyboard.press('Enter');
  try {
    await expect(menu).toBeFocused();
    await expect(menu).toHaveAttribute('aria-busy', 'true');
  } finally {
    release();
  }
  await expect(menu.locator('[data-link="mirapri"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('[data-link="gamerEscape"]')).toBeFocused();
  // Fulfill locally: this checks the browser's real popup URL without calling the wiki.
  await page
    .context()
    .route('https://ffxiv.gamerescape.com/**', (route) => route.fulfill({ body: 'wiki' }));
  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const popup = await popupPromise;
  await expect(popup).toHaveURL(
    'https://ffxiv.gamerescape.com/wiki/The_Faces_We_Wear_-_Oval_Spectacles'
  );
  await popup.close();
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
