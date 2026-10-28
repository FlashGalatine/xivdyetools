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
  initializeLanguage: vi.fn(async () => {}),
}));

vi.mock('@services/index', () => ({
  initializeServices: mocks.initializeServices,
  getServicesStatus: mocks.getServicesStatus,
  LanguageService: { initialize: mocks.initializeLanguage },
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

describe('fatal startup localization (HC-001)', () => {
  const cases = [
    [
      'en-US',
      'Application Error',
      'Failed to initialize XIV Dye Tools',
      'An unexpected error occurred',
      'Reload Page',
    ],
    [
      'de-DE',
      'Anwendungsfehler',
      'XIV Dye Tools konnte nicht initialisiert werden',
      'Ein unerwarteter Fehler ist aufgetreten',
      'Seite neu laden',
    ],
    [
      'fr-FR',
      "Erreur de l'application",
      "Échec de l'initialisation de XIV Dye Tools",
      "Une erreur inattendue s'est produite",
      'Recharger la page',
    ],
    [
      'ja-JP',
      'アプリケーションエラー',
      'XIV Dye Tools の初期化に失敗しました',
      '予期しないエラーが発生しました',
      'ページを再読み込み',
    ],
    [
      'ko-KR',
      '애플리케이션 오류',
      'XIV Dye Tools 초기화에 실패했습니다',
      '예기치 않은 오류가 발생했습니다',
      '페이지 새로고침',
    ],
    ['zh-CN', '应用程序错误', 'XIV Dye Tools 初始化失败', '发生意外错误', '重新加载页面'],
    [
      'xx-XX',
      'Application Error',
      'Failed to initialize XIV Dye Tools',
      'An unexpected error occurred',
      'Reload Page',
    ],
    [
      '',
      'Application Error',
      'Failed to initialize XIV Dye Tools',
      'An unexpected error occurred',
      'Reload Page',
    ],
    [
      undefined,
      'Application Error',
      'Failed to initialize XIV Dye Tools',
      'An unexpected error occurred',
      'Reload Page',
    ],
  ] as const;

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(cases)(
    'renders all four safe sentences for browser locale %s when language initialization fails',
    async (locale, title, body, detail, button) => {
      await boot();
      const startup = await import('../main');
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(locale as string);
      const failure = new Error('<img src=x onerror=alert(1)>private startup detail');
      mocks.initializeLanguage.mockRejectedValueOnce(failure);
      const reload = vi.fn();
      vi.stubGlobal('window', { location: { reload } });

      await expect(startup.initializeApp()).rejects.toBe(failure);

      expect(Array.from(app.querySelectorAll('h1, p, button'), (node) => node.textContent)).toEqual(
        [title, body, detail, button]
      );
      expect(app.textContent).not.toContain(failure.message);
      expect(app.querySelector('img, script, [onerror], [onclick]')).toBeNull();
      const { logger } = await import('@shared/logger');
      expect(logger.error).toHaveBeenCalledWith(
        '❌ Failed to initialize application:',
        expect.objectContaining({ message: failure.message })
      );
      app.querySelector('button')!.click();
      expect(reload).toHaveBeenCalledTimes(1);
    }
  );
});

describe('Korean Hue house terminology (TERM-001)', () => {
  it('uses 색상 while preserving the five surrounding descriptions', async () => {
    const { default: ko } = await import('../locales/ko.json');
    expect([
      ko.config.hueMatchingDesc,
      ko.config.colorSpaceHsvDesc,
      ko.config.colorSpaceLchDesc,
      ko.harmony.types.monochromaticDesc,
      ko.gradient.mode.hsv,
    ]).toEqual([
      '예술적인 색상 조화를 위해 색상 각도 사용',
      '색상환을 따름. 선명한 전환, 색상이 변할 수 있음.',
      '원통형 LAB. 지각적 밝기로 좋은 색상 보존.',
      '단일 색상의 변형으로 섬세하고 응집력 있는 룩',
      '색상 기반 (선명함)',
    ]);
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
