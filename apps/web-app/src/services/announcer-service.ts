/**
 * XIV Dye Tools v2.1.0 - Screen Reader Announcer Service (A3)
 *
 * Provides screen reader announcements for dynamic content changes
 * Uses ARIA live regions to announce updates to assistive technologies
 *
 * @module services/announcer-service
 */

import { logger } from '@shared/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Priority level for announcements
 * - 'polite': Waits for current speech to finish (default for most updates)
 * - 'assertive': Interrupts current speech (use for errors/urgent messages)
 */
export type AnnouncementPriority = 'polite' | 'assertive';

/**
 * Announcement object for queue
 */
interface QueuedAnnouncement {
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
}

// ============================================================================
// Announcer Service Class
// ============================================================================

/**
 * Service for announcing content changes to screen readers
 * Static singleton pattern - no instantiation needed
 *
 * @example
 * // Basic usage
 * AnnouncerService.announce('5 dyes found');
 *
 * // Selection announcement
 * AnnouncerService.announceSelection('Snow White');
 *
 * // Error announcement (uses assertive priority)
 * AnnouncerService.announceError('Failed to load prices');
 */
export class AnnouncerService {
  private static politeRegion: HTMLElement | null = null;
  private static assertiveRegion: HTMLElement | null = null;
  private static initialized = false;
  private static queue: QueuedAnnouncement[] = [];
  private static debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Debounce delay for rapid announcements (ms)
   * Prevents flooding screen reader with too many messages
   */
  private static readonly DEBOUNCE_DELAY = 150;

  /**
   * Initialize the announcer service
   * Creates the aria-live regions in the DOM
   * Called automatically by app-layout on mount
   */
  static init(container: HTMLElement): void {
    if (this.initialized) {
      logger.debug('AnnouncerService already initialized');
      return;
    }

    // Create polite live region (default for most announcements)
    this.politeRegion = document.createElement('div');
    this.politeRegion.id = 'sr-announcements-polite';
    this.politeRegion.className = 'sr-only';
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    this.politeRegion.setAttribute('aria-relevant', 'additions text');

    // Create assertive live region (for errors/urgent messages)
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.id = 'sr-announcements-assertive';
    this.assertiveRegion.className = 'sr-only';
    this.assertiveRegion.setAttribute('role', 'alert');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');

    container.appendChild(this.politeRegion);
    container.appendChild(this.assertiveRegion);

    this.initialized = true;
    logger.info('📢 AnnouncerService initialized');
  }

  /**
   * Announce a message to screen readers
   * @param message - The message to announce
   * @param priority - 'polite' (default) or 'assertive'
   */
  static announce(message: string, priority: AnnouncementPriority = 'polite'): void {
    if (!message.trim()) return;

    // Queue the announcement
    this.queue.push({
      message: message.trim(),
      priority,
      timestamp: Date.now(),
    });

    // Debounce to avoid rapid-fire announcements
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * Process queued announcements
   * Combines multiple polite announcements, assertive ones interrupt
   */
  private static processQueue(): void {
    if (this.queue.length === 0) return;

    // Check for any assertive announcements (take priority)
    const assertiveMessages = this.queue.filter((a) => a.priority === 'assertive');
    const politeMessages = this.queue.filter((a) => a.priority === 'polite');

    // Clear the queue
    this.queue = [];

    // Process assertive messages first (most recent one wins)
    if (assertiveMessages.length > 0) {
      const latest = assertiveMessages[assertiveMessages.length - 1];
      this.setRegionContent(this.assertiveRegion, latest.message);
      logger.debug(`📢 [assertive] ${latest.message}`);
    }

    // Process polite messages (combine if multiple)
    if (politeMessages.length > 0) {
      const combinedMessage =
        politeMessages.length === 1
          ? politeMessages[0].message
          : politeMessages.map((a) => a.message).join('. ');

      this.setRegionContent(this.politeRegion, combinedMessage);
      logger.debug(`📢 [polite] ${combinedMessage}`);
    }
  }

  /**
   * Set content in a live region
   * Uses a clear-and-set pattern to ensure announcement
   */
  private static setRegionContent(region: HTMLElement | null, message: string): void {
    if (!region) {
      // Fallback: log warning if not initialized
      logger.warn('AnnouncerService not initialized, announcement lost:', message);
      return;
    }

    // Clear then set (ensures screen reader sees the change)
    region.textContent = '';

    // Small delay to ensure screen reader detects the change
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Announce search/filter results
   * @param count - Number of results found
   * @param context - What was searched (e.g., 'matching dyes', 'harmony suggestions')
   */
  static announceResults(count: number, context: string): void {
    const message = count === 0 ? `No ${context} found` : `Found ${count} ${context}`;
    this.announce(message);
  }

  /**
   * Announce item selection
   * @param item - Name of the selected item
   */
  static announceSelection(item: string): void {
    this.announce(`${item} selected`, 'assertive');
  }

  /**
   * Announce item deselection
   * @param item - Name of the deselected item
   */
  static announceDeselection(item: string): void {
    this.announce(`${item} deselected`);
  }

  /**
   * Announce an error
   * Uses assertive priority to interrupt
   * @param message - Error message to announce
   */
  static announceError(message: string): void {
    this.announce(`Error: ${message}`, 'assertive');
  }

  /**
   * Announce a success action
   * @param message - Success message to announce
   */
  static announceSuccess(message: string): void {
    this.announce(message);
  }

  /**
   * Announce loading state
   * @param context - What is loading (e.g., 'market prices', 'dye data')
   */
  static announceLoading(context: string): void {
    this.announce(`Loading ${context}...`);
  }

  /**
   * Announce loading complete
   * @param context - What finished loading
   */
  static announceLoaded(context: string): void {
    this.announce(`${context} loaded`);
  }

  /**
   * Announce a filter change
   * @param filterName - Name of the filter
   * @param value - New filter value or state
   * @param resultCount - Optional count of filtered results
   */
  static announceFilterChange(
    filterName: string,
    value: string | boolean,
    resultCount?: number
  ): void {
    const valueText = typeof value === 'boolean' ? (value ? 'enabled' : 'disabled') : value;
    let message = `${filterName} filter ${valueText}`;
    if (resultCount !== undefined) {
      message += `. ${resultCount} items visible`;
    }
    this.announce(message);
  }

  /**
   * Announce navigation to a new tool/page
   * @param toolName - Name of the tool navigated to
   */
  static announceNavigation(toolName: string): void {
    this.announce(`Navigated to ${toolName}`, 'assertive');
  }

  /**
   * Announce clipboard copy
   * @param what - What was copied (e.g., 'Hex color', 'Palette')
   */
  static announceCopy(what: string): void {
    this.announce(`${what} copied to clipboard`);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Destroy the announcer service
   * Removes live regions from the DOM
   */
  static destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.politeRegion?.remove();
    this.assertiveRegion?.remove();

    this.politeRegion = null;
    this.assertiveRegion = null;
    this.initialized = false;
    this.queue = [];

    logger.info('📢 AnnouncerService destroyed');
  }
}
