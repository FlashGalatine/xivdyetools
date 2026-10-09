/**
 * XIV Dye Tools - main.ts boot tests
 *
 * OPT-001 (2026-10-04 deep-dive): boot awaited `getServicesStatus()` before
 * mounting the v4 shell. Its API leg is a real network probe
 * (GET /data-centers, 5000 ms abort) whose only reader is a dev-only log, so
 * every production load waited one round trip — up to five seconds of blank
 * page when the proxy stalled — for a value nobody saw.
 *
 * main.ts runs its boot on import, so each test resets the module registry and
 * imports it afresh. Every module the boot touches is mocked: a gap throws
 * inside `initializeApp()`, whose rethrow lands in a `void` call as an
 * unhandled rejection rather than a readable failure.
 *
 * @module __tests__/main.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  initializeServices: vi.fn(async () => {}),
  getServicesStatus: vi.fn(),
  initializeV4Layout: vi.fn(async () => {}),
  initializeTutorialSpotlight: vi.fn(),
  offlineBannerInitialize: vi.fn(),
  markTutorialsUnavailable: vi.fn(),
}));

vi.mock('@services/index', () => ({
  initializeServices: mocks.initializeServices,
  getServicesStatus: mocks.getServicesStatus,
  LanguageService: { initialize: vi.fn(async () => {}) },
  StorageService: { removeItem: vi.fn() },
  TutorialService: { markUnavailable: mocks.markTutorialsUnavailable },
}));
vi.mock('@services/share-service', () => ({ ShareService: {} }));
vi.mock('@services/telemetry-service', () => ({ TelemetryService: { initialize: vi.fn() } }));
vi.mock('@components/offline-banner', () => ({
  offlineBanner: { initialize: mocks.offlineBannerInitialize },
}));
vi.mock('@components/v4-layout', () => ({ initializeV4Layout: mocks.initializeV4Layout }));
vi.mock('@components/tutorial-spotlight', () => ({
  initializeTutorialSpotlight: mocks.initializeTutorialSpotlight,
}));
vi.mock('@components/welcome-modal', () => ({ showWelcomeIfFirstVisit: vi.fn() }));
vi.mock('@components/changelog-modal', () => ({ showChangelogIfUpdated: vi.fn() }));

const STATUS = {
  theme: { current: 'standard-dark', available: true },
  storage: { available: true, size: 3 },
  api: { available: true, latency: 42 },
};

/** Import main.ts afresh (it boots on import) and wait for the boot to finish. */
async function boot(): Promise<void> {
  vi.resetModules();
  await import('../main');
  // The offline banner is the boot's last step
  await vi.waitFor(() => expect(mocks.offlineBannerInitialize).toHaveBeenCalled());
}

describe('main.ts boot (OPT-001)', () => {
  let app: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServicesStatus.mockResolvedValue(STATUS);
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  });

  afterEach(() => {
    app.remove();
    vi.unstubAllEnvs();
  });

  it('boots on import in this environment', () => {
    // Otherwise every test below would wait for a DOMContentLoaded that has
    // already fired
    expect(document.readyState).not.toBe('loading');
  });

  it('mounts the shell without waiting for the services-status probe', async () => {
    // A stalled proxy: the probe never answers
    mocks.getServicesStatus.mockReturnValue(new Promise(() => {}));

    await boot();

    expect(mocks.initializeV4Layout).toHaveBeenCalledWith(app);
  });

  it('leaves tours on offer when the tutorial spotlight loads', async () => {
    await boot();

    expect(mocks.initializeTutorialSpotlight).toHaveBeenCalled();
    expect(mocks.markTutorialsUnavailable).not.toHaveBeenCalled();
  });

  it('never sends the probe from a production build', async () => {
    vi.stubEnv('DEV', false);

    await boot();

    expect(mocks.initializeV4Layout).toHaveBeenCalled();
    expect(mocks.getServicesStatus).not.toHaveBeenCalled();
  });

  it('still logs the status in development, once the shell is up', async () => {
    const { logger } = await import('@shared/logger');

    await boot();

    await vi.waitFor(() =>
      expect(logger.info).toHaveBeenCalledWith({
        'Theme Service': 'standard-dark',
        'Storage Service': 'Available',
        'API Service': 'Available (42ms)',
      })
    );
    expect(mocks.getServicesStatus.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.initializeV4Layout.mock.invocationCallOrder[0]
    );
  });

  it('reports a failed probe in development instead of leaving it unhandled', async () => {
    const { logger } = await import('@shared/logger');
    const failure = new Error('probe failed');
    mocks.getServicesStatus.mockRejectedValue(failure);

    await boot();

    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledWith(expect.any(String), failure));
  });
});

/*
 * BUG-114 (2026-10-04 deep-dive): the tutorial spotlight is its own lazy
 * chunk, imported inside the same try as the critical init. A failed fetch of
 * that one chunk (a transient network error, a deploy flipping mid-load)
 * reached the catch, and renderFatalError replaced the shell that had already
 * mounted -- every tool working, and the user looking at "Application Error".
 */
describe('main.ts boot: the tutorial spotlight is not critical (BUG-114)', () => {
  let app: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServicesStatus.mockResolvedValue(STATUS);
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
    // Stand-in for the mounted shell, so a fatal overlay would be visible
    mocks.initializeV4Layout.mockImplementationOnce(async () => {
      app.appendChild(document.createElement('v4-layout-shell'));
    });
  });

  afterEach(() => {
    app.remove();
    vi.unstubAllEnvs();
    // vi.doUnmock would drop the hoisted mock as well; put the good one back
    vi.doMock('@components/tutorial-spotlight', () => ({
      initializeTutorialSpotlight: mocks.initializeTutorialSpotlight,
    }));
  });

  async function expectShellKept(): Promise<void> {
    const { logger } = await import('@shared/logger');
    await boot();

    expect(app.querySelector('v4-layout-shell')).not.toBeNull();
    expect(app.textContent).not.toContain('Application Error');
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('spotlight'),
      expect.anything()
    );
    // Nothing can draw a tour now, so "Take tour" and the first-visit prompt
    // must not start one that shows nothing and leaves isActive stuck true
    expect(mocks.markTutorialsUnavailable).toHaveBeenCalledTimes(1);
  }

  it('keeps the mounted shell when the spotlight chunk fails to load', async () => {
    vi.doMock('@components/tutorial-spotlight', () => {
      throw new TypeError('Failed to fetch dynamically imported module');
    });

    await expectShellKept();
  });

  it('keeps the mounted shell when the spotlight throws on init', async () => {
    mocks.initializeTutorialSpotlight.mockImplementationOnce(() => {
      throw new Error('spotlight init failed');
    });

    await expectShellKept();
    expect(mocks.initializeTutorialSpotlight).toHaveBeenCalled();
  });
});
