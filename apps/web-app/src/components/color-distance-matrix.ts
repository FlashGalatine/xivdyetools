/**
 * XIV Dye Tools v2.0.0 - Color Distance Matrix Component
 *
 * Phase 12: Architecture Refactor
 * Displays color distance comparisons in a matrix table
 *
 * @module components/color-distance-matrix
 */

import { BaseComponent } from './base-component';
import { ColorService, LanguageService } from '@services/index';
import type { Dye } from '@shared/types';
import { clearContainer } from '@shared/utils';

// Locale keys for this component are under 'comparison.matrix.*'

/**
 * Color Distance Matrix Component
 * Shows pairwise color distances between selected dyes
 */
export class ColorDistanceMatrix extends BaseComponent {
  private dyes: Dye[] = [];

  constructor(container: HTMLElement, dyes: Dye[] = []) {
    super(container);
    this.dyes = dyes;
  }

  /**
   * Render the matrix component
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    if (this.dyes.length === 0) {
      const emptyState = this.createElement('div', {
        className: 'text-center py-8 text-gray-500 dark:text-gray-400',
        textContent: LanguageService.t('comparison.matrix.selectDyes'),
      });
      wrapper.appendChild(emptyState);
      clearContainer(this.container);
      this.element = wrapper;
      this.container.appendChild(this.element);
      return;
    }

    // Title
    const title = this.createElement('h3', {
      textContent: LanguageService.t('comparison.matrix.title'),
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
    });
    wrapper.appendChild(title);

    // Description
    const description = this.createElement('p', {
      textContent: LanguageService.t('comparison.matrix.description'),
      className: 'text-sm text-gray-600 dark:text-gray-400',
    });
    wrapper.appendChild(description);

    // Matrix table
    const table = this.renderMatrix();
    wrapper.appendChild(table);

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Render the matrix table
   */
  private renderMatrix(): HTMLElement {
    const tableContainer = this.createElement('div', {
      className: 'overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700',
    });

    const table = this.createElement('table', {
      className: 'w-full text-sm border-collapse bg-white dark:bg-gray-800',
    });

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const emptyCell = document.createElement('th');
    emptyCell.className =
      'px-3 py-2 text-left font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900';
    emptyCell.textContent = '';
    headerRow.appendChild(emptyCell);

    for (const dye of this.dyes) {
      const th = document.createElement('th');
      th.className =
        'px-3 py-2 text-center font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900';

      const dyeLabel = this.createElement('div', {
        className: 'flex items-center justify-center gap-1',
      });

      const swatch = this.createElement('div', {
        className: 'w-4 h-4 rounded border border-gray-400',
        attributes: {
          style: `background-color: ${dye.hex}`,
        },
      });

      const name = this.createElement('span', {
        textContent: (LanguageService.getDyeName(dye.itemID) || dye.name).substring(0, 12),
        className: 'text-xs truncate',
      });

      dyeLabel.appendChild(swatch);
      dyeLabel.appendChild(name);
      th.appendChild(dyeLabel);
      headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');

    for (let i = 0; i < this.dyes.length; i++) {
      const row = document.createElement('tr');

      // Row header
      const rowHeader = document.createElement('td');
      rowHeader.className =
        'px-3 py-2 font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900';

      const rowLabel = this.createElement('div', {
        className: 'flex items-center gap-1 text-xs',
      });

      const swatch = this.createElement('div', {
        className: 'w-4 h-4 rounded border border-gray-400',
        attributes: {
          style: `background-color: ${this.dyes[i].hex}`,
        },
      });

      const name = this.createElement('span', {
        textContent: (
          LanguageService.getDyeName(this.dyes[i].itemID) || this.dyes[i].name
        ).substring(0, 12),
        className: 'truncate',
      });

      rowLabel.appendChild(swatch);
      rowLabel.appendChild(name);
      rowHeader.appendChild(rowLabel);
      row.appendChild(rowHeader);

      // Distance cells
      for (let j = 0; j < this.dyes.length; j++) {
        const cell = document.createElement('td');
        cell.className =
          'px-3 py-2 text-center border border-gray-200 dark:border-gray-700 text-sm number';

        if (i === j) {
          // Diagonal: same color
          cell.textContent = '0.0';
          cell.className += ' bg-gray-100 dark:bg-gray-700/50';
        } else {
          const distance = ColorService.getColorDistance(this.dyes[i].hex, this.dyes[j].hex);
          cell.textContent = distance.toFixed(1);

          // Color code: green → yellow → red
          const bgColor = this.getDistanceColor(distance);
          cell.style.backgroundColor = bgColor;
          cell.style.color = this.getTextColorForBackground(bgColor);
        }

        row.appendChild(cell);
      }

      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);

    return tableContainer;
  }

  /**
   * Get background color based on distance
   */
  private getDistanceColor(distance: number): string {
    // Max distance is about 441 (white to black)
    const normalized = Math.min(distance / 441, 1);

    if (normalized < 0.25) {
      // Green: very close
      return `rgb(${Math.round(34 + normalized * 20)}, ${Math.round(197 - normalized * 50)}, ${Math.round(94 - normalized * 50)})`;
    } else if (normalized < 0.5) {
      // Yellow-green transition
      const t = (normalized - 0.25) / 0.25;
      return `rgb(${Math.round(54 + t * 180)}, ${Math.round(147 - t * 50)}, ${Math.round(44)})`;
    } else if (normalized < 0.75) {
      // Yellow to orange transition
      const t = (normalized - 0.5) / 0.25;
      return `rgb(${Math.round(234 - t * 34)}, ${Math.round(97 - t * 30)}, ${Math.round(44 - t * 44)})`;
    } else {
      // Orange to red transition
      const t = (normalized - 0.75) / 0.25;
      return `rgb(${Math.round(200 + t * 55)}, ${Math.round(67 - t * 62)}, ${Math.round(0)})`;
    }
  }

  /**
   * Get text color (white or black) for readability
   */
  private getTextColorForBackground(bgColor: string): string {
    // Extract RGB values and calculate luminance
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return '#000000';

    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  /**
   * Update dyes
   */
  updateDyes(dyes: Dye[]): void {
    this.dyes = dyes;
    this.update();
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Add any interactive features
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      dyeCount: this.dyes.length,
      dyeNames: this.dyes.map((d) => d.name),
    };
  }

  /**
   * Cleanup component resources
   */
  destroy(): void {
    this.dyes = [];
    super.destroy();
  }
}
