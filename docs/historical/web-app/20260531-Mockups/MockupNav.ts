/**
 * XIV Dye Tools v3.0.0 - Mockup Navigation Component
 *
 * Desktop left sidebar navigation with tool icons and labels.
 * Supports expanded and collapsed (IconRail) states.
 *
 * @module mockups/MockupNav
 */

import { BaseComponent } from '@components/base-component';
import { LanguageService } from '@services/index';
import {
  ICON_TOOL_HARMONY,
  ICON_TOOL_MATCHER,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_MIXER,
  ICON_TOOL_PRESETS,
  ICON_TOOL_BUDGET,
} from '@shared/tool-icons';

export interface MockupNavTool {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  description: string;
}

export interface MockupNavOptions {
  activeToolId?: string;
  onToolSelect?: (toolId: string) => void;
  onCollapse?: () => void;
}

/**
 * Get localized tool definitions
 */
export function getLocalizedMockupTools(): MockupNavTool[] {
  return [
    {
      id: 'harmony',
      name: LanguageService.t('tools.harmony.title'),
      shortName: LanguageService.t('tools.harmony.shortName'),
      icon: ICON_TOOL_HARMONY,
      description: LanguageService.t('tools.harmony.description'),
    },
    {
      id: 'matcher',
      name: LanguageService.t('tools.matcher.title'),
      shortName: LanguageService.t('tools.matcher.shortName'),
      icon: ICON_TOOL_MATCHER,
      description: LanguageService.t('tools.matcher.description'),
    },
    {
      id: 'accessibility',
      name: LanguageService.t('tools.accessibility.title'),
      shortName: LanguageService.t('tools.accessibility.shortName'),
      icon: ICON_TOOL_ACCESSIBILITY,
      description: LanguageService.t('tools.accessibility.description'),
    },
    {
      id: 'comparison',
      name: LanguageService.t('tools.comparison.title'),
      shortName: LanguageService.t('tools.comparison.shortName'),
      icon: ICON_TOOL_COMPARISON,
      description: LanguageService.t('tools.comparison.description'),
    },
    {
      id: 'mixer',
      name: LanguageService.t('tools.mixer.title'),
      shortName: LanguageService.t('tools.mixer.shortName'),
      icon: ICON_TOOL_MIXER,
      description: LanguageService.t('tools.mixer.description'),
    },
    {
      id: 'presets',
      name: LanguageService.t('tools.presets.title'),
      shortName: LanguageService.t('tools.presets.shortName'),
      icon: ICON_TOOL_PRESETS,
      description: LanguageService.t('tools.presets.description'),
    },
    {
      id: 'budget',
      name: LanguageService.t('tools.budget.title'),
      shortName: LanguageService.t('tools.budget.shortName'),
      icon: ICON_TOOL_BUDGET,
      description: LanguageService.t('tools.budget.description'),
    },
  ];
}

/**
 * Desktop sidebar navigation component
 */
export class MockupNav extends BaseComponent {
  private options: MockupNavOptions;
  private tools: MockupNavTool[];
  private activeToolId: string;

  constructor(container: HTMLElement, options: MockupNavOptions = {}) {
    super(container);
    this.options = options;
    this.tools = getLocalizedMockupTools();
    this.activeToolId = options.activeToolId ?? 'harmony';
  }

  renderContent(): void {
    const nav = this.createElement('nav', {
      className: 'mockup-nav flex flex-col h-full',
      attributes: {
        style: `
          width: var(--panel-left-width);
          background: var(--theme-card-background);
          border-right: 1px solid var(--theme-border);
        `,
        'aria-label': 'Tool navigation',
      },
    });

    // Header with collapse button
    const header = this.createElement('div', {
      className: 'flex items-center justify-between px-4 py-3 border-b',
      attributes: {
        style: 'border-color: var(--theme-border); background: var(--theme-background-secondary);',
      },
    });

    const title = this.createElement('h2', {
      className: 'text-sm font-semibold uppercase tracking-wider',
      textContent: 'Tools',
      attributes: {
        style: 'color: var(--theme-text-muted);',
      },
    });

    const collapseBtn = this.createElement('button', {
      className: 'p-1.5 rounded transition-colors hover:brightness-90',
      attributes: {
        style: 'background: var(--theme-card-hover); color: var(--theme-text);',
        'aria-label': 'Collapse sidebar',
        type: 'button',
      },
      innerHTML: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      </svg>`,
    });

    header.appendChild(title);
    header.appendChild(collapseBtn);
    nav.appendChild(header);

    // Tool buttons
    const toolsContainer = this.createElement('div', {
      className: 'flex-1 overflow-y-auto py-2',
    });

    this.tools.forEach((tool) => {
      const isActive = tool.id === this.activeToolId;

      const btn = this.createElement('button', {
        className:
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 hover:brightness-95',
        attributes: {
          style: isActive
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent; color: var(--theme-text);',
          'data-tool-id': tool.id,
          'aria-current': isActive ? 'page' : 'false',
          title: tool.description,
          type: 'button',
        },
      });

      // Icon
      const icon = this.createElement('span', {
        className: 'w-5 h-5 flex-shrink-0',
        innerHTML: tool.icon,
      });

      // Name
      const name = this.createElement('span', {
        className: 'font-medium text-sm truncate',
        textContent: tool.name,
      });

      btn.appendChild(icon);
      btn.appendChild(name);
      toolsContainer.appendChild(btn);
    });

    nav.appendChild(toolsContainer);

    // Version indicator at bottom
    const footer = this.createElement('div', {
      className: 'px-4 py-3 text-xs border-t',
      attributes: {
        style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
      },
      innerHTML: `<span class="opacity-70">v3.0.0 Mockup</span>`,
    });
    nav.appendChild(footer);

    this.element = nav;
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

    // Collapse button
    const collapseBtn = this.querySelector<HTMLButtonElement>('[aria-label="Collapse sidebar"]');
    if (collapseBtn) {
      this.on(collapseBtn, 'click', () => {
        this.options.onCollapse?.();
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
        btn.style.color = 'var(--theme-text)';
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

  /**
   * Update tools when language changes
   */
  updateTools(): void {
    this.tools = getLocalizedMockupTools();
    this.update();
  }
}
