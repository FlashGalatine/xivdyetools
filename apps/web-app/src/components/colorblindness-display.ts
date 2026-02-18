/**
 * XIV Dye Tools v2.0.0 - Colorblindness Display Component
 *
 * Phase 12: Architecture Refactor
 * Displays how colors appear to people with different types of color vision deficiency
 *
 * @module components/colorblindness-display
 */

import { BaseComponent } from './base-component';
import { ColorService } from '@services/index';
import type { VisionType } from '@shared/types';
import { clearContainer } from '@shared/utils';

/**
 * Vision type information
 */
export interface VisionTypeInfo {
  type: VisionType;
  name: string;
  description: string;
  prevalence: string; // % of population
}

/**
 * Colorblindness Display Component
 * Shows how a color appears to people with different vision types
 */
export class ColorblindnessDisplay extends BaseComponent {
  private originalColor: string = '#FF0000';
  private simulatedColors: Record<VisionType, string> = {
    normal: '#FF0000',
    deuteranopia: '#FF0000',
    protanopia: '#FF0000',
    tritanopia: '#FF0000',
    achromatopsia: '#FF0000',
  };

  private visionTypes: VisionTypeInfo[] = [
    {
      type: 'normal',
      name: 'Normal Vision',
      description: 'Standard trichromatic color vision (reference)',
      prevalence: '~92-94%',
    },
    {
      type: 'deuteranopia',
      name: 'Deuteranopia',
      description: 'Red-green colorblindness (missing green cones)',
      prevalence: '~1.2%',
    },
    {
      type: 'protanopia',
      name: 'Protanopia',
      description: 'Red-green colorblindness (missing red cones)',
      prevalence: '~1.3%',
    },
    {
      type: 'tritanopia',
      name: 'Tritanopia',
      description: 'Blue-yellow colorblindness (missing blue cones)',
      prevalence: '~0.02%',
    },
    {
      type: 'achromatopsia',
      name: 'Achromatopsia',
      description: 'Complete colorblindness (monochromatic vision)',
      prevalence: '~0.003%',
    },
  ];

  constructor(container: HTMLElement, originalColor: string = '#FF0000') {
    super(container);
    this.originalColor = originalColor;
    this.updateSimulatedColors();
  }

  /**
   * Update simulated colors for all vision types
   */
  private updateSimulatedColors(): void {
    for (const visionType of this.visionTypes) {
      const type = visionType.type;
      if (type === 'normal') {
        this.simulatedColors[type] = this.originalColor;
      } else {
        this.simulatedColors[type] = ColorService.simulateColorblindnessHex(
          this.originalColor,
          type
        );
      }
    }
  }

  /**
   * Render the display
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    // Title
    const title = this.createElement('h3', {
      textContent: 'Color Perception Simulation',
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
    });
    wrapper.appendChild(title);

    // Description
    const description = this.createElement('p', {
      textContent: 'See how this color appears to people with different types of color vision',
      className: 'text-sm text-gray-600 dark:text-gray-400',
    });
    wrapper.appendChild(description);

    // Vision types grid
    const grid = this.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3',
    });

    for (const visionType of this.visionTypes) {
      const card = this.renderVisionTypeCard(visionType);
      grid.appendChild(card);
    }

    wrapper.appendChild(grid);

    // Color values section
    const valuesSection = this.createElement('div', {
      className: 'bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2',
    });

    const valuesTitle = this.createElement('div', {
      textContent: 'Color Values',
      className: 'text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3',
    });
    valuesSection.appendChild(valuesTitle);

    for (const visionType of this.visionTypes) {
      const row = this.renderColorValueRow(visionType);
      valuesSection.appendChild(row);
    }

    wrapper.appendChild(valuesSection);

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Render a vision type card
   */
  private renderVisionTypeCard(visionType: VisionTypeInfo): HTMLElement {
    const card = this.createElement('div', {
      className:
        'rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow',
    });

    // Color swatch
    const swatch = this.createElement('div', {
      className: 'w-full h-20 border-b border-gray-200 dark:border-gray-700',
      attributes: {
        style: `background-color: ${this.simulatedColors[visionType.type]}`,
      },
    });
    card.appendChild(swatch);

    // Info section
    const info = this.createElement('div', {
      className: 'p-3 bg-white dark:bg-gray-800 space-y-2',
    });

    const name = this.createElement('div', {
      textContent: visionType.name,
      className: 'text-sm font-semibold text-gray-900 dark:text-white',
    });

    const desc = this.createElement('p', {
      textContent: visionType.description,
      className: 'text-xs text-gray-600 dark:text-gray-400 leading-tight',
    });

    const prevalence = this.createElement('div', {
      textContent: `${visionType.prevalence} population`,
      className: 'text-xs number text-gray-500 dark:text-gray-500 italic',
    });

    info.appendChild(name);
    info.appendChild(desc);
    info.appendChild(prevalence);
    card.appendChild(info);

    return card;
  }

  /**
   * Render a color value row
   */
  private renderColorValueRow(visionType: VisionTypeInfo): HTMLElement {
    const row = this.createElement('div', {
      className:
        'flex items-center gap-3 py-2 border-b border-gray-200 dark:border-gray-600 last:border-b-0',
    });

    // Vision type name
    const label = this.createElement('div', {
      textContent: visionType.name,
      className: 'flex-1 text-xs font-medium text-gray-700 dark:text-gray-300',
    });

    // Color swatch (small)
    const swatch = this.createElement('div', {
      className: 'w-5 h-5 rounded border border-gray-300 dark:border-gray-600',
      attributes: {
        style: `background-color: ${this.simulatedColors[visionType.type]}`,
      },
    });

    // Hex value
    const hex = this.createElement('div', {
      textContent: this.simulatedColors[visionType.type],
      className: 'number text-xs text-gray-600 dark:text-gray-400 w-20',
    });

    // RGB values
    const rgb = ColorService.hexToRgb(this.simulatedColors[visionType.type]);
    const rgbText = this.createElement('div', {
      textContent: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      className: 'number text-xs text-gray-600 dark:text-gray-400 flex-1',
    });

    row.appendChild(label);
    row.appendChild(swatch);
    row.appendChild(hex);
    row.appendChild(rgbText);

    return row;
  }

  /**
   * Update the displayed color
   */
  updateColor(hex: string): void {
    this.originalColor = hex;
    this.updateSimulatedColors();
    this.update();
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // No interactive events needed for this display component
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      originalColor: this.originalColor,
      simulatedColors: { ...this.simulatedColors },
    };
  }
}
