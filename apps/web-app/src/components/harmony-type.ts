/**
 * XIV Dye Tools v2.0.0 - Harmony Type Display Component
 *
 * Phase 12: Architecture Refactor
 * Displays matching dyes for a single color harmony type
 *
 * @module components/harmony-type
 */

import { BaseComponent } from './base-component';
import { ColorWheelDisplay } from './color-wheel-display';
import { addInfoIconTo, TOOLTIP_CONTENT } from './info-tooltip';
import { createDyeActionDropdown, type DyeAction } from './dye-action-dropdown';
import { LanguageService } from '@services/index';
import type { Dye, PriceData } from '@shared/types';
import { clearContainer } from '@shared/utils';
import { HARMONY_ICONS } from '@shared/harmony-icons';
import { DyeCardRenderer } from './dye-card-renderer';

/**
 * Harmony type information
 */
export interface HarmonyTypeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/**
 * Harmony type display component
 * Shows matching dyes for a specific color harmony type
 */
export class HarmonyType extends BaseComponent {
  private harmonyInfo: HarmonyTypeInfo;
  private baseColor: string;
  private matchedDyes: Array<{ dye: Dye; deviance: number }> = [];
  private showPrices: boolean = false;
  private priceData: Map<number, PriceData> = new Map();

  constructor(
    container: HTMLElement,
    harmonyInfo: HarmonyTypeInfo,
    baseColor: string,
    matchedDyes: Array<{ dye: Dye; deviance: number }> = [],
    showPrices: boolean = false
  ) {
    super(container);
    this.harmonyInfo = harmonyInfo;
    this.baseColor = baseColor;
    this.matchedDyes = matchedDyes;
    this.showPrices = showPrices;
  }

  /**
   * Render the harmony type display
   */
  renderContent(): void {
    // Note: overflow-visible is required to allow dropdown menus to extend beyond card boundaries
    const card = this.createElement('div', {
      className:
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow overflow-visible',
    });

    // Header
    const header = this.renderHeader();
    card.appendChild(header);

    // Content
    const content = this.createElement('div', {
      className: 'p-4 space-y-3',
    });

    if (this.matchedDyes.length === 0) {
      const emptyState = this.createElement('div', {
        className: 'text-center py-8 text-gray-500 dark:text-gray-400',
        textContent: LanguageService.t('harmony.noMatchingDyes'),
      });
      content.appendChild(emptyState);
    } else {
      // Color wheel visualization
      const wheelContainer = this.createElement('div', {
        className: 'flex justify-center py-3 border-b border-gray-200 dark:border-gray-700',
      });

      const matchedDyesOnly = this.matchedDyes.map(({ dye }) => dye);
      const colorWheel = new ColorWheelDisplay(
        wheelContainer,
        this.baseColor,
        matchedDyesOnly,
        this.harmonyInfo.id,
        160
      );
      colorWheel.init();

      content.appendChild(wheelContainer);

      // Dye list - increased height to accommodate 4 dyes comfortably without scrolling
      const dyeList = this.createElement('div', {
        className: 'space-y-2 max-h-none overflow-y-visible',
      });

      for (const { dye, deviance } of this.matchedDyes) {
        const dyeItem = this.renderDyeItem(dye, deviance);
        dyeList.appendChild(dyeItem);
      }

      content.appendChild(dyeList);
    }

    card.appendChild(content);

    clearContainer(this.container);
    this.element = card;
    this.container.appendChild(this.element);
  }

  /**
   * Render the header section
   */
  private renderHeader(): HTMLElement {
    const header = this.createElement('div', {
      className: 'harmony-header bg-blue-700 dark:bg-blue-900 p-4 rounded-t-lg',
    });

    // Top row with title and save button
    const topRow = this.createElement('div', {
      className: 'flex items-center justify-between mb-2',
    });

    const titleDiv = this.createElement('div', {
      className: 'flex items-center gap-2',
    });

    // Use inline SVG for theme-aware icon coloring
    const icon = this.createElement('span', {
      className: 'harmony-icon',
      attributes: {
        'aria-hidden': 'true',
      },
    });
    icon.innerHTML = HARMONY_ICONS[this.harmonyInfo.icon] || '';

    const name = this.createElement('h3', {
      textContent: this.harmonyInfo.name,
      className: 'text-lg font-bold harmony-title',
    });

    titleDiv.appendChild(icon);
    titleDiv.appendChild(name);
    topRow.appendChild(titleDiv);

    // Save button (only show if there are dyes)
    if (this.matchedDyes.length > 0) {
      const saveBtn = this.createElement('button', {
        className:
          'save-palette-btn p-1.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors',
        attributes: {
          title: LanguageService.t('palette.savePalette'),
          'aria-label': LanguageService.t('palette.savePalette'),
        },
      });

      // Bookmark/save icon SVG
      saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.emitSaveEvent();
      });

      topRow.appendChild(saveBtn);
    }

    header.appendChild(topRow);

    const description = this.createElement('p', {
      textContent: this.harmonyInfo.description,
      className: 'text-sm harmony-description font-medium',
      attributes: {
        style: 'color: var(--theme-text-header);',
      },
    });

    header.appendChild(description);

    // Deviance info
    if (this.matchedDyes.length > 0) {
      const avgDeviance =
        this.matchedDyes.reduce((sum, { deviance }) => sum + deviance, 0) / this.matchedDyes.length;
      const devianceDiv = this.createElement('div', {
        className: 'text-xs mt-2 harmony-deviance-info number',
        textContent: `${LanguageService.t('harmony.avgHueDiff')}: ${avgDeviance.toFixed(1)}°`,
        attributes: {
          style: 'color: var(--theme-text-header);',
        },
      });
      header.appendChild(devianceDiv);
    }

    return header;
  }

  /**
   * Render a single dye item
   */
  private renderDyeItem(dye: Dye, deviance: number): HTMLElement {
    // Deviance score display
    const devianceDiv = this.createElement('div', {
      className: 'text-right flex-shrink-0',
    });

    const devianceValue = this.createElement('div', {
      textContent: `${deviance.toFixed(1)}°`,
      className: `text-sm font-bold number ${this.getDevianceColor(deviance)}`,
      attributes: {
        title: 'Hue Difference (lower is better)',
      },
    });

    const devianceLabel = this.createElement('div', {
      textContent: LanguageService.t('harmony.hueDiff'),
      className: 'text-xs text-gray-500 dark:text-gray-400 inline-flex items-center',
    });
    addInfoIconTo(devianceLabel, TOOLTIP_CONTENT.deviance);

    devianceDiv.appendChild(devianceValue);
    devianceDiv.appendChild(devianceLabel);

    // Action dropdown
    const actionDropdown = createDyeActionDropdown(dye, (action: DyeAction, selectedDye: Dye) => {
      this.handleDyeAction(action, selectedDye);
    });

    const renderer = new DyeCardRenderer(this.container);
    return renderer.render({
      dye,
      price: this.priceData.get(dye.itemID),
      showPrice: this.showPrices,
      extraInfo: devianceDiv,
      actions: [actionDropdown],
      onClick: () => {
        this.emit('dye-selected', { dyeName: LanguageService.getDyeName(dye.itemID) || dye.name });
      },
    });
  }

  /**
   * Handle dye action from dropdown
   */
  private handleDyeAction(action: DyeAction, dye: Dye): void {
    // Dispatch custom event for parent components to handle
    const event = new CustomEvent('dyeAction', {
      bubbles: true,
      detail: { action, dye },
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Emit save palette event
   */
  private emitSaveEvent(): void {
    const event = new CustomEvent('savePalette', {
      bubbles: true,
      detail: {
        harmonyType: this.harmonyInfo.id,
        harmonyName: this.harmonyInfo.name,
        baseColor: this.baseColor,
        dyes: this.matchedDyes.map(({ dye }) => dye),
      },
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Get color class for deviance score
   */
  private getDevianceColor(deviance: number): string {
    if (deviance <= 5) {
      return 'text-green-600 dark:text-green-400';
    }
    if (deviance <= 15) {
      return 'text-blue-600 dark:text-blue-400';
    }
    if (deviance <= 30) {
      return 'text-yellow-600 dark:text-yellow-400';
    }
    return 'text-red-600 dark:text-red-400';
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Dye items could emit events or trigger detail views
    const dyeItems = this.querySelectorAll<HTMLDivElement>('[style*="background-color"]');
    for (const item of dyeItems) {
      this.on(item, 'click', () => {
        const dyeName = item.parentElement?.querySelector('div')?.textContent || '';
        this.emit('dye-selected', { dyeName });
      });
    }
  }

  /**
   * Update matched dyes
   */
  updateDyes(matchedDyes: Array<{ dye: Dye; deviance: number }>): void {
    this.matchedDyes = matchedDyes;
    this.update();
  }

  /**
   * Update base color
   */
  updateBaseColor(baseColor: string): void {
    this.baseColor = baseColor;
    this.update();
  }

  /**
   * Set price data for matched dyes
   */
  setPriceData(priceData: Map<number, PriceData>): void {
    this.priceData = priceData;
    this.update();
  }

  /**
   * Update show prices setting
   */
  updateShowPrices(showPrices: boolean): void {
    this.showPrices = showPrices;
    this.update();
  }

  /**
   * Get matched dyes
   */
  getDyes(): Dye[] {
    return this.matchedDyes.map(({ dye }) => dye);
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      harmonyType: this.harmonyInfo.id,
      baseColor: this.baseColor,
      matchedDyesCount: this.matchedDyes.length,
      showPrices: this.showPrices,
    };
  }

  /**
   * Cleanup component resources
   */
  destroy(): void {
    // Clear Maps and arrays to release references
    this.priceData.clear();
    this.matchedDyes = [];

    // Call parent destroy for BaseComponent cleanup
    super.destroy();
  }
}
