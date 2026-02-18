/**
 * XIV Dye Tools v4.0 - Theme Modal Component
 *
 * Modal displaying theme selection options in a grid layout.
 * Triggered by theme button in v4 header.
 *
 * @module components/v4/theme-modal
 */

import { ModalService } from '@services/modal-service';
import { ThemeService } from '@services/theme-service';
import { LanguageService } from '@services/language-service';
import { ColorService } from '@services/index';
import type { ThemeName } from '@shared/types';

// ============================================================================
// Theme Modal Class
// ============================================================================

/**
 * Theme modal showing available themes in a grid
 */
export class ThemeModal {
  private modalId: string | null = null;
  private currentTheme: ThemeName = 'standard-light';
  private themeUnsubscribe: (() => void) | null = null;

  /**
   * Show the theme modal
   */
  show(): void {
    if (this.modalId) return; // Already showing

    this.currentTheme = ThemeService.getCurrentTheme();
    const content = this.createContent();

    this.modalId = ModalService.show({
      type: 'custom',
      title: LanguageService.t('header.themeSelector'),
      content,
      size: 'md',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      onClose: () => {
        this.cleanup();
      },
    });

    // Subscribe to theme changes to update UI
    this.themeUnsubscribe = ThemeService.subscribe((theme) => {
      this.currentTheme = theme;
      this.updateSelectedTheme();
    });
  }

  /**
   * Close the theme modal
   */
  close(): void {
    if (this.modalId) {
      ModalService.dismiss(this.modalId);
      this.cleanup();
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
    this.modalId = null;
  }

  /**
   * Update the selected theme in the UI
   */
  private updateSelectedTheme(): void {
    const container = document.querySelector('.theme-modal-content');
    if (!container) return;

    // Update all theme buttons
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-theme]');
    buttons.forEach((btn) => {
      const themeName = btn.getAttribute('data-theme') as ThemeName;
      const isSelected = themeName === this.currentTheme;

      btn.setAttribute('aria-selected', String(isSelected));

      if (isSelected) {
        btn.style.borderColor = 'var(--theme-primary)';
        btn.style.boxShadow = '0 0 0 2px var(--theme-primary)';
      } else {
        btn.style.borderColor = 'var(--theme-border)';
        btn.style.boxShadow = 'none';
      }
    });
  }

  /**
   * Create modal content
   */
  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'theme-modal-content';

    // Get all available themes and sort by display name
    const themes = ThemeService.getAllThemes().sort((a, b) => {
      // Standard themes always come first
      if (a.name === 'standard-light') return -1;
      if (b.name === 'standard-light') return 1;
      if (a.name === 'standard-dark') return -1;
      if (b.name === 'standard-dark') return 1;

      // Extract theme family
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

    // Create theme grid
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-3';
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', LanguageService.t('header.themeOptions'));

    for (const theme of themes) {
      const isSelected = theme.name === this.currentTheme;
      const localeKey = theme.name.replace(/-([a-z])/g, (_, letter: string) =>
        letter.toUpperCase()
      );
      const displayName = LanguageService.t(`themes.${localeKey}`);

      // Calculate optimal text color for the theme's primary
      const textColor = ColorService.getOptimalTextColor(theme.palette.primary);

      const themeBtn = document.createElement('button');
      themeBtn.className =
        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer';
      themeBtn.setAttribute('data-theme', theme.name);
      themeBtn.setAttribute('role', 'option');
      themeBtn.setAttribute('aria-selected', String(isSelected));
      themeBtn.style.backgroundColor = 'var(--theme-card-background)';
      themeBtn.style.borderColor = isSelected ? 'var(--theme-primary)' : 'var(--theme-border)';
      themeBtn.style.boxShadow = isSelected ? '0 0 0 2px var(--theme-primary)' : 'none';

      // Color preview swatch (shows primary and background)
      const swatchContainer = document.createElement('div');
      swatchContainer.className = 'flex gap-1 rounded overflow-hidden';
      swatchContainer.setAttribute('aria-hidden', 'true');

      // Primary color swatch
      const primarySwatch = document.createElement('div');
      primarySwatch.className = 'w-8 h-8 rounded-l';
      primarySwatch.style.backgroundColor = theme.palette.primary;
      swatchContainer.appendChild(primarySwatch);

      // Background color swatch
      const bgSwatch = document.createElement('div');
      bgSwatch.className = 'w-8 h-8 rounded-r';
      bgSwatch.style.backgroundColor = theme.palette.background;
      bgSwatch.style.border = '1px solid var(--theme-border)';
      swatchContainer.appendChild(bgSwatch);

      themeBtn.appendChild(swatchContainer);

      // Theme name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'text-sm font-medium';
      nameSpan.style.color = 'var(--theme-text)';
      nameSpan.textContent = displayName;
      themeBtn.appendChild(nameSpan);

      // Check mark for selected
      if (isSelected) {
        const checkMark = document.createElement('span');
        checkMark.className =
          'absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs';
        checkMark.style.backgroundColor = 'var(--theme-primary)';
        checkMark.style.color = textColor;
        checkMark.textContent = '✓';
        themeBtn.style.position = 'relative';
        themeBtn.appendChild(checkMark);
      }

      // Hover effect
      themeBtn.addEventListener('mouseenter', () => {
        themeBtn.style.backgroundColor = 'var(--theme-card-hover)';
      });
      themeBtn.addEventListener('mouseleave', () => {
        themeBtn.style.backgroundColor = 'var(--theme-card-background)';
      });

      // Click handler - just apply theme, don't close modal
      // User can preview different themes; close via button or backdrop
      themeBtn.addEventListener('click', () => {
        ThemeService.setTheme(theme.name);
      });

      grid.appendChild(themeBtn);
    }

    container.appendChild(grid);

    // Cancel button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-center mt-6';

    const closeBtn = document.createElement('button');
    closeBtn.className =
      'px-6 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
    closeBtn.style.backgroundColor = 'var(--theme-primary)';
    closeBtn.style.color = 'var(--theme-text-header)';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.filter = 'brightness(1.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.filter = '';
    });
    closeBtn.textContent = LanguageService.t('common.close');
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    buttonContainer.appendChild(closeBtn);
    container.appendChild(buttonContainer);

    return container;
  }
}

// Singleton instance to prevent multiple theme modals
let themeModalInstance: ThemeModal | null = null;

/**
 * Show the theme modal
 * Uses singleton pattern to prevent multiple instances
 */
export function showThemeModal(): void {
  if (!themeModalInstance) {
    themeModalInstance = new ThemeModal();
  }
  themeModalInstance.show();
}

/**
 * Close the theme modal if open
 */
export function closeThemeModal(): void {
  if (themeModalInstance) {
    themeModalInstance.close();
    themeModalInstance = null;
  }
}
