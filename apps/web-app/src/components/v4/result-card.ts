/**
 * XIV Dye Tools v4.0 - Result Card Component
 *
 * Unified 280px result card for displaying dye match results.
 * Used across Harmony, Gradient, Budget, Swatch, Extractor, and other tools.
 *
 * V4 Design Updates:
 * - Dark header background (rgba(0, 0, 0, 0.4)) with centered dye name
 * - Preview labels: "Original" / "Match"
 * - Taller preview area (100px)
 * - HSV values in Technical column
 * - Hue Deviance (°) displayed alongside Delta-E
 * - Action bar at bottom with "Select Dye" button + context menu
 * - Context menu pops UP from action bar
 *
 * @module components/v4/result-card
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseLitComponent } from './base-lit-component';
import { ICON_CONTEXT_MENU } from '@shared/ui-icons';
import type { Dye, DyeWithDistance } from '@shared/types';
import type { MatchingMethod } from '@shared/tool-config-types';
import { ColorService } from '@xivdyetools/core';
import { LanguageService, StorageService, RouterService } from '@services/index';
import { ToastService } from '@services/toast-service';
import { ModalService } from '@services/modal-service';
import { DyeService } from '@services/dye-service-wrapper';

/**
 * Human-readable labels for matching algorithms
 */
const MATCHING_METHOD_LABELS: Record<MatchingMethod, string> = {
  rgb: 'RGB',
  cie76: 'CIE76',
  ciede2000: 'ΔE2000',
  oklab: 'OKLAB',
  hyab: 'HyAB',
  'oklch-weighted': 'OKLCH',
};

/**
 * Delta-E thresholds for each matching method.
 * Each algorithm has different scales for what constitutes excellent/good/acceptable/noticeable/poor.
 *
 * RGB uses Euclidean distance in 0-255 space (max ~442), so thresholds are much higher.
 * Perceptual algorithms (CIE76, CIEDE2000, OKLAB, HyAB, OKLCH) use similar scales:
 * - < 1: Imperceptible difference
 * - 1-3: Barely noticeable
 * - 3-5: Noticeable but acceptable
 * - 5-10: Clearly noticeable
 * - > 10: Very different colors
 */
const DELTA_THRESHOLDS: Record<
  MatchingMethod,
  { excellent: number; good: number; acceptable: number; noticeable: number }
> = {
  rgb: { excellent: 15, good: 35, acceptable: 60, noticeable: 100 },
  cie76: { excellent: 1, good: 3, acceptable: 5, noticeable: 10 },
  ciede2000: { excellent: 1, good: 3, acceptable: 5, noticeable: 10 },
  oklab: { excellent: 1, good: 3, acceptable: 5, noticeable: 10 },
  hyab: { excellent: 1, good: 3, acceptable: 5, noticeable: 10 },
  'oklch-weighted': { excellent: 1, good: 3, acceptable: 5, noticeable: 10 },
};

/**
 * Data structure for the result card
 */
export interface ResultCardData {
  /** The dye being displayed */
  dye: Dye | DyeWithDistance;
  /** HEX color of the original/input color (with #) */
  originalColor: string;
  /** HEX color of the matched dye (with #) */
  matchedColor: string;
  /** Delta-E color difference (optional) */
  deltaE?: number;
  /** Hue deviance in degrees from ideal (optional) */
  hueDeviance?: number;
  /**
   * Color matching algorithm used for distance calculation.
   * Used to display appropriate labels and adjust color coding thresholds.
   */
  matchingMethod?: MatchingMethod;
  /** Market server name (optional) */
  marketServer?: string;
  /** Price in Gil (optional) */
  price?: number;
  /** Vendor cost in Gil (optional) */
  vendorCost?: number;
  /**
   * Error code when price fetching fails (optional).
   * Format: "H" prefix for HTTP errors (e.g., "H429" for rate limiting),
   * "N" prefix for network errors (e.g., "NOFF" for offline),
   * "E" prefix for other errors (e.g., "EPRS" for parse error).
   */
  marketError?: string;
}

/**
 * Context menu action identifiers
 *
 * Grouped into categories:
 * - Inspect: harmony, budget, accessibility, comparison
 * - Transform: gradient, mixer
 * - External: universalis, garlandtools, teamcraft, saddlebag
 *
 * Also includes legacy action names for backwards compatibility with
 * existing tool components that listen for context-action events.
 */
export type ContextAction =
  // Inspect Dye in...
  | 'inspect-harmony'
  | 'inspect-budget'
  | 'inspect-accessibility'
  | 'inspect-comparison'
  // Transform Dye in...
  | 'transform-gradient'
  | 'transform-mixer'
  // Open in browser...
  | 'external-universalis'
  | 'external-garlandtools'
  | 'external-teamcraft'
  | 'external-saddlebag'
  // Legacy actions (for backwards compatibility with existing tool components)
  | 'add-comparison' // → use 'inspect-comparison'
  | 'add-mixer' // → use 'transform-mixer'
  | 'add-accessibility' // → use 'inspect-accessibility'
  | 'see-harmonies' // → use 'inspect-harmony'
  | 'budget' // → use 'inspect-budget'
  | 'copy-hex' // kept for clipboard functionality
  | 'add-mixer-slot-1'
  | 'add-mixer-slot-2';

/**
 * Storage keys for tool dye selections
 *
 * Note: The Dye Mixer (v4) uses a different format than other tools:
 * - Mixer v4: [number | null, number | null] tuple
 * - Other tools: number[] array
 */
const STORAGE_KEYS = {
  comparison: 'v3_comparison_selected_dyes',
  // Gradient Builder uses the legacy v3 mixer key (stores as number[])
  gradient: 'v3_mixer_selected_dyes',
  accessibility: 'v3_accessibility_selected_dyes',
  budget: 'v3_budget_target',
  harmony: 'v3_harmony_target',
  // Dye Mixer v4 uses a different key AND format (tuple, not array)
  mixerV4: 'v4_mixer_selected_dyes',
} as const;

/**
 * Maximum dye slots per tool
 * Note: mixer is handled separately due to different storage format
 */
const MAX_SLOTS = {
  comparison: 4,
  gradient: 2,
  accessibility: 4,
} as const;

/**
 * External URL templates (use itemID)
 */
const EXTERNAL_URLS = {
  universalis: (itemID: number) => `https://universalis.app/market/${itemID}`,
  garlandtools: (itemID: number) => `https://www.garlandtools.org/db/#item/${itemID}`,
  teamcraft: (itemID: number) => `https://ffxivteamcraft.com/db/en/item/${itemID}`,
  saddlebag: (itemID: number) => `https://saddlebagexchange.com/queries/item-data/${itemID}`,
} as const;

/**
 * Generate a short market error code from an error or HTTP status.
 *
 * Error code prefixes:
 * - "H" = HTTP error (e.g., "H429" for rate limiting, "H500" for server error)
 * - "N" = Network error (e.g., "NOFF" for offline, "NTMO" for timeout)
 * - "E" = Other errors (e.g., "EPRS" for parse error, "EUNK" for unknown)
 *
 * @param error - The error that occurred during price fetching
 * @returns Short error code string (e.g., "H429", "NOFF")
 */
export function generateMarketErrorCode(error: unknown): string {
  // Check for HTTP status in error message
  if (error instanceof Error) {
    const message = error.message;

    // HTTP errors: look for "HTTP XXX" pattern
    const httpMatch = message.match(/HTTP\s*(\d{3})/i);
    if (httpMatch) {
      return `H${httpMatch[1]}`;
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('abort')) {
      return 'NTMO';
    }

    // Network/fetch errors
    if (message.includes('network') || message.includes('fetch')) {
      return navigator.onLine ? 'NFCH' : 'NOFF';
    }

    // Parse errors
    if (message.includes('JSON') || message.includes('parse')) {
      return 'EPRS';
    }

    // Rate limit (if in message but not captured as HTTP)
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'H429';
    }
  }

  // Offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'NOFF';
  }

  // Unknown error
  return 'EUNK';
}

/**
 * V4 Result Card - Unified dye result display
 *
 * Features:
 * - Fixed 280px width for consistent grid layouts
 * - Split color preview (Original vs Match) - 100px tall
 * - Two-column details grid (Technical + Acquisition)
 * - Delta-E and Hue Deviance color coding for match quality
 * - HSV values in Technical column
 * - Action bar at bottom with Select Dye button + context menu
 * - Context menu pops UP from action bar
 *
 * @fires card-select - Emits when "Select Dye" button is clicked
 *   - `detail.dye`: The selected dye
 * @fires context-action - Emits when context menu action is selected
 *   - `detail.action`: The action identifier
 *   - `detail.dye`: The associated dye
 *
 * @example
 * ```html
 * <v4-result-card
 *   .data=${{
 *     dye: someDye,
 *     originalColor: '#ff0000',
 *     matchedColor: '#e01010',
 *     deltaE: 2.5,
 *     hueDeviance: 1.2
 *   }}
 *   @card-select=${(e) => this.handleSelect(e.detail.dye)}
 *   @context-action=${(e) => this.handleAction(e.detail)}
 * ></v4-result-card>
 * ```
 */
@customElement('v4-result-card')
export class ResultCard extends BaseLitComponent {
  /**
   * Card data containing dye info and colors
   */
  @property({ attribute: false })
  data?: ResultCardData;

  /**
   * Show the action bar and context menu
   */
  @property({ type: Boolean, attribute: 'show-actions' })
  showActions: boolean = true;

  /**
   * Label for primary action button
   */
  @property({ type: String, attribute: 'primary-action-label' })
  primaryActionLabel: string = 'Select Dye';

  /**
   * When true, clicking the primary button opens the context menu
   * instead of emitting the card-select event
   */
  @property({ type: Boolean, attribute: 'primary-opens-menu' })
  primaryOpensMenu: boolean = false;

  /**
   * When true, clicking the primary button opens a slot picker menu
   * allowing user to choose which mixer slot to replace
   */
  @property({ type: Boolean, attribute: 'show-slot-picker' })
  showSlotPicker: boolean = false;

  /**
   * Selected state styling
   */
  @property({ type: Boolean, reflect: true })
  selected: boolean = false;

  /**
   * Show HEX code in technical details
   */
  @property({ type: Boolean, attribute: 'show-hex' })
  showHex: boolean = true;

  /**
   * Show RGB values in technical details
   */
  @property({ type: Boolean, attribute: 'show-rgb' })
  showRgb: boolean = true;

  /**
   * Show HSV values in technical details
   */
  @property({ type: Boolean, attribute: 'show-hsv' })
  showHsv: boolean = true;

  /**
   * Show LAB values in technical details
   */
  @property({ type: Boolean, attribute: 'show-lab' })
  showLab: boolean = false;

  /**
   * Show Delta-E color distance in technical details
   */
  @property({ type: Boolean, attribute: 'show-delta-e' })
  showDeltaE: boolean = true;

  /**
   * Show market prices in acquisition column
   */
  @property({ type: Boolean, attribute: 'show-price' })
  showPrice: boolean = true;

  /**
   * Show acquisition source information
   */
  @property({ type: Boolean, attribute: 'show-acquisition' })
  showAcquisition: boolean = true;

  /**
   * Context menu open state
   */
  @state()
  private menuOpen: boolean = false;

  /**
   * Slot picker menu open state
   */
  @state()
  private slotMenuOpen: boolean = false;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        width: var(--v4-result-card-width, 280px);
      }

      .result-card {
        background: linear-gradient(
          to bottom,
          var(--theme-card-background, #2a2a2a),
          var(--v4-card-gradient-end, #151515)
        );
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-radius: 12px;
        /* overflow: visible to allow context menu submenus to escape */
        overflow: visible;
        transition:
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms),
          border-color var(--v4-transition-fast, 150ms);
        position: relative;
      }

      /* Clip color preview area for rounded corners */
      .color-preview {
        overflow: hidden;
      }

      /* Clip header for rounded top corners */
      .card-header {
        border-radius: 11px 11px 0 0;
      }

      .result-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
        border-color: var(--theme-text-muted, #888888);
      }

      :host([selected]) .result-card {
        border-color: var(--theme-primary, #d4af37);
        box-shadow: 0 0 0 2px var(--theme-primary, #d4af37);
      }

      /* Header - Dark background, centered name */
      .card-header {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 16px;
        background: rgba(0, 0, 0, 0.4);
        border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
      }

      .dye-name {
        margin: 0;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: var(--theme-text, #e0e0e0);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
      }

      /* Color Preview - 100px tall */
      .color-preview {
        display: flex;
        height: 100px;
        width: 100%;
        position: relative;
        flex-shrink: 0;
      }

      .preview-half {
        flex: 1;
        height: 100%;
        position: relative;
      }

      .preview-label {
        position: absolute;
        bottom: 4px;
        width: 100%;
        text-align: center;
        font-size: 9px;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.8);
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        pointer-events: none;
      }

      /* Details Grid */
      .details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 12px;
        background: linear-gradient(
          to bottom,
          var(--theme-card-background, #2a2a2a),
          var(--v4-card-gradient-end, #151515)
        );
      }

      .detail-column {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .column-header {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--theme-text-muted, #888888);
        margin-bottom: 4px;
        border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        padding-bottom: 2px;
      }

      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 11px;
      }

      .detail-label {
        color: var(--theme-text-muted, #888888);
      }

      .detail-value {
        font-family: 'Consolas', 'Monaco', monospace;
        color: var(--theme-text, #e0e0e0);
        text-align: right;
      }

      .detail-value.large {
        font-size: 13px;
        font-weight: 600;
        color: var(--theme-primary, #d4af37);
        margin-left: auto; /* Right-align when no label present */
      }

      /* Delta-E color coding */
      .delta-excellent {
        color: #4caf50;
      }
      .delta-good {
        color: #8bc34a;
      }
      .delta-acceptable {
        color: #ffc107;
      }
      .delta-noticeable {
        color: #ff9800;
      }
      .delta-poor {
        color: #f44336;
      }

      /* Market error code styling */
      .market-error {
        color: #f44336;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.5px;
      }

      /* Action Bar at Bottom */
      .card-actions {
        padding: 8px;
        display: flex;
        justify-content: center;
        border-top: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        background: rgba(0, 0, 0, 0.2);
      }

      .action-row {
        display: flex;
        gap: 8px;
        width: 100%;
        align-items: center;
      }

      .primary-action-btn {
        flex: 1;
        text-align: center;
        padding: 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--theme-card-background, #121212);
        background: var(--theme-primary, #d4af37);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color var(--v4-transition-fast, 150ms);
      }

      .primary-action-btn:hover {
        background: var(--theme-accent-hover, #f0c040);
      }

      .primary-action-btn:focus-visible {
        outline: 2px solid var(--theme-text, #e0e0e0);
        outline-offset: 2px;
      }

      /* Context Menu Container */
      .context-menu-container {
        position: relative;
        display: inline-block;
      }

      .menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 6px;
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-radius: 4px;
        background: transparent;
        color: var(--theme-text-muted, #888888);
        cursor: pointer;
        transition: all var(--v4-transition-fast, 150ms);
      }

      .menu-btn:hover,
      .menu-btn.active {
        background: rgba(255, 255, 255, 0.1);
        color: var(--theme-text, #e0e0e0);
        border-color: var(--theme-text-muted, #888888);
      }

      .menu-btn:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 2px;
      }

      .menu-btn svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }

      /* Context Menu - Pops UP from action bar */
      .context-menu {
        position: absolute;
        bottom: 100%;
        right: 0;
        width: 200px;
        background: var(--theme-card-background, #2a2a2a);
        border: 1px solid var(--theme-border, #3a3a3a);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        padding: 6px 0;
        z-index: 100;
        margin-bottom: 8px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(8px);
        transition:
          opacity 0.15s,
          transform 0.15s,
          visibility 0.15s;
      }

      .context-menu.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: var(--theme-text-muted, #888888);
        text-align: left;
        font-size: 13px;
        cursor: pointer;
        transition: background-color 0.1s;
      }

      .menu-item:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--theme-text, #e0e0e0);
      }

      .menu-item:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: -2px;
      }

      /* Submenu parent item - has chevron indicator */
      .menu-item.has-submenu {
        position: relative;
        justify-content: space-between;
      }

      /* Chevron arrow pointing left */
      .menu-item.has-submenu::after {
        content: '';
        width: 0;
        height: 0;
        border-top: 4px solid transparent;
        border-bottom: 4px solid transparent;
        border-right: 5px solid currentColor;
        transform: rotate(180deg);
        opacity: 0.6;
        transition: opacity 0.15s;
        flex-shrink: 0;
        margin-left: 8px;
      }

      .menu-item.has-submenu:hover::after {
        opacity: 1;
      }

      /* Invisible bridge to left side - prevents hover gap */
      .menu-item.has-submenu::before {
        content: '';
        position: absolute;
        right: 100%;
        top: 0;
        width: 16px;
        height: 100%;
        background: transparent;
      }

      /* Nested submenu - pops LEFT from parent menu */
      .submenu {
        position: absolute;
        right: calc(100% + 8px);
        top: -6px;
        width: 200px;
        background: var(--theme-card-background, #2a2a2a);
        border: 1px solid var(--theme-border, #3a3a3a);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        padding: 6px 0;
        opacity: 0;
        visibility: hidden;
        transform: translateX(8px);
        transition:
          opacity 0.15s,
          transform 0.15s,
          visibility 0.15s;
        pointer-events: none;
        z-index: 200;
      }

      .menu-item.has-submenu:hover > .submenu,
      .menu-item.has-submenu:focus-within > .submenu {
        opacity: 1;
        visibility: visible;
        transform: translateX(0);
        pointer-events: auto;
      }

      .submenu .menu-item {
        font-size: 12px;
        padding: 8px 14px;
      }

      /* Menu section divider */
      .menu-divider {
        height: 1px;
        background: var(--theme-border, rgba(255, 255, 255, 0.1));
        margin: 4px 0;
      }

      /* Slot Picker Menu - Pops UP from primary button */
      .slot-picker-container {
        position: relative;
        flex: 1;
        display: flex;
      }

      .slot-picker-container .primary-action-btn {
        flex: 1;
      }

      .slot-picker-menu {
        position: absolute;
        bottom: 100%;
        left: 0;
        right: 0;
        background: var(--theme-card-background, #2a2a2a);
        border: 1px solid var(--theme-border, #3a3a3a);
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        padding: 6px 0;
        z-index: 100;
        margin-bottom: 8px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(8px);
        transition:
          opacity 0.15s,
          transform 0.15s,
          visibility 0.15s;
      }

      .slot-picker-menu.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .slot-picker-item {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: var(--theme-text-muted, #888888);
        text-align: center;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.1s;
      }

      .slot-picker-item:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--theme-text, #e0e0e0);
      }

      .slot-picker-item:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: -2px;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .result-card,
        .menu-btn,
        .context-menu,
        .slot-picker-menu,
        .primary-action-btn {
          transition: none;
        }
        .result-card:hover {
          transform: none;
        }
      }
    `,
  ];

  /**
   * Get Delta-E color class based on value and matching method.
   * Uses algorithm-specific thresholds since RGB has different scale than perceptual methods.
   */
  private getDeltaEClass(deltaE?: number, method?: MatchingMethod): string {
    if (deltaE === undefined) return '';

    // Use method-specific thresholds, fallback to OKLAB thresholds
    const thresholds = DELTA_THRESHOLDS[method ?? 'oklab'];

    if (deltaE <= thresholds.excellent) return 'delta-excellent';
    if (deltaE <= thresholds.good) return 'delta-good';
    if (deltaE <= thresholds.acceptable) return 'delta-acceptable';
    if (deltaE <= thresholds.noticeable) return 'delta-noticeable';
    return 'delta-poor';
  }

  /**
   * Get the display label for a matching method
   */
  private getMatchingMethodLabel(method?: MatchingMethod): string {
    if (!method) return 'ΔE'; // Generic fallback
    return MATCHING_METHOD_LABELS[method];
  }

  /**
   * Format price with commas and "G" suffix.
   * If an error code is provided, displays the error code instead.
   */
  private formatPrice(price?: number, errorCode?: string): string {
    // If there's an error code, display it instead of the price
    if (errorCode) return errorCode;
    if (price === undefined || price === null) return '—';
    return `${price.toLocaleString()} G`;
  }

  /**
   * Format vendor cost with "G" suffix
   */
  private formatVendorCost(cost?: number): string {
    if (cost === undefined || cost === null) return '—';
    return `${cost.toLocaleString()} G`;
  }

  /**
   * Format LAB values for display (rounded to integers)
   */
  private formatLabValues(): string {
    if (!this.data) return '—';
    const lab = ColorService.hexToLab(this.data.matchedColor);
    return `${Math.round(lab.L)}, ${Math.round(lab.a)}, ${Math.round(lab.b)}`;
  }

  /**
   * Handle primary action (Select Dye) click
   * - If showSlotPicker is true, opens slot picker menu
   * - Else if primaryOpensMenu is true, opens context menu
   * - Otherwise emits card-select event
   */
  private handleSelectClick(e: Event): void {
    e.stopPropagation();
    if (this.showSlotPicker) {
      // Open slot picker menu
      this.slotMenuOpen = !this.slotMenuOpen;
      this.menuOpen = false; // Close context menu if open
    } else if (this.primaryOpensMenu) {
      // Open context menu instead of emitting card-select
      this.menuOpen = !this.menuOpen;
    } else if (this.data) {
      this.emit<{ dye: Dye }>('card-select', { dye: this.data.dye });
    }
  }

  /**
   * Handle slot picker action
   */
  private handleSlotAction(slotIndex: 1 | 2): void {
    if (this.data) {
      const action: ContextAction = slotIndex === 1 ? 'add-mixer-slot-1' : 'add-mixer-slot-2';
      this.emit<{ action: ContextAction; dye: Dye }>('context-action', {
        action,
        dye: this.data.dye,
      });
    }
    this.slotMenuOpen = false;
  }

  /**
   * Toggle context menu
   */
  private handleMenuClick(e: Event): void {
    e.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  /**
   * Handle context menu action
   * Routes to appropriate handler based on action type
   */
  private handleMenuAction(action: ContextAction): void {
    if (!this.data) return;

    const dye = this.data.dye;

    // Handle action based on type
    switch (action) {
      // Inspect actions - navigate to tool
      case 'inspect-harmony':
        this.navigateToHarmony(dye);
        break;
      case 'inspect-budget':
        this.setAsBudgetTarget(dye);
        break;
      case 'inspect-accessibility':
        this.addToTool('accessibility', dye);
        break;
      case 'inspect-comparison':
        this.addToTool('comparison', dye);
        break;

      // Transform actions - navigate to tool
      case 'transform-gradient':
        this.addToTool('gradient', dye);
        break;
      case 'transform-mixer':
        this.addToMixer(dye);
        break;

      // External links - open in new tab
      case 'external-universalis':
        this.openExternalUrl('universalis', dye.itemID);
        break;
      case 'external-garlandtools':
        this.openExternalUrl('garlandtools', dye.itemID);
        break;
      case 'external-teamcraft':
        this.openExternalUrl('teamcraft', dye.itemID);
        break;
      case 'external-saddlebag':
        this.openExternalUrl('saddlebag', dye.itemID);
        break;

      // Legacy slot picker actions
      case 'add-mixer-slot-1':
      case 'add-mixer-slot-2':
        // Handled by handleSlotAction
        break;
    }

    // Also emit for external listeners
    this.emit<{ action: ContextAction; dye: Dye }>('context-action', {
      action,
      dye,
    });
    this.menuOpen = false;
  }

  /**
   * Navigate to Harmony Explorer with dye pre-selected
   * Overwrites any existing dye in localStorage
   */
  private navigateToHarmony(dye: Dye): void {
    // Use itemID for localization-safe deep linking
    RouterService.navigateTo('harmony', { dyeId: String(dye.itemID) });
  }

  /**
   * Set dye as Budget Suggestions target
   * Overwrites any existing target
   */
  private setAsBudgetTarget(dye: Dye): void {
    StorageService.setItem(STORAGE_KEYS.budget, dye.id);
    ToastService.success(LanguageService.t('resultCard.sentToBudget'));
    RouterService.navigateTo('budget');
  }

  /**
   * Add dye to a multi-slot tool (comparison, accessibility, gradient)
   * Shows slot selection modal if all slots are full
   * Note: Mixer is handled separately via addToMixer() due to different storage format
   */
  private addToTool(tool: 'comparison' | 'accessibility' | 'gradient', dye: Dye): void {
    const storageKey = STORAGE_KEYS[tool];
    const maxSlots = MAX_SLOTS[tool];
    const currentDyes = StorageService.getItem<number[]>(storageKey) ?? [];

    // Check if dye already exists
    if (currentDyes.includes(dye.id)) {
      ToastService.info(LanguageService.t('resultCard.dyeAlreadyIn'));
      return;
    }

    // Has space - add directly
    if (currentDyes.length < maxSlots) {
      currentDyes.push(dye.id);
      StorageService.setItem(storageKey, currentDyes);
      ToastService.success(LanguageService.t('resultCard.addedTo'));
      // Navigate to the appropriate tool
      RouterService.navigateTo(tool);
      return;
    }

    // Full - show slot selection modal
    this.showSlotSelectionModal(tool, dye, currentDyes);
  }

  /**
   * Add dye to the Dye Mixer (v4)
   * Uses tuple format [number | null, number | null] instead of array
   */
  private addToMixer(dye: Dye): void {
    const currentDyes = StorageService.getItem<[number | null, number | null]>(
      STORAGE_KEYS.mixerV4
    ) ?? [null, null];

    // Check if dye already exists in either slot
    if (currentDyes[0] === dye.id || currentDyes[1] === dye.id) {
      ToastService.info(LanguageService.t('resultCard.dyeAlreadyIn'));
      return;
    }

    // Find first empty slot
    if (currentDyes[0] === null) {
      currentDyes[0] = dye.id;
      StorageService.setItem(STORAGE_KEYS.mixerV4, currentDyes);
      ToastService.success(LanguageService.t('resultCard.addedTo'));
      RouterService.navigateTo('mixer');
      return;
    }

    if (currentDyes[1] === null) {
      currentDyes[1] = dye.id;
      StorageService.setItem(STORAGE_KEYS.mixerV4, currentDyes);
      ToastService.success(LanguageService.t('resultCard.addedTo'));
      RouterService.navigateTo('mixer');
      return;
    }

    // Both slots full - show slot selection modal
    // Convert tuple to array for modal compatibility
    const dyeIds = currentDyes.filter((id): id is number => id !== null);
    this.showSlotSelectionModal('mixer', dye, dyeIds);
  }

  /**
   * Get display name for a tool
   */
  private getToolDisplayName(tool: 'comparison' | 'accessibility' | 'gradient' | 'mixer'): string {
    const toolNames: Record<typeof tool, string> = {
      comparison: LanguageService.t('tools.comparison.shortName'),
      accessibility: LanguageService.t('tools.accessibility.shortName'),
      gradient: LanguageService.t('tools.gradient.shortName'),
      mixer: LanguageService.t('tools.mixer.shortName'),
    };
    return toolNames[tool];
  }

  /**
   * Show modal for selecting which slot to replace when tool is full
   */
  private showSlotSelectionModal(
    tool: 'comparison' | 'accessibility' | 'gradient' | 'mixer',
    newDye: Dye,
    currentDyeIds: number[]
  ): void {
    const dyeService = DyeService.getInstance();
    const _toolName = this.getToolDisplayName(tool);

    // Generate slot labels based on tool type
    const slotLabels =
      tool === 'mixer' || tool === 'gradient'
        ? [LanguageService.t('mixer.startDye'), LanguageService.t('mixer.endDye')]
        : currentDyeIds.map((_, i) => `${LanguageService.t('common.slot')} ${i + 1}`);

    // Build slot buttons HTML
    const slotsHtml = currentDyeIds
      .map((dyeId, index) => {
        const existingDye = dyeService.getDyeById(dyeId);
        const dyeName = existingDye
          ? LanguageService.getDyeName(existingDye.itemID) || existingDye.name
          : 'Unknown';
        const dyeHex = existingDye?.hex ?? '#888888';

        return `
        <button type="button" class="slot-select-btn flex items-center gap-3 w-full p-3 rounded-lg border transition-colors"
          style="background: var(--theme-card-background); border-color: var(--theme-border);"
          data-slot="${index}">
          <div class="w-8 h-8 rounded" style="background: ${dyeHex}; border: 1px solid var(--theme-border);"></div>
          <div class="flex-1 text-left">
            <p class="font-medium text-sm" style="color: var(--theme-text);">${slotLabels[index]}</p>
            <p class="text-xs" style="color: var(--theme-text-muted);">${dyeName}</p>
          </div>
          <span class="text-xs" style="color: var(--theme-text-muted);">${LanguageService.t('common.replace')}</span>
        </button>
      `;
      })
      .join('');

    const newDyeName = LanguageService.getDyeName(newDye.itemID) || newDye.name;

    const content = `
      <p class="mb-4" style="color: var(--theme-text);">
        ${LanguageService.t('resultCard.slotsFull')}
      </p>
      <div class="space-y-2">${slotsHtml}</div>
      <div class="mt-4 p-3 rounded-lg flex items-center gap-3" style="background: var(--theme-background-secondary);">
        <div class="w-8 h-8 rounded" style="background: ${newDye.hex}; border: 1px solid var(--theme-border);"></div>
        <div>
          <p class="text-xs" style="color: var(--theme-text-muted);">${LanguageService.t('resultCard.addingDye')}:</p>
          <p class="font-medium text-sm" style="color: var(--theme-text);">${newDyeName}</p>
        </div>
      </div>
    `;

    const modalId = ModalService.show({
      type: 'custom',
      title: LanguageService.t('resultCard.selectSlotToReplace'),
      content: content,
      size: 'sm',
      closable: true,
      closeOnBackdrop: true,
      cancelText: LanguageService.t('common.cancel'),
    });

    // Attach click handlers after modal renders
    setTimeout(() => {
      const buttons = document.querySelectorAll('.slot-select-btn');
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const slotIndex = parseInt(btn.getAttribute('data-slot') || '0', 10);

          // Handle mixer specially (uses tuple format)
          if (tool === 'mixer') {
            const mixerDyes: [number | null, number | null] = [
              currentDyeIds[0] ?? null,
              currentDyeIds[1] ?? null,
            ];
            mixerDyes[slotIndex as 0 | 1] = newDye.id;
            StorageService.setItem(STORAGE_KEYS.mixerV4, mixerDyes);
          } else {
            // Other tools use array format
            const storageKey = STORAGE_KEYS[tool];
            currentDyeIds[slotIndex] = newDye.id;
            StorageService.setItem(storageKey, currentDyeIds);
          }

          ModalService.dismiss(modalId);
          ToastService.success(LanguageService.t('resultCard.replacedInTool'));
          RouterService.navigateTo(tool);
        });

        // Hover effects
        btn.addEventListener('mouseenter', () => {
          (btn as HTMLElement).style.backgroundColor = 'var(--theme-card-hover)';
        });
        btn.addEventListener('mouseleave', () => {
          (btn as HTMLElement).style.backgroundColor = 'var(--theme-card-background)';
        });
      });
    }, 50);
  }

  /**
   * Open an external URL in a new browser tab
   */
  private openExternalUrl(
    site: 'universalis' | 'garlandtools' | 'teamcraft' | 'saddlebag',
    itemID: number
  ): void {
    const url = EXTERNAL_URLS[site](itemID);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Close menus on click outside
   */
  private handleDocumentClick = (): void => {
    if (this.menuOpen) {
      this.menuOpen = false;
    }
    if (this.slotMenuOpen) {
      this.slotMenuOpen = false;
    }
  };

  /**
   * Close menus on Escape
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.menuOpen) {
        this.menuOpen = false;
      }
      if (this.slotMenuOpen) {
        this.slotMenuOpen = false;
      }
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  protected override render(): TemplateResult {
    if (!this.data) {
      return html`<div class="result-card">No data</div>`;
    }

    const {
      dye,
      originalColor,
      matchedColor,
      deltaE,
      hueDeviance,
      marketServer,
      price,
      vendorCost,
    } = this.data;

    // Get HSV values from dye (may be undefined for some dye types)
    const hsv = dye.hsv;

    return html`
      <article
        class="result-card"
        role="article"
        aria-label="Dye result: ${LanguageService.getDyeName(dye.id) || dye.name}"
      >
        <!-- Header - Dark bg, centered name -->
        <header class="card-header">
          <h3 class="dye-name">${LanguageService.getDyeName(dye.id) || dye.name}</h3>
        </header>

        <!-- Color Preview - 100px tall -->
        <div class="color-preview">
          <div class="preview-half" style="background-color: ${originalColor}">
            <span class="preview-label">${LanguageService.t('common.original')}</span>
          </div>
          <div class="preview-half" style="background-color: ${matchedColor}">
            <span class="preview-label">${LanguageService.t('common.match')}</span>
          </div>
        </div>

        <!-- Details Grid -->
        <div class="details-grid">
          <!-- Technical Column -->
          <div class="detail-column">
            <div class="column-header">${LanguageService.t('common.technical')}</div>
            ${this.showDeltaE
              ? html`
                  <div class="detail-row">
                    <span
                      class="detail-label"
                      title="${this.data?.matchingMethod
                        ? `Distance calculated using ${this.getMatchingMethodLabel(this.data.matchingMethod)} algorithm`
                        : 'Color distance'}"
                      >${this.getMatchingMethodLabel(this.data?.matchingMethod)}</span
                    >
                    <span
                      class="detail-value ${this.getDeltaEClass(deltaE, this.data?.matchingMethod)}"
                    >
                      ${deltaE !== undefined ? deltaE.toFixed(2) : '—'}
                    </span>
                  </div>
                `
              : nothing}
            ${this.showDeltaE && hueDeviance !== undefined
              ? html`
                  <div class="detail-row">
                    <span class="detail-label">Hue°</span>
                    <span class="detail-value">${hueDeviance.toFixed(1)}°</span>
                  </div>
                `
              : nothing}
            ${this.showHex
              ? html`
                  <div class="detail-row">
                    <span class="detail-label">HEX</span>
                    <span class="detail-value">${matchedColor.toUpperCase()}</span>
                  </div>
                `
              : nothing}
            ${this.showRgb
              ? html`
                  <div class="detail-row">
                    <span class="detail-label">RGB</span>
                    <span class="detail-value">${dye.rgb.r}, ${dye.rgb.g}, ${dye.rgb.b}</span>
                  </div>
                `
              : nothing}
            ${this.showHsv && hsv
              ? html`
                  <div class="detail-row">
                    <span class="detail-label">HSV</span>
                    <span class="detail-value"
                      >${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%</span
                    >
                  </div>
                `
              : nothing}
            ${this.showLab
              ? html`
                  <div class="detail-row">
                    <span class="detail-label">LAB</span>
                    <span class="detail-value">${this.formatLabValues()}</span>
                  </div>
                `
              : nothing}
          </div>

          <!-- Acquisition Column - only show if acquisition or price enabled -->
          ${this.showAcquisition || this.showPrice
            ? html`
                <div class="detail-column">
                  <div class="column-header">${LanguageService.t('common.acquisition')}</div>
                  ${this.showAcquisition
                    ? html`
                        <div class="detail-row">
                          <span class="detail-label">${LanguageService.t('common.source')}</span>
                          <span class="detail-value"
                            >${dye.acquisition
                              ? LanguageService.getAcquisition(dye.acquisition)
                              : '—'}</span
                          >
                        </div>
                        <div class="detail-row">
                          <span class="detail-label">${LanguageService.t('common.cost')}</span>
                          <span class="detail-value">${this.formatVendorCost(vendorCost)}</span>
                        </div>
                      `
                    : nothing}
                  ${this.showPrice
                    ? html`
                        <div class="detail-row">
                          <span class="detail-label">${LanguageService.t('common.market')}</span>
                          <span class="detail-value">${marketServer ?? 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                          <span
                            class="detail-value large ${this.data?.marketError
                              ? 'market-error'
                              : ''}"
                            >${this.formatPrice(price, this.data?.marketError)}</span
                          >
                        </div>
                      `
                    : nothing}
                </div>
              `
            : nothing}
        </div>

        <!-- Action Bar at Bottom -->
        ${this.showActions
          ? html`
              <div class="card-actions">
                <div class="action-row">
                  ${this.showSlotPicker
                    ? html`
                        <div class="slot-picker-container">
                          <button
                            class="primary-action-btn"
                            type="button"
                            aria-haspopup="true"
                            aria-expanded=${this.slotMenuOpen}
                            @click=${this.handleSelectClick}
                          >
                            ${this.primaryActionLabel}
                          </button>
                          <!-- Slot Picker Menu - Pops UP -->
                          <div
                            class="slot-picker-menu ${this.slotMenuOpen ? 'open' : ''}"
                            role="menu"
                            aria-hidden=${!this.slotMenuOpen}
                          >
                            <button
                              class="slot-picker-item"
                              role="menuitem"
                              @click=${() => this.handleSlotAction(1)}
                            >
                              ${LanguageService.t('common.replace')}
                              ${LanguageService.t('common.slot')} 1
                            </button>
                            <button
                              class="slot-picker-item"
                              role="menuitem"
                              @click=${() => this.handleSlotAction(2)}
                            >
                              ${LanguageService.t('common.replace')}
                              ${LanguageService.t('common.slot')} 2
                            </button>
                          </div>
                        </div>
                      `
                    : html`
                        <button
                          class="primary-action-btn"
                          type="button"
                          @click=${this.handleSelectClick}
                        >
                          ${this.primaryActionLabel}
                        </button>
                      `}
                  <div class="context-menu-container">
                    <button
                      class="menu-btn ${this.menuOpen ? 'active' : ''}"
                      type="button"
                      aria-label="${LanguageService.t('aria.moreActions')}"
                      aria-haspopup="true"
                      aria-expanded=${this.menuOpen}
                      @click=${this.handleMenuClick}
                    >
                      ${unsafeHTML(ICON_CONTEXT_MENU)}
                    </button>
                    <!-- Context Menu - Pops UP with nested submenus -->
                    <div
                      class="context-menu ${this.menuOpen ? 'open' : ''}"
                      role="menu"
                      aria-hidden=${!this.menuOpen}
                    >
                      <!-- Inspect Dye in... -->
                      <div class="menu-item has-submenu" role="menuitem" tabindex="0">
                        ${LanguageService.t('resultCard.inspectDyeIn')}
                        <div class="submenu" role="menu">
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('inspect-harmony')}
                          >
                            ${LanguageService.t('resultCard.tools.harmony')}
                          </button>
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('inspect-budget')}
                          >
                            ${LanguageService.t('resultCard.tools.budget')}
                          </button>
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('inspect-accessibility')}
                          >
                            ${LanguageService.t('resultCard.tools.accessibility')}
                          </button>
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('inspect-comparison')}
                          >
                            ${LanguageService.t('resultCard.tools.comparison')}
                          </button>
                        </div>
                      </div>

                      <!-- Transform Dye in... -->
                      <div class="menu-item has-submenu" role="menuitem" tabindex="0">
                        ${LanguageService.t('resultCard.transformDyeIn')}
                        <div class="submenu" role="menu">
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('transform-gradient')}
                          >
                            ${LanguageService.t('resultCard.tools.gradient')}
                          </button>
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('transform-mixer')}
                          >
                            ${LanguageService.t('resultCard.tools.mixer')}
                          </button>
                        </div>
                      </div>

                      <div class="menu-divider"></div>

                      <!-- Open in browser... -->
                      <div class="menu-item has-submenu" role="menuitem" tabindex="0">
                        ${LanguageService.t('resultCard.openInBrowser')}
                        <div class="submenu" role="menu">
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('external-universalis')}
                          >
                            Universalis
                          </button>
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('external-garlandtools')}
                          >
                            GarlandTools
                          </button>
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('external-teamcraft')}
                          >
                            TeamCraft
                          </button>
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('external-saddlebag')}
                          >
                            Saddlebag Exchange
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `
          : nothing}
      </article>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-result-card': ResultCard;
  }
}
