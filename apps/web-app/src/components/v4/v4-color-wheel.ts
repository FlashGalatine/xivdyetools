/**
 * XIV Dye Tools v4.0 - Color Wheel Component
 *
 * Modern CSS-based color wheel for displaying harmony relationships.
 * Uses conic-gradient for the spectrum ring and positioned nodes for
 * harmony colors.
 *
 * Features:
 * - CSS conic-gradient ring (not SVG segments)
 * - Mask-based donut effect
 * - Main swatch display in center (120px)
 * - Harmony nodes positioned on the ring
 * - Dashed connection lines between harmony points
 * - Empty state support with grayed nodes and "?" placeholder
 *
 * @module components/v4/v4-color-wheel
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { LanguageService } from '@services/index';
import type { Dye } from '@shared/types';

/**
 * Supported harmony types
 */
export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'square';

/**
 * V4 Color Wheel - Modern CSS-based harmony visualization
 *
 * @fires node-click - Emits when a harmony node is clicked
 *   - `detail.hue`: The hue angle of the clicked node
 *   - `detail.color`: The hex color of the clicked node
 *
 * @example
 * ```html
 * <v4-color-wheel
 *   base-color="#6d5440"
 *   harmony-type="tetradic"
 *   .harmonyColors=${['#BACFAA', '#111111', '#8c2530']}
 * ></v4-color-wheel>
 * ```
 */
@customElement('v4-color-wheel')
export class V4ColorWheel extends BaseLitComponent {
  /**
   * Base color (hex with #)
   */
  @property({ type: String, attribute: 'base-color' })
  baseColor: string = '';

  /**
   * Harmony type to display
   */
  @property({ type: String, attribute: 'harmony-type' })
  harmonyType: HarmonyType = 'tetradic';

  /**
   * Harmony colors to display (hex strings with #)
   * These are positioned based on the harmony type angles
   */
  @property({ attribute: false })
  harmonyColors: string[] = [];

  /**
   * Optional dye objects for richer node tooltips
   */
  @property({ attribute: false })
  harmonyDyes: Dye[] = [];

  /**
   * Size of the wheel in pixels
   */
  @property({ type: Number })
  size: number = 300;

  /**
   * Empty state - shows placeholder when no color is selected
   */
  @property({ type: Boolean })
  empty: boolean = false;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
      }

      .harmony-circle-container {
        position: relative;
        width: var(--wheel-size, 300px);
        height: var(--wheel-size, 300px);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      /* Color wheel ring using conic-gradient */
      .harmony-ring {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red);
        opacity: 0.8;
        mask-image: radial-gradient(transparent 60%, black 61%);
        -webkit-mask-image: radial-gradient(transparent 60%, black 61%);
      }

      /* Harmony node dots */
      .harmony-node {
        position: absolute;
        width: 14px;
        height: 14px;
        background: var(--theme-card-background, #1e1e1e);
        border: 2px solid #fff;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        z-index: 2;
        cursor: pointer;
        transition:
          transform 0.15s,
          box-shadow 0.15s;
      }

      .harmony-node:hover {
        transform: translate(-50%, -50%) scale(1.2);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.6);
      }

      .harmony-node.main {
        width: 18px;
        height: 18px;
        border: 3px solid #fff;
        z-index: 3;
      }

      /* Empty state for nodes */
      .harmony-node.empty {
        background-color: rgba(255, 255, 255, 0.1);
        border: 2px dashed rgba(255, 255, 255, 0.3);
        cursor: default;
      }

      .harmony-node.empty:hover {
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
      }

      /* Connection lines between nodes */
      .harmony-line {
        position: absolute;
        top: 50%;
        left: 50%;
        height: 1px;
        background: transparent;
        border-top: 1px dashed rgba(255, 255, 255, 0.4);
        transform-origin: 0 0;
        z-index: 1;
        pointer-events: none;
      }

      .harmony-line.empty {
        border-top: 1px dashed rgba(255, 255, 255, 0.2);
      }

      /* Center swatch display */
      .main-swatch-display {
        position: absolute;
        width: 120px;
        height: 120px;
        border-radius: 50%;
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
        border: 4px solid var(--theme-card-background, #121212);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .main-swatch-display.empty {
        background-color: transparent;
        border: 3px dashed rgba(255, 255, 255, 0.3);
        box-shadow: none;
      }

      .empty-placeholder {
        font-size: 28px;
        color: rgba(255, 255, 255, 0.4);
        font-weight: bold;
      }

      /* Harmony label below center */
      .harmony-label {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--theme-text-muted, #a0a0a0);
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        margin-top: 80px; /* Offset below center circle */
      }

      .harmony-label.empty {
        opacity: 0.5;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .harmony-node {
          transition: none;
        }
      }
    `,
  ];

  /**
   * Get the harmony angles based on harmony type
   */
  private getHarmonyAngles(): number[] {
    switch (this.harmonyType) {
      case 'complementary':
        return [0, 180];
      case 'analogous':
        return [0, 30, 330]; // -30 = 330
      case 'triadic':
        return [0, 120, 240];
      case 'split-complementary':
        return [0, 150, 210];
      case 'tetradic':
        return [0, 90, 180, 270];
      case 'square':
        return [0, 90, 180, 270];
      default:
        return [0];
    }
  }

  /**
   * Convert hue to position on the wheel
   * Returns {top, left} as percentage strings
   */
  private hueToPosition(hue: number): { top: string; left: string } {
    // Wheel radius is approximately 35% of container (nodes sit on the ring)
    const radius = 42; // percentage from center
    const angleRad = ((hue - 90) * Math.PI) / 180; // -90 to start from top

    const x = 50 + radius * Math.cos(angleRad);
    const y = 50 + radius * Math.sin(angleRad);

    return {
      left: `${x}%`,
      top: `${y}%`,
    };
  }

  /**
   * Get hue from hex color
   */
  private hexToHue(hex: string): number {
    if (!hex || hex.length < 7) return 0;

    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    return h;
  }

  /**
   * Handle node click
   */
  private handleNodeClick(color: string, hue: number): void {
    this.emit<{ color: string; hue: number }>('node-click', { color, hue });
  }

  /**
   * Get display name for harmony type (localized)
   */
  private getHarmonyDisplayName(): string {
    // Use core library localization for harmony types
    return LanguageService.getHarmonyType(this.harmonyType);
  }

  /**
   * Render connection lines between harmony nodes
   */
  private renderConnectionLines(): TemplateResult[] {
    if (this.empty) {
      // Show placeholder lines for empty state
      const angles = this.getHarmonyAngles();
      return angles.map(
        (angle) => html`
          <div
            class="harmony-line empty"
            style="width: ${this.size * 0.35}px; transform: rotate(${angle - 90}deg);"
          ></div>
        `
      );
    }

    if (!this.baseColor) return [];

    const baseHue = this.hexToHue(this.baseColor);
    const harmonyAngles = this.getHarmonyAngles();

    return harmonyAngles.map((offset) => {
      const angle = (baseHue + offset) % 360;
      // Subtract 90° to align with hueToPosition which also offsets by -90
      const lineAngle = angle - 90;
      return html`
        <div
          class="harmony-line"
          style="width: ${this.size * 0.35}px; transform: rotate(${lineAngle}deg);"
        ></div>
      `;
    });
  }

  /**
   * Render harmony nodes
   */
  private renderHarmonyNodes(): TemplateResult[] {
    if (this.empty) {
      // Show placeholder nodes for empty state
      const angles = this.getHarmonyAngles();
      return angles.map((angle, index) => {
        const pos = this.hueToPosition(angle);
        return html`
          <div
            class="harmony-node empty ${index === 0 ? 'main' : ''}"
            style="top: ${pos.top}; left: ${pos.left};"
            title="${index === 0 ? 'Select a base color' : 'Harmony color'}"
          ></div>
        `;
      });
    }

    if (!this.baseColor) return [];

    const baseHue = this.hexToHue(this.baseColor);
    const harmonyAngles = this.getHarmonyAngles();
    const nodes: TemplateResult[] = [];

    // Base color node
    const basePos = this.hueToPosition(baseHue);
    nodes.push(html`
      <div
        class="harmony-node main"
        style="top: ${basePos.top}; left: ${basePos.left}; background-color: ${this.baseColor};"
        title="Base: ${this.baseColor}"
        @click=${() => this.handleNodeClick(this.baseColor, baseHue)}
      ></div>
    `);

    // Harmony nodes
    harmonyAngles.slice(1).forEach((offset, index) => {
      const hue = (baseHue + offset) % 360;
      const pos = this.hueToPosition(hue);
      const color = this.harmonyColors[index] || this.baseColor;
      const dye = this.harmonyDyes[index];
      const title = dye ? dye.name : color;

      nodes.push(html`
        <div
          class="harmony-node"
          style="top: ${pos.top}; left: ${pos.left}; background-color: ${color};"
          title="${title}"
          @click=${() => this.handleNodeClick(color, hue)}
        ></div>
      `);
    });

    return nodes;
  }

  protected override render(): TemplateResult {
    const swatchStyle = this.empty
      ? ''
      : `background-color: ${this.baseColor}; box-shadow: 0 0 30px ${this.baseColor}40;`;

    return html`
      <div class="harmony-circle-container" style="--wheel-size: ${this.size}px;">
        <!-- Color spectrum ring -->
        <div class="harmony-ring"></div>

        <!-- Connection lines -->
        ${this.renderConnectionLines()}

        <!-- Harmony nodes -->
        ${this.renderHarmonyNodes()}

        <!-- Center swatch display -->
        <div
          class="main-swatch-display ${this.empty ? 'empty' : ''}"
          style="${swatchStyle}"
          title="${this.empty
            ? LanguageService.t('harmony.selectColorPrompt')
            : `Base: ${this.baseColor}`}"
        >
          ${this.empty ? html`<span class="empty-placeholder">?</span>` : nothing}
        </div>

        <!-- Harmony type label -->
        <span class="harmony-label ${this.empty ? 'empty' : ''}">
          ${this.empty
            ? LanguageService.t('harmony.selectColorPrompt')
            : this.getHarmonyDisplayName()}
        </span>
      </div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-color-wheel': V4ColorWheel;
  }
}
