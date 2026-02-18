/**
 * XIV Dye Tools v2.1.0 - Tooltip Service
 *
 * Tooltip management system with viewport-aware positioning
 * Provides hover/focus tooltips with configurable delays
 *
 * @module services/tooltip-service
 */

// ============================================================================
// Tooltip Types
// ============================================================================

/**
 * Tooltip position relative to target element
 */
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

/**
 * Configuration for attaching a tooltip
 */
export interface TooltipConfig {
  content: string;
  position?: TooltipPosition;
  delay?: number;
  maxWidth?: number;
  showOnFocus?: boolean;
}

/**
 * Internal tooltip state
 */
interface TooltipState {
  config: TooltipConfig;
  element: HTMLElement | null;
  showTimeout: ReturnType<typeof setTimeout> | null;
  hideTimeout: ReturnType<typeof setTimeout> | null;
  // Store handlers for cleanup
  mouseEnterHandler: (() => void) | null;
  mouseLeaveHandler: (() => void) | null;
  focusHandler: (() => void) | null;
  blurHandler: (() => void) | null;
}

// ============================================================================
// Tooltip Constants
// ============================================================================

const DEFAULT_DELAY = 200;
const DEFAULT_MAX_WIDTH = 250;
const VIEWPORT_PADDING = 8;
const ARROW_SIZE = 6;

// ============================================================================
// Tooltip Service Class
// ============================================================================

/**
 * Service for managing tooltips
 * Static singleton pattern
 */
export class TooltipService {
  private static tooltips: Map<HTMLElement, TooltipState> = new Map();
  private static container: HTMLElement | null = null;
  private static cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * BUG-002 FIX: Start periodic cleanup of orphaned tooltip states
   * Removes tooltip states for elements that are no longer in the DOM
   */
  static startOrphanCleanup(intervalMs: number = 30000): void {
    if (this.cleanupIntervalId) return;

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOrphanedTooltips();
    }, intervalMs);
  }

  /**
   * Stop the orphan cleanup interval
   */
  static stopOrphanCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Clean up tooltip states for elements no longer in the DOM
   */
  private static cleanupOrphanedTooltips(): void {
    const orphanedTargets: HTMLElement[] = [];

    this.tooltips.forEach((_, target) => {
      if (!target.isConnected) {
        orphanedTargets.push(target);
      }
    });

    orphanedTargets.forEach((target) => {
      this.detach(target);
    });
  }

  /**
   * Initialize the tooltip container
   */
  private static ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'tooltip-container';
      this.container.className = 'tooltip-container';
      this.container.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  /**
   * Attach a tooltip to an element
   */
  static attach(target: HTMLElement, config: TooltipConfig): void {
    // Remove existing tooltip if any
    this.detach(target);

    const state: TooltipState = {
      config: {
        position: 'auto',
        delay: DEFAULT_DELAY,
        maxWidth: DEFAULT_MAX_WIDTH,
        showOnFocus: true,
        ...config,
      },
      element: null,
      showTimeout: null,
      hideTimeout: null,
      mouseEnterHandler: null,
      mouseLeaveHandler: null,
      focusHandler: null,
      blurHandler: null,
    };

    this.tooltips.set(target, state);

    // Store handler references for cleanup
    state.mouseEnterHandler = () => this.handleMouseEnter(target);
    state.mouseLeaveHandler = () => this.handleMouseLeave(target);

    // Add event listeners
    target.addEventListener('mouseenter', state.mouseEnterHandler);
    target.addEventListener('mouseleave', state.mouseLeaveHandler);

    if (state.config.showOnFocus) {
      state.focusHandler = () => this.handleFocus(target);
      state.blurHandler = () => this.handleBlur(target);
      target.addEventListener('focus', state.focusHandler);
      target.addEventListener('blur', state.blurHandler);
    }

    // Set aria-describedby for accessibility
    const tooltipId = this.getTooltipId(target);
    target.setAttribute('aria-describedby', tooltipId);
  }

  /**
   * Detach a tooltip from an element
   */
  static detach(target: HTMLElement): void {
    const state = this.tooltips.get(target);
    if (!state) return;

    // Clear any pending timeouts
    if (state.showTimeout) clearTimeout(state.showTimeout);
    if (state.hideTimeout) clearTimeout(state.hideTimeout);

    // Remove event listeners
    if (state.mouseEnterHandler) {
      target.removeEventListener('mouseenter', state.mouseEnterHandler);
    }
    if (state.mouseLeaveHandler) {
      target.removeEventListener('mouseleave', state.mouseLeaveHandler);
    }
    if (state.focusHandler) {
      target.removeEventListener('focus', state.focusHandler);
    }
    if (state.blurHandler) {
      target.removeEventListener('blur', state.blurHandler);
    }

    // Remove tooltip element
    if (state.element) {
      state.element.remove();
    }

    // Remove aria attribute
    target.removeAttribute('aria-describedby');

    this.tooltips.delete(target);
  }

  /**
   * Force show a tooltip
   */
  static show(target: HTMLElement): void {
    const state = this.tooltips.get(target);
    if (!state) return;

    // Clear any pending hide
    if (state.hideTimeout) {
      clearTimeout(state.hideTimeout);
      state.hideTimeout = null;
    }

    this.showTooltip(target, state);
  }

  /**
   * Force hide a tooltip
   */
  static hide(target: HTMLElement): void {
    const state = this.tooltips.get(target);
    if (!state) return;

    // Clear any pending show
    if (state.showTimeout) {
      clearTimeout(state.showTimeout);
      state.showTimeout = null;
    }

    this.hideTooltip(state);
  }

  /**
   * Handle mouse enter event
   */
  private static handleMouseEnter(target: HTMLElement): void {
    const state = this.tooltips.get(target);
    if (!state) return;

    // Clear any pending hide
    if (state.hideTimeout) {
      clearTimeout(state.hideTimeout);
      state.hideTimeout = null;
    }

    // Start show timer
    state.showTimeout = setTimeout(() => {
      this.showTooltip(target, state);
    }, state.config.delay);
  }

  /**
   * Handle mouse leave event
   */
  private static handleMouseLeave(target: HTMLElement): void {
    const state = this.tooltips.get(target);
    if (!state) return;

    // Clear any pending show
    if (state.showTimeout) {
      clearTimeout(state.showTimeout);
      state.showTimeout = null;
    }

    // Start hide timer (shorter delay for responsive feel)
    state.hideTimeout = setTimeout(() => {
      this.hideTooltip(state);
    }, 100);
  }

  /**
   * Handle focus event
   */
  private static handleFocus(target: HTMLElement): void {
    const state = this.tooltips.get(target);
    if (!state || !state.config.showOnFocus) return;

    // Show immediately on focus (for keyboard users)
    this.showTooltip(target, state);
  }

  /**
   * Handle blur event
   */
  private static handleBlur(target: HTMLElement): void {
    const state = this.tooltips.get(target);
    if (!state) return;

    this.hideTooltip(state);
  }

  /**
   * Show the tooltip
   */
  private static showTooltip(target: HTMLElement, state: TooltipState): void {
    const container = this.ensureContainer();

    // Create tooltip element if not exists
    if (!state.element) {
      state.element = this.createTooltipElement(target, state.config);
      container.appendChild(state.element);
    }

    // Position the tooltip
    this.positionTooltip(target, state);

    // Show with animation
    state.element.classList.add('tooltip-visible');
  }

  /**
   * Hide the tooltip
   */
  private static hideTooltip(state: TooltipState): void {
    if (state.element) {
      state.element.classList.remove('tooltip-visible');
    }
  }

  /**
   * Create tooltip element
   */
  private static createTooltipElement(target: HTMLElement, config: TooltipConfig): HTMLElement {
    const tooltip = document.createElement('div');
    tooltip.id = this.getTooltipId(target);
    tooltip.className = 'tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.style.maxWidth = `${config.maxWidth}px`;
    tooltip.textContent = config.content;

    // Add arrow
    const arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow';
    tooltip.appendChild(arrow);

    return tooltip;
  }

  /**
   * Position the tooltip relative to target
   */
  private static positionTooltip(target: HTMLElement, state: TooltipState): void {
    if (!state.element) return;

    // WEB-BUG-006: Clean up state when DOM elements are detached to prevent memory leaks
    if (!target.isConnected || !state.element.isConnected) {
      this.detach(target);
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = state.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Determine best position
    let position = state.config.position || 'auto';
    if (position === 'auto') {
      position = this.calculateBestPosition(targetRect, tooltipRect, viewportWidth, viewportHeight);
    }

    // Calculate coordinates
    let top: number;
    let left: number;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - ARROW_SIZE;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + ARROW_SIZE;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - ARROW_SIZE;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + ARROW_SIZE;
        break;
      default:
        top = targetRect.top - tooltipRect.height - ARROW_SIZE;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
    }

    // Constrain to viewport
    top = Math.max(
      VIEWPORT_PADDING,
      Math.min(top, viewportHeight - tooltipRect.height - VIEWPORT_PADDING)
    );
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, viewportWidth - tooltipRect.width - VIEWPORT_PADDING)
    );

    // Apply position
    state.element.style.top = `${top}px`;
    state.element.style.left = `${left}px`;
    state.element.setAttribute('data-position', position);
  }

  /**
   * Calculate best position based on available space
   */
  private static calculateBestPosition(
    targetRect: DOMRect,
    tooltipRect: DOMRect,
    viewportWidth: number,
    viewportHeight: number
  ): TooltipPosition {
    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;
    const spaceLeft = targetRect.left;
    const spaceRight = viewportWidth - targetRect.right;

    const neededHeight = tooltipRect.height + ARROW_SIZE + VIEWPORT_PADDING;
    const neededWidth = tooltipRect.width + ARROW_SIZE + VIEWPORT_PADDING;

    // Prefer top, then bottom, then right, then left
    if (spaceAbove >= neededHeight) return 'top';
    if (spaceBelow >= neededHeight) return 'bottom';
    if (spaceRight >= neededWidth) return 'right';
    if (spaceLeft >= neededWidth) return 'left';

    // Default to top if nothing fits well
    return 'top';
  }

  /**
   * Generate unique tooltip ID for target element
   */
  private static getTooltipId(target: HTMLElement): string {
    let id = target.dataset.tooltipId;
    if (!id) {
      id = `tooltip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      target.dataset.tooltipId = id;
    }
    return id;
  }

  /**
   * Update tooltip content
   */
  static updateContent(target: HTMLElement, content: string): void {
    const state = this.tooltips.get(target);
    if (!state) return;

    state.config.content = content;
    if (state.element) {
      // Update text content (preserve arrow)
      const textNode = state.element.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.textContent = content;
      }
    }
  }

  /**
   * Check if reduced motion is preferred
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Detach all tooltips
   */
  static detachAll(): void {
    this.tooltips.forEach((_, target) => this.detach(target));
    this.tooltips.clear();
  }
}
