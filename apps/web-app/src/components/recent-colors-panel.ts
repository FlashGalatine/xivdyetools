/**
 * XIV Dye Tools v2.0.0 - Recent Colors Panel
 *
 * Phase 3: Architecture Refactor
 * Handles display and persistence of recently sampled colors
 *
 * @module components/recent-colors-panel
 */

import { BaseComponent } from './base-component';
import { LanguageService } from '@services/language-service';
import { StorageService } from '@services/storage-service';
import { AnnouncerService } from '@services/announcer-service';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';

export interface RecentColor {
  hex: string;
  timestamp: number;
}

export interface RecentColorsPanelOptions {
  onColorSelected?: (hex: string) => void;
  maxColors?: number;
  storageKey?: string;
}

export class RecentColorsPanel extends BaseComponent {
  private recentColors: RecentColor[] = [];
  private maxRecentColors: number = 10;
  private recentColorsStorageKey: string = 'colormatcher_recent_colors';
  private onColorSelected?: (hex: string) => void;

  // UI Elements
  private containerRef: HTMLElement | null = null;

  constructor(container: HTMLElement, options: RecentColorsPanelOptions = {}) {
    super(container);
    this.onColorSelected = options.onColorSelected;
    if (options.maxColors) this.maxRecentColors = options.maxColors;
    if (options.storageKey) this.recentColorsStorageKey = options.storageKey;
  }

  renderContent(): void {
    this.container.id = 'recent-colors-section';
    this.container.className =
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6';
    this.container.style.display = 'none'; // Hidden until there are recent colors

    const recentColorsTitle = this.createElement('h3', {
      textContent: LanguageService.t('matcher.recentColors'),
      className: 'text-lg font-semibold text-gray-900 dark:text-white mb-3',
    });
    this.container.appendChild(recentColorsTitle);

    this.containerRef = this.createElement('div', {
      id: 'recent-colors-container',
      className: 'flex flex-wrap items-center gap-2',
    });
    this.container.appendChild(this.containerRef);

    // Initial load
    this.loadRecentColors();
  }

  bindEvents(): void {
    // Events are bound to dynamically created elements in renderRecentColors
  }

  /**
   * Add a color to recent history with incremental DOM update
   */
  addRecentColor(hex: string): void {
    // Normalize hex to uppercase
    const normalizedHex = hex.toUpperCase();

    // Check if color already exists
    const existingIndex = this.recentColors.findIndex((c) => c.hex.toUpperCase() === normalizedHex);

    if (existingIndex !== -1) {
      // Remove existing and re-add at front - need full re-render for reorder
      this.recentColors = this.recentColors.filter((c) => c.hex.toUpperCase() !== normalizedHex);
      this.recentColors.unshift({
        hex: normalizedHex,
        timestamp: Date.now(),
      });
      this.saveRecentColors();
      this.renderRecentColors();
      return;
    }

    // New color - use incremental update
    const newColor: RecentColor = {
      hex: normalizedHex,
      timestamp: Date.now(),
    };

    // Add to data array
    this.recentColors.unshift(newColor);

    // Handle DOM incrementally
    if (this.containerRef) {
      // Show section if it was hidden
      if (this.container.style.display === 'none') {
        this.container.style.display = 'block';
      }

      // Create new swatch element
      const swatch = this.createColorSwatch(newColor, 0);

      // Insert at the beginning (before first child, or before clear button)
      const firstChild = this.containerRef.firstChild;
      if (firstChild) {
        this.containerRef.insertBefore(swatch, firstChild);
      } else {
        this.containerRef.appendChild(swatch);
        // Add clear button if this is the first color
        this.containerRef.appendChild(this.createClearButton());
      }

      // Update data-recent-index attributes for existing swatches
      const swatches = this.containerRef.querySelectorAll('[data-recent-index]');
      swatches.forEach((el, index) => {
        el.setAttribute('data-recent-index', String(index));
      });

      // Trim if over max size
      if (this.recentColors.length > this.maxRecentColors) {
        this.recentColors = this.recentColors.slice(0, this.maxRecentColors);
        // Remove last swatch (the one before the clear button)
        const allSwatches = this.containerRef.querySelectorAll('[data-recent-index]');
        if (allSwatches.length > this.maxRecentColors) {
          const lastSwatch = allSwatches[allSwatches.length - 1];
          lastSwatch.remove();
        }
      }
    }

    this.saveRecentColors();
  }

  /**
   * Create a color swatch button element
   */
  private createColorSwatch(color: RecentColor, index: number): HTMLButtonElement {
    const swatch = this.createElement('button', {
      className:
        'w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer ' +
        'hover:scale-110 hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
        'transition-transform',
      attributes: {
        style: `background-color: ${color.hex};`,
        title: `${color.hex} - Click to re-match`,
        'aria-label': `Recent color ${color.hex}, click to match`,
        'data-recent-index': String(index),
        type: 'button',
      },
    }) as HTMLButtonElement;

    // Click to re-match
    this.on(swatch, 'click', () => {
      if (this.onColorSelected) {
        this.onColorSelected(color.hex);
      }
      AnnouncerService.announce(`Re-matching color ${color.hex}`);
    });

    return swatch;
  }

  /**
   * Create the clear button element
   */
  private createClearButton(): HTMLButtonElement {
    const clearBtn = this.createElement('button', {
      className:
        'px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 ' +
        'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 ' +
        'hover:bg-red-50 hover:border-red-300 hover:text-red-600 ' +
        'dark:hover:bg-red-900/20 dark:hover:border-red-700 dark:hover:text-red-400 ' +
        'transition-colors ml-2',
      textContent: LanguageService.t('matcher.clearHistory'),
      attributes: {
        title: 'Clear recent colors history',
        'aria-label': 'Clear recent colors history',
        type: 'button',
        'data-clear-button': 'true',
      },
    }) as HTMLButtonElement;

    this.on(clearBtn, 'click', () => {
      this.clearRecentColors();
    });

    return clearBtn;
  }

  /**
   * Load recent colors from localStorage
   */
  private loadRecentColors(): void {
    try {
      const stored = StorageService.getItem<RecentColor[]>(this.recentColorsStorageKey);
      if (stored && Array.isArray(stored)) {
        this.recentColors = stored.slice(0, this.maxRecentColors);
        this.renderRecentColors();
      }
    } catch (error) {
      logger.warn('Failed to load recent colors from storage:', error);
    }
  }

  /**
   * Save recent colors to localStorage
   */
  private saveRecentColors(): void {
    try {
      StorageService.setItem(this.recentColorsStorageKey, this.recentColors);
    } catch (error) {
      logger.warn('Failed to save recent colors to storage:', error);
    }
  }

  /**
   * Clear all recent colors
   */
  private clearRecentColors(): void {
    this.recentColors = [];
    this.saveRecentColors();
    this.renderRecentColors();
    AnnouncerService.announce('Recent colors cleared');
  }

  /**
   * Render the recent colors UI (full rebuild - used for initial load and reordering)
   */
  private renderRecentColors(): void {
    if (!this.containerRef) return;

    // Clear existing content
    clearContainer(this.containerRef);

    // Hide section if no recent colors
    if (this.recentColors.length === 0) {
      this.container.style.display = 'none';
      return;
    }

    // Show section
    this.container.style.display = 'block';

    // Render swatches using helper method
    this.recentColors.forEach((color, index) => {
      const swatch = this.createColorSwatch(color, index);
      this.containerRef?.appendChild(swatch);
    });

    // Add clear button using helper method
    this.containerRef.appendChild(this.createClearButton());
  }

  getState(): Record<string, unknown> {
    return {
      recentColorsCount: this.recentColors.length,
    };
  }
}
