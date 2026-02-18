/**
 * XIV Dye Tools v2.0.0 - Palette Exporter Component
 *
 * Reusable component for exporting color palettes in various formats
 * Supports JSON, CSS, SCSS exports and hex code copying
 *
 * @module components/palette-exporter
 */

import { BaseComponent } from './base-component';
import { LanguageService } from '@services/index';
import type { Dye } from '@shared/types';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';

/**
 * Palette data structure for export
 */
export interface PaletteData {
  base?: Dye | null; // Optional base color
  groups?: Record<string, Dye[]>; // Named groups (e.g., harmonies, steps)
  metadata?: Record<string, unknown>; // Additional metadata
}

/**
 * Options for PaletteExporter component
 */
export interface PaletteExporterOptions {
  title?: string; // Default: "Export Palette"
  dataProvider: () => PaletteData;
  enabled?: () => boolean; // Optional function to check if export should be enabled
}

/**
 * Palette Exporter Component
 * Provides export functionality for color palettes
 */
export class PaletteExporter extends BaseComponent {
  private options: PaletteExporterOptions;
  private jsonBtn: HTMLButtonElement | null = null;
  private cssBtn: HTMLButtonElement | null = null;
  private scssBtn: HTMLButtonElement | null = null;
  private copyBtn: HTMLButtonElement | null = null;
  private languageUnsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, options: PaletteExporterOptions) {
    super(container);
    this.options = {
      title: options.title || 'Export Palette',
      dataProvider: options.dataProvider,
      enabled: options.enabled || (() => true),
    };
  }

  /**
   * Render the export section
   */
  renderContent(): void {
    const section = this.createElement('div', {
      className: 'rounded-lg border p-6 space-y-4',
      attributes: {
        style: 'background-color: var(--theme-card-background); border-color: var(--theme-border);',
      },
    });

    const title = this.createElement('h3', {
      textContent: this.options.title,
      className: 'text-lg font-semibold',
      attributes: {
        style: 'color: var(--theme-text);',
      },
    });
    section.appendChild(title);

    const buttonGroup = this.createElement('div', {
      className: 'flex flex-wrap gap-3 justify-center',
    });

    // JSON export button - using theme primary color
    this.jsonBtn = this.createElement('button', {
      textContent: LanguageService.t('export.exportAsJson'),
      className: 'px-4 py-2 rounded-lg transition-colors font-semibold min-h-[44px]',
      attributes: {
        'data-export': 'json',
        style: 'background-color: var(--theme-primary); color: var(--theme-text-header);',
      },
    });
    // Add hover effect
    this.jsonBtn.addEventListener('mouseenter', () => {
      this.jsonBtn!.style.opacity = '0.9';
    });
    this.jsonBtn.addEventListener('mouseleave', () => {
      this.jsonBtn!.style.opacity = '1';
    });

    // CSS export button - using theme primary color
    this.cssBtn = this.createElement('button', {
      textContent: LanguageService.t('export.exportAsCss'),
      className: 'px-4 py-2 rounded-lg transition-colors font-semibold min-h-[44px]',
      attributes: {
        'data-export': 'css',
        style: 'background-color: var(--theme-primary); color: var(--theme-text-header);',
      },
    });
    // Add hover effect
    this.cssBtn.addEventListener('mouseenter', () => {
      this.cssBtn!.style.opacity = '0.9';
    });
    this.cssBtn.addEventListener('mouseleave', () => {
      this.cssBtn!.style.opacity = '1';
    });

    // SCSS export button - using theme primary color
    this.scssBtn = this.createElement('button', {
      textContent: LanguageService.t('export.exportAsScss'),
      className: 'px-4 py-2 rounded-lg transition-colors font-semibold min-h-[44px]',
      attributes: {
        'data-export': 'scss',
        style: 'background-color: var(--theme-primary); color: var(--theme-text-header);',
      },
    });
    // Add hover effect
    this.scssBtn.addEventListener('mouseenter', () => {
      this.scssBtn!.style.opacity = '0.9';
    });
    this.scssBtn.addEventListener('mouseleave', () => {
      this.scssBtn!.style.opacity = '1';
    });

    // Copy hex codes button - using theme primary color
    this.copyBtn = this.createElement('button', {
      textContent: LanguageService.t('export.copyAllHexCodes'),
      className: 'px-4 py-2 rounded-lg transition-colors font-semibold min-h-[44px]',
      attributes: {
        'data-export': 'hex',
        style: 'background-color: var(--theme-primary); color: var(--theme-text-header);',
      },
    });
    // Add hover effect
    this.copyBtn.addEventListener('mouseenter', () => {
      this.copyBtn!.style.opacity = '0.9';
    });
    this.copyBtn.addEventListener('mouseleave', () => {
      this.copyBtn!.style.opacity = '1';
    });

    buttonGroup.appendChild(this.jsonBtn);
    buttonGroup.appendChild(this.cssBtn);
    buttonGroup.appendChild(this.scssBtn);
    buttonGroup.appendChild(this.copyBtn);

    section.appendChild(buttonGroup);

    clearContainer(this.container);
    this.element = section;
    this.container.appendChild(this.element);

    // Update button states
    this.updateButtonStates();
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    if (this.jsonBtn) {
      this.on(this.jsonBtn, 'click', () => {
        this.handleJsonExport();
      });
    }

    if (this.cssBtn) {
      this.on(this.cssBtn, 'click', () => {
        this.handleCssExport();
      });
    }

    if (this.scssBtn) {
      this.on(this.scssBtn, 'click', () => {
        this.handleScssExport();
      });
    }

    if (this.copyBtn) {
      this.on(this.copyBtn, 'click', () => {
        void this.handleCopyHexCodes();
      });
    }
  }

  /**
   * Update button enabled/disabled states
   */
  private updateButtonStates(): void {
    const isEnabled = this.options.enabled?.() ?? true;
    const buttons = [this.jsonBtn, this.cssBtn, this.scssBtn, this.copyBtn];

    for (const btn of buttons) {
      if (btn) {
        btn.disabled = !isEnabled;
        if (!isEnabled) {
          btn.classList.add('cursor-not-allowed');
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
        } else {
          btn.classList.remove('cursor-not-allowed');
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        }
      }
    }
  }

  /**
   * Handle JSON export
   */
  private handleJsonExport(): void {
    try {
      const data = this.options.dataProvider();
      const json = this.generateJsonExport(data);
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadFile(`ffxiv-palette-${timestamp}.json`, json, 'application/json');
    } catch (error) {
      logger.error('Failed to export JSON:', error);
    }
  }

  /**
   * Handle CSS export
   */
  private handleCssExport(): void {
    try {
      const data = this.options.dataProvider();
      const css = this.generateCssExport(data);
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadFile(`ffxiv-palette-${timestamp}.css`, css, 'text/css');
    } catch (error) {
      logger.error('Failed to export CSS:', error);
    }
  }

  /**
   * Handle SCSS export
   */
  private handleScssExport(): void {
    try {
      const data = this.options.dataProvider();
      const scss = this.generateScssExport(data);
      const timestamp = new Date().toISOString().split('T')[0];
      this.downloadFile(`ffxiv-palette-${timestamp}.scss`, scss, 'text/scss');
    } catch (error) {
      logger.error('Failed to export SCSS:', error);
    }
  }

  /**
   * Handle copy hex codes
   */
  private async handleCopyHexCodes(): Promise<void> {
    try {
      const data = this.options.dataProvider();
      await this.copyAllHexCodes(data);
    } catch (error) {
      logger.error('Failed to copy hex codes:', error);
    }
  }

  /**
   * Generate JSON export
   */
  private generateJsonExport(data: PaletteData): string {
    const exportData: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
    };

    // Add base color if present
    if (data.base) {
      exportData.base = data.base;
    }

    // Add groups
    if (data.groups) {
      for (const [key, dyes] of Object.entries(data.groups)) {
        if (dyes && dyes.length > 0) {
          exportData[key] = dyes;
        }
      }
    }

    // Add metadata if present
    if (data.metadata) {
      exportData.metadata = data.metadata;
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate CSS export
   */
  private generateCssExport(data: PaletteData): string {
    let css = ':root {\n';

    // Add base color if present
    if (data.base) {
      css += `  /* Base Color: ${data.base.name} */\n`;
      css += `  --color-base: ${data.base.hex};\n\n`;
    }

    // Add groups
    if (data.groups) {
      for (const [groupKey, dyes] of Object.entries(data.groups)) {
        if (dyes && dyes.length > 0) {
          // Capitalize first letter of group key for display
          const groupName = groupKey.charAt(0).toUpperCase() + groupKey.slice(1).replace(/-/g, ' ');
          css += `  /* ${groupName} */\n`;
          for (let i = 0; i < dyes.length; i++) {
            const dye = dyes[i];
            const varName = `--color-${groupKey}-${i + 1}`;
            css += `  ${varName}: ${dye.hex}; /* ${dye.name} */\n`;
          }
          css += '\n';
        }
      }
    }

    css += '}';
    return css;
  }

  /**
   * Generate SCSS export
   */
  private generateScssExport(data: PaletteData): string {
    const timestamp = new Date().toISOString().split('T')[0];
    let scss = `// FFXIV Color Palette - Generated ${timestamp}\n\n`;

    // Add base color if present
    if (data.base) {
      scss += `// Base Color: ${data.base.name}\n`;
      scss += `$color-base: ${data.base.hex};\n\n`;
    }

    // Add groups
    if (data.groups) {
      for (const [groupKey, dyes] of Object.entries(data.groups)) {
        if (dyes && dyes.length > 0) {
          // Capitalize first letter of group key for display
          const groupName = groupKey.charAt(0).toUpperCase() + groupKey.slice(1).replace(/-/g, ' ');
          scss += `// ${groupName}\n`;
          for (let i = 0; i < dyes.length; i++) {
            const dye = dyes[i];
            const varName = `$color-${groupKey}-${i + 1}`;
            scss += `${varName}: ${dye.hex}; // ${dye.name}\n`;
          }
          scss += '\n';
        }
      }
    }

    return scss;
  }

  /**
   * Copy all hex codes to clipboard
   */
  private async copyAllHexCodes(data: PaletteData): Promise<void> {
    const hexCodes: string[] = [];

    // Add base color hex if present
    if (data.base) {
      hexCodes.push(data.base.hex);
    }

    // Add all group hex codes
    if (data.groups) {
      for (const dyes of Object.values(data.groups)) {
        if (dyes) {
          for (const dye of dyes) {
            hexCodes.push(dye.hex);
          }
        }
      }
    }

    // Remove duplicates and join
    const uniqueHexCodes = [...new Set(hexCodes)];
    const hexString = uniqueHexCodes.join(', ');

    try {
      await navigator.clipboard.writeText(hexString);
      logger.info('Hex codes copied to clipboard');
      // Could emit a custom event here for toast notifications if available
      this.emit('export-copied', { type: 'hex', count: uniqueHexCodes.length });
    } catch (error) {
      logger.error('Failed to copy to clipboard:', error);
      // Fallback: try to select text in a temporary textarea
      this.fallbackCopyToClipboard(hexString);
    }
  }

  /**
   * Fallback copy method using temporary textarea
   */
  private fallbackCopyToClipboard(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      logger.info('Hex codes copied to clipboard (fallback method)');
    } catch (error) {
      logger.error('Fallback copy failed:', error);
    }
    document.body.removeChild(textarea);
  }

  /**
   * Download file with given content
   */
  private downloadFile(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Emit event for potential toast notifications
    this.emit('export-downloaded', { type: mimeType, filename });
  }

  /**
   * Initialize the component
   */
  onMount(): void {
    // Clean up existing subscription before creating a new one (prevents exponential leak)
    this.languageUnsubscribe?.();

    // Subscribe to language changes to update localized text (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update(); // Re-render to update localized text (NOT init() - avoids infinite loop)
    });
  }

  /**
   * Clean up subscriptions on destroy
   */
  override destroy(): void {
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
    super.destroy();
  }

  /**
   * Update the exporter (re-render and refresh button states)
   */
  update(): void {
    super.update(); // Call parent update to re-render with new translations
    this.updateButtonStates();
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      title: this.options.title,
      enabled: this.options.enabled?.(),
    };
  }
}
