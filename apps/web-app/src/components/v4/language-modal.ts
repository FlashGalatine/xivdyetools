/**
 * XIV Dye Tools v4.0 - Language Modal Component
 *
 * Modal displaying language selection options in a grid layout.
 * Triggered by language button in v4 header.
 *
 * @module components/v4/language-modal
 */

import { ModalService } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { LOCALE_DISPLAY_INFO } from '@shared/constants';
import type { LocaleCode } from '@shared/i18n-types';

// ============================================================================
// Language Modal Class
// ============================================================================

/**
 * Language modal showing available languages in a grid
 */
export class LanguageModal {
  private modalId: string | null = null;
  private currentLocale: LocaleCode = 'en';
  private languageUnsubscribe: (() => void) | null = null;

  /**
   * Show the language modal
   */
  show(): void {
    if (this.modalId) return; // Already showing

    this.currentLocale = LanguageService.getCurrentLocale();
    const content = this.createContent();

    this.modalId = ModalService.show({
      type: 'custom',
      title: LanguageService.t('header.languageSelector'),
      content,
      size: 'sm',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      onClose: () => {
        this.cleanup();
      },
    });

    // Subscribe to language changes to update UI
    this.languageUnsubscribe = LanguageService.subscribe((locale) => {
      this.currentLocale = locale;
      this.updateSelectedLanguage();
    });
  }

  /**
   * Close the language modal
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
    if (this.languageUnsubscribe) {
      this.languageUnsubscribe();
      this.languageUnsubscribe = null;
    }
    this.modalId = null;
  }

  /**
   * Update the selected language in the UI
   */
  private updateSelectedLanguage(): void {
    const container = document.querySelector('.language-modal-content');
    if (!container) return;

    // Update all language buttons
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-locale]');
    buttons.forEach((btn) => {
      const localeCode = btn.getAttribute('data-locale') as LocaleCode;
      const isSelected = localeCode === this.currentLocale;

      btn.setAttribute('aria-selected', String(isSelected));

      // Update check mark visibility
      const checkMark = btn.querySelector('.check-mark') as HTMLElement;
      if (checkMark) {
        checkMark.style.display = isSelected ? 'flex' : 'none';
      }

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
    container.className = 'language-modal-content';

    // Create language grid (2 columns for 6 languages)
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-3';
    grid.setAttribute('role', 'listbox');
    grid.setAttribute('aria-label', LanguageService.t('header.languageOptions'));

    for (const locale of LOCALE_DISPLAY_INFO) {
      const isSelected = locale.code === this.currentLocale;

      const localeBtn = document.createElement('button');
      localeBtn.className =
        'flex items-center gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer relative';
      localeBtn.setAttribute('data-locale', locale.code);
      localeBtn.setAttribute('role', 'option');
      localeBtn.setAttribute('aria-selected', String(isSelected));
      localeBtn.style.backgroundColor = 'var(--theme-card-background)';
      localeBtn.style.borderColor = isSelected ? 'var(--theme-primary)' : 'var(--theme-border)';
      localeBtn.style.boxShadow = isSelected ? '0 0 0 2px var(--theme-primary)' : 'none';

      // Flag emoji
      const flag = document.createElement('span');
      flag.className = 'text-2xl';
      flag.textContent = locale.flag;
      flag.setAttribute('aria-hidden', 'true');
      localeBtn.appendChild(flag);

      // Name container
      const nameContainer = document.createElement('div');
      nameContainer.className = 'flex flex-col items-start';

      // Native language name
      const nativeName = document.createElement('span');
      nativeName.className = 'text-sm font-medium';
      nativeName.style.color = 'var(--theme-text)';
      nativeName.textContent = locale.name;
      nameContainer.appendChild(nativeName);

      // English name (for non-English languages)
      if (locale.code !== 'en') {
        const englishName = document.createElement('span');
        englishName.className = 'text-xs';
        englishName.style.color = 'var(--theme-text-muted)';
        englishName.textContent = locale.englishName;
        nameContainer.appendChild(englishName);
      }

      localeBtn.appendChild(nameContainer);

      // Check mark for selected
      const checkMark = document.createElement('span');
      checkMark.className =
        'check-mark absolute top-1 right-1 w-5 h-5 rounded-full items-center justify-center text-xs';
      checkMark.style.backgroundColor = 'var(--theme-primary)';
      checkMark.style.color = 'var(--theme-text-header)';
      checkMark.style.display = isSelected ? 'flex' : 'none';
      checkMark.textContent = '✓';
      localeBtn.appendChild(checkMark);

      // Hover effect
      localeBtn.addEventListener('mouseenter', () => {
        localeBtn.style.backgroundColor = 'var(--theme-card-hover)';
      });
      localeBtn.addEventListener('mouseleave', () => {
        localeBtn.style.backgroundColor = 'var(--theme-card-background)';
      });

      // Click handler - apply language and close modal
      localeBtn.addEventListener('click', async () => {
        if (locale.code !== this.currentLocale) {
          await LanguageService.setLocale(locale.code);
        }
        this.close();
      });

      grid.appendChild(localeBtn);
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

// Singleton instance to prevent multiple language modals
let languageModalInstance: LanguageModal | null = null;

/**
 * Show the language modal
 * Uses singleton pattern to prevent multiple instances
 */
export function showLanguageModal(): void {
  if (!languageModalInstance) {
    languageModalInstance = new LanguageModal();
  }
  languageModalInstance.show();
}

/**
 * Close the language modal if open
 */
export function closeLanguageModal(): void {
  if (languageModalInstance) {
    languageModalInstance.close();
    languageModalInstance = null;
  }
}
