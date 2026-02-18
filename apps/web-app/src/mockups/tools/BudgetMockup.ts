/**
 * XIV Dye Tools v3.0.0 - Budget Suggestions Mockup
 *
 * Two-panel layout mockup for the Budget-Aware Suggestions tool.
 * Find affordable dye alternatives that are similar to expensive dyes.
 *
 * Left: Target dye selector, quick picks, budget slider, sort options, filters
 * Right: Target overview, alternatives list with price/savings display
 *
 * @module mockups/tools/BudgetMockup
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '../CollapsiblePanel';
import { clearContainer } from '@shared/utils';

// SVG Icons
const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
</svg>`;

const ICON_CURRENCY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>`;

const ICON_SORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
</svg>`;

/**
 * Popular expensive dyes for quick picks
 */
const POPULAR_EXPENSIVE_DYES = [
  { name: 'Jet Black', hex: '#0A0A0A', avgPrice: 200000 },
  { name: 'Pure White', hex: '#FFFFFF', avgPrice: 180000 },
  { name: 'Metallic Gold', hex: '#D4AF37', avgPrice: 150000 },
  { name: 'Metallic Silver', hex: '#C0C0C0', avgPrice: 120000 },
  { name: 'Gunmetal Black', hex: '#1A1A20', avgPrice: 80000 },
  { name: 'Snow White', hex: '#F8F8F8', avgPrice: 60000 },
];

/**
 * Budget slider tick marks (logarithmic scale)
 */
const BUDGET_TICKS = [
  { value: 0, label: '0' },
  { value: 1000, label: '1K' },
  { value: 10000, label: '10K' },
  { value: 50000, label: '50K' },
  { value: 100000, label: '100K' },
  { value: 500000, label: '500K' },
  { value: 1000000, label: '1M' },
];

/**
 * Sample alternatives for mockup display
 */
const SAMPLE_ALTERNATIVES = [
  { name: 'Soot Black', hex: '#0D0D0D', distance: 5.2, price: 500, savings: 199500 },
  { name: 'Ink Blue', hex: '#0E0E14', distance: 12.3, price: 800, savings: 199200 },
  { name: 'Gunmetal Black', hex: '#1A1A20', distance: 18.7, price: 1200, savings: 198800 },
  { name: 'Charcoal Grey', hex: '#252525', distance: 24.1, price: 600, savings: 199400 },
  { name: 'Slate Grey', hex: '#2E2E2E', distance: 32.5, price: 400, savings: 199600 },
];

export interface BudgetMockupOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Budget Suggestions Mockup - Two-panel layout demonstration
 */
export class BudgetMockup extends BaseComponent {
  private options: BudgetMockupOptions;
  private targetDye = POPULAR_EXPENSIVE_DYES[0]; // Default to Jet Black
  private budgetLimit = 50000;
  private sortBy: 'match' | 'price' | 'value' = 'match';
  private filtersPanel: CollapsiblePanel | null = null;

  constructor(container: HTMLElement, options: BudgetMockupOptions) {
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

    // Section 1: Target Dye
    left.appendChild(this.createTargetDyeSection());

    // Section 2: Quick Picks
    left.appendChild(this.createQuickPicksSection());

    // Section 3: Budget Limit
    left.appendChild(this.createBudgetSection());

    // Section 4: Sort Options
    left.appendChild(this.createSortSection());

    // Collapsible: Filters
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    this.filtersPanel = new CollapsiblePanel(filtersContainer, {
      title: 'Dye Filters',
      storageKey: 'budget_mockup_filters',
      defaultOpen: false,
      icon: ICON_FILTER,
    });
    this.filtersPanel.init();
    this.filtersPanel.setContent(this.createFiltersContent());

    // Section: Data Center
    left.appendChild(this.createDataCenterSection());
  }

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Target Overview Card
    right.appendChild(this.createTargetOverview());

    // Alternatives Header
    right.appendChild(this.createAlternativesHeader());

    // Alternatives List
    right.appendChild(this.createAlternativesList());
  }

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    clearContainer(this.options.drawerContent);

    const content = this.createElement('div', { className: 'p-4 space-y-4' });

    // Quick summary
    const summary = this.createElement('div', {
      className: 'p-3 rounded-lg',
      attributes: { style: 'background: var(--theme-card-background);' },
    });
    summary.innerHTML = `
      <div class="flex items-center gap-2 mb-2">
        <div class="w-6 h-6 rounded" style="background: ${this.targetDye.hex}; border: 1px solid var(--theme-border);"></div>
        <span class="font-medium" style="color: var(--theme-text);">${this.targetDye.name}</span>
      </div>
      <p class="text-sm" style="color: var(--theme-text-muted);">Budget: ${this.budgetLimit.toLocaleString()} gil</p>
    `;
    content.appendChild(summary);

    this.options.drawerContent.appendChild(content);
  }

  // ============================================================================
  // Left Panel Sections
  // ============================================================================

  private createTargetDyeSection(): HTMLElement {
    const section = this.createSection('Target Dye');

    const card = this.createElement('div', {
      className: 'p-4 rounded-lg',
      attributes: {
        style: `background: ${this.targetDye.hex}; border: 1px solid var(--theme-border);`,
      },
    });

    // Determine text color based on background brightness
    const textColor = this.isLightColor(this.targetDye.hex) ? '#1A1A1A' : '#FFFFFF';

    card.innerHTML = `
      <p class="font-semibold text-lg mb-1" style="color: ${textColor};">${this.targetDye.name}</p>
      <p class="text-sm font-mono mb-2" style="color: ${textColor}; opacity: 0.8;">${this.targetDye.hex}</p>
      <p class="text-sm font-medium" style="color: ${textColor};">
        ~${this.targetDye.avgPrice.toLocaleString()} gil
      </p>
    `;

    const changeBtn = this.createElement('button', {
      className: 'mt-3 w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors',
      textContent: 'Change Dye',
      attributes: {
        style:
          'background: rgba(255,255,255,0.2); color: ' +
          textColor +
          '; backdrop-filter: blur(4px);',
        type: 'button',
      },
    });
    card.appendChild(changeBtn);

    section.appendChild(card);
    return section;
  }

  private createQuickPicksSection(): HTMLElement {
    const section = this.createSection('Quick Picks');

    const grid = this.createElement('div', {
      className: 'grid grid-cols-3 gap-2',
    });

    POPULAR_EXPENSIVE_DYES.forEach((dye) => {
      const isSelected = dye.name === this.targetDye.name;
      const btn = this.createElement('button', {
        className: 'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: var(--theme-card-background); color: var(--theme-text);',
          type: 'button',
          title: `${dye.name} (~${dye.avgPrice.toLocaleString()} gil)`,
        },
      });

      btn.innerHTML = `
        <div class="w-6 h-6 rounded" style="background: ${dye.hex}; border: 1px solid var(--theme-border);"></div>
        <span class="text-xs truncate w-full text-center">${dye.name.split(' ')[0]}</span>
      `;

      grid.appendChild(btn);
    });

    section.appendChild(grid);
    return section;
  }

  private createBudgetSection(): HTMLElement {
    const section = this.createSection('Budget Limit');

    // Current value display
    const valueDisplay = this.createElement('div', {
      className: 'flex items-center justify-between mb-3',
    });
    valueDisplay.innerHTML = `
      <span class="text-sm" style="color: var(--theme-text-muted);">Max Price</span>
      <span class="font-semibold" style="color: var(--theme-text);">${this.budgetLimit.toLocaleString()} gil</span>
    `;
    section.appendChild(valueDisplay);

    // Slider
    const slider = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '0',
        max: '1000000',
        value: String(this.budgetLimit),
        step: '1000',
      },
    });
    section.appendChild(slider);

    // Tick labels
    const ticksContainer = this.createElement('div', {
      className: 'flex justify-between mt-1',
    });
    ticksContainer.innerHTML = `
      <span class="text-xs" style="color: var(--theme-text-muted);">0</span>
      <span class="text-xs" style="color: var(--theme-text-muted);">100K</span>
      <span class="text-xs" style="color: var(--theme-text-muted);">500K</span>
      <span class="text-xs" style="color: var(--theme-text-muted);">1M</span>
    `;
    section.appendChild(ticksContainer);

    return section;
  }

  private createSortSection(): HTMLElement {
    const section = this.createSection('Sort By');

    const options = [
      { id: 'match', label: 'Best Match', desc: 'Closest color first' },
      { id: 'price', label: 'Lowest Price', desc: 'Cheapest first' },
      { id: 'value', label: 'Best Value', desc: 'Balance of match + price' },
    ];

    const container = this.createElement('div', { className: 'space-y-2' });

    options.forEach((opt) => {
      const isSelected = this.sortBy === opt.id;
      const label = this.createElement('label', {
        className: 'flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent;',
        },
      });

      const radio = this.createElement('input', {
        className: 'mt-1',
        attributes: {
          type: 'radio',
          name: 'sortBy',
          value: opt.id,
          ...(isSelected && { checked: '' }),
        },
      });

      const text = this.createElement('div');
      text.innerHTML = `
        <span class="font-medium text-sm">${opt.label}</span>
        <p class="text-xs ${isSelected ? '' : 'text-muted'}" style="color: ${isSelected ? 'inherit' : 'var(--theme-text-muted)'};">${opt.desc}</p>
      `;

      label.appendChild(radio);
      label.appendChild(text);
      container.appendChild(label);
    });

    section.appendChild(container);
    return section;
  }

  private createDataCenterSection(): HTMLElement {
    const section = this.createSection('Data Center');

    const select = this.createElement('select', {
      className: 'w-full p-2 rounded text-sm',
      attributes: {
        style:
          'background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);',
      },
    });
    select.innerHTML = `
      <option>North America - Aether</option>
      <option>North America - Primal</option>
      <option>North America - Crystal</option>
      <option>North America - Dynamis</option>
      <option>Europe - Chaos</option>
      <option>Europe - Light</option>
      <option>Japan - Elemental</option>
      <option>Japan - Gaia</option>
      <option>Japan - Mana</option>
      <option>Japan - Meteor</option>
      <option>Oceania - Materia</option>
    `;

    section.appendChild(select);
    return section;
  }

  private createFiltersContent(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });
    const filters = ['Exclude Metallic', 'Exclude Pastel', 'Exclude Stainable-only'];

    filters.forEach((filter) => {
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

  // ============================================================================
  // Right Panel Sections
  // ============================================================================

  private createTargetOverview(): HTMLElement {
    const card = this.createElement('div', {
      className: 'p-4 rounded-lg mb-6',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    card.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-lg flex-shrink-0" style="background: ${this.targetDye.hex}; border: 2px solid var(--theme-border);"></div>
        <div class="flex-1">
          <h3 class="font-semibold text-lg" style="color: var(--theme-text);">${this.targetDye.name}</h3>
          <p class="text-sm font-mono" style="color: var(--theme-text-muted);">${this.targetDye.hex}</p>
        </div>
        <div class="text-right">
          <p class="text-sm" style="color: var(--theme-text-muted);">Market Price</p>
          <p class="font-semibold text-lg" style="color: var(--theme-text);">~${this.targetDye.avgPrice.toLocaleString()} gil</p>
        </div>
      </div>
    `;

    return card;
  }

  private createAlternativesHeader(): HTMLElement {
    const header = this.createElement('div', {
      className: 'flex items-center justify-between mb-4',
    });

    const count = SAMPLE_ALTERNATIVES.filter((a) => a.price <= this.budgetLimit).length;

    header.innerHTML = `
      <h3 class="font-semibold" style="color: var(--theme-text);">
        ${count} alternatives within budget
      </h3>
      <span class="text-sm px-2 py-1 rounded" style="background: var(--theme-background-secondary); color: var(--theme-text-muted);">
        Sorted by: Best Match
      </span>
    `;

    return header;
  }

  private createAlternativesList(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });

    const alternatives = SAMPLE_ALTERNATIVES.filter((a) => a.price <= this.budgetLimit);

    if (alternatives.length === 0) {
      const emptyState = this.createElement('div', {
        className: 'text-center py-8',
      });
      emptyState.innerHTML = `
        <p class="text-lg font-medium mb-2" style="color: var(--theme-text);">No dyes within budget</p>
        <p class="text-sm mb-4" style="color: var(--theme-text-muted);">Try increasing your budget limit</p>
        <p class="text-sm" style="color: var(--theme-text-muted);">
          Closest affordable: <strong>Soot Black</strong> at 500 gil
        </p>
      `;
      container.appendChild(emptyState);
      return container;
    }

    alternatives.forEach((alt, index) => {
      const card = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg transition-colors hover:brightness-95',
        attributes: {
          style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
        },
      });

      // Rank badge
      const rankBadge = this.createElement('div', {
        className:
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
        textContent: String(index + 1),
        attributes: {
          style: 'background: var(--theme-background-secondary); color: var(--theme-text-muted);',
        },
      });

      // Color comparison (target vs alternative)
      const colorCompare = this.createElement('div', {
        className: 'flex gap-1 flex-shrink-0',
      });
      colorCompare.innerHTML = `
        <div class="w-8 h-8 rounded" style="background: ${this.targetDye.hex}; border: 1px solid var(--theme-border);" title="Target"></div>
        <div class="w-8 h-8 rounded" style="background: ${alt.hex}; border: 1px solid var(--theme-border);" title="${alt.name}"></div>
      `;

      // Dye info
      const info = this.createElement('div', {
        className: 'flex-1 min-w-0',
      });
      info.innerHTML = `
        <p class="font-medium truncate" style="color: var(--theme-text);">${alt.name}</p>
        <p class="text-xs" style="color: var(--theme-text-muted);">
          <span class="font-mono">${alt.hex}</span> · Δ${alt.distance.toFixed(1)}
        </p>
      `;

      // Distance bar
      const distanceBar = this.createElement('div', {
        className: 'w-20 flex-shrink-0 hidden sm:block',
      });
      const barWidth = Math.min(100, (alt.distance / 50) * 100);
      distanceBar.innerHTML = `
        <div class="h-2 rounded-full" style="background: var(--theme-background-secondary);">
          <div class="h-full rounded-full" style="background: var(--theme-primary); width: ${barWidth}%;"></div>
        </div>
      `;

      // Price & Savings
      const priceInfo = this.createElement('div', {
        className: 'text-right flex-shrink-0',
      });
      priceInfo.innerHTML = `
        <p class="font-semibold" style="color: var(--theme-text);">${alt.price.toLocaleString()} gil</p>
        <p class="text-xs font-bold" style="color: #22C55E;">Save ${alt.savings.toLocaleString()}</p>
      `;

      card.appendChild(rankBadge);
      card.appendChild(colorCompare);
      card.appendChild(info);
      card.appendChild(distanceBar);
      card.appendChild(priceInfo);

      container.appendChild(card);
    });

    return container;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

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

  private isLightColor(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  bindEvents(): void {
    // Placeholder - in production, wire up slider, radio buttons, etc.
  }

  destroy(): void {
    this.filtersPanel?.destroy();
    super.destroy();
  }
}
