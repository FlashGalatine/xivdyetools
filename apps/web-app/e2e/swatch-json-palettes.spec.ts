import { test, expect } from './fixtures/coverage';
import { gotoTool, seedStartupStorage } from './fixtures/navigation';

// A cell count alone accepts the stale Eye grid after a rejected JSON import.
// These are the creator's Midlander/Male colors, distinct from Eye's #F7F7F7.
for (const [palette, firstHex] of [
  ['Hair', '#FEFEFE'],
  ['Skin', '#F6D0BB'],
]) {
  test(`loads the ${palette} palette through the dev server without module errors`, async ({
    page,
    baseURL,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    // Keep the dev-server regression local, including the app's startup probes.
    const localOrigin = new URL(baseURL!).origin;
    await page.route('**/*', (route) =>
      new URL(route.request().url()).origin === localOrigin
        ? route.continue()
        : route.fulfill({ json: {} })
    );
    await seedStartupStorage(page);
    await gotoTool(page, 'swatch');

    const cells = page.locator('button[data-index]');
    await expect(cells).toHaveCount(192);
    await expect(cells.first()).toHaveAttribute('aria-label', 'R1·C1: #F7F7F7');

    await page.getByRole('button', { name: palette, exact: true }).click();
    await expect(cells.first()).toHaveAttribute('aria-label', `R1·C1: ${firstHex}`);
    await expect(cells).toHaveCount(192);
    // Check while the page is live; teardown errors cannot hide a rejected import.
    expect(pageErrors).toEqual([]);
  });
}
