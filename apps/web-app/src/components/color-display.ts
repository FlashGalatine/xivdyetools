/**
 * XIV Dye Tools v2.0.0 - Color Display Component
 *
 * Phase 12: Architecture Refactor
 * UI component for displaying dye colors and their properties
 *
 * @module components/color-display
 */

import { BaseComponent } from './base-component';
import { ColorService, LanguageService } from '@services/index';
import type { Dye } from '@shared/types';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { ICON_SUCCESS, ICON_ERROR } from '@shared/ui-icons';

/**
 * Options for color display initialization
 */
export interface ColorDisplayOptions {
  showHex?: boolean;
  showRGB?: boolean;
  showHSV?: boolean;
  showDistance?: boolean;
  showAccessibility?: boolean;
  comparisonDye?: Dye | null;
}

/**
 * Color display component - shows color information and properties
 * Can display single colors or compare two colors
 */
export class ColorDisplay extends BaseComponent {
  private displayDye: Dye | null = null;
  private comparisonDye: Dye | null = null;
  private options: ColorDisplayOptions;

  constructor(container: HTMLElement, options: ColorDisplayOptions = {}) {
    super(container);
    this.options = {
      showHex: options.showHex ?? true,
      showRGB: options.showRGB ?? true,
      showHSV: options.showHSV ?? true,
      showDistance: options.showDistance ?? true,
      showAccessibility: options.showAccessibility ?? true,
      comparisonDye: options.comparisonDye ?? null,
    };
    this.comparisonDye = this.options.comparisonDye ?? null;
  }

  /**
   * Render the color display component
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    if (!this.displayDye) {
      const emptyState = this.createElement('div', {
        className:
          'flex items-center justify-center h-40 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700',
      });

      const emptyText = this.createElement('div', {
        textContent: 'No color selected',
        className: 'text-center text-gray-500 dark:text-gray-400',
      });

      emptyState.appendChild(emptyText);
      wrapper.appendChild(emptyState);

      clearContainer(this.container);
      this.element = wrapper;
      this.container.appendChild(this.element);
      return;
    }

    // Main color display area
    const colorArea = this.createElement('div', {
      className: 'grid grid-cols-1 md:grid-cols-2 gap-4',
    });

    // Primary color card
    const primaryCard = this.renderColorCard(this.displayDye, 'Primary');
    colorArea.appendChild(primaryCard);

    // Comparison color card (if available)
    if (this.comparisonDye) {
      const comparisonCard = this.renderColorCard(this.comparisonDye, 'Comparison');
      colorArea.appendChild(comparisonCard);
    }

    wrapper.appendChild(colorArea);

    // Color comparison metrics (if comparison dye is set)
    if (this.comparisonDye && this.options.showDistance) {
      const metricsSection = this.renderComparisonMetrics();
      wrapper.appendChild(metricsSection);
    }

    // Color properties section
    const propertiesSection = this.renderColorProperties();
    wrapper.appendChild(propertiesSection);

    // Accessibility section (if enabled)
    if (this.options.showAccessibility) {
      const accessibilitySection = this.renderAccessibilityInfo();
      wrapper.appendChild(accessibilitySection);
    }

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Render a single color card
   */
  private renderColorCard(dye: Dye, label: string): HTMLElement {
    const card = this.createElement('div', {
      className: 'p-4 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3',
    });

    // Label
    const labelDiv = this.createElement('div', {
      textContent: label,
      className: 'text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide',
    });
    card.appendChild(labelDiv);

    // Color swatch (accessible with role="img" and aria-label)
    const dyeName = LanguageService.getDyeName(dye.itemID) || dye.name;
    const swatch = this.createElement('div', {
      className: 'w-full h-24 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-md',
      attributes: {
        style: `background-color: ${dye.hex}`,
        role: 'img',
        'aria-label': `${dyeName} color swatch: ${dye.hex}`,
      },
    });
    card.appendChild(swatch);

    // Dye name
    const nameDiv = this.createElement('div', {
      textContent: dyeName,
      className: 'text-lg font-bold text-gray-900 dark:text-white',
    });
    card.appendChild(nameDiv);

    // Dye info grid
    const infoGrid = this.createElement('div', {
      className: 'grid grid-cols-2 gap-2 text-sm',
    });

    if (this.options.showHex) {
      const hexItem = this.createElement('div', {
        className: 'space-y-1',
      });
      const hexLabelId = `hex-label-${dye.id}`;
      const hexLabel = this.createElement('div', {
        textContent: 'Hex',
        className: 'text-xs text-gray-600 dark:text-gray-400 uppercase',
        attributes: { id: hexLabelId },
      });
      // Use button for keyboard accessibility
      const hexValue = this.createElement('button', {
        textContent: dye.hex,
        className:
          'text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1 -mx-1 number',
        attributes: {
          type: 'button',
          'data-copy': dye.hex,
          'aria-label': `Copy hex value: ${dye.hex}`,
          'aria-describedby': hexLabelId,
          title: 'Click to copy',
        },
      });
      hexItem.appendChild(hexLabel);
      hexItem.appendChild(hexValue);
      infoGrid.appendChild(hexItem);
    }

    if (this.options.showRGB) {
      const rgbItem = this.createElement('div', {
        className: 'space-y-1',
      });
      const rgbLabelId = `rgb-label-${dye.id}`;
      const rgbLabel = this.createElement('div', {
        textContent: 'RGB',
        className: 'text-xs text-gray-600 dark:text-gray-400 uppercase',
        attributes: { id: rgbLabelId },
      });
      const rgbCopyValue = `rgb(${dye.rgb.r}, ${dye.rgb.g}, ${dye.rgb.b})`;
      // Use button for keyboard accessibility
      const rgbValue = this.createElement('button', {
        textContent: `${dye.rgb.r}, ${dye.rgb.g}, ${dye.rgb.b}`,
        className:
          'text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1 -mx-1 number',
        attributes: {
          type: 'button',
          'data-copy': rgbCopyValue,
          'aria-label': `Copy RGB value: ${rgbCopyValue}`,
          'aria-describedby': rgbLabelId,
          title: 'Click to copy',
        },
      });
      rgbItem.appendChild(rgbLabel);
      rgbItem.appendChild(rgbValue);
      infoGrid.appendChild(rgbItem);
    }

    if (this.options.showHSV) {
      const hsvItem = this.createElement('div', {
        className: 'space-y-1',
      });
      const hsvLabelId = `hsv-label-${dye.id}`;
      const hsvLabel = this.createElement('div', {
        textContent: 'HSV',
        className: 'text-xs text-gray-600 dark:text-gray-400 uppercase',
        attributes: { id: hsvLabelId },
      });
      const h = Math.round(dye.hsv.h);
      const s = Math.round(dye.hsv.s);
      const v = Math.round(dye.hsv.v);
      const hsvCopyValue = `hsv(${h}, ${s}%, ${v}%)`;
      // Use button for keyboard accessibility
      const hsvValue = this.createElement('button', {
        textContent: `${h}°, ${s}%, ${v}%`,
        className:
          'text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded px-1 -mx-1 number',
        attributes: {
          type: 'button',
          'data-copy': hsvCopyValue,
          'aria-label': `Copy HSV value: ${hsvCopyValue}`,
          'aria-describedby': hsvLabelId,
          title: 'Click to copy',
        },
      });
      hsvItem.appendChild(hsvLabel);
      hsvItem.appendChild(hsvValue);
      infoGrid.appendChild(hsvItem);
    }

    card.appendChild(infoGrid);

    return card;
  }

  /**
   * Render comparison metrics
   */
  private renderComparisonMetrics(): HTMLElement {
    if (!this.comparisonDye) {
      return this.createElement('div');
    }

    const section = this.createElement('div', {
      className:
        'p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 space-y-2',
    });

    const title = this.createElement('div', {
      textContent: 'Color Comparison',
      className: 'font-semibold text-blue-900 dark:text-blue-100',
    });
    section.appendChild(title);

    // Color distance
    const distance = ColorService.getColorDistance(this.displayDye!.hex, this.comparisonDye.hex);
    const distanceDiv = this.createElement('div', {
      className: 'text-sm text-blue-800 dark:text-blue-200',
    });
    const distanceLabel = this.createElement('div', {});
    const distanceStrong = this.createElement('strong', { textContent: 'Color Distance:' });
    distanceLabel.appendChild(distanceStrong);
    distanceLabel.appendChild(document.createTextNode(' '));
    const distanceValueSpan = this.createElement('span', {
      textContent: distance.toFixed(2),
      className: 'number',
    });
    distanceLabel.appendChild(distanceValueSpan);
    distanceLabel.appendChild(document.createTextNode(' (0-441.67 scale)'));
    distanceDiv.appendChild(distanceLabel);

    const progressContainer = this.createElement('div', {
      className: 'mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2',
    });
    const progressBar = this.createElement('div', {
      className: 'bg-blue-500 h-2 rounded-full',
    });
    const progressWidth = Math.min(100, Math.max(0, (distance / 441.67) * 100));
    progressBar.style.width = `${progressWidth}%`;
    progressContainer.appendChild(progressBar);
    distanceDiv.appendChild(progressContainer);
    section.appendChild(distanceDiv);

    // Contrast ratio
    const contrast = ColorService.getContrastRatio(this.displayDye!.hex, this.comparisonDye.hex);
    const contrastDiv = this.createElement('div', {
      className: 'text-sm text-blue-800 dark:text-blue-200',
    });
    contrastDiv.appendChild(document.createTextNode('Contrast Ratio: '));
    const contrastValueSpan = this.createElement('span', {
      textContent: `${contrast.toFixed(2)}:1`,
      className: 'number',
    });
    contrastDiv.appendChild(contrastValueSpan);
    section.appendChild(contrastDiv);

    // WCAG compliance
    const wcagAA = ColorService.meetsWCAGAA(this.displayDye!.hex, this.comparisonDye.hex);
    const wcagAAA = ColorService.meetsWCAGAAA(this.displayDye!.hex, this.comparisonDye.hex);
    const wcagDiv = this.createElement('div', {
      className: 'text-sm text-blue-800 dark:text-blue-200',
    });

    const wcagAADiv = this.createElement('div', {
      className: 'flex items-center gap-1',
    });
    wcagAADiv.appendChild(document.createTextNode('WCAG AA: '));
    const wcagAASpan = this.createElement('span', {
      className: `inline-flex items-center gap-1 ${wcagAA ? 'text-green-600 font-semibold' : 'text-red-600'}`,
    });
    const wcagAAIcon = this.createElement('span', {
      className: 'inline-block w-4 h-4',
    });
    wcagAAIcon.innerHTML = wcagAA ? ICON_SUCCESS : ICON_ERROR;
    wcagAASpan.appendChild(wcagAAIcon);
    wcagAASpan.appendChild(document.createTextNode(wcagAA ? ' Pass' : ' Fail'));
    wcagAADiv.appendChild(wcagAASpan);
    wcagDiv.appendChild(wcagAADiv);

    const wcagAAADiv = this.createElement('div', {
      className: 'flex items-center gap-1',
    });
    wcagAAADiv.appendChild(document.createTextNode('WCAG AAA: '));
    const wcagAAASpan = this.createElement('span', {
      className: `inline-flex items-center gap-1 ${wcagAAA ? 'text-green-600 font-semibold' : 'text-red-600'}`,
    });
    const wcagAAAIcon = this.createElement('span', {
      className: 'inline-block w-4 h-4',
    });
    wcagAAAIcon.innerHTML = wcagAAA ? ICON_SUCCESS : ICON_ERROR;
    wcagAAASpan.appendChild(wcagAAAIcon);
    wcagAAASpan.appendChild(document.createTextNode(wcagAAA ? ' Pass' : ' Fail'));
    wcagAAADiv.appendChild(wcagAAASpan);
    wcagDiv.appendChild(wcagAAADiv);
    section.appendChild(wcagDiv);

    return section;
  }

  /**
   * Render color properties
   */
  private renderColorProperties(): HTMLElement {
    if (!this.displayDye) {
      return this.createElement('div');
    }

    const section = this.createElement('div', {
      className:
        'p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 space-y-2',
    });

    const title = this.createElement('div', {
      textContent: 'Color Properties',
      className: 'font-semibold text-gray-900 dark:text-white mb-3',
    });
    section.appendChild(title);

    const properties = [
      { label: 'Category', value: this.displayDye.category, isNumeric: false },
      { label: 'Acquisition', value: this.displayDye.acquisition, isNumeric: false },
      { label: 'Item ID', value: String(this.displayDye.itemID), isNumeric: true },
      {
        label: 'Cost',
        value: this.displayDye.cost ? `${this.displayDye.cost.toLocaleString()} Gil` : 'N/A',
        isNumeric: true,
      },
      { label: 'Brightness', value: `${Math.round(this.displayDye.hsv.v)}%`, isNumeric: true },
      { label: 'Saturation', value: `${Math.round(this.displayDye.hsv.s)}%`, isNumeric: true },
    ];

    for (const prop of properties) {
      const propDiv = this.createElement('div', {
        className: 'flex justify-between text-sm',
      });

      const label = this.createElement('span', {
        textContent: prop.label,
        className: 'font-medium text-gray-700 dark:text-gray-300',
      });

      const value = this.createElement('span', {
        textContent: prop.value,
        className: `text-gray-900 dark:text-white ${prop.isNumeric ? 'number' : ''}`,
      });

      propDiv.appendChild(label);
      propDiv.appendChild(value);
      section.appendChild(propDiv);
    }

    return section;
  }

  /**
   * Render accessibility information
   */
  private renderAccessibilityInfo(): HTMLElement {
    if (!this.displayDye) {
      return this.createElement('div');
    }

    const section = this.createElement('div', {
      className:
        'p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 space-y-2',
    });

    const title = this.createElement('div', {
      textContent: 'Accessibility',
      className: 'font-semibold text-purple-900 dark:text-purple-100',
    });
    section.appendChild(title);

    const luminance = ColorService.getPerceivedLuminance(this.displayDye.hex);
    const isLight = ColorService.isLightColor(this.displayDye.hex);

    const infoDiv = this.createElement('div', {
      className: 'text-sm text-purple-800 dark:text-purple-200 space-y-1',
    });

    const luminanceValue = this.createElement('div', {});
    luminanceValue.appendChild(document.createTextNode('Perceived Luminance: '));
    const luminanceSpan = this.createElement('span', {
      textContent: `${(luminance * 100).toFixed(1)}%`,
      className: 'number',
    });
    luminanceValue.appendChild(luminanceSpan);

    const brightnessValue = this.createElement('div', {
      textContent: `Brightness Classification: ${isLight ? 'Light' : 'Dark'}`,
    });

    const textColor = ColorService.getOptimalTextColor(this.displayDye.hex);

    const textColorValue = this.createElement('div', {});
    textColorValue.appendChild(document.createTextNode('Optimal Text Color: '));
    const textColorSpan = this.createElement('span', {
      textContent: textColor,
      className: 'number',
      attributes: {
        style: `color: ${textColor}; font-weight: bold;`,
      },
    });
    textColorValue.appendChild(textColorSpan);

    infoDiv.appendChild(luminanceValue);
    infoDiv.appendChild(brightnessValue);
    infoDiv.appendChild(textColorValue);

    section.appendChild(infoDiv);

    return section;
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Copy-to-clipboard functionality
    const copyableElements = this.querySelectorAll<HTMLElement>('[data-copy]');
    for (const element of copyableElements) {
      this.on(element, 'click', async (event) => {
        event.preventDefault();
        const text = element.getAttribute('data-copy');
        if (text) {
          try {
            await navigator.clipboard.writeText(text);
            const originalText = element.textContent;
            element.textContent = 'Copied!';
            setTimeout(() => {
              element.textContent = originalText;
            }, 2000);
          } catch (error) {
            logger.warn('Failed to copy to clipboard:', error);
          }
        }
      });
    }
  }

  /**
   * Set the dye to display
   */
  setDye(dye: Dye | null): void {
    this.displayDye = dye;
    this.update();
  }

  /**
   * Set the comparison dye
   */
  setComparisonDye(dye: Dye | null): void {
    this.comparisonDye = dye;
    this.update();
  }

  /**
   * Get current displayed dye
   */
  getDye(): Dye | null {
    return this.displayDye;
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      displayDye: this.displayDye,
      comparisonDye: this.comparisonDye,
    };
  }

  /**
   * Set component state
   */
  protected setState(newState: Record<string, unknown>): void {
    if (newState.displayDye === null || typeof newState.displayDye === 'object') {
      this.displayDye = newState.displayDye as Dye | null;
    }
    if (newState.comparisonDye === null || typeof newState.comparisonDye === 'object') {
      this.comparisonDye = newState.comparisonDye as Dye | null;
    }
  }
}
