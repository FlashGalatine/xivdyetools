/**
 * XIV Dye Tools v3.0.0 - Color Matcher Mockup
 *
 * Two-panel layout mockup for the Color Matcher tool.
 * Left: Image upload, color picker, sample size, palette mode, filters
 * Right: Image canvas with zoom, matched dye results, recent colors
 *
 * @module mockups/tools/MatcherMockup
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { clearContainer } from '@shared/utils';

// SVG Icons
const ICON_UPLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
</svg>`;

const ICON_EYEDROPPER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
</svg>`;

const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
</svg>`;

const ICON_MARKET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
</svg>`;

/**
 * Sample matched dyes
 */
const SAMPLE_MATCHED_DYES = [
  { name: 'Dalamud Red', hex: '#E85A5A', distance: 2.3 },
  { name: 'Coral Pink', hex: '#E87A7A', distance: 5.1 },
  { name: 'Salmon Pink', hex: '#E89A8A', distance: 8.7 },
  { name: 'Wine Red', hex: '#C84A4A', distance: 12.4 },
];

/**
 * Recent colors
 */
const RECENT_COLORS = ['#E85A5A', '#4AC0B0', '#7A58A6', '#E8C44A', '#7AC07A'];

export interface MatcherMockupOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Color Matcher Mockup - Two-panel layout demonstration
 */
export class MatcherMockup extends BaseComponent {
  private options: MatcherMockupOptions;
  private selectedColor: string = '#E85A5A';
  private sampleSize: number = 5;
  private paletteMode: boolean = false;
  private filtersPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;

  constructor(container: HTMLElement, options: MatcherMockupOptions) {
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

    // Section 1: Image Upload
    const uploadSection = this.createSection('Image Source');
    uploadSection.appendChild(this.createImageUpload());
    left.appendChild(uploadSection);

    // Section 2: Color Picker
    const colorSection = this.createSection('Color Selection');
    colorSection.appendChild(this.createColorPicker());
    left.appendChild(colorSection);

    // Section 3: Options
    const optionsSection = this.createSection('Options');
    optionsSection.appendChild(this.createOptions());
    left.appendChild(optionsSection);

    // Collapsible: Dye Filters
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    this.filtersPanel = new CollapsiblePanel(filtersContainer, {
      title: 'Dye Filters',
      storageKey: 'matcher_mockup_filters',
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
      storageKey: 'matcher_mockup_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.marketPanel.init();
    this.marketPanel.setContent(this.createMarketContent());
  }

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Image Canvas with Zoom Controls
    const canvasSection = this.createElement('div', { className: 'mb-6' });
    canvasSection.appendChild(this.createImageCanvas());
    right.appendChild(canvasSection);

    // Matched Dye Results
    const resultsSection = this.createElement('div', { className: 'mb-6' });
    const resultsHeader = this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: 'Matched Dyes',
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    resultsSection.appendChild(resultsHeader);
    resultsSection.appendChild(this.createMatchedResults());
    right.appendChild(resultsSection);

    // Recent Colors
    const recentSection = this.createElement('div');
    const recentHeader = this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: 'Recent Colors',
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    recentSection.appendChild(recentHeader);
    recentSection.appendChild(this.createRecentColors());
    right.appendChild(recentSection);
  }

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    const content = this.createElement('div', { className: 'p-4' });
    content.innerHTML = `
      <div class="flex items-center gap-3 p-3 rounded-lg" style="background: var(--theme-background-secondary);">
        <div class="w-10 h-10 rounded-lg" style="background: ${this.selectedColor};"></div>
        <div>
          <p class="font-medium" style="color: var(--theme-text);">Selected Color</p>
          <p class="text-xs font-mono" style="color: var(--theme-text-muted);">${this.selectedColor}</p>
        </div>
      </div>
    `;
    drawer.appendChild(content);
  }

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

  private createImageUpload(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });

    // Drop zone
    const dropZone = this.createElement('div', {
      className:
        'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors hover:border-opacity-70',
      attributes: {
        style: 'border-color: var(--theme-border); background: var(--theme-background-secondary);',
      },
    });
    dropZone.innerHTML = `
      <span class="w-10 h-10 mx-auto mb-2 block opacity-50" style="color: var(--theme-text);">${ICON_UPLOAD}</span>
      <p class="text-sm font-medium" style="color: var(--theme-text);">Drop image here</p>
      <p class="text-xs mt-1" style="color: var(--theme-text-muted);">or click to browse</p>
    `;
    container.appendChild(dropZone);

    // Action buttons
    const actions = this.createElement('div', { className: 'flex gap-2' });
    ['Camera', 'Paste'].forEach((action) => {
      const btn = this.createElement('button', {
        className: 'flex-1 px-3 py-2 text-sm rounded-lg transition-colors',
        textContent: action,
        attributes: {
          style:
            'background: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);',
        },
      });
      actions.appendChild(btn);
    });
    container.appendChild(actions);

    return container;
  }

  private createColorPicker(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });

    // Current color display
    const colorDisplay = this.createElement('div', {
      className: 'flex items-center gap-3 p-3 rounded-lg',
      attributes: { style: 'background: var(--theme-background-secondary);' },
    });
    const swatch = this.createElement('div', {
      className: 'w-12 h-12 rounded-lg border',
      attributes: {
        style: `background: ${this.selectedColor}; border-color: var(--theme-border);`,
      },
    });
    const colorInfo = this.createElement('div');
    colorInfo.innerHTML = `
      <p class="text-xs" style="color: var(--theme-text-muted);">Current Color</p>
      <p class="font-mono text-lg" style="color: var(--theme-text);">${this.selectedColor}</p>
    `;
    colorDisplay.appendChild(swatch);
    colorDisplay.appendChild(colorInfo);
    container.appendChild(colorDisplay);

    // Hex input
    const hexInput = this.createElement('div', { className: 'flex gap-2' });
    const input = this.createElement('input', {
      attributes: { type: 'text', value: this.selectedColor, placeholder: '#RRGGBB' },
      className: 'flex-1 px-3 py-2 rounded-lg text-sm font-mono',
    });
    input.setAttribute(
      'style',
      'background: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);'
    );
    const eyedropperBtn = this.createElement('button', {
      className: 'px-3 py-2 rounded-lg transition-colors',
      innerHTML: `<span class="w-5 h-5 block">${ICON_EYEDROPPER}</span>`,
      attributes: {
        style: 'background: var(--theme-primary); color: var(--theme-text-header);',
        title: 'Pick from image',
      },
    });
    hexInput.appendChild(input);
    hexInput.appendChild(eyedropperBtn);
    container.appendChild(hexInput);

    return container;
  }

  private createOptions(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-4' });

    // Sample size slider
    const sampleGroup = this.createElement('div');
    const sampleLabel = this.createElement('label', {
      className: 'flex items-center justify-between text-sm mb-2',
    });
    sampleLabel.innerHTML = `<span style="color: var(--theme-text);">Sample Size</span><span class="font-mono" style="color: var(--theme-text-muted);">${this.sampleSize}px</span>`;
    const sampleSlider = this.createElement('input', {
      attributes: { type: 'range', min: '1', max: '10', value: String(this.sampleSize) },
      className: 'w-full',
    });
    sampleGroup.appendChild(sampleLabel);
    sampleGroup.appendChild(sampleSlider);
    container.appendChild(sampleGroup);

    // Palette mode toggle
    const paletteToggle = this.createElement('label', {
      className: 'flex items-center gap-3 cursor-pointer',
    });
    const checkbox = this.createElement('input', {
      attributes: { type: 'checkbox' },
      className: 'w-5 h-5 rounded',
    });
    const toggleText = this.createElement('div');
    toggleText.innerHTML = `
      <p class="text-sm font-medium" style="color: var(--theme-text);">Extract Palette</p>
      <p class="text-xs" style="color: var(--theme-text-muted);">Get multiple colors from image</p>
    `;
    paletteToggle.appendChild(checkbox);
    paletteToggle.appendChild(toggleText);
    container.appendChild(paletteToggle);

    return container;
  }

  private createFiltersContent(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });
    ['Exclude Metallic', 'Exclude Pastel', 'Exclude Expensive'].forEach((filter) => {
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });
      label.innerHTML = `
        <input type="checkbox" class="w-4 h-4 rounded">
        <span class="text-sm" style="color: var(--theme-text);">${filter}</span>
      `;
      container.appendChild(label);
    });
    return container;
  }

  private createMarketContent(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });
    container.innerHTML = `
      <div>
        <label class="block text-xs mb-1" style="color: var(--theme-text-muted);">Data Center</label>
        <select class="w-full p-2 rounded text-sm" style="background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);">
          <option>Aether</option><option>Primal</option><option>Crystal</option>
        </select>
      </div>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" class="w-4 h-4 rounded">
        <span class="text-sm" style="color: var(--theme-text);">Show Prices</span>
      </label>
    `;
    return container;
  }

  private createImageCanvas(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });

    // Zoom controls
    const controls = this.createElement('div', {
      className: 'flex items-center justify-between p-2 rounded-lg',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });
    controls.innerHTML = `
      <div class="flex gap-1">
        <button class="px-2 py-1 text-sm rounded" style="background: var(--theme-background-secondary); color: var(--theme-text);">-</button>
        <span class="px-3 py-1 text-sm font-mono" style="color: var(--theme-text);">100%</span>
        <button class="px-2 py-1 text-sm rounded" style="background: var(--theme-background-secondary); color: var(--theme-text);">+</button>
      </div>
      <div class="flex gap-1">
        <button class="px-2 py-1 text-xs rounded" style="background: var(--theme-background-secondary); color: var(--theme-text);">Fit</button>
        <button class="px-2 py-1 text-xs rounded" style="background: var(--theme-background-secondary); color: var(--theme-text);">1:1</button>
      </div>
    `;
    container.appendChild(controls);

    // Canvas placeholder
    const canvas = this.createElement('div', {
      className: 'aspect-video rounded-lg flex items-center justify-center',
      attributes: {
        style:
          'background: var(--theme-background-secondary); border: 2px dashed var(--theme-border);',
      },
    });
    canvas.innerHTML = `
      <div class="text-center">
        <span class="w-16 h-16 mx-auto mb-3 block opacity-30" style="color: var(--theme-text);">${ICON_UPLOAD}</span>
        <p class="text-sm" style="color: var(--theme-text-muted);">Upload an image to start matching</p>
      </div>
    `;
    container.appendChild(canvas);

    return container;
  }

  private createMatchedResults(): HTMLElement {
    const container = this.createElement('div', { className: 'grid gap-3 sm:grid-cols-2' });

    SAMPLE_MATCHED_DYES.forEach((dye, index) => {
      const card = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg',
        attributes: {
          style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
        },
      });

      const rank = this.createElement('span', {
        className: 'w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full',
        textContent: String(index + 1),
        attributes: {
          style:
            index === 0
              ? 'background: var(--theme-primary); color: var(--theme-text-header);'
              : 'background: var(--theme-background-secondary); color: var(--theme-text-muted);',
        },
      });

      const swatch = this.createElement('div', {
        className: 'w-10 h-10 rounded-lg',
        attributes: { style: `background: ${dye.hex};` },
      });

      const info = this.createElement('div', { className: 'flex-1 min-w-0' });
      info.innerHTML = `
        <p class="text-sm font-medium truncate" style="color: var(--theme-text);">${dye.name}</p>
        <p class="text-xs" style="color: var(--theme-text-muted);">Distance: ${dye.distance}</p>
      `;

      card.appendChild(rank);
      card.appendChild(swatch);
      card.appendChild(info);
      container.appendChild(card);
    });

    return container;
  }

  private createRecentColors(): HTMLElement {
    const container = this.createElement('div', { className: 'flex gap-2' });

    RECENT_COLORS.forEach((color) => {
      const btn = this.createElement('button', {
        className: 'w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110',
        attributes: {
          style: `background: ${color}; border-color: var(--theme-border);`,
          title: color,
        },
      });
      container.appendChild(btn);
    });

    return container;
  }

  bindEvents(): void {}

  destroy(): void {
    this.filtersPanel?.destroy();
    this.marketPanel?.destroy();
    super.destroy();
  }
}
