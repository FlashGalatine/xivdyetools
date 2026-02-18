/**
 * XIV Dye Tools - Preset Card Component
 *
 * Renders a single preset card in the browse grid.
 * Extracted from preset-browser-tool.ts for better maintainability.
 *
 * @module components/preset-card
 */

import { BaseComponent } from './base-component';
import { LanguageService, dyeService, type UnifiedPreset } from '@services/index';
import { getCategoryIcon } from '@shared/category-icons';

/**
 * Event callback type for preset card interactions
 */
export type PresetCardCallback = (preset: UnifiedPreset) => void;

/**
 * Preset Card Component
 * Displays a single preset in a card format with color swatches and metadata
 */
export class PresetCard extends BaseComponent {
  private preset: UnifiedPreset;
  private onClick?: PresetCardCallback;

  constructor(container: HTMLElement, preset: UnifiedPreset, onClick?: PresetCardCallback) {
    super(container);
    this.preset = preset;
    this.onClick = onClick;
  }

  renderContent(): void {
    const card = this.createElement('div', {
      className: `bg-white dark:bg-gray-800 rounded-lg border overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
        this.preset.isCurated
          ? 'border-gray-200 dark:border-gray-700'
          : 'border-indigo-200 dark:border-indigo-800'
      }`,
      dataAttributes: {
        presetId: this.preset.id,
      },
    });

    // Community badge for non-curated presets
    if (!this.preset.isCurated) {
      const badge = this.createElement('div', {
        className:
          'px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-medium',
        textContent: 'Community',
      });
      card.appendChild(badge);
    }

    // Color swatch strip at top
    const swatchStrip = this.createElement('div', {
      className: 'flex h-16',
    });

    this.preset.dyes.forEach((dyeId) => {
      const dye = dyeService.getDyeById(dyeId);
      const swatch = this.createElement('div', {
        className: 'flex-1',
        attributes: {
          style: `background-color: ${dye?.hex || '#888888'}`,
          title: dye?.name || 'Unknown',
        },
      });
      swatchStrip.appendChild(swatch);
    });

    card.appendChild(swatchStrip);

    // Card content
    const content = this.createElement('div', {
      className: 'p-4',
    });

    // Category badge + title
    const header = this.createElement('div', {
      className: 'flex items-center gap-2 mb-2',
    });

    const categoryBadge = this.createElement('span', {
      className: 'w-5 h-5 flex-shrink-0',
      innerHTML: getCategoryIcon(this.preset.category),
    });
    header.appendChild(categoryBadge);

    const title = this.createElement('h3', {
      className: 'font-semibold text-gray-900 dark:text-white flex-1 truncate',
      textContent: this.preset.name,
    });
    header.appendChild(title);

    // Vote count
    if (this.preset.voteCount > 0) {
      const votes = this.createElement('span', {
        className:
          'text-sm text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1',
      });
      const starIcon = this.createElement('span', {
        innerHTML: '&#9733;', // Star
      });
      votes.appendChild(starIcon);
      const voteCount = this.createElement('span', {
        textContent: String(this.preset.voteCount),
      });
      votes.appendChild(voteCount);
      header.appendChild(votes);
    }

    content.appendChild(header);

    // Description
    const description = this.createElement('p', {
      className: 'text-sm text-gray-600 dark:text-gray-400 line-clamp-2',
      textContent: this.preset.description,
    });
    content.appendChild(description);

    // Footer: dye count and author
    const footer = this.createElement('div', {
      className: 'mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500',
    });

    const dyeCount = this.createElement('span', {
      textContent: `${this.preset.dyes.length} ${LanguageService.t('tools.presets.dyes')}`,
    });
    footer.appendChild(dyeCount);

    if (this.preset.author) {
      const author = this.createElement('span', {
        className: 'truncate max-w-[100px]',
        textContent: `by ${this.preset.author}`,
        attributes: {
          title: `by ${this.preset.author}`,
        },
      });
      footer.appendChild(author);
    } else if (this.preset.isCurated) {
      const official = this.createElement('span', {
        className: 'text-indigo-600 dark:text-indigo-400',
        textContent: 'Official',
      });
      footer.appendChild(official);
    }

    content.appendChild(footer);
    card.appendChild(content);

    // Bind click event
    if (this.onClick) {
      this.on(card, 'click', () => {
        this.onClick?.(this.preset);
      });
    }

    this.element = card;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    // Events are attached inline during render
  }

  /**
   * Update the preset data and re-render
   */
  updatePreset(preset: UnifiedPreset): void {
    this.preset = preset;
    if (this.element) {
      this.element.remove();
    }
    this.render();
  }

  /**
   * Get the current preset
   */
  getPreset(): UnifiedPreset {
    return this.preset;
  }

  destroy(): void {
    super.destroy();
  }
}
