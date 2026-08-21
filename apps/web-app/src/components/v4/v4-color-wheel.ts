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

import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { LanguageService } from '@services/index';
import type { Dye } from '@xivdyetools/types';
import { localizedDyeName } from '@shared/dye-name';

/**
 * Supported harmony types
 */
export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'inverted-tetradic'
  | 'square'
  | 'monochromatic'
  | 'compound'
  | 'shades';

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
   * Base dye's display name, shown in the hub (falls back to the hex)
   */
  @property({ type: String, attribute: 'base-name' })
  baseName: string = '';

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

      /* 1A: node pucks — 42px tap targets, not 14px dots */
      .harmony-node {
        position: absolute;
        width: 42px;
        height: 42px;
        padding: 0;
        background: var(--theme-card-background, #1e1e1e);
        border: 3px solid var(--theme-background, #0b0b0c);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
        z-index: 2;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Fragment Mono', monospace;
        font-size: 12px;
        line-height: 1;
        transition:
          transform 0.15s,
          box-shadow 0.15s;
      }

      .harmony-node:hover {
        transform: translate(-50%, -50%) scale(1.08);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.55);
      }

      .harmony-node:focus-visible {
        outline: 2px solid var(--theme-primary, #ea4133);
        outline-offset: 2px;
      }

      /* The base's own position on the ring — ringed, never numbered */
      .harmony-node.main {
        z-index: 3;
        box-shadow:
          0 0 0 2px var(--theme-primary, #ea4133),
          0 2px 6px rgba(0, 0, 0, 0.45);
      }

      /* Empty state for nodes */
      .harmony-node.empty {
        background-color: rgba(127, 127, 127, 0.12);
        border: 2px dashed var(--theme-border, rgba(255, 255, 255, 0.3));
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

      /* 1A hub: 114px button carrying the base dye — tapping opens the picker */
      .main-swatch-display {
        position: absolute;
        width: 114px;
        height: 114px;
        padding: 6px;
        border-radius: 50%;
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
        border: 4px solid var(--theme-background, #0b0b0c);
        z-index: 10;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        cursor: pointer;
        font-family: inherit;
      }

      .main-swatch-display:focus-visible {
        outline: 2px solid var(--theme-primary, #ea4133);
        outline-offset: 3px;
      }

      .hub-label {
        font-family: 'Fragment Mono', monospace;
        font-size: 8px;
        letter-spacing: 1px;
        text-transform: uppercase;
        opacity: 0.75;
      }

      .hub-name {
        font-weight: 600;
        font-size: 12px;
        line-height: 1.15;
        text-align: center;
        overflow-wrap: anywhere;
      }

      .main-swatch-display.empty {
        background-color: transparent;
        border: 3px dashed var(--theme-border, rgba(255, 255, 255, 0.3));
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
        // Rectangle: two complementary pairs 60° apart — matches core's
        // findTetradicDyes offsets [60, 180, 240] (NOT the square's 90° steps)
        return [0, 60, 180, 240];
      case 'inverted-tetradic':
        // Mirror rectangle: second pair at −60° (300°) — matches core's
        // findInvertedTetradicDyes offsets [120, 180, 300]
        return [0, 120, 180, 300];
      case 'square':
        return [0, 90, 180, 270];
      // The three types that drew no nodes at all. Offsets mirror
      // HARMONY_OFFSETS in harmony-generator — the wheel and the grid have to
      // be describing the same geometry.
      case 'compound':
        return [0, 30, 180, 330];
      case 'shades':
        return [0, 15, 345];
      case 'monochromatic':
        // One companion at the base's own hue: it varies in value, not hue,
        // so it shares the spoke and is staggered inward (see hueToPosition).
        return [0, 0];
      default:
        return [0];
    }
  }

  /**
   * Convert hue to position on the wheel
   * Returns {top, left} as percentage strings
   */
  private hueToPosition(hue: number, depth: number = 0): { top: string; left: string } {
    // Nodes sit on the ring; `depth` pulls coincident nodes inward along the
    // same spoke so a monochromatic pair reads as two dyes, not one puck.
    const radius = 42 - depth * 13; // percentage from center
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
    // Use core library localization for harmony types.
    // HarmonyTypeKey is camelCase while this.harmonyType is the kebab id —
    // convert (previously 'split-complementary' silently fell back to the
    // raw key; same would have happened for 'inverted-tetradic').
    const camelKey = this.harmonyType.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    return LanguageService.getHarmonyType(camelKey);
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
    const harmonyAngles = this.getHarmonyAngles();
    // Nodes sharing a spoke step inward so none is hidden under another
    const seenAngles = new Map<number, number>();
    const depthFor = (angle: number): number => {
      const key = Math.round(angle) % 360;
      const depth = seenAngles.get(key) ?? 0;
      seenAngles.set(key, depth + 1);
      return depth;
    };

    if (this.empty) {
      // Show placeholder nodes for empty state
      return harmonyAngles.map((angle, index) => {
        const pos = this.hueToPosition(angle, depthFor(angle));
        return html`
          <div
            class="harmony-node empty ${index === 0 ? 'main' : ''}"
            style="top: ${pos.top}; left: ${pos.left};"
            title="${
              index === 0
                ? LanguageService.t('harmony.selectColorPrompt')
                : `${LanguageService.t('harmony.harmony')} ${index}`
            }"
          ></div>
        `;
      });
    }

    if (!this.baseColor) return [];

    const baseHue = this.hexToHue(this.baseColor);
    const nodes: TemplateResult[] = [];

    // Base color node — its position on the ring, ringed rather than numbered
    const basePos = this.hueToPosition(baseHue, depthFor(baseHue));
    nodes.push(html`
      <button
        type="button"
        class="harmony-node main"
        style="top: ${basePos.top}; left: ${basePos.left}; background-color: ${this.baseColor};"
        title="${LanguageService.t('harmony.baseColorSection')}: ${this.baseColor.toUpperCase()}"
        @click=${() => this.handleNodeClick(this.baseColor, baseHue)}
      ></button>
    `);

    // Harmony nodes, numbered to match the result cards' "Harmony N" labels
    harmonyAngles.slice(1).forEach((offset, index) => {
      const hue = (baseHue + offset) % 360;
      const pos = this.hueToPosition(hue, depthFor(hue));
      const color = this.harmonyColors[index] || this.baseColor;
      const dye = this.harmonyDyes[index];
      const slot = `${LanguageService.t('harmony.harmony')} ${index + 1}`;
      const title = dye ? `${slot} · ${localizedDyeName(dye)}` : `${slot} · ${color.toUpperCase()}`;

      nodes.push(html`
        <button
          type="button"
          class="harmony-node"
          style="top: ${pos.top}; left: ${pos.left}; background-color: ${color}; color: ${this.inkOn(color)};"
          title="${title}"
          @click=${() => this.handleNodeClick(color, hue)}
        >
          ${index + 1}
        </button>
      `);
    });

    return nodes;
  }

  /** Readable ink for text sitting on a coloured puck. */
  private inkOn(hex: string): string {
    if (!hex || hex.length < 7) return '#fff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? 'rgba(10,10,12,0.8)' : 'rgba(255,255,255,0.9)';
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

        <!-- 1A hub: the base dye lives here, and tapping it opens the picker -->
        <button
          type="button"
          class="main-swatch-display ${this.empty ? 'empty' : ''}"
          style="${swatchStyle}${this.empty ? '' : ` color: ${this.inkOn(this.baseColor)};`}"
          title="${
            this.empty
              ? LanguageService.t('harmony.selectColorPrompt')
              : LanguageService.t('harmony.selectDye')
          }"
          @click=${() => this.emit('hub-click', {})}
        >
          ${
            this.empty
              ? html`<span class="empty-placeholder">?</span>`
              : html`
                  <span class="hub-label">${LanguageService.t('harmony.baseColorSection')}</span>
                  <span class="hub-name">${this.baseName || this.baseColor.toUpperCase()}</span>
                `
          }
        </button>

        <!-- Harmony type label -->
        <span class="harmony-label ${this.empty ? 'empty' : ''}">
          ${
            this.empty
              ? LanguageService.t('harmony.selectColorPrompt')
              : this.getHarmonyDisplayName()
          }
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
