/**
 * XIV Dye Tools v3.0.0 - Harmony Result Panel Component
 *
 * Individual result panel for harmony color display.
 * Shows: dye name, hex code, hue difference, closest dyes, action menu.
 *
 * @module components/harmony-result-panel
 */

import { BaseComponent } from './base-component';
import { createDyeActionDropdown, type DyeAction } from './dye-action-dropdown';
import { LanguageService, APIService } from '@services/index';
import type { Dye, PriceData } from '@shared/types';
import { clearContainer } from '@shared/utils';

// ============================================================================
// Types
// ============================================================================

export interface HarmonyResultPanelOptions {
  /** Panel label: "Base" or "Harmony 1", "Harmony 2", etc. */
  label: string;
  /** The ideal target harmony color (hex) */
  targetColor: string;
  /** The matched/displayed dye */
  matchedDye: Dye;
  /** Hue difference from ideal in degrees */
  deviance: number;
  /** Alternative dyes for "Closest dyes:" section (empty for Base panel) */
  closestDyes: Dye[];
  /** Whether to show prices */
  showPrices: boolean;
  /** Price data map */
  priceData: Map<number, PriceData>;
  /** True for Base panel (no closest dyes section) */
  isBase: boolean;
  /** Harmony slot index (for non-base panels) */
  harmonyIndex?: number;
  /** Callback when user clicks a closest dye swatch to swap it in */
  onSwapDye?: (dye: Dye) => void;
}

// ============================================================================
// HarmonyResultPanel Component
// ============================================================================

/**
 * Displays a single harmony result panel with dye info and swap functionality
 */
export class HarmonyResultPanel extends BaseComponent {
  private options: HarmonyResultPanelOptions;

  constructor(container: HTMLElement, options: HarmonyResultPanelOptions) {
    super(container);
    this.options = options;
  }

  renderContent(): void {
    const { label, matchedDye, deviance, closestDyes, isBase, showPrices, priceData } =
      this.options;

    // Main card container
    const card = this.createElement('div', {
      className: 'rounded-lg overflow-visible',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    // Header row: label + hex badge
    const header = this.createHeader(label, matchedDye.hex);
    card.appendChild(header);

    // Content area
    const content = this.createElement('div', {
      className: 'p-4 space-y-3',
    });

    // Large color swatch
    const swatch = this.createColorSwatch(matchedDye.hex);
    content.appendChild(swatch);

    // Dye name (prominent)
    const dyeName = LanguageService.getDyeName(matchedDye.itemID) ?? matchedDye.name;
    const nameEl = this.createElement('p', {
      className: 'text-lg font-semibold',
      textContent: dyeName,
      attributes: { style: 'color: var(--theme-text);' },
    });
    content.appendChild(nameEl);

    // Hue difference (only for harmony panels, not base)
    if (!isBase && deviance !== undefined) {
      const devianceEl = this.createDevianceDisplay(deviance);
      content.appendChild(devianceEl);
    }

    // Acquisition info
    if (matchedDye.acquisition) {
      const acquisitionEl = this.createElement('p', {
        className: 'text-xs',
        textContent: matchedDye.acquisition,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      content.appendChild(acquisitionEl);
    }

    // Price display (if enabled and has price data)
    if (showPrices) {
      const priceInfo = priceData.get(matchedDye.itemID);
      if (priceInfo) {
        const priceEl = this.createElement('p', {
          className: 'text-sm font-medium number',
          textContent: APIService.formatPrice(priceInfo.currentAverage),
          attributes: { style: 'color: var(--theme-accent);' },
        });
        content.appendChild(priceEl);
      }
    }

    // Closest dyes section (only for harmony panels)
    if (!isBase && closestDyes.length > 0) {
      const closestSection = this.createClosestDyesSection(closestDyes);
      content.appendChild(closestSection);
    }

    // Action dropdown row
    const actionsRow = this.createElement('div', {
      className: 'flex justify-end pt-2',
    });
    const actionDropdown = createDyeActionDropdown(matchedDye, (action: DyeAction, dye: Dye) => {
      this.handleDyeAction(action, dye);
    });
    actionsRow.appendChild(actionDropdown);
    content.appendChild(actionsRow);

    card.appendChild(content);

    // Clear container and add card
    clearContainer(this.container);
    this.element = card;
    this.container.appendChild(card);
  }

  /**
   * Create header with label and hex badge
   */
  private createHeader(label: string, hex: string): HTMLElement {
    const header = this.createElement('div', {
      className: 'flex items-center justify-between p-3',
      attributes: {
        style:
          'background: var(--theme-background-secondary); border-bottom: 1px solid var(--theme-border);',
      },
    });

    const labelEl = this.createElement('span', {
      className: 'text-sm font-medium',
      textContent: label,
      attributes: { style: 'color: var(--theme-text);' },
    });

    const hexBadge = this.createElement('span', {
      className: 'text-xs px-2 py-0.5 rounded number',
      textContent: hex.toUpperCase(),
      attributes: {
        style: 'background: var(--theme-background); color: var(--theme-text-muted);',
      },
    });

    header.appendChild(labelEl);
    header.appendChild(hexBadge);
    return header;
  }

  /**
   * Create large color swatch
   */
  private createColorSwatch(hex: string): HTMLElement {
    return this.createElement('div', {
      className: 'w-full h-16 rounded-lg',
      attributes: {
        style: `background: ${hex};`,
        'aria-label': `Color swatch: ${hex}`,
      },
    });
  }

  /**
   * Create hue deviance display with color coding
   */
  private createDevianceDisplay(deviance: number): HTMLElement {
    const container = this.createElement('div', {
      className: 'flex items-center gap-2',
    });

    const colorClass = this.getDevianceColorStyle(deviance);
    const valueEl = this.createElement('span', {
      className: 'text-sm font-semibold number',
      textContent: `${deviance.toFixed(1)}°`,
      attributes: { style: colorClass },
    });

    const labelEl = this.createElement('span', {
      className: 'text-xs',
      textContent: LanguageService.t('harmony.fromIdeal'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    container.appendChild(valueEl);
    container.appendChild(labelEl);
    return container;
  }

  /**
   * Get color style for deviance value
   * Green ≤5°, Blue ≤15°, Yellow ≤30°, Red >30°
   */
  private getDevianceColorStyle(deviance: number): string {
    if (deviance <= 5) {
      return 'color: #22c55e;'; // green-500
    }
    if (deviance <= 15) {
      return 'color: #3b82f6;'; // blue-500
    }
    if (deviance <= 30) {
      return 'color: #eab308;'; // yellow-500
    }
    return 'color: #ef4444;'; // red-500
  }

  /**
   * Create closest dyes section with clickable swatches
   */
  private createClosestDyesSection(closestDyes: Dye[]): HTMLElement {
    const section = this.createElement('div', {
      className: 'space-y-2 pt-2',
      attributes: {
        style: 'border-top: 1px solid var(--theme-border);',
      },
    });

    const label = this.createElement('p', {
      className: 'text-xs',
      textContent: LanguageService.t('harmony.closestDyes'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    section.appendChild(label);

    const swatchGrid = this.createElement('div', {
      className: 'flex gap-1 flex-wrap',
    });

    closestDyes.forEach((dye) => {
      const dyeName = LanguageService.getDyeName(dye.itemID) ?? dye.name;
      const swatch = this.createElement('button', {
        className:
          'w-7 h-7 rounded cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1',
        attributes: {
          style: `background: ${dye.hex}; border: 1px solid var(--theme-border);`,
          title: dyeName,
          'aria-label': `Swap to ${dyeName}`,
          type: 'button',
        },
      });

      // Store dye reference for click handler
      (swatch as unknown as { __dye: Dye }).__dye = dye;
      swatchGrid.appendChild(swatch);
    });

    section.appendChild(swatchGrid);
    return section;
  }

  /**
   * Handle dye action from dropdown
   */
  private handleDyeAction(action: DyeAction, dye: Dye): void {
    this.emit('dyeAction', { action, dye });
  }

  bindEvents(): void {
    // Bind click events on closest dye swatches
    const swatches = this.querySelectorAll<HTMLButtonElement>('button[aria-label^="Swap to"]');
    swatches.forEach((swatch) => {
      this.on(swatch, 'click', () => {
        const dye = (swatch as HTMLButtonElement & { __dye?: Dye }).__dye;
        if (dye && this.options.onSwapDye) {
          this.options.onSwapDye(dye);
        }
      });
    });
  }

  /**
   * Update price data and re-render if needed
   */
  setPriceData(priceData: Map<number, PriceData>): void {
    this.options.priceData = priceData;
    if (this.options.showPrices) {
      this.update();
    }
  }

  /**
   * Update show prices setting
   */
  setShowPrices(showPrices: boolean): void {
    this.options.showPrices = showPrices;
    this.update();
  }

  /**
   * Get component state for debugging
   */
  protected getState(): Record<string, unknown> {
    return {
      label: this.options.label,
      dyeName: this.options.matchedDye.name,
      deviance: this.options.deviance,
      isBase: this.options.isBase,
      closestDyesCount: this.options.closestDyes.length,
    };
  }
}
