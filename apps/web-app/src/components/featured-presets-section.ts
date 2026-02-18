/**
 * XIV Dye Tools - Featured Presets Section Component
 *
 * Displays a horizontal scrolling section of featured community presets.
 * Extracted from preset-browser-tool.ts for better maintainability.
 *
 * @module components/featured-presets-section
 */

import { BaseComponent } from './base-component';
import { dyeService, type UnifiedPreset } from '@services/index';

/**
 * Event callback type for featured preset clicks
 */
export type FeaturedPresetCallback = (preset: UnifiedPreset) => void;

/**
 * Featured Presets Section Component
 * Displays featured community presets in a horizontal scrollable layout
 */
export class FeaturedPresetsSection extends BaseComponent {
  private presets: UnifiedPreset[];
  private onClick?: FeaturedPresetCallback;

  constructor(container: HTMLElement, presets: UnifiedPreset[], onClick?: FeaturedPresetCallback) {
    super(container);
    this.presets = presets;
    this.onClick = onClick;
  }

  renderContent(): void {
    const section = this.createElement('div', {
      className: 'featured-section-gradient rounded-lg p-6 text-white',
    });

    // Header
    const header = this.createElement('div', {
      className: 'flex items-center gap-2 mb-4',
    });

    const starIcon = this.createElement('span', {
      innerHTML: '&#11088;', // Star emoji
      className: 'text-xl',
    });
    header.appendChild(starIcon);

    const title = this.createElement('h3', {
      className: 'text-lg font-semibold',
      textContent: 'Featured Community Presets',
    });
    header.appendChild(title);

    section.appendChild(header);

    // Grid of featured cards
    const grid = this.createElement('div', {
      className: 'flex gap-4 overflow-x-auto pb-2',
    });

    this.presets.forEach((preset) => {
      const card = this.createFeaturedCard(preset);
      grid.appendChild(card);
    });

    section.appendChild(grid);

    this.element = section;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    // Events are attached inline during render
  }

  /**
   * Create a featured preset card
   */
  private createFeaturedCard(preset: UnifiedPreset): HTMLElement {
    const card = this.createElement('div', {
      className:
        'flex-shrink-0 w-48 bg-white/10 backdrop-blur rounded-lg overflow-hidden cursor-pointer hover:bg-white/20 transition-colors',
      dataAttributes: {
        presetId: preset.id,
      },
    });

    // Color strip
    const swatchStrip = this.createElement('div', {
      className: 'flex h-12',
    });

    preset.dyes.forEach((dyeId) => {
      const dye = dyeService.getDyeById(dyeId);
      const swatch = this.createElement('div', {
        className: 'flex-1',
        attributes: {
          style: `background-color: ${dye?.hex || '#888888'}`,
        },
      });
      swatchStrip.appendChild(swatch);
    });

    card.appendChild(swatchStrip);

    // Info
    const info = this.createElement('div', {
      className: 'p-3',
    });

    const name = this.createElement('div', {
      className: 'font-medium text-sm truncate',
      textContent: preset.name,
    });
    info.appendChild(name);

    if (preset.voteCount > 0) {
      const votes = this.createElement('div', {
        className: 'text-xs opacity-75 mt-1',
        textContent: `${preset.voteCount} votes`,
      });
      info.appendChild(votes);
    }

    card.appendChild(info);

    // Bind click event
    if (this.onClick) {
      this.on(card, 'click', () => {
        this.onClick?.(preset);
      });
    }

    return card;
  }

  /**
   * Update the featured presets and re-render
   */
  updatePresets(presets: UnifiedPreset[]): void {
    this.presets = presets;
    if (this.element) {
      this.element.remove();
    }
    this.render();
  }

  /**
   * Show or hide the section
   */
  setVisible(visible: boolean): void {
    if (this.element) {
      this.element.classList.toggle('hidden', !visible);
    }
  }

  destroy(): void {
    super.destroy();
  }
}
