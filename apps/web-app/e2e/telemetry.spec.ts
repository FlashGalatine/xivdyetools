/**
 * Telemetry — the Enable Analytics toggle is honoured end-to-end.
 * The api-worker route is intercepted; no worker runs.
 */
import type { Request } from '@playwright/test';
import { test, expect, type Page } from './fixtures/coverage';
import {
  seedStartupStorage,
  dismissBlockingOverlays,
  waitForAppReady,
  switchToolViaMenu,
} from './fixtures/navigation';

const TELEMETRY = /\/v1\/telemetry$/;

async function seedAnalytics(page: Page, enabled: boolean): Promise<void> {
  await page.addInitScript((on: boolean) => {
    localStorage.setItem(
      'xivdyetools_v4_config_advanced',
      JSON.stringify({ analyticsEnabled: on, performanceMode: false }),
    );
  }, enabled);
}

function captureBeacons(page: Page): Request[] {
  const seen: Request[] = [];
  page.on('request', (req) => {
    if (TELEMETRY.test(req.url())) seen.push(req);
  });
  return seen;
}

/**
 * `waitForAppReady` (called directly after `page.goto('/')`, and internally
 * by `switchToolViaMenu`) treats any child in the content scroll as "ready" —
 * including the loading spinner that `loadToolContent` renders while its
 * dynamic `import()` is in flight. That race lets a test race ahead of a
 * tool's actual mount, before `recordToolView()` (which fires
 * `TelemetryService.startTool`/`track`) has run — on the very first load this
 * also leaves the nav rail interactive early, so a click can land before
 * harmony's import resolves, `superseded()` swallows harmony's load
 * entirely, and it never records a `tool_view`/`tool_leave` pair at all.
 * `.v4-tool-container` only appears once the spinner is swapped out for the
 * real tool, immediately before `recordToolView()` — so polling for it pins
 * every wait (initial load and each subsequent switch) to the
 * telemetry-relevant event instead of the spinner.
 */
async function waitForToolMounted(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const shell = document.querySelector('v4-layout-shell');
        const scroll = shell?.shadowRoot?.querySelector('.v4-layout-content-scroll');
        return Boolean(scroll?.querySelector('.v4-tool-container'));
      })
    )
    .toBe(true);
}

test.describe('telemetry', () => {
  test.beforeEach(async ({ page }) => {
    await seedStartupStorage(page);
    await page.route(TELEMETRY, (route) => route.fulfill({ status: 204, body: '' }));
  });

  test('sends nothing while analytics is off (the default)', async ({ page }) => {
    await seedAnalytics(page, false);
    const beacons = captureBeacons(page);
    await page.goto('/');
    await waitForAppReady(page);
    await waitForToolMounted(page);
    await dismissBlockingOverlays(page);
    await switchToolViaMenu(page, 'mixer');
    await switchToolViaMenu(page, 'comparison');
    // Force the pagehide flush path too
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForTimeout(500);
    expect(beacons).toHaveLength(0);
  });

  test('beacons tool_leave + tool_view on navigation when analytics is on', async ({ page }) => {
    await seedAnalytics(page, true);
    const beacons = captureBeacons(page);
    await page.goto('/');
    await waitForAppReady(page);
    await waitForToolMounted(page);
    await dismissBlockingOverlays(page);
    await switchToolViaMenu(page, 'mixer');
    await waitForToolMounted(page);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(() => beacons.length).toBeGreaterThan(0);

    const bodies = beacons.map((r) => JSON.parse(r.postData() ?? '{}'));
    const events = bodies.flatMap((b) => b.events as Array<{ n: string; p: Record<string, unknown> }>);
    expect(events).toContainEqual({ n: 'tool_view', p: { tool: 'harmony', entry: 'initial' } });
    expect(events.some((e) => e.n === 'tool_leave' && e.p.tool === 'harmony')).toBe(true);
    expect(events).toContainEqual({ n: 'tool_view', p: { tool: 'mixer', entry: 'nav' } });

    // Envelope carries only coarse dimensions and nothing that looks like an id
    for (const body of bodies) {
      expect(Object.keys(body).sort()).toEqual(['env', 'events', 'locale', 'theme', 'v', 'ver', 'vp']);
    }
    // sendBeacon → text/plain (no preflight)
    expect(beacons[0].headers()['content-type']).toMatch(/^text\/plain/);
  });
});
