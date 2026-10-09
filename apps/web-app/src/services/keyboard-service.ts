/**
 * XIV Dye Tools v2.1.0 - Keyboard Service
 *
 * Centralized keyboard shortcut management
 * Handles global shortcuts: 0-9 (tools), Shift+T (theme), Shift+L (language),
 * Shift+S (share the active tool), ? (help)
 *
 * @module services/keyboard-service
 */

import { toggleThemeVariant } from './theme-switch';
import { LanguageService } from './language-service';
import { ModalService } from './modal-service';
import { RouterService } from './router-service';
import type { ToolId } from './router-service';
import { showShortcutsPanel } from '@components/shortcuts-panel';
// Type-only: erased at compile time, so this adds no runtime dependency from
// the service layer onto a component.
import type { ShareButton } from '@components/v4/share-button';
import { logger } from '@shared/logger';

// ============================================================================
// Tool ID Mapping
// ============================================================================

/**
 * Maps number keys 1-9 to the first nine tools, in ROUTES order, and 0 to the
 * tenth (the Glamour Reader) — 0 sits after 9 on the number row.
 * (Pre-5.0 this stopped at 5 and still said 'matcher', which is not a
 * routable ToolId — key 2 dispatched a tool the router could not open.)
 */
const TOOL_KEY_MAP: Record<string, string> = {
  '1': 'harmony',
  '2': 'extractor',
  '3': 'accessibility',
  '4': 'comparison',
  '5': 'gradient',
  '6': 'presets',
  '7': 'budget',
  '8': 'swatch',
  '9': 'mixer',
  '0': 'glamour',
};

/**
 * The digit a keystroke stands for on the number row, whatever the layout.
 *
 * BUG-120: the lookup used to be `TOOL_KEY_MAP[e.key]` behind a no-Shift
 * guard. On AZERTY the unshifted number row types & é " ' ( - è _ ç à and the
 * digits need Shift, so 1-9/0 were reachable only from a numpad there.
 *
 * - A key that TYPES a digit is that digit, Shift or not (AZERTY Shift+&,
 *   QWERTY 1, a NumLock-on numpad).
 * - Otherwise an unshifted number-row key counts by its physical position
 *   (`code` Digit0-Digit9). Shift stays excluded there: QWERTY Shift+1 types
 *   "!", which is not the digit shortcut.
 * - AltGr stays excluded from that fallback too. Windows reports it as
 *   Ctrl+Alt, which handleKeyDown() already turns away, but on Linux Chrome
 *   and Firefox report ctrlKey and altKey both false and expose it only as
 *   getModifierState('AltGraph') — and AltGr on the number row types symbols
 *   (AZERTY AltGr+à "@", German AltGr+7 "{"). A dead key there ("Dead") is
 *   composing an accent. Neither is a digit shortcut.
 * - `Numpad*` codes are deliberately NOT mapped: with NumLock off they report
 *   key "ArrowDown", "End", "Insert"... and must stay navigation keys.
 */
function toolDigit(e: KeyboardEvent): string | null {
  if (/^[0-9]$/.test(e.key)) return e.key;
  if (e.shiftKey || e.key === 'Dead' || e.getModifierState?.('AltGraph')) return null;
  const match = /^Digit([0-9])$/.exec(e.code ?? '');
  return match ? match[1] : null;
}

/** Is this element something the user types into? */
function isTextEntry(node: EventTarget | null | undefined): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) return true;
  // Both checks are load-bearing: `isContentEditable` catches contenteditable=""
  // and inherited editability that the attribute test misses, but jsdom does
  // not implement contenteditable at all and always reports false — so the
  // attribute test is what holds the unit tests honest.
  if (node.isContentEditable) return true;
  const attr = node.getAttribute('contenteditable');
  return attr === '' || attr === 'true' || attr === 'plaintext-only';
}

/**
 * Check if the user is currently typing in a text field.
 *
 * Must see THROUGH shadow DOM. Every tool renders inside V4LayoutShell's
 * shadow root, so `document.activeElement` retargets to the host — it reports
 * <v4-layout-shell>, never the <input> the user is actually typing in. The
 * old guard therefore never fired in the real app, and typing a capital
 * letter ran the Shift+<letter> shortcuts (naming a palette after a .chara
 * import flipped the theme on Shift+T), while digits in any search box
 * navigated away.
 *
 * `composedPath()[0]` is the authoritative answer: it is the true innermost
 * target, before any retargeting. The activeElement walk is a fallback for
 * synthetic events dispatched without a path.
 *
 * Exported for the other page-wide shortcut, DyeSelector's "/" (BUG-088),
 * whose `document.activeElement.tagName` guard had the same blind spot.
 */
export function isUserTyping(e?: KeyboardEvent): boolean {
  if (isTextEntry(e?.composedPath?.()[0])) return true;

  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return isTextEntry(active);
}

/**
 * Shift held, and nothing else.
 *
 * BUG-084: the Shift+T / Shift+L / Shift+S branches tested `e.shiftKey` alone,
 * so browser and OS chords that merely include Shift matched them too —
 * Ctrl+Shift+T (reopen closed tab) flipped the theme on its way past. The
 * digit branch excludes Ctrl, Alt and Meta (Shift it leaves to toolDigit(),
 * since AZERTY types its digits with Shift — BUG-120); this makes the letter
 * chords exclude the same three, as the shortcuts panel documents them.
 */
function isBareShift(e: KeyboardEvent): boolean {
  return e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
}

// ============================================================================
// Keyboard Service Class
// ============================================================================

/**
 * Service for managing global keyboard shortcuts
 * Follows the ThemeService/LanguageService singleton pattern
 */
export class KeyboardService {
  private static boundHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Initialize keyboard service
   * Attaches global keydown listener
   * WEB-BUG-001: Always removes existing handler before adding new one to prevent duplicates
   */
  static initialize(): void {
    // WEB-BUG-001: Always remove existing handler to prevent duplicates
    // This handles race conditions between initialize() and destroy()
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
    }

    // Bind and store handler for potential cleanup
    this.boundHandler = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.boundHandler);

    logger.info('KeyboardService initialized');
  }

  /**
   * Cleanup keyboard service
   */
  static destroy(): void {
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
      this.boundHandler = null;
    }
  }

  /**
   * Main keyboard event handler
   */
  private static handleKeyDown(e: KeyboardEvent): void {
    // Skip if user is typing in an input
    if (isUserTyping(e)) {
      return;
    }

    // Handle ? key (show shortcuts panel)
    // Must check before modal check since this is the help shortcut
    const isQuestionMark = e.key === '?' || (e.shiftKey && e.key === '/');
    if (isQuestionMark && !ModalService.hasOpenModals()) {
      e.preventDefault();
      showShortcutsPanel();
      return;
    }

    // Skip other shortcuts if modal is open (except Escape, which is handled by modal itself)
    if (ModalService.hasOpenModals()) {
      return;
    }

    // Handle Shift+T (toggle theme). BUG-084: the 1-9 branch below excludes
    // ctrl/alt/meta and these three did not, so Ctrl+Shift+T (reopen closed
    // tab) also flipped the theme. The shortcuts panel documents them as bare
    // Shift chords.
    if (isBareShift(e) && e.key.toUpperCase() === 'T') {
      e.preventDefault();
      this.handleToggleTheme();
      return;
    }

    // Handle Shift+L (cycle language)
    if (isBareShift(e) && e.key.toUpperCase() === 'L') {
      e.preventDefault();
      void this.handleCycleLanguage();
      return;
    }

    // Handle Shift+S (share the active tool)
    if (isBareShift(e) && e.key.toUpperCase() === 'S') {
      e.preventDefault();
      this.handleShare();
      return;
    }

    // Handle 0-9 keys (tool navigation). Shift is toolDigit()'s call: it is
    // how AZERTY types a digit (BUG-120); the other modifiers never are.
    if (!e.ctrlKey && !e.altKey && !e.metaKey) {
      const digit = toolDigit(e);
      const toolId = digit === null ? undefined : TOOL_KEY_MAP[digit];
      if (toolId) {
        e.preventDefault();
        this.handleToolNavigation(toolId);
        return;
      }
    }
  }

  /**
   * Share the active tool by triggering its own share button.
   *
   * Deliberately DOM-driven rather than brokered through a controller: the
   * share button already lives in the active tool's results header, already
   * holds fresh params, and already knows its own disabled rule. A central
   * share-state store would duplicate all three across seven tools to move a
   * button no design doc asks to move.
   *
   * The buttons render inside the shell's shadow DOM, so the query has to hop
   * the boundary — a document-level querySelector never sees them. And the
   * trigger is `share()`, not `click()`: the component's @click binding is on
   * an inner <button> inside its OWN shadow root, so clicking the host is a
   * silent no-op.
   */
  private static handleShare(): void {
    const shell = document.querySelector('v4-layout-shell');
    const button = shell?.shadowRoot?.querySelector<ShareButton>('v4-share-button:not([disabled])');
    if (!button) {
      logger.info('Share shortcut ignored: active tool has nothing to share');
      return;
    }
    button.share();
    logger.info('Shared via keyboard shortcut');
  }

  /**
   * Toggle between light and dark theme variants
   */
  private static handleToggleTheme(): void {
    try {
      // Through the shared switch so the deliberate change is recorded
      // (telemetry) exactly like a pick in the theme modal.
      toggleThemeVariant();
      logger.info('Theme toggled via keyboard shortcut');
    } catch (error) {
      logger.error('Failed to toggle theme:', error);
    }
  }

  /**
   * Cycle to the next language
   */
  private static async handleCycleLanguage(): Promise<void> {
    try {
      await LanguageService.cycleToNextLocale();
      logger.info('Language cycled via keyboard shortcut');
    } catch (error) {
      logger.error('Failed to cycle language:', error);
    }
  }

  /**
   * Navigate to a tool.
   *
   * BUG-014: this used to only dispatch `keyboard-navigate-tool` and rely on a
   * listener in main.ts that does not exist — nothing in the app has ever
   * listened for it, so the 1-9 shortcuts the shortcuts panel advertises did
   * nothing at all. The service's own tests passed because each one registered
   * the missing listener itself before dispatching.
   *
   * The navigation now happens here, so the shortcut works whether or not
   * anyone is listening. The event is still emitted: it is a useful hook and is
   * part of this service's tested surface, but it is a notification now, not
   * the mechanism.
   */
  private static handleToolNavigation(toolId: string): void {
    RouterService.navigateTo(toolId as ToolId);

    const event = new CustomEvent('keyboard-navigate-tool', {
      detail: { toolId },
      bubbles: true,
    });
    window.dispatchEvent(event);
    logger.info(`Tool navigation via keyboard: ${toolId}`);
  }
}
