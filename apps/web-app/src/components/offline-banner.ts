/**
 * XIV Dye Tools v2.0.0 - Offline Banner Component
 *
 * Phase 4: Advanced Features (F4)
 * Shows a notification banner when the user is offline
 *
 * @module components/offline-banner
 */

import { LanguageService } from '@services/index';
import { logger } from '@shared/logger';
import { ICON_NETWORK } from '@shared/ui-icons';

/**
 * OfflineBanner - Shows a sticky banner when offline
 */
export class OfflineBanner {
  private static instance: OfflineBanner | null = null;
  private banner: HTMLElement | null = null;
  private isOnline: boolean = navigator.onLine;
  private listeners: (() => void)[] = [];

  private constructor() {
    this.setupListeners();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OfflineBanner {
    if (!OfflineBanner.instance) {
      OfflineBanner.instance = new OfflineBanner();
    }
    return OfflineBanner.instance;
  }

  /**
   * Initialize the offline banner
   */
  initialize(): void {
    this.createBanner();
    this.updateBannerVisibility();
    logger.info(`📡 Offline banner initialized (online: ${this.isOnline})`);
  }

  /**
   * Setup online/offline event listeners
   */
  private setupListeners(): void {
    const handleOnline = () => {
      this.isOnline = true;
      this.updateBannerVisibility();
      logger.info('📡 Connection restored');
    };

    const handleOffline = () => {
      this.isOnline = false;
      this.updateBannerVisibility();
      logger.info('📡 Connection lost - offline mode');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Store cleanup functions
    this.listeners.push(
      () => window.removeEventListener('online', handleOnline),
      () => window.removeEventListener('offline', handleOffline)
    );
  }

  /**
   * Create the banner element
   */
  private createBanner(): void {
    // Remove existing banner if any
    if (this.banner) {
      this.banner.remove();
    }

    this.banner = document.createElement('div');
    this.banner.id = 'offline-banner';
    this.banner.setAttribute('role', 'alert');
    this.banner.setAttribute('aria-live', 'polite');
    this.banner.className = `
      fixed top-0 left-0 right-0 z-50
      bg-amber-500 text-black
      px-4 py-2
      text-center text-sm font-medium
      flex items-center justify-center gap-2
      transform transition-transform duration-300
      -translate-y-full
    `
      .trim()
      .replace(/\s+/g, ' ');

    // Icon
    const icon = document.createElement('span');
    icon.className = 'w-5 h-5 inline-block';
    icon.innerHTML = ICON_NETWORK;
    icon.setAttribute('aria-hidden', 'true');
    this.banner.appendChild(icon);

    // Message
    const message = document.createElement('span');
    message.id = 'offline-banner-message';
    message.textContent = LanguageService.t('offline.banner');
    this.banner.appendChild(message);

    // Dismiss button
    const dismissBtn = document.createElement('button');
    dismissBtn.className =
      'ml-4 px-2 py-1 bg-amber-600 hover:bg-amber-700 rounded text-xs font-bold transition-colors';
    dismissBtn.textContent = '✕';
    dismissBtn.setAttribute('aria-label', LanguageService.t('common.dismiss'));
    dismissBtn.addEventListener('click', () => {
      this.hideBanner();
    });
    this.banner.appendChild(dismissBtn);

    // Add to DOM
    document.body.prepend(this.banner);
  }

  /**
   * Update banner visibility based on online status
   */
  private updateBannerVisibility(): void {
    if (!this.banner) return;

    if (this.isOnline) {
      this.hideBanner();
    } else {
      this.showBanner();
    }
  }

  /**
   * Show the banner
   */
  showBanner(): void {
    if (!this.banner) return;
    this.banner.style.transform = 'translateY(0)';

    // Add padding to body to prevent content overlap
    document.body.style.paddingTop = `${this.banner.offsetHeight}px`;
  }

  /**
   * Hide the banner
   */
  hideBanner(): void {
    if (!this.banner) return;
    this.banner.style.transform = 'translateY(-100%)';

    // Remove body padding
    document.body.style.paddingTop = '0';
  }

  /**
   * Check if currently online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to online status changes
   */
  onStatusChange(callback: (isOnline: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  /**
   * Update banner message (for language changes)
   */
  updateMessage(): void {
    const message = this.banner?.querySelector('#offline-banner-message');
    if (message) {
      message.textContent = LanguageService.t('offline.banner');
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.listeners.forEach((cleanup) => cleanup());
    this.listeners = [];

    if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }

    document.body.style.paddingTop = '0';
    OfflineBanner.instance = null;
  }
}

// Export singleton instance
export const offlineBanner = OfflineBanner.getInstance();
