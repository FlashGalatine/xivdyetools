/**
 * XIV Dye Tools v3.0.0 - Icon Rail Component
 *
 * Collapsed sidebar state showing only tool icons with tooltips.
 * 64px wide icon-only rail for maximum content space.
 *
 * @module mockups/IconRail
 */

import { BaseComponent } from '@components/base-component';
import {
  ICON_TOOL_HARMONY,
  ICON_TOOL_MATCHER,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_MIXER,
  ICON_TOOL_PRESETS,
} from '@shared/tool-icons';

export interface IconRailTool {
  id: string;
  name: string;
  icon: string;
}

export interface IconRailOptions {
  tools?: IconRailTool[];
  activeToolId?: string;
  onToolSelect?: (toolId: string) => void;
  onExpand?: () => void;
}

/**
 * Default tools with icons
 */
const DEFAULT_TOOLS: IconRailTool[] = [
  { id: 'harmony', name: 'Harmony', icon: ICON_TOOL_HARMONY },
  { id: 'matcher', name: 'Extractor', icon: ICON_TOOL_MATCHER },
  { id: 'accessibility', name: 'Accessibility', icon: ICON_TOOL_ACCESSIBILITY },
  { id: 'comparison', name: 'Comparison', icon: ICON_TOOL_COMPARISON },
  { id: 'mixer', name: 'Mixer', icon: ICON_TOOL_MIXER },
  { id: 'presets', name: 'Presets', icon: ICON_TOOL_PRESETS },
];

/**
 * Collapsed sidebar icon rail
 */
export class IconRail extends BaseComponent {
  private options: IconRailOptions;
  private activeToolId: string;

  constructor(container: HTMLElement, options: IconRailOptions = {}) {
    super(container);
    this.options = options;
    this.activeToolId = options.activeToolId ?? 'harmony';
  }

  renderContent(): void {
    const rail = this.createElement('div', {
      className: 'icon-rail flex flex-col h-full',
      attributes: {
        style: `
          width: var(--panel-collapsed-width);
          background: var(--theme-card-background);
          border-right: 1px solid var(--theme-border);
        `,
      },
    });

    // Tool icons
    const toolsContainer = this.createElement('div', {
      className: 'flex-1 flex flex-col items-center py-2 gap-1',
    });

    const tools = this.options.tools ?? DEFAULT_TOOLS;

    tools.forEach((tool) => {
      const isActive = tool.id === this.activeToolId;
      const btn = this.createElement('button', {
        className:
          'relative group w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200',
        attributes: {
          style: isActive
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent; color: var(--theme-text-muted);',
          'data-tool-id': tool.id,
          'aria-label': tool.name,
          'aria-current': isActive ? 'page' : 'false',
          type: 'button',
        },
      });

      // Icon
      const icon = this.createElement('span', {
        className: 'w-6 h-6',
        innerHTML: tool.icon,
      });
      btn.appendChild(icon);

      // Tooltip (appears on hover)
      const tooltip = this.createElement('span', {
        className:
          'absolute left-full ml-2 px-2 py-1 text-sm rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50',
        textContent: tool.name,
        attributes: {
          style: 'background: var(--theme-text); color: var(--theme-background);',
          role: 'tooltip',
        },
      });
      btn.appendChild(tooltip);

      toolsContainer.appendChild(btn);
    });

    rail.appendChild(toolsContainer);

    // Expand button at bottom
    const expandBtn = this.createElement('button', {
      className:
        'w-full py-3 flex items-center justify-center border-t transition-colors hover:brightness-90',
      attributes: {
        style:
          'border-color: var(--theme-border); background: var(--theme-background-secondary); color: var(--theme-text);',
        'aria-label': 'Expand sidebar',
        type: 'button',
      },
      innerHTML: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>`,
    });
    rail.appendChild(expandBtn);

    this.element = rail;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    // Tool button clicks
    const toolBtns = this.querySelectorAll<HTMLButtonElement>('[data-tool-id]');
    toolBtns.forEach((btn) => {
      this.on(btn, 'click', () => {
        const toolId = btn.getAttribute('data-tool-id');
        if (toolId) {
          this.setActiveToolId(toolId);
          this.options.onToolSelect?.(toolId);
        }
      });
    });

    // Expand button
    const expandBtn = this.querySelector<HTMLButtonElement>('[aria-label="Expand sidebar"]');
    if (expandBtn) {
      this.on(expandBtn, 'click', () => {
        this.options.onExpand?.();
      });
    }
  }

  /**
   * Set the active tool and update visual state
   */
  setActiveToolId(toolId: string): void {
    this.activeToolId = toolId;

    const toolBtns = this.querySelectorAll<HTMLButtonElement>('[data-tool-id]');
    toolBtns.forEach((btn) => {
      const isActive = btn.getAttribute('data-tool-id') === toolId;

      if (isActive) {
        btn.style.background = 'var(--theme-primary)';
        btn.style.color = 'var(--theme-text-header)';
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--theme-text-muted)';
        btn.setAttribute('aria-current', 'false');
      }
    });
  }

  /**
   * Get current active tool ID
   */
  getActiveToolId(): string {
    return this.activeToolId;
  }
}
