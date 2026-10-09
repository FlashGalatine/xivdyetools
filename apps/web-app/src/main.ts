/**
 * XIV Dye Tools v4.0.0 - Main Application Entry Point
 *
 * Initializes services and loads the v4 glassmorphism layout.
 *
 * @entrypoint No importer by design — src/index.html loads this module with a script tag
 * @module main
 */

// Import global styles
import '@/styles/themes.css';
import '@/styles/v4-layout.css'; // V4 layout and tool-specific styles
import '@/styles/tailwind.css';

// Import services
import {
  initializeServices,
  getServicesStatus,
  LanguageService,
  StorageService,
} from '@services/index';
import { ErrorHandler } from '@shared/error-handler';
import { renderFatalError } from '@shared/fatal-error';
import { APP_VERSION } from '@shared/constants';
import { logger } from '@shared/logger';

// Import components
import { offlineBanner } from '@components/offline-banner';

// TutorialService: dev-mode console access, and told when its overlay is missing
import { TutorialService } from '@services/index';

import { ShareService } from '@services/share-service';
import { TelemetryService } from '@services/telemetry-service';

/**
 * The fatal-error overlay runs when service initialization threw, so
 * LanguageService may never have loaded a locale — `t()` would echo raw keys
 * at the one moment the user needs a sentence. These six lines are therefore
 * inlined and picked off `navigator.language`, English when nothing matches.
 * They are the ONLY strings in the app allowed to live outside `src/locales`.
 */
const FATAL_STRINGS: Record<string, { title: string; body: string; button: string }> = {
  en: {
    title: 'Application Error',
    body: 'Failed to initialize XIV Dye Tools',
    button: 'Reload Page',
  },
  de: {
    title: 'Anwendungsfehler',
    body: 'XIV Dye Tools konnte nicht initialisiert werden',
    button: 'Seite neu laden',
  },
  fr: {
    title: "Erreur de l'application",
    body: "Échec de l'initialisation de XIV Dye Tools",
    button: 'Recharger la page',
  },
  ja: {
    title: 'アプリケーションエラー',
    body: 'XIV Dye Tools の初期化に失敗しました',
    button: 'ページを再読み込み',
  },
  ko: {
    title: '애플리케이션 오류',
    body: 'XIV Dye Tools 초기화에 실패했습니다',
    button: '페이지 새로고침',
  },
  zh: {
    title: '应用程序错误',
    body: 'XIV Dye Tools 初始化失败',
    button: '重新加载页面',
  },
};

/** Fatal-overlay copy for the browser's language, falling back to English. */
function fatalStrings(): { title: string; body: string; button: string } {
  const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return FATAL_STRINGS[lang] ?? FATAL_STRINGS.en;
}

/**
 * Initialize the application
 */
async function initializeApp(): Promise<void> {
  try {
    // Log startup info
    logger.info(`🚀 XIV Dye Tools v${APP_VERSION}`);
    logger.info('🏗️ Build System: Vite + TypeScript');

    // Get or create app container
    const appContainer = document.getElementById('app');
    if (!appContainer) {
      throw new Error('App container (#app) not found in HTML');
    }

    // Initialize all services
    logger.info('🔧 Initializing services...');
    await initializeServices();

    // Initialize language service (must be done before rendering components)
    logger.info('🌐 Initializing language service...');
    await LanguageService.initialize();

    // Opt-in usage telemetry (default off; honours Global Privacy Control)
    TelemetryService.initialize();

    // Cleanup: pre-5.x ShareService localStorage buffer, retired by this change.
    StorageService.removeItem('xiv_share_analytics');

    // Initialize v4 glassmorphism layout directly on app container
    // (Removed v3 AppLayout wrapper to eliminate double-header issue)
    logger.info('🎨 Initializing v4 layout shell...');
    const { initializeV4Layout } = await import('@components/v4-layout');
    await initializeV4Layout(appContainer);

    // Initialize tutorial spotlight component (listens for tutorial events).
    // BUG-114: not critical, so not inside the fatal path. It is its own lazy
    // chunk, and a failed fetch of it (a transient network error, a deploy
    // flipping mid-load) reached the catch below, whose fatal overlay replaced
    // the shell that had just mounted with every tool working.
    logger.info('📚 Initializing tutorial spotlight...');
    try {
      const { initializeTutorialSpotlight } = await import('@components/tutorial-spotlight');
      initializeTutorialSpotlight();
    } catch (error) {
      logger.warn('⚠️ Tutorial spotlight unavailable, continuing without it:', error);
      // The spotlight is the whole tour (its steps, buttons and Escape), so
      // "Take tour" and the first-visit prompt stand down for this session
      // instead of starting a tour that shows nothing and never ends.
      TutorialService.markUnavailable();
    }

    logger.info('✅ Application initialized successfully');

    // Show welcome modal for first-time visitors, or changelog for returning users
    // Lazy-load modals to reduce initial bundle size (they're only shown once typically)
    void (async () => {
      const { showWelcomeIfFirstVisit } = await import('@components/welcome-modal');
      const { showChangelogIfUpdated } = await import('@components/changelog-modal');
      showWelcomeIfFirstVisit();
      showChangelogIfUpdated();
    })();

    // Initialize offline banner for network status detection
    offlineBanner.initialize();
    logger.info('📡 Offline banner initialized');

    // Expose services on window for dev mode debugging
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).TutorialService = TutorialService;
      (window as unknown as Record<string, unknown>).ShareService = ShareService;
      logger.info('[DEV] TutorialService exposed on window for debugging');
      logger.info('[DEV] ShareService exposed on window for debugging');

      // Log service status. OPT-001 (2026-10-04 deep-dive): this was awaited
      // before the shell mounted on every load, though its API leg is a real
      // network probe (up to 5 s when the proxy stalls) and the log it feeds
      // only prints in dev, so it is dev-only now and never awaited.
      void getServicesStatus()
        .then((status) => {
          logger.info({
            'Theme Service': status.theme.current,
            'Storage Service': status.storage.available ? 'Available' : 'Unavailable',
            'API Service': status.api.available
              ? `Available (${status.api.latency}ms)`
              : 'Unavailable',
          });
        })
        .catch((error: unknown) => {
          logger.warn('[DEV] Service status probe failed', error);
        });
    }
  } catch (error) {
    const appError = ErrorHandler.log(error);
    logger.error('❌ Failed to initialize application:', appError);

    // Show error to user. DOM-built with a real click listener: an inline
    // onclick is blocked by the production CSP (WEB-9).
    const container = document.getElementById('app');
    if (container) {
      // WEB-9 DOM builder (no inline onclick) carrying the i18n-branch copy:
      // fatalStrings() reads navigator.language, not LanguageService, so it
      // is safe even when the language service is what failed.
      renderFatalError(
        container,
        ErrorHandler.createUserMessage(appError),
        () => window.location.reload(),
        fatalStrings()
      );
    }

    throw error;
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initializeApp();
  });
} else {
  void initializeApp();
}
