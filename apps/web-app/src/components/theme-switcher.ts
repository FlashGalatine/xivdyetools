/**
 * XIV Dye Tools v2.0.0 - Theme Switcher Component
 *
 * Phase 12: Architecture Refactor
 * UI component for theme selection and management
 *
 * @module components/theme-switcher
 */

import { BaseComponent } from './base-component';
import { ThemeService, LanguageService } from '@services/index';
import { ColorService } from '@services/index';
import type { ThemeName } from '@shared/types';
import { clearContainer } from '@shared/utils';
import { ICON_THEME } from '@shared/ui-icons';

/**
 * Theme switcher component - allows users to select from 10 available themes
 * Manages theme persistence via ThemeService
 */
export class ThemeSwitcher extends BaseComponent {
  private currentTheme: ThemeName = 'standard-light';
  private isDropdownOpen: boolean = false;
  private closeOtherDropdownsHandler: EventListener | null = null;
  private themeUnsubscribe: (() => void) | null = null;
  private languageUnsubscribe: (() => void) | null = null;

  /**
   * Render the theme switcher component
   */
  renderContent(): void {
    // Get current theme to determine border opacity
    const currentTheme = ThemeService.getCurrentTheme();
    const themeObject = ThemeService.getTheme(currentTheme);
    const isLightText = ColorService.getOptimalTextColor(themeObject.palette.primary) === '#FFFFFF';

    const translatedLabel = LanguageService.t('header.themeSelector');
    const ariaLabel =
      translatedLabel && translatedLabel !== 'header.themeSelector'
        ? translatedLabel
        : 'Toggle theme switcher';

    // Create button to toggle dropdown
    const button = this.createElement('button', {
      id: 'theme-switcher-btn',
      className:
        'p-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
      attributes: {
        'aria-label': ariaLabel,
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
        'aria-controls': 'theme-dropdown',
        style: `color: var(--theme-text-header); border-color: ${isLightText ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};`,
      },
    });

    // Add theme icon (inline SVG for theme color inheritance)
    button.innerHTML = `<span class="inline-block w-5 h-5" aria-hidden="true">${ICON_THEME}</span> ${LanguageService.t('header.theme')}`;

    // Add hover effect using theme colors
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = isLightText
        ? 'rgba(255, 255, 255, 0.15)'
        : 'rgba(0, 0, 0, 0.15)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = 'transparent';
    });

    // Create dropdown menu container - use theme CSS variables for background
    const dropdown = this.createElement('div', {
      id: 'theme-dropdown',
      className: 'hidden absolute right-0 mt-2 border rounded-lg shadow-lg z-50 min-w-48',
      attributes: {
        role: 'listbox',
        'aria-label': LanguageService.t('header.themeOptions'),
        style: 'background-color: var(--theme-card-background); border-color: var(--theme-border);',
      },
    });

    // Get all available themes and sort by display name
    // Priority: Standard themes first, then grouped by theme family (light before dark)
    const themes = ThemeService.getAllThemes().sort((a, b) => {
      // Standard themes always come first
      if (a.name === 'standard-light') return -1;
      if (b.name === 'standard-light') return 1;
      if (a.name === 'standard-dark') return -1;
      if (b.name === 'standard-dark') return 1;

      // Extract theme family (e.g., "hydaelyn" from "hydaelyn-light")
      const familyA = a.name.replace(/-light$|-dark$/, '');
      const familyB = b.name.replace(/-light$|-dark$/, '');

      // Sort by family name first
      if (familyA !== familyB) {
        return familyA.localeCompare(familyB);
      }

      // Within same family, light comes before dark
      const isLightA = a.name.endsWith('-light');
      const isLightB = b.name.endsWith('-light');
      if (isLightA && !isLightB) return -1;
      if (!isLightA && isLightB) return 1;
      return 0;
    });
    const themeList = this.createElement('div', {
      className: 'flex flex-col p-2',
    });

    for (const theme of themes) {
      const isCurrentTheme = theme.name === this.currentTheme;
      const themeBtn = this.createElement('button', {
        className: 'px-4 py-2 text-left text-sm rounded transition-colors flex items-center gap-2',
        attributes: {
          'data-theme': theme.name,
          role: 'option',
          'aria-selected': String(isCurrentTheme),
          style: 'color: var(--theme-text);',
        },
      });

      // Add hover effect using theme colors
      themeBtn.addEventListener('mouseenter', () => {
        themeBtn.style.backgroundColor = 'var(--theme-card-hover)';
      });
      themeBtn.addEventListener('mouseleave', () => {
        if (theme.name !== this.currentTheme) {
          themeBtn.style.backgroundColor = 'transparent';
        }
      });

      // Add color swatch (decorative, hidden from screen readers)
      const swatch = this.createElement('div', {
        className: 'w-4 h-4 rounded border border-gray-300',
        attributes: {
          style: `background-color: ${theme.palette.primary}`,
          'aria-hidden': 'true',
        },
      });

      themeBtn.appendChild(swatch);

      // Convert theme name (kebab-case) to locale key (camelCase)
      // e.g., "standard-light" -> "standardLight", "og-classic-dark" -> "ogClassicDark"
      const localeKey = theme.name.replace(/-([a-z])/g, (_, letter: string) =>
        letter.toUpperCase()
      );
      const displayName = LanguageService.t(`themes.${localeKey}`);
      themeBtn.appendChild(this.createElement('span', { textContent: displayName }));

      // Mark current theme
      if (isCurrentTheme) {
        themeBtn.classList.add('font-semibold');
        themeBtn.style.backgroundColor = 'var(--theme-card-hover)';
      }

      themeList.appendChild(themeBtn);
    }

    dropdown.appendChild(themeList);

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
   * Bind event listeners for theme selection and dropdown toggle
   */
  bindEvents(): void {
    const button = this.querySelector<HTMLButtonElement>('#theme-switcher-btn');
    const dropdown = this.querySelector<HTMLDivElement>('#theme-dropdown');

    if (!button || !dropdown) return;

    // Toggle dropdown visibility
    this.on(button, 'click', (event) => {
      event.stopPropagation(); // Prevent immediate closing from document listener
      this.toggleDropdown(button, dropdown);
    });

    // Handle theme selection
    const themeButtons = this.querySelectorAll<HTMLButtonElement>('[data-theme]');
    for (const themeBtn of themeButtons) {
      this.on(themeBtn, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation(); // Prevent bubbling to document listener
        const themeId = themeBtn.getAttribute('data-theme') as ThemeName;

        if (themeId) {
          // Update current theme
          this.currentTheme = themeId;

          // Apply theme via service
          ThemeService.setTheme(themeId);

          // Close dropdown
          this.closeDropdown(button, dropdown);

          // Note: update() is automatically called by the theme subscription in onMount()
          // No need to call it here, as it would cause duplicate renders

          // Emit change event for other components
          this.emit('theme-changed', { theme: themeId });
        }
      });
    }

    // Listen for close requests from other dropdowns
    this.closeOtherDropdownsHandler = ((e: CustomEvent<{ source: string }>) => {
      if (e.detail.source !== 'theme' && this.isDropdownOpen) {
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
        button.focus(); // Return focus to button for accessibility
      }
    });
  }

  /**
   * Toggle dropdown open/closed state
   */
  private toggleDropdown(button: HTMLButtonElement, dropdown: HTMLDivElement): void {
    if (!this.isDropdownOpen) {
      // Close other dropdowns (Tools dropdown)
      document.dispatchEvent(
        new CustomEvent('close-other-dropdowns', { detail: { source: 'theme' } })
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
   * Initialize with current theme from service
   */
  onMount(): void {
    this.currentTheme = ThemeService.getCurrentTheme();

    // Subscribe to theme changes (store unsubscribe for cleanup)
    this.themeUnsubscribe = ThemeService.subscribe((theme) => {
      this.currentTheme = theme;
      this.update();
    });

    // Subscribe to language changes (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
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
    // Clean up service subscriptions
    this.themeUnsubscribe?.();
    this.themeUnsubscribe = null;
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      currentTheme: this.currentTheme,
      isDropdownOpen: this.isDropdownOpen,
    };
  }

  /**
   * Set component state
   */
  protected setState(newState: Record<string, unknown>): void {
    if (typeof newState.currentTheme === 'string') {
      this.currentTheme = newState.currentTheme as ThemeName;
    }
    if (typeof newState.isDropdownOpen === 'boolean') {
      this.isDropdownOpen = newState.isDropdownOpen;
    }
  }
}
