/**
 * XIV Dye Tools v3.0.0 - Harmony Generator Mockup
 *
 * Two-panel layout mockup for the Harmony Generator tool.
 * Demonstrates the layout structure with simplified placeholder components.
 *
 * Left: Dye selector, harmony type, companion count, filters, market board
 * Right: Color wheel, harmony cards grid, matched dyes
 *
 * @module mockups/tools/HarmonyMockup
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { LanguageService } from '@services/index';
import { clearContainer } from '@shared/utils';

// SVG Icons
const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
</svg>`;

const ICON_MARKET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
</svg>`;

const ICON_PALETTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
</svg>`;

/**
 * Harmony type definitions
 */
const HARMONY_TYPES = [
  { id: 'complementary', name: 'Complementary', degrees: [180] },
  { id: 'analogous', name: 'Analogous', degrees: [30, 330] },
  { id: 'triadic', name: 'Triadic', degrees: [120, 240] },
  { id: 'split-complementary', name: 'Split Complementary', degrees: [150, 210] },
  { id: 'tetradic', name: 'Tetradic', degrees: [60, 180, 240] },
  { id: 'square', name: 'Square', degrees: [90, 180, 270] },
  { id: 'monochromatic', name: 'Monochromatic', degrees: [0] },
  { id: 'compound', name: 'Compound', degrees: [30, 180, 330] },
  { id: 'shades', name: 'Shades', degrees: [15, 345] },
];

/**
 * Sample dye colors for mockup
 */
const SAMPLE_DYES = [
  { name: 'Snow White', hex: '#F8F8F8', id: 1 },
  { name: 'Dalamud Red', hex: '#E85A5A', id: 2 },
  { name: 'Turquoise Blue', hex: '#4AC0B0', id: 3 },
  { name: 'Royal Purple', hex: '#7A58A6', id: 4 },
  { name: 'Honey Yellow', hex: '#E8C44A', id: 5 },
  { name: 'Celeste Green', hex: '#7AC07A', id: 6 },
];

export interface HarmonyMockupOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Harmony Generator Mockup - Two-panel layout demonstration
 */
export class HarmonyMockup extends BaseComponent {
  private options: HarmonyMockupOptions;
  private selectedDye: (typeof SAMPLE_DYES)[0] | null = SAMPLE_DYES[1]; // Default to Dalamud Red
  private selectedHarmonyType: string = 'complementary';
  private companionCount: number = 5;
  private filtersPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;

  constructor(container: HTMLElement, options: HarmonyMockupOptions) {
    super(container);
    this.options = options;
  }

  renderContent(): void {
    this.renderLeftPanel();
    this.renderRightPanel();

    if (this.options.drawerContent) {
      this.renderDrawerContent();
    }

    this.element = this.container;
  }

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Dye Selection
    const dyeSection = this.createSection('Base Dye');
    dyeSection.appendChild(this.createDyeSelector());
    left.appendChild(dyeSection);

    // Section 2: Harmony Type
    const harmonySection = this.createSection('Harmony Type');
    harmonySection.appendChild(this.createHarmonyTypeSelector());
    left.appendChild(harmonySection);

    // Section 3: Companion Count
    const countSection = this.createSection('Companion Dyes');
    countSection.appendChild(this.createCompanionSlider());
    left.appendChild(countSection);

    // Collapsible: Dye Filters
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    this.filtersPanel = new CollapsiblePanel(filtersContainer, {
      title: 'Dye Filters',
      storageKey: 'harmony_mockup_filters',
      defaultOpen: false,
      icon: ICON_FILTER,
    });
    this.filtersPanel.init();
    this.filtersPanel.setContent(this.createFiltersContent());

    // Collapsible: Market Board
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    this.marketPanel = new CollapsiblePanel(marketContainer, {
      title: 'Market Board',
      storageKey: 'harmony_mockup_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.marketPanel.init();
    this.marketPanel.setContent(this.createMarketContent());
  }

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Color Wheel
    const wheelSection = this.createElement('div', { className: 'mb-6' });
    wheelSection.appendChild(this.createColorWheel());
    right.appendChild(wheelSection);

    // Results Header
    const resultsHeader = this.createElement('div', {
      className: 'flex items-center justify-between mb-4',
    });
    const resultsTitle = this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider',
      textContent: 'Harmony Results',
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    const exportBtn = this.createElement('button', {
      className: 'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors',
      attributes: {
        style:
          'background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);',
      },
      innerHTML: `<span class="w-4 h-4">${ICON_PALETTE}</span> Export`,
    });
    resultsHeader.appendChild(resultsTitle);
    resultsHeader.appendChild(exportBtn);
    right.appendChild(resultsHeader);

    // Harmony Cards Grid
    const grid = this.createElement('div', {
      className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3',
    });

    if (this.selectedDye) {
      this.createHarmonyCards(grid);
    } else {
      grid.appendChild(this.createEmptyState());
    }

    right.appendChild(grid);
  }

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    // Simplified version for mobile drawer
    const content = this.createElement('div', { className: 'p-4 space-y-4' });

    // Selected dye display
    if (this.selectedDye) {
      const dyeDisplay = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });
      const swatch = this.createElement('div', {
        className: 'w-10 h-10 rounded-lg border',
        attributes: {
          style: `background: ${this.selectedDye.hex}; border-color: var(--theme-border);`,
        },
      });
      const info = this.createElement('div');
      info.innerHTML = `
        <p class="font-medium" style="color: var(--theme-text);">${this.selectedDye.name}</p>
        <p class="text-xs font-mono" style="color: var(--theme-text-muted);">${this.selectedDye.hex}</p>
      `;
      dyeDisplay.appendChild(swatch);
      dyeDisplay.appendChild(info);
      content.appendChild(dyeDisplay);
    }

    // Current harmony type
    const harmonyInfo = this.createElement('div', {
      className: 'text-sm',
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    const selectedType = HARMONY_TYPES.find((t) => t.id === this.selectedHarmonyType);
    harmonyInfo.textContent = `Harmony: ${selectedType?.name ?? this.selectedHarmonyType}`;
    content.appendChild(harmonyInfo);

    drawer.appendChild(content);
  }

  // Helper: Create section with label
  private createSection(label: string): HTMLElement {
    const section = this.createElement('div', {
      className: 'p-4 border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });
    const sectionLabel = this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: label,
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    section.appendChild(sectionLabel);
    return section;
  }

  // Create dye selector mockup
  private createDyeSelector(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });

    // Current selection
    if (this.selectedDye) {
      const current = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg mb-3',
        attributes: { style: 'background: var(--theme-primary); color: var(--theme-text-header);' },
      });
      const swatch = this.createElement('div', {
        className: 'w-8 h-8 rounded border-2 border-white/30',
        attributes: { style: `background: ${this.selectedDye.hex};` },
      });
      const name = this.createElement('span', {
        className: 'font-medium',
        textContent: this.selectedDye.name,
      });
      current.appendChild(swatch);
      current.appendChild(name);
      container.appendChild(current);
    }

    // Dye grid
    const grid = this.createElement('div', {
      className: 'grid grid-cols-3 gap-2',
    });

    SAMPLE_DYES.forEach((dye) => {
      const btn = this.createElement('button', {
        className: 'p-2 rounded-lg text-center transition-all hover:scale-105',
        attributes: {
          style: `background: var(--theme-card-background); border: 2px solid ${
            this.selectedDye?.id === dye.id ? 'var(--theme-primary)' : 'var(--theme-border)'
          };`,
        },
      });
      const swatch = this.createElement('div', {
        className: 'w-full aspect-square rounded mb-1',
        attributes: { style: `background: ${dye.hex};` },
      });
      const name = this.createElement('span', {
        className: 'text-xs truncate block',
        textContent: dye.name,
        attributes: { style: 'color: var(--theme-text);' },
      });
      btn.appendChild(swatch);
      btn.appendChild(name);

      btn.addEventListener('click', () => {
        this.selectedDye = dye;
        this.update();
      });

      grid.appendChild(btn);
    });

    container.appendChild(grid);
    return container;
  }

  // Create harmony type selector
  private createHarmonyTypeSelector(): HTMLElement {
    const container = this.createElement('div', {
      className: 'space-y-1 max-h-48 overflow-y-auto',
    });

    HARMONY_TYPES.forEach((type) => {
      const isSelected = this.selectedHarmonyType === type.id;
      const btn = this.createElement('button', {
        className:
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all text-sm',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent; color: var(--theme-text);',
        },
      });

      const indicator = this.createElement('span', {
        className: 'w-2 h-2 rounded-full',
        attributes: {
          style: isSelected ? 'background: currentColor;' : 'background: var(--theme-border);',
        },
      });
      const name = this.createElement('span', { textContent: type.name });

      btn.appendChild(indicator);
      btn.appendChild(name);

      btn.addEventListener('click', () => {
        this.selectedHarmonyType = type.id;
        this.update();
      });

      container.appendChild(btn);
    });

    return container;
  }

  // Create companion count slider
  private createCompanionSlider(): HTMLElement {
    const container = this.createElement('div', { className: 'flex items-center gap-3' });

    const slider = this.createElement('input', {
      attributes: { type: 'range', min: '3', max: '8', value: String(this.companionCount) },
      className: 'flex-1',
    }) as HTMLInputElement;

    const display = this.createElement('span', {
      className: 'text-sm font-mono w-6 text-center',
      textContent: String(this.companionCount),
      attributes: { style: 'color: var(--theme-text);' },
    });

    slider.addEventListener('input', () => {
      this.companionCount = parseInt(slider.value, 10);
      display.textContent = String(this.companionCount);
    });

    container.appendChild(slider);
    container.appendChild(display);
    return container;
  }

  // Create filters content
  private createFiltersContent(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });
    const filters = ['Exclude Metallic', 'Exclude Pastel', 'Exclude Expensive'];

    filters.forEach((filter) => {
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });
      const checkbox = this.createElement('input', {
        attributes: { type: 'checkbox' },
        className: 'w-4 h-4 rounded',
      });
      const text = this.createElement('span', {
        className: 'text-sm',
        textContent: filter,
        attributes: { style: 'color: var(--theme-text);' },
      });
      label.appendChild(checkbox);
      label.appendChild(text);
      container.appendChild(label);
    });

    return container;
  }

  // Create market board content
  private createMarketContent(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });

    // Data center selector
    const dcGroup = this.createElement('div');
    const dcLabel = this.createElement('label', {
      className: 'block text-xs mb-1',
      textContent: 'Data Center',
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    const dcSelect = this.createElement('select', {
      className: 'w-full p-2 rounded text-sm',
      attributes: {
        style:
          'background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);',
      },
    });
    dcSelect.innerHTML = '<option>Aether</option><option>Primal</option><option>Crystal</option>';
    dcGroup.appendChild(dcLabel);
    dcGroup.appendChild(dcSelect);
    container.appendChild(dcGroup);

    // Show prices toggle
    const priceToggle = this.createElement('label', {
      className: 'flex items-center gap-2 cursor-pointer',
    });
    const priceCheckbox = this.createElement('input', {
      attributes: { type: 'checkbox' },
      className: 'w-4 h-4 rounded',
    });
    const priceText = this.createElement('span', {
      className: 'text-sm',
      textContent: 'Show Prices',
      attributes: { style: 'color: var(--theme-text);' },
    });
    priceToggle.appendChild(priceCheckbox);
    priceToggle.appendChild(priceText);
    container.appendChild(priceToggle);

    return container;
  }

  // Create color wheel visualization
  private createColorWheel(): HTMLElement {
    const container = this.createElement('div', {
      className: 'flex justify-center',
    });

    const wheel = this.createElement('div', {
      className: 'relative w-48 h-48',
    });

    // Create SVG color wheel
    const baseHue = this.selectedDye ? this.getHueFromHex(this.selectedDye.hex) : 0;
    const harmonyType = HARMONY_TYPES.find((t) => t.id === this.selectedHarmonyType);
    const degrees = harmonyType?.degrees ?? [];

    wheel.innerHTML = `
      <svg viewBox="0 0 100 100" class="w-full h-full">
        <!-- Outer ring (color wheel) -->
        <defs>
          <linearGradient id="wheelGrad">
            ${Array.from({ length: 12 }, (_, i) => {
              const hue = i * 30;
              return `<stop offset="${(i / 12) * 100}%" stop-color="hsl(${hue}, 70%, 50%)" />`;
            }).join('')}
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="none" stroke="url(#wheelGrad)" stroke-width="8" opacity="0.3" />

        <!-- Center circle (theme background) -->
        <circle cx="50" cy="50" r="35" fill="var(--theme-card-background)" stroke="var(--theme-border)" stroke-width="1" />

        <!-- Base color marker -->
        ${
          this.selectedDye
            ? `
          <circle cx="${50 + 40 * Math.cos(((baseHue - 90) * Math.PI) / 180)}"
                  cy="${50 + 40 * Math.sin(((baseHue - 90) * Math.PI) / 180)}"
                  r="6" fill="${this.selectedDye.hex}" stroke="white" stroke-width="2" />
        `
            : ''
        }

        <!-- Harmony markers -->
        ${degrees
          .map((deg) => {
            const angle = ((baseHue + deg - 90) * Math.PI) / 180;
            return `<circle cx="${50 + 40 * Math.cos(angle)}"
                          cy="${50 + 40 * Math.sin(angle)}"
                          r="4" fill="var(--theme-primary)" stroke="white" stroke-width="1.5" />`;
          })
          .join('')}

        <!-- Center text -->
        <text x="50" y="48" text-anchor="middle" font-size="6" fill="var(--theme-text)">${harmonyType?.name ?? ''}</text>
        <text x="50" y="56" text-anchor="middle" font-size="4" fill="var(--theme-text-muted)">${degrees.length + 1} colors</text>
      </svg>
    `;

    container.appendChild(wheel);
    return container;
  }

  // Create harmony result cards
  private createHarmonyCards(container: HTMLElement): void {
    if (!this.selectedDye) return;

    const harmonyType = HARMONY_TYPES.find((t) => t.id === this.selectedHarmonyType);
    const degrees = harmonyType?.degrees ?? [];

    // Generate harmony colors
    const baseHue = this.getHueFromHex(this.selectedDye.hex);
    const colors = [
      this.selectedDye.hex,
      ...degrees.map((deg) => this.hueToHex((baseHue + deg) % 360)),
    ];

    colors.forEach((color, index) => {
      const card = this.createElement('div', {
        className: 'p-4 rounded-lg',
        attributes: {
          style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
        },
      });

      // Card header
      const header = this.createElement('div', {
        className: 'flex items-center justify-between mb-3',
      });
      const title = this.createElement('span', {
        className: 'text-sm font-medium',
        textContent: index === 0 ? 'Base' : `Harmony ${index}`,
        attributes: { style: 'color: var(--theme-text);' },
      });
      const hexBadge = this.createElement('span', {
        className: 'text-xs font-mono px-2 py-0.5 rounded',
        textContent: color.toUpperCase(),
        attributes: {
          style: 'background: var(--theme-background-secondary); color: var(--theme-text-muted);',
        },
      });
      header.appendChild(title);
      header.appendChild(hexBadge);
      card.appendChild(header);

      // Color swatch
      const swatch = this.createElement('div', {
        className: 'w-full h-16 rounded-lg mb-3',
        attributes: { style: `background: ${color};` },
      });
      card.appendChild(swatch);

      // Matched dyes (simulated)
      const matchedLabel = this.createElement('p', {
        className: 'text-xs mb-2',
        textContent: 'Closest dyes:',
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      card.appendChild(matchedLabel);

      const matchedGrid = this.createElement('div', { className: 'flex gap-1' });
      for (let i = 0; i < Math.min(this.companionCount, 4); i++) {
        const matchSwatch = this.createElement('div', {
          className: 'w-6 h-6 rounded',
          attributes: {
            style: `background: ${this.adjustColor(color, i * 10)};`,
            title: `Match ${i + 1}`,
          },
        });
        matchedGrid.appendChild(matchSwatch);
      }
      if (this.companionCount > 4) {
        const more = this.createElement('span', {
          className: 'w-6 h-6 flex items-center justify-center text-xs rounded',
          textContent: `+${this.companionCount - 4}`,
          attributes: {
            style: 'background: var(--theme-background-secondary); color: var(--theme-text-muted);',
          },
        });
        matchedGrid.appendChild(more);
      }
      card.appendChild(matchedGrid);

      container.appendChild(card);
    });
  }

  // Create empty state
  private createEmptyState(): HTMLElement {
    const empty = this.createElement('div', {
      className: 'col-span-full p-8 rounded-lg border-2 border-dashed text-center',
      attributes: {
        style: 'border-color: var(--theme-border); background: var(--theme-card-background);',
      },
    });
    empty.innerHTML = `
      <svg class="w-12 h-12 mx-auto mb-3 opacity-30" style="color: var(--theme-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
      <p style="color: var(--theme-text);">Select a dye to see harmony results</p>
    `;
    return empty;
  }

  // Utility: Get hue from hex color
  private getHueFromHex(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }
    return Math.round(h * 360);
  }

  // Utility: Convert hue to hex
  private hueToHex(hue: number): string {
    const h = hue / 360;
    const s = 0.6;
    const l = 0.5;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(this.hue2rgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(this.hue2rgb(p, q, h) * 255);
    const b = Math.round(this.hue2rgb(p, q, h - 1 / 3) * 255);
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  private hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  // Utility: Adjust color for simulated matches
  private adjustColor(hex: string, offset: number): string {
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + offset));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + offset));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) - offset));
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  bindEvents(): void {
    // Events bound inline during render
  }

  destroy(): void {
    this.filtersPanel?.destroy();
    this.marketPanel?.destroy();
    super.destroy();
  }
}
