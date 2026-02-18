/**
 * XIV Dye Tools v3.0.0 - Preset Browser Mockup
 *
 * Two-panel layout mockup for the Preset Browser tool.
 * Left: Category filters, sort options, auth status, my submissions
 * Right: Featured presets, preset grid, preset detail view
 *
 * @module mockups/tools/PresetsMockup
 */

import { BaseComponent } from '@components/base-component';
import { clearContainer } from '@shared/utils';

const CATEGORIES = [
  'All',
  'Jobs',
  'Grand Companies',
  'Seasons',
  'Events',
  'Aesthetics',
  'Community',
];

const SAMPLE_PRESETS = [
  {
    name: 'Warrior of Light',
    author: 'Hydaelyn',
    votes: 1234,
    colors: ['#4A90D9', '#F5A623', '#7ED321', '#D0021B'],
  },
  {
    name: 'Autumn Vibes',
    author: 'Eorzea',
    votes: 876,
    colors: ['#D97706', '#B91C1C', '#78350F', '#F59E0B'],
  },
  {
    name: 'Ocean Dreams',
    author: 'Limsa',
    votes: 654,
    colors: ['#0EA5E9', '#06B6D4', '#14B8A6', '#0891B2'],
  },
  {
    name: 'Royal Court',
    author: 'Ishgard',
    votes: 543,
    colors: ['#7C3AED', '#A855F7', '#C084FC', '#E879F9'],
  },
  {
    name: 'Forest Walk',
    author: 'Gridania',
    votes: 432,
    colors: ['#22C55E', '#16A34A', '#15803D', '#4ADE80'],
  },
  {
    name: 'Desert Rose',
    author: 'UlDah',
    votes: 321,
    colors: ['#F43F5E', '#E11D48', '#BE123C', '#FDA4AF'],
  },
];

export interface PresetsMockupOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

export class PresetsMockup extends BaseComponent {
  private options: PresetsMockupOptions;
  private selectedCategory = 'All';
  private sortBy = 'popular';
  private isLoggedIn = false;

  constructor(container: HTMLElement, options: PresetsMockupOptions) {
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

    // Category Filters
    const catSection = this.createSection('Categories');
    catSection.appendChild(this.createCategoryFilters());
    left.appendChild(catSection);

    // Sort Options
    const sortSection = this.createSection('Sort By');
    sortSection.appendChild(this.createSortOptions());
    left.appendChild(sortSection);

    // Auth Status
    const authSection = this.createSection('Account');
    authSection.appendChild(this.createAuthSection());
    left.appendChild(authSection);
  }

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Featured Section
    const featuredSection = this.createElement('div', { className: 'mb-6' });
    featuredSection.appendChild(this.createHeader('Featured Presets'));
    featuredSection.appendChild(this.createFeaturedPresets());
    right.appendChild(featuredSection);

    // All Presets Grid
    const gridSection = this.createElement('div');
    gridSection.appendChild(this.createHeader('All Presets'));
    gridSection.appendChild(this.createPresetGrid());
    right.appendChild(gridSection);
  }

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    clearContainer(this.options.drawerContent);
    this.options.drawerContent.innerHTML = `
      <div class="p-4">
        <p class="text-sm" style="color: var(--theme-text-muted);">
          Category: ${this.selectedCategory}<br>
          Sort: ${this.sortBy}
        </p>
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

  private createCategoryFilters(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-1' });

    CATEGORIES.forEach((cat) => {
      const isSelected = this.selectedCategory === cat;
      const btn = this.createElement('button', {
        className: 'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
        textContent: cat,
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent; color: var(--theme-text);',
        },
      });
      container.appendChild(btn);
    });

    return container;
  }

  private createSortOptions(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });

    [
      { id: 'popular', label: 'Most Popular' },
      { id: 'recent', label: 'Most Recent' },
      { id: 'name', label: 'Alphabetical' },
    ].forEach((opt) => {
      const isSelected = this.sortBy === opt.id;
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });
      label.innerHTML = `
        <input type="radio" name="sort" ${isSelected ? 'checked' : ''} class="w-4 h-4">
        <span class="text-sm" style="color: var(--theme-text);">${opt.label}</span>
      `;
      container.appendChild(label);
    });

    return container;
  }

  private createAuthSection(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-3' });

    if (this.isLoggedIn) {
      container.innerHTML = `
        <div class="flex items-center gap-3 p-3 rounded-lg" style="background: var(--theme-background-secondary);">
          <div class="w-10 h-10 rounded-full" style="background: var(--theme-primary);"></div>
          <div class="flex-1">
            <p class="text-sm font-medium" style="color: var(--theme-text);">Username</p>
            <p class="text-xs" style="color: var(--theme-text-muted);">3 submissions</p>
          </div>
        </div>
        <button class="w-full px-3 py-2 text-sm rounded-lg" style="background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);">
          My Submissions
        </button>
        <button class="w-full px-3 py-2 text-sm rounded-lg" style="background: var(--theme-primary); color: var(--theme-text-header);">
          + Submit Preset
        </button>
      `;
    } else {
      container.innerHTML = `
        <p class="text-sm" style="color: var(--theme-text-muted);">Log in to submit presets and vote</p>
        <button class="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg" style="background: #5865F2; color: white;">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Login with Discord
        </button>
      `;
    }

    return container;
  }

  private createFeaturedPresets(): HTMLElement {
    const container = this.createElement('div', { className: 'grid gap-4 md:grid-cols-2' });

    SAMPLE_PRESETS.slice(0, 2).forEach((preset) => {
      const card = this.createElement('div', {
        className: 'relative p-4 rounded-lg overflow-hidden',
        attributes: {
          style: `background: linear-gradient(135deg, ${preset.colors[0]}40, ${preset.colors[2]}40); border: 2px solid ${preset.colors[0]};`,
        },
      });

      card.innerHTML = `
        <div class="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium" style="background: var(--theme-primary); color: var(--theme-text-header);">
          Featured
        </div>
        <h4 class="font-bold text-lg mb-2" style="color: var(--theme-text);">${preset.name}</h4>
        <p class="text-sm mb-3" style="color: var(--theme-text-muted);">by ${preset.author}</p>
        <div class="flex gap-1 mb-3">
          ${preset.colors.map((c) => `<div class="w-8 h-8 rounded" style="background: ${c};"></div>`).join('')}
        </div>
        <div class="flex items-center gap-1 text-sm" style="color: var(--theme-text-muted);">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          ${preset.votes.toLocaleString()}
        </div>
      `;

      container.appendChild(card);
    });

    return container;
  }

  private createPresetGrid(): HTMLElement {
    const grid = this.createElement('div', {
      className: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
    });

    SAMPLE_PRESETS.forEach((preset) => {
      const card = this.createElement('div', {
        className: 'p-4 rounded-lg cursor-pointer transition-transform hover:scale-102',
        attributes: {
          style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
        },
      });

      card.innerHTML = `
        <div class="flex gap-1 mb-3">
          ${preset.colors.map((c) => `<div class="flex-1 h-12 first:rounded-l-lg last:rounded-r-lg" style="background: ${c};"></div>`).join('')}
        </div>
        <h4 class="font-medium text-sm mb-1" style="color: var(--theme-text);">${preset.name}</h4>
        <div class="flex items-center justify-between text-xs" style="color: var(--theme-text-muted);">
          <span>by ${preset.author}</span>
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            ${preset.votes}
          </span>
        </div>
      `;

      grid.appendChild(card);
    });

    return grid;
  }

  bindEvents(): void {}
  destroy(): void {
    super.destroy();
  }
}
