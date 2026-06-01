/**
 * XIV Dye Tools v3.0.0 - Accessibility Checker Mockup
 *
 * Two-panel layout mockup for the Accessibility Checker tool.
 * Left: Dye selector (up to 4), vision type toggles, display options
 * Right: Vision simulation cards, contrast analysis, distinguishability matrix
 *
 * @module mockups/tools/AccessibilityMockup
 */

import { BaseComponent } from '@components/base-component';
import { clearContainer } from '@shared/utils';

const SAMPLE_DYES = [
  { name: 'Dalamud Red', hex: '#E85A5A' },
  { name: 'Turquoise Blue', hex: '#4AC0B0' },
  { name: 'Royal Purple', hex: '#7A58A6' },
  { name: 'Honey Yellow', hex: '#E8C44A' },
];

const VISION_TYPES = [
  { id: 'normal', name: 'Normal Vision', prevalence: '~92%' },
  { id: 'deuteranopia', name: 'Deuteranopia', prevalence: '~6% males' },
  { id: 'protanopia', name: 'Protanopia', prevalence: '~2% males' },
  { id: 'tritanopia', name: 'Tritanopia', prevalence: '~0.01%' },
  { id: 'achromatopsia', name: 'Achromatopsia', prevalence: '~0.003%' },
];

export interface AccessibilityMockupOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

export class AccessibilityMockup extends BaseComponent {
  private options: AccessibilityMockupOptions;
  private selectedDyes = SAMPLE_DYES.slice(0, 2);
  private enabledVisionTypes = new Set(['normal', 'deuteranopia', 'protanopia']);

  constructor(container: HTMLElement, options: AccessibilityMockupOptions) {
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

    // Dye Selection
    const dyeSection = this.createSection('Selected Dyes');
    dyeSection.appendChild(this.createDyeSelector());
    left.appendChild(dyeSection);

    // Vision Types
    const visionSection = this.createSection('Vision Types');
    visionSection.appendChild(this.createVisionToggles());
    left.appendChild(visionSection);

    // Display Options
    const optionsSection = this.createSection('Display Options');
    optionsSection.appendChild(this.createDisplayOptions());
    left.appendChild(optionsSection);
  }

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Vision Simulation Cards
    const simSection = this.createElement('div', { className: 'mb-6' });
    simSection.appendChild(this.createHeader('Vision Simulations'));
    simSection.appendChild(this.createVisionSimulations());
    right.appendChild(simSection);

    // Contrast Analysis
    const contrastSection = this.createElement('div', { className: 'mb-6' });
    contrastSection.appendChild(this.createHeader('Contrast Analysis'));
    contrastSection.appendChild(this.createContrastTable());
    right.appendChild(contrastSection);

    // Distinguishability Matrix
    const matrixSection = this.createElement('div');
    matrixSection.appendChild(this.createHeader('Pairwise Distinguishability'));
    matrixSection.appendChild(this.createDistinguishabilityMatrix());
    right.appendChild(matrixSection);
  }

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    clearContainer(this.options.drawerContent);
    this.options.drawerContent.innerHTML = `
      <div class="p-4">
        <p class="text-sm" style="color: var(--theme-text-muted);">
          ${this.selectedDyes.length} dyes selected, ${this.enabledVisionTypes.size} vision types enabled
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

  private createDyeSelector(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });

    this.selectedDyes.forEach((dye, _i) => {
      const item = this.createElement('div', {
        className: 'flex items-center gap-3 p-2 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });
      item.innerHTML = `
        <div class="w-8 h-8 rounded" style="background: ${dye.hex};"></div>
        <span class="flex-1 text-sm font-medium" style="color: var(--theme-text);">${dye.name}</span>
        <button class="text-xs px-2 py-1 rounded" style="background: var(--theme-card-hover); color: var(--theme-text-muted);">Remove</button>
      `;
      container.appendChild(item);
    });

    if (this.selectedDyes.length < 4) {
      const addBtn = this.createElement('button', {
        className: 'w-full p-3 rounded-lg border-2 border-dashed text-sm',
        textContent: '+ Add Dye (up to 4)',
        attributes: { style: 'border-color: var(--theme-border); color: var(--theme-text-muted);' },
      });
      container.appendChild(addBtn);
    }

    return container;
  }

  private createVisionToggles(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });

    VISION_TYPES.forEach((type) => {
      const isEnabled = this.enabledVisionTypes.has(type.id);
      const label = this.createElement('label', {
        className: 'flex items-center gap-3 cursor-pointer',
      });
      label.innerHTML = `
        <input type="checkbox" ${isEnabled ? 'checked' : ''} class="w-4 h-4 rounded">
        <div class="flex-1">
          <p class="text-sm font-medium" style="color: var(--theme-text);">${type.name}</p>
          <p class="text-xs" style="color: var(--theme-text-muted);">${type.prevalence}</p>
        </div>
      `;
      container.appendChild(label);
    });

    return container;
  }

  private createDisplayOptions(): HTMLElement {
    const container = this.createElement('div', { className: 'space-y-2' });
    ['Show Labels', 'Show Hex Values', 'High Contrast Mode'].forEach((opt) => {
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });
      label.innerHTML = `<input type="checkbox" class="w-4 h-4 rounded"><span class="text-sm" style="color: var(--theme-text);">${opt}</span>`;
      container.appendChild(label);
    });
    return container;
  }

  private createVisionSimulations(): HTMLElement {
    const grid = this.createElement('div', {
      className: 'grid gap-4 md:grid-cols-2 lg:grid-cols-3',
    });

    VISION_TYPES.filter((t) => this.enabledVisionTypes.has(t.id)).forEach((type) => {
      const card = this.createElement('div', {
        className: 'p-4 rounded-lg',
        attributes: {
          style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
        },
      });
      card.innerHTML = `
        <p class="text-sm font-medium mb-3" style="color: var(--theme-text);">${type.name}</p>
        <div class="flex gap-2 mb-2">
          ${this.selectedDyes.map((d) => `<div class="w-10 h-10 rounded" style="background: ${d.hex};" title="${d.name}"></div>`).join('')}
        </div>
        <p class="text-xs" style="color: var(--theme-text-muted);">${type.prevalence}</p>
      `;
      grid.appendChild(card);
    });

    return grid;
  }

  private createContrastTable(): HTMLElement {
    const table = this.createElement('div', {
      className: 'rounded-lg overflow-hidden',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    table.innerHTML = `
      <div class="p-3 border-b" style="border-color: var(--theme-border); background: var(--theme-background-secondary);">
        <div class="grid grid-cols-3 gap-2 text-xs font-medium" style="color: var(--theme-text-muted);">
          <span>Dye</span><span>vs White</span><span>vs Black</span>
        </div>
      </div>
      ${this.selectedDyes
        .map(
          (dye) => `
        <div class="p-3 border-b last:border-b-0" style="border-color: var(--theme-border);">
          <div class="grid grid-cols-3 gap-2 items-center text-sm">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded" style="background: ${dye.hex};"></div>
              <span class="truncate" style="color: var(--theme-text);">${dye.name}</span>
            </div>
            <div class="flex items-center gap-2">
              <span style="color: var(--theme-text);">4.5:1</span>
              <span class="px-1.5 py-0.5 rounded text-xs font-medium" style="background: #3b82f620; color: #3b82f6;">AA</span>
            </div>
            <div class="flex items-center gap-2">
              <span style="color: var(--theme-text);">8.2:1</span>
              <span class="px-1.5 py-0.5 rounded text-xs font-medium" style="background: #22c55e20; color: #22c55e;">AAA</span>
            </div>
          </div>
        </div>
      `
        )
        .join('')}
    `;

    return table;
  }

  private createDistinguishabilityMatrix(): HTMLElement {
    const matrix = this.createElement('div', {
      className: 'rounded-lg p-4',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    let html = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr><th></th>';
    // Column headers with swatch + name
    this.selectedDyes.forEach((d) => {
      html += `<th class="p-2 text-center">
        <div class="w-6 h-6 rounded mx-auto mb-1" style="background: ${d.hex};"></div>
        <span class="text-xs font-normal block truncate max-w-20" style="color: var(--theme-text-muted);">${d.name}</span>
      </th>`;
    });
    html += '</tr></thead><tbody>';

    this.selectedDyes.forEach((dye, i) => {
      // Row header with swatch + name
      html += `<tr>
        <td class="p-2">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded shrink-0" style="background: ${dye.hex};"></div>
            <span class="text-xs truncate max-w-20" style="color: var(--theme-text);">${dye.name}</span>
          </div>
        </td>`;
      this.selectedDyes.forEach((_, j) => {
        if (i === j) {
          html += '<td class="p-2 text-center" style="color: var(--theme-text-muted);">-</td>';
        } else {
          const score = Math.round(Math.random() * 40 + 60);
          const color = score > 80 ? '#22c55e' : score > 50 ? '#eab308' : '#ef4444';
          html += `<td class="p-2 text-center font-mono" style="color: ${color};">${score}%</td>`;
        }
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    matrix.innerHTML = html;
    return matrix;
  }

  bindEvents(): void {}
  destroy(): void {
    super.destroy();
  }
}
