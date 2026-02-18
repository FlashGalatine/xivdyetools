/**
 * XIV Dye Tools v2.1.0 - Modal Service
 *
 * Modal dialog system for user interactions
 * Follows ToastService singleton pattern with subscription model
 *
 * @module services/modal-service
 */

import { logger } from '@shared/logger';

// ============================================================================
// Modal Types
// ============================================================================

/**
 * Modal type determines content and behavior
 */
export type ModalType = 'welcome' | 'changelog' | 'confirm' | 'custom';

/**
 * Branded type for Modal IDs (WEB-TYPE-001)
 * Prevents accidental use of arbitrary strings as modal identifiers
 */
export type ModalId = string & { readonly __brand: 'ModalId' };

/**
 * Modal configuration for creating a modal
 */
export interface ModalConfig {
  type: ModalType;
  title: string;
  content?: string | HTMLElement;
  size?: 'sm' | 'md' | 'lg';
  closable?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

/**
 * Modal instance with ID and timestamp
 */
export interface Modal extends ModalConfig {
  id: ModalId;
  timestamp: number;
}

// ============================================================================
// Modal Constants
// ============================================================================

/**
 * Maximum number of stacked modals
 */
const MAX_MODALS = 3;

// ============================================================================
// Modal Service Class
// ============================================================================

/**
 * Service for managing modal dialogs
 * Static singleton pattern with subscription model
 */
export class ModalService {
  private static modals: Modal[] = [];
  private static listeners: Set<(modals: Modal[]) => void> = new Set();

  /**
   * Generate unique modal ID (WEB-TYPE-001: returns branded ModalId type)
   */
  private static generateId(): ModalId {
    return `modal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}` as ModalId;
  }

  /**
   * Notify all listeners of modal changes
   */
  private static notifyListeners(): void {
    const modalsCopy = [...this.modals];
    this.listeners.forEach((listener) => listener(modalsCopy));
  }

  /**
   * Show a modal dialog
   * @returns Modal ID for programmatic dismissal
   */
  static show(config: ModalConfig): ModalId {
    const id = this.generateId();

    const modal: Modal = {
      ...config,
      id,
      size: config.size ?? 'md',
      closable: config.closable ?? true,
      closeOnBackdrop: config.closeOnBackdrop ?? true,
      closeOnEscape: config.closeOnEscape ?? true,
      timestamp: Date.now(),
    };

    // Add modal, respecting max limit
    this.modals.push(modal);
    if (this.modals.length > MAX_MODALS) {
      const removed = this.modals.shift();
      if (removed?.onClose) {
        try {
          removed.onClose();
        } catch (error) {
          logger.error('Modal onClose callback failed:', error);
        }
      }
    }

    this.notifyListeners();
    logger.info(`Modal shown: [${config.type}] ${config.title}`);

    return id;
  }

  /**
   * Show a welcome modal
   */
  static showWelcome(config: Omit<ModalConfig, 'type'>): ModalId {
    return this.show({ ...config, type: 'welcome' });
  }

  /**
   * Show a changelog modal
   */
  static showChangelog(config: Omit<ModalConfig, 'type'>): ModalId {
    return this.show({ ...config, type: 'changelog' });
  }

  /**
   * Show a confirmation modal
   */
  static showConfirm(config: Omit<ModalConfig, 'type'>): ModalId {
    return this.show({
      ...config,
      type: 'confirm',
      closable: config.closable ?? false,
      closeOnBackdrop: config.closeOnBackdrop ?? false,
    });
  }

  /**
   * Dismiss a specific modal by ID
   * WEB-PERF-001: Removed debug console.log statements for production performance
   */
  static dismiss(id: ModalId | string): void {
    const index = this.modals.findIndex((m) => m.id === id);
    if (index !== -1) {
      const modal = this.modals[index];
      this.modals.splice(index, 1);
      if (modal.onClose) {
        try {
          modal.onClose();
        } catch (error) {
          logger.error('Modal onClose callback failed:', error);
        }
      }
      this.notifyListeners();
      logger.info(`Modal dismissed: ${id}`);
    } else {
      logger.warn(`Modal not found for dismissal: ${id}`);
    }
  }

  /**
   * Dismiss the topmost modal
   * WEB-PERF-001: Removed debug console.log statements for production performance
   */
  static dismissTop(): void {
    if (this.modals.length > 0) {
      const topModal = this.modals[this.modals.length - 1];
      this.dismiss(topModal.id);
    }
  }

  /**
   * Dismiss all modals
   */
  static dismissAll(): void {
    // Call onClose for each modal (wrapped in try-catch to ensure all are processed)
    this.modals.forEach((modal) => {
      if (modal.onClose) {
        try {
          modal.onClose();
        } catch (error) {
          logger.error('Modal onClose callback failed:', error);
        }
      }
    });

    this.modals = [];
    this.notifyListeners();
    logger.info('All modals dismissed');
  }

  /**
   * Get current modals (readonly copy)
   */
  static getModals(): readonly Modal[] {
    return [...this.modals];
  }

  /**
   * Get topmost modal
   */
  static getTopModal(): Modal | null {
    return this.modals.length > 0 ? this.modals[this.modals.length - 1] : null;
  }

  /**
   * Check if any modals are open
   */
  static hasOpenModals(): boolean {
    return this.modals.length > 0;
  }

  /**
   * Subscribe to modal changes
   * WEB-BUG-002: Added options parameter to control immediate notification
   * @param listener - Callback function for modal changes
   * @param options - Subscription options (immediate: whether to call listener immediately)
   * @returns Unsubscribe function
   */
  static subscribe(
    listener: (modals: Modal[]) => void,
    options: { immediate?: boolean } = { immediate: true }
  ): () => void {
    this.listeners.add(listener);

    // Immediately notify with current state (opt-in, default true for backwards compatibility)
    if (options.immediate) {
      listener([...this.modals]);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if reduced motion is preferred
   */
  static prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
