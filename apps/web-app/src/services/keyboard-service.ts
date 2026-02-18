/**
 * XIV Dye Tools v2.1.0 - Keyboard Service
 *
 * Centralized keyboard shortcut management
 * Handles global shortcuts: 1-5 (tools), Shift+T (theme), Shift+L (language), ? (help)
 *
 * @module services/keyboard-service
 */

import { FEATURE_FLAGS } from '@shared/constants';
import { ThemeService } from './theme-service';
import { LanguageService } from './language-service';
import { ModalService } from './modal-service';
import { showShortcutsPanel } from '@components/shortcuts-panel';
import { logger } from '@shared/logger';

// ============================================================================
// Tool ID Mapping
// ============================================================================

/**
 * Maps number keys 1-5 to tool IDs
 */
const TOOL_KEY_MAP: Record<string, string> = {
  '1': 'harmony',
  '2': 'matcher',
  '3': 'accessibility',
  '4': 'comparison',
  '5': 'mixer',
};

// ============================================================================
// Keyboard Service Class
// ============================================================================

/**
 * Service for managing global keyboard shortcuts
 * Follows the ThemeService/LanguageService singleton pattern
 */
export class KeyboardService {
  private static isInitialized = false;
  private static boundHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Initialize keyboard service
   * Attaches global keydown listener
   * WEB-BUG-001: Always removes existing handler before adding new one to prevent duplicates
   */
  static initialize(): void {
    // Check feature flag first
    if (!FEATURE_FLAGS.ENABLE_KEYBOARD_SHORTCUTS) {
      logger.info('Keyboard shortcuts disabled by feature flag');
      return;
    }

    // WEB-BUG-001: Always remove existing handler to prevent duplicates
    // This handles race conditions between initialize() and destroy()
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
    }

    // Bind and store handler for potential cleanup
    this.boundHandler = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.boundHandler);

    this.isInitialized = true;
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
    this.isInitialized = false;
  }

  /**
   * Check if user is currently typing in an input field
   */
  private static isUserTyping(): boolean {
    const activeElement = document.activeElement;
    return (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement?.getAttribute('contenteditable') === 'true'
    );
  }

  /**
   * Main keyboard event handler
   */
  private static handleKeyDown(e: KeyboardEvent): void {
    // Skip if user is typing in an input
    if (this.isUserTyping()) {
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

    // Handle Shift+T (toggle theme)
    if (e.shiftKey && e.key.toUpperCase() === 'T') {
      e.preventDefault();
      this.handleToggleTheme();
      return;
    }

    // Handle Shift+L (cycle language)
    if (e.shiftKey && e.key.toUpperCase() === 'L') {
      e.preventDefault();
      void this.handleCycleLanguage();
      return;
    }

    // Handle 1-5 keys (tool navigation)
    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const toolId = TOOL_KEY_MAP[e.key];
      if (toolId) {
        e.preventDefault();
        this.handleToolNavigation(toolId);
        return;
      }
    }
  }

  /**
   * Toggle between light and dark theme variants
   */
  private static handleToggleTheme(): void {
    try {
      ThemeService.toggleDarkMode();
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
   * Navigate to a tool by dispatching a custom event
   * main.ts listens for 'keyboard-navigate-tool' events
   */
  private static handleToolNavigation(toolId: string): void {
    const event = new CustomEvent('keyboard-navigate-tool', {
      detail: { toolId },
      bubbles: true,
    });
    window.dispatchEvent(event);
    logger.info(`Tool navigation via keyboard: ${toolId}`);
  }
}
