/**
 * The .chara reader's license notice, served as a file.
 *
 * The About modal links /licenses/xivcharakit.txt, which
 * scripts/copy-chara-notices.mjs generates into public/. In production,
 * public/_redirects answers every unknown path with index.html and a 200, so a
 * status check cannot tell a shipped notice from a missing one: this asserts
 * the BODY (the MIT grant and the third-party notice heading, both copied
 * verbatim from the package) and that it is served as plain text, not the SPA.
 * scripts/smoke-test-pages.js makes the same check against the deployed site.
 */
import { test, expect } from './fixtures/coverage';

test.describe('reader license notice', () => {
  test('serves /licenses/xivcharakit.txt as text/plain with the license and notices', async ({
    page,
  }) => {
    const response = await page.goto('/licenses/xivcharakit.txt');
    expect(response).not.toBeNull();
    expect(response!.ok()).toBe(true);
    expect(response!.headers()['content-type']).toMatch(/^text\/plain\b/);

    const body = await response!.text();
    expect(body).not.toMatch(/^\s*<(?:!doctype|html)\b/i);
    expect(body).toContain('xivcharakit');
    expect(body).toContain('MIT License');
    expect(body).toContain('Permission is hereby granted, free of charge');
    expect(body).toContain('# Third-party notices');
  });
});
