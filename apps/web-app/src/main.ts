/**
 * XIV Dye Tools v4.0.0 - Main Application Entry Point
 *
 * Initializes services and loads the v4 glassmorphism layout.
 *
 * @module main
 */

// Import global styles
import '@/styles/themes.css';
import '@/styles/v4-utilities.css'; // V4 glassmorphism and layout utilities
import '@/styles/v4-layout.css'; // V4 layout and tool-specific styles
import '@/styles/tailwind.css';

// Import services
import { initializeServices, getServicesStatus, LanguageService } from '@services/index';
import { ErrorHandler } from '@shared/error-handler';
import { APP_VERSION } from '@shared/constants';
import { logger } from '@shared/logger';

// Import components
import { offlineBanner } from '@components/index';

// Import TutorialService for dev mode console access
import { TutorialService } from '@services/index';

// Import ShareService for analytics initialization
import { ShareService } from '@services/share-service';

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

    // DEV ONLY: Load mockup system if ?mockup=true is in URL (for testing mockups directly)
    if (import.meta.env.DEV && window.location.search.includes('mockup=true')) {
      logger.info('🎨 Loading mockup system (dev mode)...');
      const { loadMockupSystem } = await import('@mockups/index');
      loadMockupSystem(appContainer);
      logger.info('✅ Mockup system loaded. Access at: http://localhost:5173/?mockup=true');
      return;
    }

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
      console.info('[DEV] TutorialService exposed on window for debugging');
      console.info(
        '[DEV] ShareService exposed on window for debugging (try ShareService.getAnalyticsStats())'
      );
    }
  } catch (error) {
    const appError = ErrorHandler.log(error);
    logger.error('❌ Failed to initialize application:', appError);

    // Show error to user
    const container = document.getElementById('app');
    if (container) {
      container.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900">
          <div class="text-center">
            <h1 class="text-2xl font-bold text-red-900 dark:text-red-100 mb-4">
              Application Error
            </h1>
            <p class="text-red-700 dark:text-red-200 mb-4">
              Failed to initialize XIV Dye Tools
            </p>
            <p class="text-sm text-red-600 dark:text-red-300">
              ${ErrorHandler.createUserMessage(appError)}
            </p>
            <button onclick="location.reload()" class="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Reload Page
            </button>
          </div>
        </div>
      `;
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
