/**
 * XIV Dye Tools v4.0 - Tool Banner Component
 *
 * 64px horizontal navigation bar with 9 tool buttons
 * Provides quick access to all tools with keyboard navigation support
 *
 * @module components/v4/tool-banner
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { BaseLitComponent } from './base-lit-component';
import { TOOL_ICONS } from '@shared/tool-icons';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { ToolId } from '@services/router-service';
import { LanguageService } from '@services/index';

/**
 * Tool definition for banner display
 */
interface ToolDefinition {
  id: ToolId;
  /** Translation key prefix - maps v4 tool IDs to translation keys (some renamed in v4) */
  translationKey: string;
}

/**
 * Tool definitions in display order.
 * Maps v4 tool IDs to their translation key prefixes.
 * Some tools were renamed in v4: matcher→extractor, character→swatch
 */
const TOOL_DEFINITIONS: ToolDefinition[] = [
  { id: 'harmony', translationKey: 'tools.harmony' },
  { id: 'extractor', translationKey: 'tools.matcher' }, // v4 renamed: matcher → extractor
  { id: 'accessibility', translationKey: 'tools.accessibility' },
  { id: 'comparison', translationKey: 'tools.comparison' },
  { id: 'gradient', translationKey: 'tools.gradient' }, // Gradient Builder tool
  { id: 'mixer', translationKey: 'tools.mixer' },
  { id: 'presets', translationKey: 'tools.presets' },
  { id: 'budget', translationKey: 'tools.budget' },
  { id: 'swatch', translationKey: 'tools.character' }, // v4 renamed: character → swatch
];

/**
 * V4 Tool Banner - Horizontal navigation for tool selection
 *
 * @fires tool-select - When a tool is selected, with detail: { toolId: ToolId }
 *
 * @example
 * ```html
 * <v4-tool-banner
 *   .activeTool=${'harmony'}
 *   @tool-select=${this.handleToolSelect}
 * ></v4-tool-banner>
 * ```
 */
@customElement('v4-tool-banner')
export class ToolBanner extends BaseLitComponent {
  /**
   * Currently active tool ID
   */
  @property({ type: String, attribute: 'active-tool' })
  activeTool: ToolId = 'harmony';

  private languageUnsubscribe: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    // Subscribe to language changes to update translated text
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.requestUpdate();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
  }

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        height: var(--v4-tool-bar-height, 64px);
      }

      .v4-tool-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 100%;
        padding: 0 16px;
        background: linear-gradient(
          to bottom,
          var(--v4-gradient-start, #252525),
          var(--v4-gradient-end, #121212)
        );
        border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        box-shadow: var(--v4-shadow-soft, 0 4px 6px rgba(0, 0, 0, 0.3));
        overflow-x: auto;
        scrollbar-width: thin;
      }

      /* Hide scrollbar on webkit browsers */
      .v4-tool-banner::-webkit-scrollbar {
        height: 4px;
      }

      .v4-tool-banner::-webkit-scrollbar-track {
        background: transparent;
      }

      .v4-tool-banner::-webkit-scrollbar-thumb {
        background: var(--theme-border, rgba(255, 255, 255, 0.2));
        border-radius: 2px;
      }

      /* Tool Button */
      .v4-tool-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 72px;
        height: calc(100% - 8px);
        padding: 8px 12px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--theme-text-muted, #a0a0a0);
        cursor: pointer;
        position: relative;
        transition:
          color var(--v4-transition-fast, 150ms),
          background-color var(--v4-transition-fast, 150ms);
        flex-shrink: 0;
      }

      .v4-tool-btn:hover {
        color: var(--theme-text, #e0e0e0);
        background: rgba(255, 255, 255, 0.05);
      }

      .v4-tool-btn:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 2px;
      }

      .v4-tool-btn.active {
        color: var(--theme-primary, #d4af37);
      }

      /* Active indicator bar */
      .v4-tool-btn.active::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 80%;
        height: 3px;
        background: var(--theme-primary, #d4af37);
        border-radius: 2px 2px 0 0;
        box-shadow: var(--v4-shadow-glow, 0 0 10px rgba(212, 175, 55, 0.3));
      }

      /* Tool Icon */
      .v4-tool-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .v4-tool-icon svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
        stroke: currentColor;
      }

      /* Tool Label */
      .v4-tool-label {
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .v4-tool-btn {
          transition: none;
        }
      }

      /* Mobile: Smaller buttons, left-aligned for proper scroll */
      @media (max-width: 768px) {
        .v4-tool-banner {
          justify-content: flex-start;
        }

        .v4-tool-btn {
          min-width: 60px;
          padding: 6px 8px;
        }

        .v4-tool-icon {
          width: 20px;
          height: 20px;
        }

        .v4-tool-label {
          font-size: 9px;
        }
      }
    `,
  ];

  /**
   * Handle tool button click
   */
  private handleToolClick(toolId: ToolId): void {
    if (toolId !== this.activeTool) {
      this.emit('tool-select', { toolId });
    }
  }

  /**
   * Handle keyboard navigation within the banner
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const buttons = this.shadowRoot?.querySelectorAll<HTMLButtonElement>('.v4-tool-btn');
    if (!buttons || buttons.length === 0) return;

    const currentIndex = Array.from(buttons).findIndex(
      (btn) => btn === this.shadowRoot?.activeElement
    );

    if (currentIndex === -1) return;

    let newIndex: number;

    switch (e.key) {
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % buttons.length;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        e.preventDefault();
        break;
      case 'Home':
        newIndex = 0;
        e.preventDefault();
        break;
      case 'End':
        newIndex = buttons.length - 1;
        e.preventDefault();
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex) {
      buttons[newIndex].focus();
    }
  }

  /**
   * Render a single tool button
   */
  private renderToolButton(tool: ToolDefinition): TemplateResult {
    const isActive = tool.id === this.activeTool;
    const icon = TOOL_ICONS[tool.id];
    // Get translated label and description using the translation key prefix
    const label = LanguageService.t(`${tool.translationKey}.shortName`);
    const description = LanguageService.t(`${tool.translationKey}.description`);

    const classes = {
      'v4-tool-btn': true,
      active: isActive,
    };

    return html`
      <button
        class=${classMap(classes)}
        type="button"
        title=${description}
        aria-label=${description}
        aria-current=${isActive ? 'page' : nothing}
        data-tool=${tool.id}
        @click=${() => this.handleToolClick(tool.id)}
      >
        <span class="v4-tool-icon" aria-hidden="true"> ${icon ? unsafeHTML(icon) : nothing} </span>
        <span class="v4-tool-label">${label}</span>
      </button>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <nav
        class="v4-tool-banner"
        role="navigation"
        aria-label="${LanguageService.t('aria.toolSelection')}"
        @keydown=${this.handleKeyDown}
      >
        ${TOOL_DEFINITIONS.map((tool) => this.renderToolButton(tool))}
      </nav>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-tool-banner': ToolBanner;
  }
}
