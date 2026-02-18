/**
 * XIV Dye Tools v3.0.0 - Dye Mixer Mockup
 *
 * Two-panel layout mockup for the Dye Mixer tool.
 * Left: Start/End dye selectors, steps slider, color space toggle, filters
 * Right: Interpolation gradient, intermediate dye matches, palette export
 *
 * @module mockups/tools/MixerMockup
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { clearContainer } from '@shared/utils';

const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
</svg>`;

const ICON_MARKET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
</svg>`;

const ICON_EXPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
</svg>`;

export interface MixerMockupOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

export class MixerMockup extends BaseComponent {
  private options: MixerMockupOptions;
  private startDye = { name: 'Dalamud Red', hex: '#E85A5A' };
  private endDye = { name: 'Turquoise Blue', hex: '#4AC0B0' };
  private steps = 5;
  private colorSpace: 'rgb' | 'hsv' = 'rgb';
  private filtersPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;

  constructor(container: HTMLElement, options: MixerMockupOptions) {
    super(container);
    this.options = options;
  }

  renderContent(): void {
    this.renderLeftPanel();
    this.renderRightPanel();
    if (this.options.drawerContent) this.renderDrawerContent();
    this.element = this.container;
  }

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Start Dye
    left.appendChild(this.createDyeSection('Start Dye', this.startDye));

    // End Dye
    left.appendChild(this.createDyeSection('End Dye', this.endDye));

    // Interpolation Settings
    const settingsSection = this.createSection('Interpolation');
    settingsSection.appendChild(this.createSettings());
    left.appendChild(settingsSection);

    // Collapsible: Filters
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    this.filtersPanel = new CollapsiblePanel(filtersContainer, {
      title: 'Dye Filters',
      storageKey: 'mixer_mockup_filters',
      defaultOpen: false,
      icon: ICON_FILTER,
    });
    this.filtersPanel.init();
    this.filtersPanel.setContent(this.createFiltersContent());

    // Collapsible: Market
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    this.marketPanel = new CollapsiblePanel(marketContainer, {
      title: 'Market Board',
      storageKey: 'mixer_mockup_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.marketPanel.init();
    this.marketPanel.setContent(this.createMarketContent());
  }

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Gradient Preview
    const gradientSection = this.createElement('div', { className: 'mb-6' });
    gradientSection.appendChild(this.createHeader('Interpolation Preview'));
    gradientSection.appendChild(this.createGradientPreview());
    right.appendChild(gradientSection);

    // Intermediate Matches
    const matchesSection = this.createElement('div', { className: 'mb-6' });
    matchesSection.appendChild(this.createHeader('Intermediate Dye Matches'));
    matchesSection.appendChild(this.createIntermediateMatches());
    right.appendChild(matchesSection);

    // Export
    const exportSection = this.createElement('div');
    exportSection.appendChild(this.createExportOptions());
    right.appendChild(exportSection);
  }

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    clearContainer(this.options.drawerContent);
    this.options.drawerContent.innerHTML = `
      <div class="p-4 space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded" style="background: ${this.startDye.hex};"></div>
          <span style="color: var(--theme-text-muted);">→</span>
          <div class="w-8 h-8 rounded" style="background: ${this.endDye.hex};"></div>
        </div>
        <p class="text-sm" style="color: var(--theme-text-muted);">${this.steps} steps, ${this.colorSpace.toUpperCase()}</p>
      </div>
    `;
  }

  private createSection(label: string): HTMLElement {
    const section = this.createElement('div', {
      className: 'p-4 border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });
    section.appendChild(
      this.createElement('h3', {
        className: 'text-sm font-semibold uppercase tracking-wider mb-3',
        textContent: label,
        attributes: { style: 'color: var(--theme-text-muted);' },
      })
    );
    return section;
  }

  private createHeader(text: string): HTMLElement {
    return this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: text,
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
  }

  private createDyeSection(label: string, dye: { name: string; hex: string }): HTMLElement {
    const section = this.createElement('div', {
      className: 'p-4 border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });
    section.innerHTML = `
      <h3 class="text-sm font-semibold uppercase tracking-wider mb-3" style="color: var(--theme-text-muted);">${label}</h3>
      <div class="flex items-center gap-3 p-3 rounded-lg" style="background: var(--theme-primary);">
        <div class="w-10 h-10 rounded border-2 border-white/30" style="background: ${dye.hex};"></div>
        <div>
          <p class="font-medium" style="color: var(--theme-text-header) !important;">${dye.name}</p>
          <p class="text-xs opacity-80 font-mono" style="color: var(--theme-text-header) !important;">${dye.hex}</p>
        </div>
      </div>
      <button class="w-full mt-2 p-2 text-sm rounded-lg" style="background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);">
        Change Dye
      </button>
    `;
    return section;
  }

  private createSettings(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-4' });

    // Steps slider
    const stepsGroup = this.createElement('div');
    stepsGroup.innerHTML = `
      <label class="flex items-center justify-between text-sm mb-2">
        <span style="color: var(--theme-text);">Steps</span>
        <span class="font-mono" style="color: var(--theme-text-muted);">${this.steps}</span>
      </label>
      <input type="range" min="2" max="10" value="${this.steps}" class="w-full">
    `;
    container.appendChild(stepsGroup);

    // Color space toggle
    const spaceGroup = this.createElement('div');
    spaceGroup.innerHTML = `
      <label class="block text-sm mb-2" style="color: var(--theme-text);">Color Space</label>
      <div class="flex gap-2">
        <button class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors" style="background: ${this.colorSpace === 'rgb' ? 'var(--theme-primary)' : 'var(--theme-background-secondary)'}; color: ${this.colorSpace === 'rgb' ? 'var(--theme-text-header)' : 'var(--theme-text)'};">RGB</button>
        <button class="flex-1 px-3 py-2 text-sm rounded-lg transition-colors" style="background: ${this.colorSpace === 'hsv' ? 'var(--theme-primary)' : 'var(--theme-background-secondary)'}; color: ${this.colorSpace === 'hsv' ? 'var(--theme-text-header)' : 'var(--theme-text)'};">HSV</button>
      </div>
    `;
    container.appendChild(spaceGroup);

    return container;
  }

  private createFiltersContent(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });
    ['Exclude Metallic', 'Exclude Pastel'].forEach((filter) => {
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });
      label.innerHTML = `<input type="checkbox" class="w-4 h-4 rounded"><span class="text-sm" style="color: var(--theme-text);">${filter}</span>`;
      container.appendChild(label);
    });
    return container;
  }

  private createMarketContent(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });
    container.innerHTML = `
      <select class="w-full p-2 rounded text-sm" style="background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);">
        <option>Aether</option><option>Primal</option><option>Crystal</option>
      </select>
    `;
    return container;
  }

  private createGradientPreview(): HTMLElement {
    const container = this.createElement('div', {
      className: 'p-4 rounded-lg',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    // Gradient bar
    const gradient = this.createElement('div', {
      className: 'h-16 rounded-lg mb-3',
      attributes: {
        style: `background: linear-gradient(to right, ${this.startDye.hex}, ${this.endDye.hex});`,
      },
    });
    container.appendChild(gradient);

    // Step markers
    const markers = this.createElement('div', { className: 'flex justify-between' });
    for (let i = 0; i <= this.steps; i++) {
      const t = i / this.steps;
      const color = this.interpolateColor(this.startDye.hex, this.endDye.hex, t);
      const marker = this.createElement('div', { className: 'text-center' });
      marker.innerHTML = `
        <div class="w-8 h-8 rounded mx-auto mb-1" style="background: ${color};"></div>
        <span class="text-xs font-mono" style="color: var(--theme-text-muted);">${i}</span>
      `;
      markers.appendChild(marker);
    }
    container.appendChild(markers);

    return container;
  }

  private createIntermediateMatches(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });

    for (let i = 1; i < this.steps; i++) {
      const t = i / this.steps;
      const targetColor = this.interpolateColor(this.startDye.hex, this.endDye.hex, t);

      const row = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg',
        attributes: {
          style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
        },
      });

      row.innerHTML = `
        <span class="w-6 text-center font-medium" style="color: var(--theme-text-muted);">${i}</span>
        <div class="w-10 h-10 rounded border" style="background: ${targetColor}; border-color: var(--theme-border);" title="Target"></div>
        <span style="color: var(--theme-text-muted);">→</span>
        <div class="w-10 h-10 rounded" style="background: ${this.adjustColor(targetColor, 5)};" title="Best Match"></div>
        <div class="flex-1">
          <p class="text-sm font-medium" style="color: var(--theme-text);">Closest Match ${i}</p>
          <p class="text-xs" style="color: var(--theme-text-muted);">Distance: ${(Math.random() * 5).toFixed(1)}</p>
        </div>
      `;

      container.appendChild(row);
    }

    return container;
  }

  private createExportOptions(): HTMLElement {
    const container = this.createElement('div', {
      className: 'p-4 rounded-lg flex items-center justify-between',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    container.innerHTML = `
      <span class="text-sm font-medium" style="color: var(--theme-text);">Export Palette</span>
      <div class="flex gap-2">
        <button class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg" style="background: var(--theme-background-secondary); color: var(--theme-text);">
          <span class="w-4 h-4">${ICON_EXPORT}</span> Copy
        </button>
        <button class="flex items-center gap-2 px-3 py-2 text-sm rounded-lg" style="background: var(--theme-primary); color: var(--theme-text-header);">
          <span class="w-4 h-4">${ICON_EXPORT}</span> Download
        </button>
      </div>
    `;

    return container;
  }

  private interpolateColor(start: string, end: string, t: number): string {
    const r1 = parseInt(start.slice(1, 3), 16);
    const g1 = parseInt(start.slice(3, 5), 16);
    const b1 = parseInt(start.slice(5, 7), 16);
    const r2 = parseInt(end.slice(1, 3), 16);
    const g2 = parseInt(end.slice(3, 5), 16);
    const b2 = parseInt(end.slice(5, 7), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  private adjustColor(hex: string, offset: number): string {
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + offset));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + offset));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) - offset));
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }

  bindEvents(): void {}
  destroy(): void {
    this.filtersPanel?.destroy();
    this.marketPanel?.destroy();
    super.destroy();
  }
}
