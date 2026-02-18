/**
 * XIV Dye Tools v3.0.0 - Collapsible Panel Component
 *
 * Reusable collapsible section for left panel config areas.
 * Used for: Dye Filters, Market Board, Advanced Options
 *
 * @module components/collapsible-panel
 */

import { BaseComponent } from '@components/base-component';
import { StorageService } from '@services/index';

export interface CollapsiblePanelOptions {
  title: string;
  storageKey?: string; // For persisting open/closed state
  defaultOpen?: boolean;
  icon?: string; // Optional SVG icon
}

/**
 * Collapsible panel with animated expand/collapse
 */
export class CollapsiblePanel extends BaseComponent {
  private options: CollapsiblePanelOptions;
  private isOpen: boolean;
  private contentSlot: HTMLElement | null = null;
  private chevron: HTMLElement | null = null;

  constructor(container: HTMLElement, options: CollapsiblePanelOptions) {
    super(container);
    this.options = options;

    // Load persisted state or use default
    if (options.storageKey) {
      const stored = StorageService.getItem<boolean>(`v3_panel_${options.storageKey}`);
      this.isOpen = stored !== null ? stored : (options.defaultOpen ?? true);
    } else {
      this.isOpen = options.defaultOpen ?? true;
    }
  }

  renderContent(): void {
    const panel = this.createElement('div', {
      className: 'collapsible-panel border-t',
      attributes: {
        style: 'border-color: var(--theme-border);',
      },
    });

    // Header (clickable to toggle)
    const header = this.createElement('button', {
      className:
        'w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:brightness-95',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        'aria-expanded': String(this.isOpen),
        type: 'button',
      },
    });

    // Title with optional icon
    const titleContainer = this.createElement('span', {
      className: 'flex items-center gap-2 font-medium text-sm',
    });

    if (this.options.icon) {
      const iconSpan = this.createElement('span', {
        className: 'w-4 h-4 flex-shrink-0',
        innerHTML: this.options.icon,
      });
      titleContainer.appendChild(iconSpan);
    }

    const titleText = this.createElement('span', {
      textContent: this.options.title,
    });
    titleContainer.appendChild(titleText);
    header.appendChild(titleContainer);

    // Chevron indicator
    this.chevron = this.createElement('span', {
      className: 'w-5 h-5 transition-transform duration-200',
      innerHTML: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-full h-full">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>`,
      attributes: {
        style: this.isOpen ? 'transform: rotate(0deg);' : 'transform: rotate(-90deg);',
      },
    });
    header.appendChild(this.chevron);

    panel.appendChild(header);

    // Content area (collapsible)
    this.contentSlot = this.createElement('div', {
      className: 'collapsible-content overflow-hidden transition-all duration-200',
      attributes: {
        style: this.isOpen ? 'max-height: 1000px; opacity: 1;' : 'max-height: 0; opacity: 0;',
      },
    });

    const contentInner = this.createElement('div', {
      className: 'px-4 py-3',
      attributes: {
        style: 'background: var(--theme-card-background);',
      },
    });
    this.contentSlot.appendChild(contentInner);
    panel.appendChild(this.contentSlot);

    this.element = panel;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    const header = this.querySelector<HTMLButtonElement>('button');
    if (header) {
      this.on(header, 'click', this.toggle);
    }
  }

  /**
   * Toggle open/closed state
   */
  toggle = (): void => {
    this.isOpen = !this.isOpen;
    this.updateVisualState();
    this.persistState();
  };

  /**
   * Open the panel
   */
  open(): void {
    if (!this.isOpen) {
      this.isOpen = true;
      this.updateVisualState();
      this.persistState();
    }
  }

  /**
   * Close the panel
   */
  close(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.updateVisualState();
      this.persistState();
    }
  }

  /**
   * Get the content container to append child elements
   */
  getContentContainer(): HTMLElement | null {
    return this.contentSlot?.querySelector('.px-4.py-3') ?? null;
  }

  /**
   * Set content directly
   */
  setContent(content: HTMLElement | string): void {
    const container = this.getContentContainer();
    if (!container) return;

    container.innerHTML = '';
    if (typeof content === 'string') {
      container.innerHTML = content;
    } else {
      container.appendChild(content);
    }
  }

  private updateVisualState(): void {
    // Update chevron rotation
    if (this.chevron) {
      this.chevron.style.transform = this.isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    }

    // Update content visibility
    if (this.contentSlot) {
      if (this.isOpen) {
        this.contentSlot.style.maxHeight = '1000px';
        this.contentSlot.style.opacity = '1';
      } else {
        this.contentSlot.style.maxHeight = '0';
        this.contentSlot.style.opacity = '0';
      }
    }

    // Update aria-expanded
    const header = this.querySelector<HTMLButtonElement>('button');
    if (header) {
      header.setAttribute('aria-expanded', String(this.isOpen));
    }
  }

  private persistState(): void {
    if (this.options.storageKey) {
      StorageService.setItem(`v3_panel_${this.options.storageKey}`, this.isOpen);
    }
  }
}
