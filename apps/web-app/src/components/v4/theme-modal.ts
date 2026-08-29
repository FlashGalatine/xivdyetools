/**
 * XIV Dye Tools 5.0 - Theme Modal Component
 *
 * The confirmed theme picker from Modal Directions: each theme is a swatch
 * card showing background, surface and accent as three bands — more honest
 * than a name. Selected is an accent border plus a tick. The sheet uses a
 * reduced scrim because tapping a row applies the theme immediately and
 * repaints the whole app behind the dialog — dimming it was hiding the
 * feature. The footer says Done, not Cancel: there is no revert and never
 * was.
 *
 * 5.0 fixed decision: Light and Dark only.
 *
 * @module components/v4/theme-modal
 */

import { ModalService } from '@services/modal-service';
import { ThemeService } from '@services/theme-service';
import { LanguageService } from '@services/language-service';
import { TelemetryService } from '@services/telemetry-service';
import type { ThemeName } from '@shared/types';

// ============================================================================
// Theme Modal Class
// ============================================================================

/**
 * Theme modal showing the two themes as swatch cards
 */
class ThemeModal {
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
      eyebrow: LanguageService.t('themes.eyebrow'),
      content,
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      lightScrim: true,
      confirmText: LanguageService.t('common.done'),
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

    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-theme]');
    buttons.forEach((btn) => {
      const themeName = btn.getAttribute('data-theme') as ThemeName;
      const isSelected = themeName === this.currentTheme;

      btn.setAttribute('aria-selected', String(isSelected));
      btn.style.borderColor = isSelected ? 'var(--theme-primary)' : 'var(--theme-border)';
      btn.style.boxShadow = isSelected ? '0 0 0 1px var(--theme-primary)' : 'none';

      const tick = btn.querySelector<HTMLElement>('[data-tick]');
      if (tick) tick.style.visibility = isSelected ? 'visible' : 'hidden';
    });
  }

  /**
   * Create modal content: one swatch card per theme, three bands each.
   */
  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'theme-modal-content';

    // Mono legend for what the bands are
    const legend = document.createElement('div');
    legend.className = 'm16-label mb-2';
    legend.textContent = LanguageService.t('themes.bandsLabel');
    container.appendChild(legend);

    const list = document.createElement('div');
    list.className = 'flex flex-col gap-2';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', LanguageService.t('header.themeOptions'));

    for (const theme of ThemeService.getAllThemes()) {
      const isSelected = theme.name === this.currentTheme;
      const localeKey = theme.name.replace(/-([a-z])/g, (_, letter: string) =>
        letter.toUpperCase()
      );
      const displayName = LanguageService.t(`themes.${localeKey}`);

      const themeBtn = document.createElement('button');
      themeBtn.type = 'button';
      themeBtn.className =
        'flex items-center gap-3 w-full p-3 rounded-xl border transition-all cursor-pointer text-left';
      themeBtn.setAttribute('data-theme', theme.name);
      themeBtn.setAttribute('role', 'option');
      themeBtn.setAttribute('aria-selected', String(isSelected));
      themeBtn.style.backgroundColor = 'var(--theme-card-background)';
      themeBtn.style.borderColor = isSelected ? 'var(--theme-primary)' : 'var(--theme-border)';
      themeBtn.style.boxShadow = isSelected ? '0 0 0 1px var(--theme-primary)' : 'none';

      // Three bands: background · surface · accent
      const bands = document.createElement('div');
      bands.className = 'flex rounded-lg overflow-hidden flex-shrink-0 border';
      bands.style.borderColor = 'var(--theme-border)';
      bands.setAttribute('aria-hidden', 'true');
      const bandColors = [
        theme.palette.background,
        theme.palette.cardBackground,
        theme.palette.primary,
      ];
      bandColors.forEach((color) => {
        const band = document.createElement('div');
        band.style.width = '22px';
        band.style.height = '36px';
        band.style.backgroundColor = color;
        bands.appendChild(band);
      });
      themeBtn.appendChild(bands);

      // Theme name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'text-sm font-medium flex-1';
      nameSpan.style.color = 'var(--theme-text)';
      nameSpan.textContent = displayName;
      themeBtn.appendChild(nameSpan);

      // Tick (always in the DOM so selection updates never re-render)
      const tick = document.createElement('span');
      tick.setAttribute('data-tick', '');
      tick.className = 'text-sm font-bold';
      tick.style.color = 'var(--theme-primary)';
      tick.style.visibility = isSelected ? 'visible' : 'hidden';
      tick.textContent = '✓';
      themeBtn.appendChild(tick);

      // Apply on tap — live preview, no revert, footer says Done
      themeBtn.addEventListener('click', () => {
        // Telemetry: only a deliberate switch counts (spec: theme_change)
        if (theme.name !== this.currentTheme) {
          TelemetryService.track('theme_change', { to: theme.name });
        }
        ThemeService.setTheme(theme.name);
      });

      list.appendChild(themeBtn);
    }

    container.appendChild(list);
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
