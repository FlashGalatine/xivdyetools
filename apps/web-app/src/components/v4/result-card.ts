/**
 * XIV Dye Tools 5.0 - Result Card Component (Ticket · Split zones)
 *
 * The confirmed 5B "Ticket" geometry from the design project's
 * `ResultCard.dc.html`: a colour verdict above a perforation, the data below
 * it split into a two-column numeric matrix (short uniform values inline) and
 * a full-width text zone (long localized values wrap, never truncate).
 *
 * German-proofing contract (Turn 5):
 * - the card root carries `lang` so DE hyphenates,
 * - the dye name uses `overflow-wrap: anywhere; hyphens: auto`,
 * - every label is `flex-shrink: 0`, every value `min-width: 0` with
 *   `overflow-wrap: anywhere` — nothing truncates in any language.
 *
 * The verdict is structural and always ΔE2000 (standing decision) — when the
 * tool ordered its results with another method, the card derives ΔE2000
 * itself from the original/matched pair. Optional rows are user-configurable
 * (persistent via DisplayOptionsConfig, default all-on).
 *
 * @module components/v4/result-card
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseLitComponent } from './base-lit-component';
import { ICON_CONTEXT_MENU } from '@shared/ui-icons';
import { handoffTo } from '@shared/tool-handoff';
import { customDyeLabel, isCustomDye } from '@shared/custom-dye';
import { formatGil, formatNumber } from '@shared/format';
import type { Dye, DyeWithDistance } from '@xivdyetools/types';
import type { MatchingMethod } from '@shared/tool-config-types';
import {
  ColorService,
  classifyBandTier,
  getConsolidatedDyeName,
  getMarketItemID,
} from '@xivdyetools/core';
import { LanguageService, StorageService, RouterService, ThemeService } from '@services/index';
import { ToastService } from '@services/toast-service';
import { ModalService } from '@services/modal-service';
import { DyeService } from '@services/dye-service-wrapper';

/** Shared 5.0 tier ramps (same as 7C Duel / 9C Ledger). */
const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;

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
   * Color matching algorithm the tool used for `deltaE`. The card's verdict
   * is always ΔE2000 — a non-ciede2000 value here makes the card derive
   * ΔE2000 from the colour pair instead of using `deltaE`.
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
  /**
   * Runner-up dyes for this slot. Rendered as tappable swatch dots so a slot
   * can be swapped without leaving the grid — the tool decides what counts as
   * an alternate (harmony passes the next-closest companions).
   */
  alternates?: Dye[];
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
  | 'inspect-swatch'
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
  // Swatch Matcher incoming dye (one-shot, cleared after consumption)
  swatch: 'v4_swatch_target_dye',
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
 * V4 Result Card - the 5.0 Ticket
 *
 * Structural (always rendered): swatch pair, name, ΔE2000 verdict, action bar.
 * Optional rows are gated by the show* properties, which the tools AND with
 * the user's persisted DisplayOptionsConfig.
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
   * Label for primary action button. Left undefined by the four tools that
   * never pass one; `primaryLabel` then supplies the shared localized string.
   * A field initialiser cannot be used here — it is evaluated once at
   * construction, so the default froze at whatever locale was active when the
   * first card mounted and never followed a language switch.
   */
  @property({ type: String, attribute: 'primary-action-label' })
  primaryActionLabel?: string;

  /** Primary-button label: the caller's override, else the localized default. */
  private get primaryLabel(): string {
    return this.primaryActionLabel ?? LanguageService.t('common.selectDye');
  }

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
   * Compact ticket variant (5B compact) — the grid default everywhere except
   * Dye Comparison, which keeps the full variant. Tightens the head, drops
   * the matrix to a single stacked column, and shrinks the action bar to 44px.
   */
  @property({ type: Boolean, reflect: true })
  compact: boolean = false;

  /**
   * Show HEX code in the numeric matrix
   */
  @property({ type: Boolean, attribute: 'show-hex' })
  showHex: boolean = true;

  /**
   * Show RGB values in the numeric matrix
   */
  @property({ type: Boolean, attribute: 'show-rgb' })
  showRgb: boolean = true;

  /**
   * Show HSV values in the numeric matrix
   */
  @property({ type: Boolean, attribute: 'show-hsv' })
  showHsv: boolean = true;

  /**
   * Show LAB values in the numeric matrix
   */
  @property({ type: Boolean, attribute: 'show-lab' })
  showLab: boolean = true;

  /**
   * Show CMYK values in the numeric matrix (off-doc extra; default off)
   */
  @property({ type: Boolean, attribute: 'show-cmyk' })
  showCmyk: boolean = false;

  /**
   * Legacy gate — the ΔE2000 verdict is structural in 5.0 and always renders
   * (when a real match pair exists). Kept so existing tool assignments and
   * attributes don't break; it no longer controls anything.
   */
  @property({ type: Boolean, attribute: 'show-delta-e' })
  showDeltaE: boolean = true;

  /**
   * Show the HUE OFF readout beside the verdict (when hueDeviance provided)
   */
  @property({ type: Boolean, attribute: 'show-hue' })
  showHue: boolean = true;

  /**
   * Show the STAIN readout beside the verdict
   */
  @property({ type: Boolean, attribute: 'show-stain' })
  showStain: boolean = true;

  /**
   * Show market price row in the text zone
   */
  @property({ type: Boolean, attribute: 'show-price' })
  showPrice: boolean = true;

  /**
   * Show acquisition source + vendor cost rows in the text zone
   */
  @property({ type: Boolean, attribute: 'show-acquisition' })
  showAcquisition: boolean = true;

  /**
   * Show consolidated dye spectrum row in the text zone
   */
  @property({ type: Boolean, attribute: 'show-consolidation' })
  showConsolidation: boolean = true;

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

      .ticket {
        display: flex;
        flex-direction: column;
        background: var(--theme-card-background, #17171a);
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-radius: 12px;
        /* overflow: visible to allow context menu submenus to escape */
        overflow: visible;
        position: relative;
        transition:
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms),
          border-color var(--v4-transition-fast, 150ms);
      }

      .ticket:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.25);
        border-color: var(--theme-text-muted, #888888);
      }

      :host([selected]) .ticket {
        border-color: var(--theme-primary, #d4af37);
        box-shadow: 0 0 0 2px var(--theme-primary, #d4af37);
      }

      /* ---- verdict stub ------------------------------------------------ */

      .head {
        padding: 12px 12px 12px;
      }

      .swatches {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }

      .swatch {
        flex: 1;
        height: 52px;
        border-radius: 8px;
      }

      .dye-name {
        margin: 0;
        font-family: var(--font-display);
        font-size: 15px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--theme-text, #ececee);
        min-height: 36px;
        overflow-wrap: anywhere;
        hyphens: auto;
      }

      .verdict {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 10px;
        margin-top: 6px;
      }

      .de-num {
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 26px;
        line-height: 0.92;
        letter-spacing: -0.5px;
      }

      .metric-label {
        font-family: var(--font-mono);
        font-size: 8.5px;
        letter-spacing: 0.5px;
        color: var(--theme-text-muted, #86868c);
        margin-top: 4px;
      }

      .readout {
        text-align: right;
      }

      .readout-val {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--theme-text, #c6c6ca);
      }

      /* ---- perforation ------------------------------------------------- */

      .perf {
        position: relative;
        height: 1px;
        border-top: 1px dashed var(--theme-text-muted, rgba(255, 255, 255, 0.3));
        opacity: 0.6;
      }

      .perf .notch {
        position: absolute;
        top: -7px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--theme-background, #0b0b0c);
      }

      .perf .notch.left {
        left: -8px;
      }

      .perf .notch.right {
        right: -8px;
      }

      /* ---- numeric matrix ---------------------------------------------- */

      .matrix {
        padding: 12px 12px 10px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 4px 18px;
      }

      .cell {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        min-width: 0;
      }

      .cell-label {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--theme-text-muted, #86868c);
        flex-shrink: 0;
      }

      .cell-val {
        font-family: var(--font-mono);
        font-size: 11.5px;
        line-height: 1.3;
        color: var(--theme-text, #c6c6ca);
        min-width: 0;
        text-align: right;
        overflow-wrap: anywhere;
      }

      /* ---- text zone ---------------------------------------------------- */

      .zone-rule {
        margin: 0 12px;
        border-top: 1px solid var(--theme-border, rgba(255, 255, 255, 0.07));
      }

      .zone {
        padding: 10px 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .zrow {
        display: flex;
        align-items: baseline;
        gap: 10px;
        min-width: 0;
      }

      .zlabel {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--theme-text-muted, #86868c);
        width: 62px;
        flex-shrink: 0;
        overflow-wrap: anywhere;
      }

      .zlabel.latin {
        text-transform: uppercase;
      }

      .zval {
        font-family: var(--font-mono);
        font-size: 11.5px;
        line-height: 1.3;
        color: var(--theme-text, #c6c6ca);
        text-align: right;
        margin-left: auto;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .zrow.market {
        margin-top: 1px;
        padding-top: 7px;
        border-top: 1px dashed var(--theme-border, rgba(255, 255, 255, 0.12));
      }

      /* The market label carries the server name ("MARKET · HALICARNASSUS"),
         which cannot fit the 62px label column of the full variant — it folded
         onto three lines for long world names (Budget target card, Comparison).
         The row sits alone under its dashed rule, so it needs no column
         alignment: let the label take its natural width, as compact does. */
      .zrow.market .zlabel {
        width: auto;
      }

      .market-error {
        color: #f4645a;
        letter-spacing: 0.5px;
      }

      /* ---- alternates ----------------------------------------------------
         Runner-up dyes as swatch dots: one tap swaps the slot in place, so
         choosing between near-equal companions never costs a round trip
         through the picker. */

      .card-alternates {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-top: 1px solid var(--theme-border, rgba(255, 255, 255, 0.07));
        flex-wrap: wrap;
      }

      .alt-label {
        font-family: var(--font-mono);
        font-size: 8.5px;
        letter-spacing: 1px;
        color: var(--theme-text-muted, #888888);
        flex-shrink: 0;
      }

      .alt-dot {
        width: 22px;
        height: 22px;
        padding: 0;
        border-radius: 50%;
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.14));
        box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.22);
        cursor: pointer;
        flex-shrink: 0;
        transition: transform 120ms ease;
      }

      .alt-dot:hover {
        transform: scale(1.12);
      }

      .alt-dot:focus-visible {
        outline: 2px solid var(--theme-primary, #ea4133);
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        .alt-dot {
          transition: none;
        }
      }

      /* ---- action bar ---------------------------------------------------- */

      .card-actions {
        display: flex;
        align-items: stretch;
        border-top: 1px solid var(--theme-border, rgba(255, 255, 255, 0.07));
      }

      .primary-action-btn {
        flex: 1;
        min-width: 0;
        height: 46px;
        border: none;
        border-radius: 0 0 0 11px;
        cursor: pointer;
        font-family: var(--font-display);
        font-weight: 600;
        font-size: 12.5px;
        line-height: 1.15;
        padding: 0 6px;
        background: var(--theme-primary, #d4af37);
        color: var(--theme-card-background, #121212);
        transition: filter var(--v4-transition-fast, 150ms);
      }

      .primary-action-btn:hover {
        filter: brightness(1.12);
      }

      .primary-action-btn:focus-visible {
        outline: 2px solid var(--theme-text, #e0e0e0);
        outline-offset: -2px;
      }

      /* Context Menu Container */
      .context-menu-container {
        position: relative;
        display: flex;
      }

      .menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        padding: 0;
        border: none;
        border-left: 1px solid var(--theme-border, rgba(255, 255, 255, 0.07));
        border-radius: 0 0 11px 0;
        background: transparent;
        color: var(--theme-text-muted, #888888);
        cursor: pointer;
        transition: all var(--v4-transition-fast, 150ms);
      }

      .menu-btn:hover,
      .menu-btn.active {
        background: rgba(128, 128, 128, 0.15);
        color: var(--theme-text, #e0e0e0);
      }

      .menu-btn:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: -2px;
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
        .ticket,
        .menu-btn,
        .context-menu,
        .slot-picker-menu,
        .primary-action-btn {
          transition: none;
        }
        .ticket:hover {
          transform: none;
        }
      }
    `,
    // 5B compact variant (ResultCard.dc.html compact geometry)
    css`
      :host([compact]) .ticket {
        border-radius: 11px;
      }

      :host([compact]) .head {
        padding: 8px 8px 9px;
      }

      :host([compact]) .swatches {
        gap: 4px;
        margin-bottom: 7px;
      }

      :host([compact]) .swatch {
        height: 40px;
        border-radius: 6px;
      }

      :host([compact]) .dye-name {
        font-family: inherit;
        font-size: 12px;
        line-height: 1.18;
        min-height: 0;
        height: 28px;
        overflow: hidden;
      }

      :host([compact]) .verdict {
        gap: 6px;
      }

      :host([compact]) .de-num {
        font-size: 19px;
        line-height: 0.95;
        letter-spacing: 0;
      }

      :host([compact]) .metric-label {
        font-size: 7px;
        margin-top: 3px;
      }

      :host([compact]) .readout-val {
        font-size: 10.5px;
      }

      :host([compact]) .perf .notch {
        width: 11px;
        height: 11px;
        top: -5.5px;
      }

      :host([compact]) .perf .notch.left {
        left: -6px;
      }

      :host([compact]) .perf .notch.right {
        right: -6px;
      }

      :host([compact]) .matrix {
        grid-template-columns: 1fr;
        gap: 3px;
        padding: 9px 8px 0;
      }

      :host([compact]) .cell-label {
        font-size: 9px;
      }

      :host([compact]) .cell-val {
        font-size: 10px;
      }

      :host([compact]) .zone-rule {
        margin: 0 8px;
      }

      :host([compact]) .zone {
        padding: 9px 8px 10px;
        gap: 3px;
      }

      :host([compact]) .zlabel {
        font-size: 9px;
        width: auto;
      }

      :host([compact]) .zval {
        font-size: 10px;
      }

      :host([compact]) .primary-action-btn {
        height: 44px;
        font-size: 11.5px;
        border-radius: 0 0 0 10px;
      }

      :host([compact]) .menu-btn {
        width: 44px;
        height: 44px;
        border-radius: 0 0 10px 0;
      }
    `,
  ];

  /**
   * The structural verdict value: always ΔE2000. Uses the tool-provided
   * distance when it already is ΔE2000; derives it from the colour pair
   * otherwise. Undefined when the card shows a plain dye (no real match pair).
   */
  private getDeltaE2000(): number | undefined {
    if (!this.data) return undefined;
    const { deltaE, matchingMethod, originalColor, matchedColor } = this.data;
    if (deltaE !== undefined && (matchingMethod === undefined || matchingMethod === 'ciede2000')) {
      return deltaE;
    }
    const hasPair =
      Boolean(originalColor) &&
      Boolean(matchedColor) &&
      originalColor.toLowerCase() !== matchedColor.toLowerCase();
    if (deltaE === undefined && !hasPair) return undefined;
    try {
      return ColorService.getDistanceForMethod(originalColor, matchedColor, 'ciede2000');
    } catch {
      return undefined;
    }
  }

  /**
   * Tier colour for the verdict, from the calibrated MATCH bands
   */
  private getTierColor(deltaE2000: number): string {
    const ramp = ThemeService.isDarkMode() ? TIER_RAMP_DARK : TIER_RAMP_LIGHT;
    const tier = classifyBandTier(deltaE2000, 'ciede2000', 'match');
    return ramp[Math.min(tier, ramp.length - 1)];
  }

  /**
   * Format a market price as a localized gil amount.
   * If an error code is provided, displays the error code instead.
   */
  private formatPrice(price?: number, errorCode?: string): string {
    // If there's an error code, display it instead of the price
    if (errorCode) return errorCode;
    if (price === undefined || price === null) return '—';
    return formatGil(price);
  }

  /**
   * Format vendor cost with localized currency label
   */
  private formatVendorCost(cost?: number, currency?: string | null): string {
    if (cost === undefined || cost === null || !currency) return '—';
    const label = LanguageService.getCurrency(currency);
    return `${formatNumber(cost)} ${label}`;
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
   * Format CMYK values for display (rounded to integer percentages)
   */
  private formatCmykValues(): string {
    if (!this.data) return '—';
    const cmyk = ColorService.hexToCmyk(this.data.matchedColor);
    return `${Math.round(cmyk.c)}, ${Math.round(cmyk.m)}, ${Math.round(cmyk.y)}, ${Math.round(cmyk.k)}`;
  }

  /**
   * Format consolidated dye spectrum name for display.
   * Returns the localized spectrum name (Standard / Wide #1 / Wide #2)
   * or em-dash for non-consolidated dyes (Special, Facewear).
   */
  private formatConsolidation(): string {
    const type = this.data?.dye.consolidationType;
    if (!type) return '—';
    return getConsolidatedDyeName(type, LanguageService.getCurrentLocale());
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
      case 'inspect-swatch':
        this.sendToSwatch(dye);
        break;

      // Transform actions - navigate to tool
      case 'transform-gradient':
        this.addToTool('gradient', dye);
        break;
      case 'transform-mixer':
        this.addToMixer(dye);
        break;

      // External links - open in new tab.
      // Post-7.5 consolidation: the legacy per-color items are no longer
      // tradeable, so external sites must resolve to the purchasable
      // Spectrum (consolidated) itemID via getMarketItemID(). Unconsolidated
      // dyes (Venture Coffer specials) keep their own itemID.
      case 'external-universalis':
        this.openExternalUrl('universalis', getMarketItemID(dye));
        break;
      case 'external-garlandtools':
        this.openExternalUrl('garlandtools', getMarketItemID(dye));
        break;
      case 'external-teamcraft':
        this.openExternalUrl('teamcraft', getMarketItemID(dye));
        break;
      case 'external-saddlebag':
        this.openExternalUrl('saddlebag', getMarketItemID(dye));
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
    // BUG-012 was fixed here first, then found still live at Gradient's two
    // context actions — so the grammar now lives in one place rather than in a
    // comment repeated per call site. `handoffTo` also drops the old
    // `stainID ?? 0`, which navigated with an id no dye has and let the
    // receiver raise the toast; a dye with no stainID simply does not navigate.
    handoffTo('harmony', dye);
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
   * Send dye to Swatch Matcher for reverse matching
   * Stores dye ID in localStorage for one-shot consumption
   */
  private sendToSwatch(dye: Dye): void {
    StorageService.setItem(STORAGE_KEYS.swatch, dye.id);
    ToastService.success(LanguageService.t('resultCard.sentToSwatch'));
    RouterService.navigateTo('swatch');
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
   * Show modal for selecting which slot to replace when tool is full
   */
  private showSlotSelectionModal(
    tool: 'comparison' | 'accessibility' | 'gradient' | 'mixer',
    newDye: Dye,
    currentDyeIds: number[]
  ): void {
    const dyeService = DyeService.getInstance();

    // Generate slot labels based on tool type
    const slotLabels =
      tool === 'mixer' || tool === 'gradient'
        ? [LanguageService.t('mixer.startDye'), LanguageService.t('mixer.endDye')]
        : currentDyeIds.map((_, i) => LanguageService.tInterpolate('common.slotN', { n: i + 1 }));

    // Build content as DOM elements (SEC-002: avoid innerHTML for defense-in-depth)
    const contentEl = document.createElement('div');

    const description = document.createElement('p');
    description.className = 'mb-4';
    description.style.color = 'var(--theme-text)';
    description.textContent = LanguageService.t('resultCard.slotsFull');
    contentEl.appendChild(description);

    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'space-y-2';

    // Store modalId so slot buttons can dismiss it (must be let — assigned after closures capture it)
    // eslint-disable-next-line prefer-const
    let modalId: ReturnType<typeof ModalService.show>;

    currentDyeIds.forEach((dyeId, index) => {
      const existingDye = dyeService.getDyeById(dyeId);
      const dyeName = existingDye
        ? LanguageService.getDyeName(existingDye.itemID) || existingDye.name
        : LanguageService.t('common.unknown');
      const dyeHex = existingDye?.hex ?? '#888888';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flex items-center gap-3 w-full p-3 rounded-lg border transition-colors';
      btn.style.background = 'var(--theme-card-background)';
      btn.style.borderColor = 'var(--theme-border)';

      const swatch = document.createElement('div');
      swatch.className = 'w-8 h-8 rounded';
      swatch.style.background = dyeHex;
      swatch.style.border = '1px solid var(--theme-border)';
      btn.appendChild(swatch);

      const info = document.createElement('div');
      info.className = 'flex-1 text-left';
      const labelP = document.createElement('p');
      labelP.className = 'font-medium text-sm';
      labelP.style.color = 'var(--theme-text)';
      labelP.textContent = slotLabels[index];
      info.appendChild(labelP);
      const nameP = document.createElement('p');
      nameP.className = 'text-xs';
      nameP.style.color = 'var(--theme-text-muted)';
      nameP.textContent = dyeName;
      info.appendChild(nameP);
      btn.appendChild(info);

      const replaceLabel = document.createElement('span');
      replaceLabel.className = 'text-xs';
      replaceLabel.style.color = 'var(--theme-text-muted)';
      replaceLabel.textContent = LanguageService.t('common.replace');
      btn.appendChild(replaceLabel);

      // Click handler — directly attached, no setTimeout needed
      btn.addEventListener('click', () => {
        // Handle mixer specially (uses tuple format)
        if (tool === 'mixer') {
          const mixerDyes: [number | null, number | null] = [
            currentDyeIds[0] ?? null,
            currentDyeIds[1] ?? null,
          ];
          mixerDyes[index as 0 | 1] = newDye.id;
          StorageService.setItem(STORAGE_KEYS.mixerV4, mixerDyes);
        } else {
          // Other tools use array format
          const storageKey = STORAGE_KEYS[tool];
          currentDyeIds[index] = newDye.id;
          StorageService.setItem(storageKey, currentDyeIds);
        }

        ModalService.dismiss(modalId);
        ToastService.success(LanguageService.t('resultCard.replacedInTool'));
        RouterService.navigateTo(tool);
      });

      // Hover effects
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = 'var(--theme-card-hover)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = 'var(--theme-card-background)';
      });

      slotsContainer.appendChild(btn);
    });

    contentEl.appendChild(slotsContainer);

    // "Adding dye" preview
    const newDyeName = LanguageService.getDyeName(newDye.itemID) || newDye.name;

    const preview = document.createElement('div');
    preview.className = 'mt-4 p-3 rounded-lg flex items-center gap-3';
    preview.style.background = 'var(--theme-background-secondary)';

    const previewSwatch = document.createElement('div');
    previewSwatch.className = 'w-8 h-8 rounded';
    previewSwatch.style.background = newDye.hex;
    previewSwatch.style.border = '1px solid var(--theme-border)';
    preview.appendChild(previewSwatch);

    const previewInfo = document.createElement('div');
    const addingLabel = document.createElement('p');
    addingLabel.className = 'text-xs';
    addingLabel.style.color = 'var(--theme-text-muted)';
    addingLabel.textContent = LanguageService.t('resultCard.addingDyeLabel');
    previewInfo.appendChild(addingLabel);
    const addingName = document.createElement('p');
    addingName.className = 'font-medium text-sm';
    addingName.style.color = 'var(--theme-text)';
    addingName.textContent = newDyeName;
    previewInfo.appendChild(addingName);
    preview.appendChild(previewInfo);

    contentEl.appendChild(preview);

    modalId = ModalService.show({
      type: 'custom',
      title: LanguageService.t('resultCard.selectSlotToReplace'),
      content: contentEl,
      size: 'sm',
      closable: true,
      closeOnBackdrop: true,
      cancelText: LanguageService.t('common.cancel'),
    });
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

  private languageUnsubscribe: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.languageUnsubscribe = LanguageService.subscribe(() => this.requestUpdate());
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  /** One numeric-matrix cell */
  private matrixCell(label: string, value: string): TemplateResult {
    return html`
      <div class="cell">
        <span class="cell-label">${label}</span>
        <span class="cell-val">${value}</span>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    if (!this.data) {
      return html`<div class="ticket">${LanguageService.t('resultCard.noData')}</div>`;
    }

    const { dye, originalColor, matchedColor, hueDeviance, marketServer, price } = this.data;

    const locale = LanguageService.getCurrentLocale();
    const isLatin = locale === 'en' || locale === 'de' || locale === 'fr';
    const dyeName = LanguageService.getDyeName(dye.id) || dye.name;
    const hsv = dye.hsv;
    const deltaE2000 = this.getDeltaE2000();
    const stain = dye.stainID;
    const marketLabel = marketServer
      ? `${LanguageService.t('common.market')} · ${marketServer}`
      : LanguageService.t('common.market');

    return html`
      <article
        class="ticket"
        lang="${locale}"
        role="article"
        aria-label="${LanguageService.tInterpolate('resultCard.dyeResultAria', { name: dyeName })}"
      >
        <!-- Verdict stub -->
        <div class="head">
          <div class="swatches">
            ${
              originalColor && originalColor.toLowerCase() !== matchedColor.toLowerCase()
                ? html`
                    <div
                      class="swatch"
                      style="background: ${originalColor}"
                      title="${LanguageService.t('common.original')}"
                    ></div>
                  `
                : nothing
            }
            <div class="swatch" style="background: ${matchedColor}" title="${dyeName}"></div>
          </div>
          <h3 class="dye-name">${dyeName}</h3>
          ${
            // `showDeltaE` was declared but never read: the verdict gated on
            // `deltaE2000 !== undefined` alone, so the ΔE readout rendered
            // whatever the option said. Ten call sites set it — config-sidebar
            // binds it in nine places as the user's "Show ΔE" switch, and
            // accessibility (`= lensActive`), budget and comparison
            // (`// No Delta-E in comparison context`) each set it false
            // expecting the row to disappear. None of that did anything.
            (this.showDeltaE && deltaE2000 !== undefined) || (this.showStain && stain != null)
              ? html`
                  <div class="verdict">
                    ${
                      this.showDeltaE && deltaE2000 !== undefined
                        ? html`
                            <div>
                              <div class="de-num" style="color: ${this.getTierColor(deltaE2000)}">
                                ${deltaE2000.toFixed(2)}
                              </div>
                              <div class="metric-label">ΔE2000</div>
                            </div>
                          `
                        : nothing
                    }
                    ${
                      this.showHue && hueDeviance !== undefined
                        ? html`
                            <div class="readout">
                              <div class="readout-val">${hueDeviance.toFixed(1)}°</div>
                              <div class="metric-label">
                                ${LanguageService.t('resultCard.hueOff')}
                              </div>
                            </div>
                          `
                        : nothing
                    }
                    ${
                      this.showStain && stain != null
                        ? html`
                            <div class="readout">
                              <div class="readout-val">${stain}</div>
                              <div class="metric-label">
                                ${LanguageService.t('resultCard.stainShort')}
                              </div>
                            </div>
                          `
                        : nothing
                    }
                  </div>
                `
              : nothing
          }
        </div>

        <!-- Perforation -->
        <div class="perf" aria-hidden="true">
          <span class="notch left"></span>
          <span class="notch right"></span>
        </div>

        <!-- Numeric matrix -->
        ${
          this.showHex || this.showRgb || this.showHsv || this.showLab || this.showCmyk
            ? html`
                <div class="matrix">
                  ${this.showHex ? this.matrixCell('HEX', matchedColor.toUpperCase()) : nothing}
                  ${
                    this.showRgb
                      ? this.matrixCell('RGB', `${dye.rgb.r}, ${dye.rgb.g}, ${dye.rgb.b}`)
                      : nothing
                  }
                  ${
                    this.showHsv && hsv
                      ? this.matrixCell(
                          'HSV',
                          `${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`
                        )
                      : nothing
                  }
                  ${this.showLab ? this.matrixCell('LAB', this.formatLabValues()) : nothing}
                  ${this.showCmyk ? this.matrixCell('CMYK', this.formatCmykValues()) : nothing}
                </div>
              `
            : nothing
        }

        <!-- Text zone: spectrum / source / cost, market after a dashed rule -->
        ${
          this.showConsolidation || this.showAcquisition || this.showPrice
            ? html`
                <div class="zone-rule"></div>
                <div class="zone">
                  ${
                    this.showConsolidation
                      ? html`
                          <div class="zrow">
                            <span
                              class="zlabel ${isLatin ? 'latin' : ''}"
                              title="${LanguageService.t('common.spectrum')}"
                              >${LanguageService.t('resultCard.spectrumShort')}</span
                            >
                            <span class="zval">${this.formatConsolidation()}</span>
                          </div>
                        `
                      : nothing
                  }
                  ${
                    this.showAcquisition
                      ? html`
                          <div class="zrow">
                            <span
                              class="zlabel ${isLatin ? 'latin' : ''}"
                              title="${LanguageService.t('common.acquisition')}"
                              >${LanguageService.t('resultCard.acquisitionShort')}</span
                            >
                            <span class="zval"
                              >${
                                isCustomDye(dye)
                                  ? customDyeLabel()
                                  : dye.acquisition
                                    ? LanguageService.getAcquisition(dye.acquisition)
                                    : '—'
                              }</span
                            >
                          </div>
                          <div class="zrow">
                            <span class="zlabel ${isLatin ? 'latin' : ''}"
                              >${LanguageService.t('common.cost')}</span
                            >
                            <span class="zval"
                              >${this.formatVendorCost(this.data.vendorCost, dye.currency)}</span
                            >
                          </div>
                        `
                      : nothing
                  }
                  ${
                    this.showPrice
                      ? html`
                          <div class="zrow market">
                            <span class="zlabel ${isLatin ? 'latin' : ''}">${marketLabel}</span>
                            <span class="zval ${this.data.marketError ? 'market-error' : ''}"
                              >${this.formatPrice(price, this.data.marketError)}</span
                            >
                          </div>
                        `
                      : nothing
                  }
                </div>
              `
            : nothing
        }

        <!-- Companion alternates — one tap swaps the slot in place -->
        ${
          this.data.alternates && this.data.alternates.length > 0
            ? html`
                <div class="card-alternates">
                  <span class="alt-label">${LanguageService.t('common.alternates')}</span>
                  ${this.data.alternates.map(
                    (alt) => html`
                      <button
                        class="alt-dot"
                        type="button"
                        style="background: ${alt.hex};"
                        title="${LanguageService.getDyeName(alt.itemID) || alt.name}"
                        aria-label="${LanguageService.getDyeName(alt.itemID) || alt.name}"
                        @click=${(e: Event): void => {
                          e.stopPropagation();
                          this.emit<{ dye: Dye }>('alternate-select', { dye: alt });
                        }}
                      ></button>
                    `
                  )}
                </div>
              `
            : nothing
        }

        <!-- Action Bar at Bottom -->
        ${
          this.showActions
            ? html`
                <div class="card-actions">
                  ${
                    this.showSlotPicker
                      ? html`
                          <div class="slot-picker-container">
                            <button
                              class="primary-action-btn"
                              type="button"
                              aria-haspopup="true"
                              aria-expanded=${this.slotMenuOpen}
                              @click=${this.handleSelectClick}
                            >
                              ${this.primaryLabel}
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
                                ${LanguageService.tInterpolate('resultCard.replaceSlotN', {
                                  n: 1,
                                })}
                              </button>
                              <button
                                class="slot-picker-item"
                                role="menuitem"
                                @click=${() => this.handleSlotAction(2)}
                              >
                                ${LanguageService.tInterpolate('resultCard.replaceSlotN', {
                                  n: 2,
                                })}
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
                            ${this.primaryLabel}
                          </button>
                        `
                  }
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
                          <button
                            class="menu-item"
                            role="menuitem"
                            @click=${() => this.handleMenuAction('inspect-swatch')}
                          >
                            ${LanguageService.t('resultCard.tools.swatch')}
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
                            @click=${/* eslint-disable-next-line xivdyetools-i18n/no-hardcoded-ui-strings -- brand name */ () => this.handleMenuAction('external-saddlebag')}
                          >
                            Saddlebag Exchange
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              `
            : nothing
        }
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
