/**
 * XIV Dye Tools v2.0.0 - App Layout Component
 *
 * Phase 12: Architecture Refactor
 * Main application layout with header, content area, and footer
 *
 * @module components/app-layout
 */

import { BaseComponent } from './base-component';
import { ThemeSwitcher } from './theme-switcher';
import { LanguageSelector } from './language-selector';
import { ToastContainer } from './toast-container';
import { ModalContainer } from './modal-container';
import {
  ThemeService,
  LanguageService,
  AnnouncerService,
  KeyboardService,
  ColorService,
} from '@services/index';
import { APP_VERSION } from '@shared/constants';
import { clearContainer } from '@shared/utils';
import { ICON_ABOUT } from '@shared/ui-icons';
import { showAboutModal } from './about-modal';
import { LOGO_SPARKLES } from '@shared/app-logo';

/**
 * Main application layout component
 * Manages overall page structure and component hierarchy
 */
export class AppLayout extends BaseComponent {
  private themeSwitcher: ThemeSwitcher | null = null;
  private languageSelector: LanguageSelector | null = null;
  private toastContainer: ToastContainer | null = null;
  private modalContainer: ModalContainer | null = null;
  private contentContainer: HTMLElement | null = null;
  private themeUnsubscribe: (() => void) | null = null;
  private languageUnsubscribe: (() => void) | null = null;
  private titleResizeObserver: ResizeObserver | null = null;

  /**
   * Render the application layout
   */
  renderContent(): void {
    const app = this.createElement('div', {
      // Mobile: min-h-screen allows normal page scrolling
      // Desktop (md+): h-screen + overflow-hidden forces internal scrolling for sticky to work
      className:
        'app-shell flex flex-col min-h-screen md:h-screen md:overflow-hidden transition-colors',
    });

    // Header - sticky positioning for top navigation
    // flex-shrink-0 prevents header from shrinking when content is tall
    const header = this.renderHeader();
    header.classList.add('sticky', 'top-0', 'z-30', 'flex-shrink-0'); // Sticky positioning, stays at top, above content
    app.appendChild(header);

    // Main content area
    // Mobile: flex-1 allows natural growth, no overflow constraints
    // Desktop: flex-1 + min-h-0 + overflow-hidden enables internal scrolling
    const main = this.createElement('main', {
      className: 'flex-1 min-h-0 md:overflow-hidden max-w-7xl mx-auto w-full px-4 py-8',
    });

    this.contentContainer = main;
    app.appendChild(main);

    // Footer - visible, contains copyright and credit information
    // On mobile it appears below content normally
    // On desktop, a copy is placed inside the scrollable right panel by two-panel-shell
    const footer = this.renderFooter();
    footer.classList.add('flex-shrink-0', 'md:hidden'); // Show on mobile only at app level
    footer.id = 'app-footer';
    app.appendChild(footer);

    // Toast container (for notifications)
    const toastContainerEl = this.createElement('div', {
      id: 'toast-root',
    });
    app.appendChild(toastContainerEl);

    // Modal container (for dialogs)
    const modalContainerEl = this.createElement('div', {
      id: 'modal-root',
    });
    app.appendChild(modalContainerEl);

    // Screen reader announcements container (A3 accessibility)
    const announcerContainerEl = this.createElement('div', {
      id: 'announcer-root',
    });
    app.appendChild(announcerContainerEl);

    clearContainer(this.container);
    this.element = app;
    this.container.appendChild(this.element);
  }

  /**
   * Render the header section
   */
  private renderHeader(): HTMLElement {
    const header = this.createElement('header', {
      className: 'app-header shadow-lg',
    });

    const nav = this.createElement('nav', {
      className: 'max-w-7xl mx-auto px-4 py-4 flex justify-between items-center gap-2',
    });

    // Logo/Title container - min-w-0 enables text truncation, flex-shrink allows shrinking
    const titleDiv = this.createElement('div', {
      className: 'flex items-center gap-2 min-w-0 flex-shrink',
    });

    // Logo using inline SVG - smaller on mobile, fixed size (never shrinks)
    const logoContainer = this.createElement('div', {
      className: 'w-8 h-8 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center',
      attributes: {
        'aria-label': 'XIV Dye Tools Logo',
        title: 'XIV Dye Tools',
      },
    });
    logoContainer.innerHTML = LOGO_SPARKLES;

    // Ensure SVG fills container and is centered
    const svg = logoContainer.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
    }

    titleDiv.appendChild(logoContainer);

    // Title text - auto-sizing with whitespace-nowrap to force single line
    const title = this.createElement('h1', {
      textContent: LanguageService.t('app.title'),
      className: 'font-bold whitespace-nowrap overflow-hidden text-ellipsis',
      attributes: {
        style: 'color: var(--theme-text-header); font-size: clamp(0.875rem, 4vw, 1.5rem);',
        'data-auto-size-title': '',
      },
    });

    const versionText = `v${APP_VERSION}`;
    const version = this.createElement('span', {
      textContent: versionText,
      className: 'text-xs md:text-sm number flex-shrink-0',
      attributes: {
        'data-app-version': versionText,
        style: 'color: var(--theme-text-header); opacity: 0.8;',
      },
    });

    titleDiv.appendChild(title);
    titleDiv.appendChild(version);

    // Right side buttons - flex-shrink-0 ensures they never get pushed off screen
    const rightContainer = this.createElement('div', {
      className: 'flex items-center gap-2 md:gap-4 flex-shrink-0',
    });

    const infoButtonContainer = this.createElement('div', {
      id: 'info-button-container',
    });

    const toolsDropdownContainer = this.createElement('div', {
      id: 'tools-dropdown-container',
    });

    const languageSelectorContainer = this.createElement('div', {
      id: 'language-selector-container',
    });

    const themeSwitcherContainer = this.createElement('div', {
      id: 'theme-switcher-container',
    });

    rightContainer.appendChild(infoButtonContainer);
    rightContainer.appendChild(toolsDropdownContainer);
    rightContainer.appendChild(languageSelectorContainer);
    rightContainer.appendChild(themeSwitcherContainer);
    nav.appendChild(titleDiv);
    nav.appendChild(rightContainer);
    header.appendChild(nav);

    return header;
  }

  /**
   * Render the footer section (minimal - only SE disclaimer)
   * Full credits moved to About modal
   */
  private renderFooter(): HTMLElement {
    const footer = this.createElement('footer', {
      className: 'app-footer mt-8',
    });

    const footerContent = this.createElement('div', {
      className: 'max-w-7xl mx-auto px-4 py-4',
    });

    // FFXIV Copyright disclaimer only
    const disclaimer = this.createElement('div', {
      id: 'footer-disclaimer',
      className: 'text-center text-xs text-gray-500 dark:text-gray-500',
      innerHTML: `${LanguageService.t('footer.disclaimer')}<br>${LanguageService.t('footer.notAffiliated')}`,
    });
    footerContent.appendChild(disclaimer);

    footer.appendChild(footerContent);

    return footer;
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Event handlers for child components can be added here
  }

  /**
   * Initialize the layout and all child components
   */
  onMount(): void {
    // Initialize info button (About modal trigger)
    const infoButtonContainer = this.querySelector<HTMLElement>('#info-button-container');
    if (infoButtonContainer) {
      this.createInfoButton(infoButtonContainer);
    }

    // Initialize language selector
    const languageSelectorContainer = this.querySelector<HTMLElement>(
      '#language-selector-container'
    );
    if (languageSelectorContainer) {
      this.languageSelector = new LanguageSelector(languageSelectorContainer);
      this.languageSelector.init();
    }

    // Initialize theme switcher
    const themeSwitcherContainer = this.querySelector<HTMLElement>('#theme-switcher-container');
    if (themeSwitcherContainer) {
      this.themeSwitcher = new ThemeSwitcher(themeSwitcherContainer);
      this.themeSwitcher.init();
    }

    // Initialize toast container (for notifications)
    const toastRoot = this.querySelector<HTMLElement>('#toast-root');
    if (toastRoot) {
      this.toastContainer = new ToastContainer(toastRoot);
      this.toastContainer.init();
    }

    // Initialize modal container (for dialogs)
    const modalRoot = this.querySelector<HTMLElement>('#modal-root');
    if (modalRoot) {
      this.modalContainer = new ModalContainer(modalRoot);
      this.modalContainer.init();
    }

    // Initialize screen reader announcer (A3 accessibility)
    const announcerRoot = this.querySelector<HTMLElement>('#announcer-root');
    if (announcerRoot) {
      AnnouncerService.init(announcerRoot);
    }

    // Initialize keyboard shortcuts (O4 - press "?" to show shortcuts, 1-5 for tools, etc.)
    KeyboardService.initialize();

    // Subscribe to theme changes to update header text colors (store unsubscribe for cleanup)
    this.themeUnsubscribe = ThemeService.subscribe(() => {
      this.updateHeaderColors();
    });

    // Subscribe to language changes to update text (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.updateLocalizedText();
      // Re-fit title when language changes
      this.setupAutoSizeTitle();
    });

    // Setup auto-sizing title for mobile
    this.setupAutoSizeTitle();
  }

  /**
   * Update localized text when language changes (without re-rendering)
   */
  private updateLocalizedText(): void {
    // Update title text
    const title = this.querySelector<HTMLElement>('header h1');
    if (title) {
      title.textContent = LanguageService.t('app.title');
    }

    // Update info button aria-label
    const infoButton = this.querySelector<HTMLButtonElement>('#info-button');
    if (infoButton) {
      const ariaLabel = LanguageService.t('header.about');
      infoButton.setAttribute('aria-label', ariaLabel);
      infoButton.title = ariaLabel;
    }

    // Update footer disclaimer text
    const footerDisclaimer = this.querySelector<HTMLElement>('#footer-disclaimer');
    if (footerDisclaimer) {
      footerDisclaimer.innerHTML = `${LanguageService.t('footer.disclaimer')}<br>${LanguageService.t('footer.notAffiliated')}`;
    }

    // WEB-REF-006: Announce language change for screen reader users
    const currentLocale = LanguageService.getCurrentLocale();
    AnnouncerService.announce(`Language changed to ${currentLocale}`, 'polite');
  }

  /**
   * Update header text colors based on current theme (without re-rendering)
   */
  private updateHeaderColors(): void {
    // Update title text color using --theme-text-header
    const title = this.querySelector<HTMLElement>('header h1');
    if (title) {
      title.style.color = 'var(--theme-text-header)';
    }

    // Update version text color (muted version of header text)
    const version = this.querySelector<HTMLElement>('header span[data-app-version]');
    if (version) {
      // Use opacity to create muted effect
      version.style.color = 'var(--theme-text-header)';
      version.style.opacity = '0.8';
    }

    // Update info button colors
    this.updateInfoButtonColors();
  }

  /**
   * Create the info button that opens the About modal
   */
  private createInfoButton(container: HTMLElement): void {
    const isLightText = this.isCurrentThemeLightText();
    const ariaLabel = LanguageService.t('header.about');

    const button = this.createElement('button', {
      id: 'info-button',
      className:
        'p-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
      attributes: {
        'aria-label': ariaLabel,
        title: ariaLabel,
        style: `color: var(--theme-text-header); border-color: ${isLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};`,
      },
    });

    // Add about icon (exclamation point)
    button.innerHTML = `<span class="inline-block w-5 h-5" aria-hidden="true">${ICON_ABOUT}</span>`;

    // Add hover effect using theme colors
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = isLightText
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
    });

    // Open about modal on click
    button.addEventListener('click', () => {
      showAboutModal();
    });

    container.appendChild(button);
  }

  /**
   * Check if current theme uses light text on header (based on primary color)
   */
  private isCurrentThemeLightText(): boolean {
    const currentTheme = ThemeService.getCurrentTheme();
    const themeObject = ThemeService.getTheme(currentTheme);
    return ColorService.getOptimalTextColor(themeObject.palette.primary) === '#FFFFFF';
  }

  /**
   * Update info button colors based on current theme
   */
  private updateInfoButtonColors(): void {
    const button = this.querySelector<HTMLButtonElement>('#info-button');
    if (!button) return;

    const isLightText = this.isCurrentThemeLightText();
    button.style.color = 'var(--theme-text-header)';
    button.style.borderColor = isLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';

    // Re-bind hover handlers with updated colors
    button.onmouseenter = () => {
      button.style.backgroundColor = isLightText
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)';
    };
    button.onmouseleave = () => {
      button.style.backgroundColor = 'transparent';
    };
  }

  /**
   * Setup auto-sizing for the header title on mobile devices
   * Uses ResizeObserver to dynamically fit text within available space
   */
  private setupAutoSizeTitle(): void {
    const title = this.querySelector<HTMLElement>('[data-auto-size-title]');
    if (!title) return;

    // Clean up existing observer if any
    if (this.titleResizeObserver) {
      this.titleResizeObserver.disconnect();
      this.titleResizeObserver = null;
    }

    // Only apply dynamic sizing on mobile (CSS clamp handles most cases)
    if (window.innerWidth >= 768) {
      title.style.fontSize = '';
      return;
    }

    const fitText = () => {
      const parent = title.parentElement;
      if (!parent) return;

      // Get available width (parent width minus logo, version, and gaps)
      const logoWidth = 40; // 32px logo + 8px gap
      const versionEl = parent.querySelector('[data-app-version]') as HTMLElement;
      const versionWidth = versionEl ? versionEl.offsetWidth + 8 : 0; // + gap
      const availableWidth = parent.clientWidth - logoWidth - versionWidth - 8;

      // Reset font size to measure natural width
      title.style.fontSize = '';

      // Wait for reflow then measure
      requestAnimationFrame(() => {
        const naturalWidth = title.scrollWidth;

        if (naturalWidth > availableWidth && availableWidth > 0) {
          // Calculate scale factor
          const scale = availableWidth / naturalWidth;
          const baseFontSize = parseFloat(getComputedStyle(title).fontSize);
          const newFontSize = Math.max(12, baseFontSize * scale); // Min 12px
          title.style.fontSize = `${newFontSize}px`;
        }
      });
    };

    // Fit on initial load
    fitText();

    // Refit on resize using ResizeObserver
    const parent = title.parentElement;
    if (parent) {
      this.titleResizeObserver = new ResizeObserver(() => {
        if (window.innerWidth < 768) {
          fitText();
        } else {
          title.style.fontSize = '';
        }
      });
      this.titleResizeObserver.observe(parent);
    }
  }

  /**
   * Get the main content container
   */
  getContentContainer(): HTMLElement | null {
    return this.contentContainer;
  }

  /**
   * Set the main content
   */
  setContent(content: HTMLElement | string): void {
    if (!this.contentContainer) return;

    clearContainer(this.contentContainer);

    if (typeof content === 'string') {
      this.contentContainer.textContent = content;
    } else {
      this.contentContainer.appendChild(content);
    }
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      themeSwitcherInitialized: this.themeSwitcher !== null,
    };
  }

  /**
   * Destroy the layout and all child components
   */
  destroy(): void {
    // Clean up service subscriptions
    this.themeUnsubscribe?.();
    this.themeUnsubscribe = null;
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;

    // Clean up ResizeObserver
    if (this.titleResizeObserver) {
      this.titleResizeObserver.disconnect();
      this.titleResizeObserver = null;
    }

    if (this.languageSelector) {
      this.languageSelector.destroy();
    }
    if (this.themeSwitcher) {
      this.themeSwitcher.destroy();
    }
    if (this.toastContainer) {
      this.toastContainer.destroy();
    }
    if (this.modalContainer) {
      this.modalContainer.destroy();
    }
    // Clean up announcer service
    AnnouncerService.destroy();
    super.destroy();
  }
}
