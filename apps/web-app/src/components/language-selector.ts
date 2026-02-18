/**
 * XIV Dye Tools v2.1.0 - Language Selector Component
 *
 * UI component for language selection with emoji flags
 * Follows ThemeSwitcher pattern for consistency
 *
 * @module components/language-selector
 */

import { BaseComponent } from './base-component';
import { ThemeService, LanguageService, ColorService } from '@services/index';
import type { LocaleCode } from '@shared/i18n-types';
import { LOCALE_DISPLAY_INFO } from '@shared/constants';
import { clearContainer } from '@shared/utils';
import { ICON_GLOBE } from '@shared/ui-icons';

/**
 * Language selector component - allows users to select from 6 available languages
 * Manages language persistence via LanguageService
 */
export class LanguageSelector extends BaseComponent {
  private currentLocale: LocaleCode = 'en';
  private isDropdownOpen: boolean = false;
  private closeOtherDropdownsHandler: EventListener | null = null;

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private themeUnsubscribe: (() => void) | null = null;

  /**
   * Render the language selector component
   */
  renderContent(): void {
    // Get current theme to determine border opacity
    const currentTheme = ThemeService.getCurrentTheme();
    const themeObject = ThemeService.getTheme(currentTheme);
    const isLightText = ColorService.getOptimalTextColor(themeObject.palette.primary) === '#FFFFFF';

    // Get current locale display info
    const currentLocaleInfo =
      LOCALE_DISPLAY_INFO.find((l) => l.code === this.currentLocale) || LOCALE_DISPLAY_INFO[0];

    // Create button to toggle dropdown
    const button = this.createElement('button', {
      id: 'language-selector-btn',
      className: 'p-2 rounded-lg border transition-colors',
      attributes: {
        'aria-label': 'Change language',
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
        style: `color: var(--theme-text-header); border-color: ${isLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};`,
      },
    });

    // Show globe icon and native language name
    button.innerHTML = `<span class="inline-block w-5 h-5" aria-hidden="true">${ICON_GLOBE}</span><span class="hidden sm:inline ml-1">${currentLocaleInfo.name}</span>`;

    // Add hover effect using theme colors
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = isLightText
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
    });

    // Create dropdown menu container
    const dropdown = this.createElement('div', {
      id: 'language-dropdown',
      className: 'hidden absolute right-0 mt-2 border rounded-lg shadow-lg z-50 min-w-48',
      attributes: {
        style: 'background-color: var(--theme-card-background); border-color: var(--theme-border);',
      },
    });

    // Create language list
    const localeList = this.createElement('div', {
      className: 'flex flex-col p-2',
    });

    for (const locale of LOCALE_DISPLAY_INFO) {
      const localeBtn = this.createElement('button', {
        className: 'px-4 py-2 text-left text-sm rounded transition-colors flex items-center gap-3',
        attributes: {
          'data-locale': locale.code,
          style: 'color: var(--theme-text);',
        },
      });

      // Add hover effect
      localeBtn.addEventListener('mouseenter', () => {
        localeBtn.style.backgroundColor = 'var(--theme-card-hover)';
      });
      localeBtn.addEventListener('mouseleave', () => {
        if (locale.code !== this.currentLocale) {
          localeBtn.style.backgroundColor = 'transparent';
        }
      });

      // Add flag emoji
      const flag = this.createElement('span', {
        textContent: locale.flag,
        className: 'text-lg',
      });
      localeBtn.appendChild(flag);

      // Add native name and English name
      const nameContainer = this.createElement('div', {
        className: 'flex flex-col',
      });

      const nativeName = this.createElement('span', {
        textContent: locale.name,
        className: 'font-medium',
      });

      const englishName = this.createElement('span', {
        textContent: locale.englishName,
        className: 'text-xs opacity-70',
      });

      nameContainer.appendChild(nativeName);
      if (locale.code !== 'en') {
        nameContainer.appendChild(englishName);
      }
      localeBtn.appendChild(nameContainer);

      // Mark current locale
      if (locale.code === this.currentLocale) {
        localeBtn.classList.add('font-semibold');
        localeBtn.style.backgroundColor = 'var(--theme-card-hover)';
      }

      localeList.appendChild(localeBtn);
    }

    dropdown.appendChild(localeList);

    // Create wrapper container
    const container = this.createElement('div', {
      className: 'relative',
    });

    container.appendChild(button);
    container.appendChild(dropdown);

    // Clear existing content and add new
    clearContainer(this.container);
    this.element = container;
    this.container.appendChild(this.element);
  }

  /**
   * Bind event listeners for language selection and dropdown toggle
   */
  bindEvents(): void {
    const button = this.querySelector<HTMLButtonElement>('#language-selector-btn');
    const dropdown = this.querySelector<HTMLDivElement>('#language-dropdown');

    if (!button || !dropdown) return;

    // Toggle dropdown visibility
    this.on(button, 'click', (event) => {
      event.stopPropagation();
      this.toggleDropdown(button, dropdown);
    });

    // Handle language selection
    const localeButtons = this.querySelectorAll<HTMLButtonElement>('[data-locale]');
    for (const localeBtn of localeButtons) {
      this.on(localeBtn, 'click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const localeCode = localeBtn.getAttribute('data-locale') as LocaleCode;

        if (localeCode && localeCode !== this.currentLocale) {
          try {
            // Update current locale
            this.currentLocale = localeCode;

            // Apply locale via service
            await LanguageService.setLocale(localeCode);

            // Close dropdown
            this.closeDropdown(button, dropdown);

            // Emit change event for other components
            this.emit('language-changed', { locale: localeCode });
          } catch (error) {
            console.error('Failed to change language:', error);
            // Revert on error
            this.currentLocale = LanguageService.getCurrentLocale();
          }
        } else {
          // Same language selected, just close dropdown
          this.closeDropdown(button, dropdown);
        }
      });
    }

    // Remove old listener before adding new one (update() calls bindEvents)
    if (this.closeOtherDropdownsHandler) {
      document.removeEventListener('close-other-dropdowns', this.closeOtherDropdownsHandler);
    }

    // Listen for close requests from other dropdowns
    this.closeOtherDropdownsHandler = ((e: CustomEvent<{ source: string }>) => {
      if (e.detail.source !== 'language' && this.isDropdownOpen) {
        this.closeDropdown(button, dropdown);
      }
    }) as EventListener;
    document.addEventListener('close-other-dropdowns', this.closeOtherDropdownsHandler);

    // Close dropdown when clicking outside
    this.on(document, 'click', (event) => {
      const target = event.target as HTMLElement;
      if (!this.element?.contains(target) && this.isDropdownOpen) {
        this.closeDropdown(button, dropdown);
      }
    });

    // Close dropdown on ESC key
    this.on(document, 'keydown', (event) => {
      if (event.key === 'Escape' && this.isDropdownOpen) {
        this.closeDropdown(button, dropdown);
        button.focus();
      }
    });
  }

  /**
   * Toggle dropdown open/closed state
   */
  private toggleDropdown(button: HTMLButtonElement, dropdown: HTMLDivElement): void {
    if (!this.isDropdownOpen) {
      // Close other dropdowns (Tools dropdown, Theme switcher)
      document.dispatchEvent(
        new CustomEvent('close-other-dropdowns', { detail: { source: 'language' } })
      );
    }

    this.isDropdownOpen = !this.isDropdownOpen;
    dropdown.classList.toggle('hidden', !this.isDropdownOpen);
    button.setAttribute('aria-expanded', String(this.isDropdownOpen));
  }

  /**
   * Close the dropdown menu
   */
  private closeDropdown(button: HTMLButtonElement, dropdown: HTMLDivElement): void {
    this.isDropdownOpen = false;
    dropdown.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
  }

  /**
   * Initialize with current locale from service
   */
  onMount(): void {
    this.currentLocale = LanguageService.getCurrentLocale();

    // Subscribe to language changes (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe((locale) => {
      this.currentLocale = locale;
      this.update();
    });

    // Subscribe to theme changes (store unsubscribe for cleanup)
    this.themeUnsubscribe = ThemeService.subscribe(() => {
      this.update();
    });
  }

  /**
   * Cleanup event listeners and subscriptions
   */
  onUnmount(): void {
    if (this.closeOtherDropdownsHandler) {
      document.removeEventListener('close-other-dropdowns', this.closeOtherDropdownsHandler);
      this.closeOtherDropdownsHandler = null;
    }

    // Clean up subscriptions to prevent memory leaks
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
    this.themeUnsubscribe?.();
    this.themeUnsubscribe = null;
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      currentLocale: this.currentLocale,
      isDropdownOpen: this.isDropdownOpen,
    };
  }

  /**
   * Set component state
   */
  protected setState(newState: Record<string, unknown>): void {
    if (typeof newState.currentLocale === 'string') {
      this.currentLocale = newState.currentLocale as LocaleCode;
    }
    if (typeof newState.isDropdownOpen === 'boolean') {
      this.isDropdownOpen = newState.isDropdownOpen;
    }
  }
}
