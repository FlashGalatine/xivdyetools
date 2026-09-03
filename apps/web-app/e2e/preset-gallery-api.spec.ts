/**
 * Community preset gallery, against a stubbed presets-api.
 *
 * Four of the modules `vitest.config.ts` drops from the unit-coverage
 * denominator are on this one path — `community-preset-service`,
 * `hybrid-preset-service`, `v4/preset-tool` and `v4/preset-detail` — and
 * TESTING.md's stated reason for excluding them is that they "make real HTTP
 * requests". The existing `preset-browser.spec.ts` runs with no network at
 * all, so the tool renders its offline state and none of that code executes:
 * across a full `chromium-coverage` pass, `preset-detail` reached 2 of its 22
 * functions.
 *
 * `page.route()` gives the honest middle ground — the real service code, the
 * real fetch stack, the real cache and render path, with a deterministic
 * payload. That is coverage the unit suite cannot buy and the offline E2E run
 * was never going to reach.
 */
import { test, expect } from './fixtures/coverage';
import type { Page } from './fixtures/coverage';
import { waitForAppReady, seedStartupStorage, gotoTool } from './fixtures/navigation';
import type { CommunityPreset, PresetListResponse } from '@xivdyetools/types';

// --- fixture payloads -------------------------------------------------------

/*
 * Typed as the real `CommunityPreset` rather than a hand-rolled shape. The
 * first version of this file declared its own interface, which let the fixture
 * drift from the contract in three ways at once — `category_id: 'seasonal'`
 * (not a PresetCategory; the real member is 'seasons') and a list envelope
 * missing the required `has_more`. A stub production cannot produce is worth
 * less than no stub, because it proves the app tolerates something it will
 * never receive.
 */
type StubPreset = CommunityPreset;

function preset(over: Partial<StubPreset> & { id: string; name: string }): StubPreset {
  return {
    description: 'A stubbed community preset.',
    category_id: 'aesthetics',
    secondary_categories: [],
    dyes: [2, 3, 4],
    tags: ['test'],
    author_discord_id: '1',
    author_name: 'Test Author',
    vote_count: 0,
    status: 'approved',
    is_curated: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    preview_image_status: 'none',
    ...over,
  };
}

const PRESETS: StubPreset[] = [
  preset({
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    name: 'Midnight Ceruleum',
    description: 'Deep blues for a stormy glamour.',
    category_id: 'aesthetics',
    dyes: [2, 3, 4],
    author_name: 'Nyx',
    vote_count: 42,
    tags: ['blue', 'dark'],
  }),
  preset({
    id: 'aaaaaaaa-0000-4000-8000-000000000002',
    name: 'Sunbleached Linen',
    description: 'Warm neutrals for a summer fit.',
    category_id: 'seasons',
    dyes: [5, 6, 7, 8],
    author_name: 'Sol',
    vote_count: 17,
    tags: ['warm'],
  }),
  preset({
    id: 'aaaaaaaa-0000-4000-8000-000000000003',
    name: 'Curated Ironworks',
    description: 'An official palette.',
    category_id: 'jobs',
    dyes: [9, 10],
    author_discord_id: null,
    author_name: null,
    is_curated: true,
    vote_count: 99,
  }),
];

/**
 * Stand the presets-api up in front of the browser. Installed before
 * `page.goto` so the tool's very first request is already served.
 */
async function stubPresetsApi(page: Page, presets: StubPreset[] = PRESETS): Promise<void> {
  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' })
  );

  // Single preset by id.
  await page.route('**/api/v1/presets/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    const found = presets.find((p) => p.id === id);
    return route.fulfill({
      status: found ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(found ?? { error: 'not found' }),
    });
  });

  await page.route('**/api/v1/presets?**', (route) => {
    const url = new URL(route.request().url());
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    let list = presets;
    if (category && category !== 'all') list = list.filter((p) => p.category_id === category);
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presets: list,
        total: list.length,
        page: 1,
        limit: 50,
        has_more: false,
      } satisfies PresetListResponse),
    });
  });

  // Registered AFTER `**/api/v1/presets/*` on purpose: Playwright stores
  // handlers newest-first, so the LAST registration wins. The first version of
  // this file had these two the other way round with a comment asserting the
  // opposite, and `/featured` was answered by the by-id route as
  // `404 {"error":"not found"}` — getFeaturedPresets() threw on every run and
  // hybrid-preset-service silently fell back to the curated set, so the
  // featured path was only ever exercised through its error branch.
  await page.route('**/api/v1/presets/featured', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ presets: presets.slice(0, 2) }),
    })
  );

  await page.route('**/api/v1/presets', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        presets,
        total: presets.length,
        page: 1,
        limit: 50,
        has_more: false,
      } satisfies PresetListResponse),
    })
  );
}

async function openGallery(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedStartupStorage(page);
  await page.goto('/');
  await waitForAppReady(page);
  await gotoTool(page, 'presets');
}

const cards = (page: Page) => page.locator('v4-preset-card');

// ---------------------------------------------------------------------------

test.describe('Preset gallery against a live-shaped API', () => {
  test.beforeEach(async ({ page }) => {
    await stubPresetsApi(page);
  });

  test('renders a card for every preset the API returns', async ({ page }) => {
    await openGallery(page);
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    // Not an exact count: `hybrid-preset-service` merges the bundled curated
    // palettes in alongside the API list, so the gallery legitimately holds
    // more cards than the stub returns. What must hold is that each stubbed
    // preset made it through the fetch -> unify -> merge -> render path.
    for (const p of PRESETS.filter((x) => !x.is_curated)) {
      await expect(cards(page).filter({ hasText: p.name })).toHaveCount(1, { timeout: 15000 });
    }
  });

  test('keeps a curated preset off the Community tab', async ({ page }) => {
    await openGallery(page);
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    // Community is the default tab and it is community-only by design — the
    // Official tab is where `is_curated` lands.
    await expect(cards(page).filter({ hasText: 'Curated Ironworks' })).toHaveCount(0);
  });

  test('prints the author on a community card', async ({ page }) => {
    await openGallery(page);
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    // `body.innerText` cannot see this: the tool renders inside the layout
    // shell's shadow root. Playwright locators pierce it; a DOM text read does
    // not, and would silently assert against the offline banner alone.
    const card = cards(page).filter({ hasText: 'Midnight Ceruleum' }).first();
    await expect(card).toContainText('Nyx');
  });

  test('reports the dye count the API sent', async ({ page }) => {
    await openGallery(page);
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    // The `.band-seg` colour strip is only drawn for a card that has a preview
    // shot, so the unconditional proof that `dyes[]` survived the
    // fetch -> unify -> merge -> render path is the dye-count line.
    // The count sits in `.byline` as "<author> · N dyes · <age>". Asserted as
    // the whole phrase rather than `toContainText('3')` — a bare digit matches
    // a vote count, a date or a tag anywhere on the card.
    const first = cards(page).filter({ hasText: 'Midnight Ceruleum' }).first();
    await expect(first).toBeVisible({ timeout: 15000 });
    await expect(first.locator('.byline')).toContainText('3 dyes');

    // ...and the four-dye preset says four, so the number is read off the
    // payload rather than being a fixed bit of card furniture.
    const second = cards(page).filter({ hasText: 'Sunbleached Linen' }).first();
    await expect(second.locator('.byline')).toContainText('4 dyes');
  });

  test('falls back to the bundled palettes when the API 500s', async ({ page }) => {
    // The earlier shape of this test asserted `toHaveCount(0)` plus
    // `document.body.innerText.length > 0` — both true at t=0 and the second
    // unconditionally true on any page, so it and the empty-gallery test below
    // could have their stubs swapped and still pass. What actually
    // distinguishes a 500 is that the community presets vanish while the
    // bundled curated ones stay: `hybrid-preset-service` catches the throw and
    // returns the local set.
    await page.route('**/api/v1/presets**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
    );

    await openGallery(page);
    await page
      .getByRole('button', { name: /^Official\b/i })
      .first()
      .click();

    // Bundled curated palettes are local, so the Official tab still fills.
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    // ...and nothing the (failed) API would have supplied is on screen.
    for (const p of PRESETS) {
      await expect(cards(page).filter({ hasText: p.name })).toHaveCount(0);
    }
  });

  test('goes properly offline when the health check fails', async ({ page }) => {
    // `isAPIAvailable()` gates every community fetch on /health. The beforeEach
    // stub answers it 200, so a failing *presets* call alone never reaches the
    // offline path — hybrid-preset-service swallows that throw. Failing health
    // is what actually exercises it.
    await page.route('**/health', (route) => route.fulfill({ status: 503, body: '' }));
    await page.route('**/api/v1/presets**', (route) => route.abort('failed'));

    await openGallery(page);
    await page.waitForTimeout(3000);

    // No community card can be present, and the shell survives.
    for (const p of PRESETS.filter((x) => !x.is_curated)) {
      await expect(cards(page).filter({ hasText: p.name })).toHaveCount(0);
    }
    await expect(page.locator('#main-content')).toBeAttached();
  });

  test('serves an empty gallery without erroring', async ({ page }) => {
    await page.route('**/api/v1/presets**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ presets: [], total: 0, page: 1, limit: 50, has_more: false }),
      })
    );

    await openGallery(page);
    await page.waitForTimeout(2500);

    // A 200 with no presets is not the same as a failure: the tool must render
    // its gallery chrome (the tab row) rather than an error state.
    await expect(page.getByRole('button', { name: /^Community\b/i }).first()).toBeVisible({
      timeout: 15000,
    });
    for (const p of PRESETS) {
      await expect(cards(page).filter({ hasText: p.name })).toHaveCount(0);
    }
  });
});

test.describe('Preset detail', () => {
  test.beforeEach(async ({ page }) => {
    await stubPresetsApi(page);
  });

  test('opens the detail view for the tapped preset', async ({ page }) => {
    await openGallery(page);
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    await cards(page).filter({ hasText: 'Midnight Ceruleum' }).first().click();

    // The detail element mounts, and it is showing the preset that was tapped.
    await expect(page.locator('v4-preset-detail')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('v4-preset-detail')).toContainText('Midnight Ceruleum');
  });

  test('carries the description and author through to the detail', async ({ page }) => {
    await openGallery(page);
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    await cards(page).filter({ hasText: 'Midnight Ceruleum' }).first().click();
    const detail = page.locator('v4-preset-detail');
    await expect(detail).toHaveCount(1, { timeout: 10000 });

    await expect(detail).toContainText(/Deep blues for a stormy glamour/i);
    await expect(detail).toContainText('Nyx');
  });

  test('reaches a curated preset through the Official tab, with no author', async ({ page }) => {
    await openGallery(page);
    await expect(cards(page).first()).toBeVisible({ timeout: 20000 });

    // The tab's accessible name is its label plus its count ("Official 1"),
    // so an anchored /^Official$/ never matches.
    await page
      .getByRole('button', { name: /^Official\b/i })
      .first()
      .click();

    const curated = cards(page).filter({ hasText: 'Curated Ironworks' }).first();
    await expect(curated).toBeVisible({ timeout: 15000 });
    await curated.click();

    const detail = page.locator('v4-preset-detail');
    await expect(detail).toHaveCount(1, { timeout: 10000 });
    await expect(detail).toContainText('Curated Ironworks');
    // `author_name` is null on a curated preset — the card must not render the
    // string "null" where a name would go.
    await expect(detail).not.toContainText('null');
  });
});
