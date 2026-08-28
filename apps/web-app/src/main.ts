/**
 * XIV Dye Tools v4.0.0 - Main Application Entry Point
 *
 * Initializes services and loads the v4 glassmorphism layout.
 *
 * @module main
 */

// Import global styles
import '@/styles/themes.css';
import '@/styles/v4-layout.css'; // V4 layout and tool-specific styles
import '@/styles/tailwind.css';

// Import services
import { initializeServices, getServicesStatus, LanguageService } from '@services/index';
import { ErrorHandler } from '@shared/error-handler';
import { renderFatalError } from '@shared/fatal-error';
import { APP_VERSION } from '@shared/constants';
import { logger } from '@shared/logger';

// Import components
import { offlineBanner } from '@components/offline-banner';

// Import TutorialService for dev mode console access
import { TutorialService } from '@services/index';

// Import ShareService for analytics initialization
import { ShareService } from '@services/share-service';

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

    // Initialize share analytics (client-side tracking)
    logger.info('📊 Initializing share analytics...');
    ShareService.initializeAnalytics();

    // Log service status
    const status = await getServicesStatus();
    logger.info({
      'Theme Service': status.theme.current,
      'Storage Service': status.storage.available ? 'Available' : 'Unavailable',
      'API Service': status.api.available ? `Available (${status.api.latency}ms)` : 'Unavailable',
    });

    // Initialize v4 glassmorphism layout directly on app container
    // (Removed v3 AppLayout wrapper to eliminate double-header issue)
    logger.info('🎨 Initializing v4 layout shell...');
    const { initializeV4Layout } = await import('@components/v4-layout');
    await initializeV4Layout(appContainer);

    // Initialize tutorial spotlight component (listens for tutorial events)
    logger.info('📚 Initializing tutorial spotlight...');
    const { initializeTutorialSpotlight } = await import('@components/tutorial-spotlight');
    initializeTutorialSpotlight();

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
      logger.info(
        '[DEV] ShareService exposed on window for debugging (try ShareService.getAnalyticsStats())'
      );
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
