/**
 * XIV Dye Tools v2.1.0 - Toast Service
 *
 * Toast notification system for user feedback
 * Follows ThemeService singleton pattern with subscription model
 *
 * @module services/toast-service
 */

import { logger } from '@shared/logger';

// ============================================================================
// Toast Types
// ============================================================================

/**
 * Toast notification type determines styling and behavior
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast notification object
 */
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  details?: string;
  duration: number;
  dismissible?: boolean;
  timestamp?: number;
}

/**
 * Options for creating a toast
 */
export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  dismissible?: boolean;
  details?: string;
}

// ============================================================================
// Toast Constants
// ============================================================================

/**
 * Default durations by toast type (in milliseconds)
 */
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

/**
 * Maximum number of visible toasts
 */
const MAX_VISIBLE_TOASTS = 5;

// ============================================================================
// Toast Service Class
// ============================================================================

/**
 * Service for managing toast notifications
 * Static singleton pattern with subscription model
 */
export class ToastService {
  private static toasts: Toast[] = [];
  private static listeners: Set<(toasts: Toast[]) => void> = new Set();
  private static timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /**
   * Generate unique toast ID
   */
  private static generateId(): string {
    return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Notify all listeners of toast changes
   */
  private static notifyListeners(): void {
    const toastsCopy = [...this.toasts];
    this.listeners.forEach((listener) => listener(toastsCopy));
  }

  /**
   * Show a toast notification
   * @returns Toast ID for programmatic dismissal
   */
  static show(message: string, options: ToastOptions = {}): string {
    const type = options.type || 'info';
    const id = this.generateId();

    const toast: Toast = {
      id,
      type,
      message,
      details: options.details,
      duration: options.duration ?? DEFAULT_DURATIONS[type],
      dismissible: options.dismissible ?? type === 'error',
      timestamp: Date.now(),
    };

    // Add toast, respecting max visible limit
    this.toasts.push(toast);
    if (this.toasts.length > MAX_VISIBLE_TOASTS) {
      const removed = this.toasts.shift();
      if (removed) {
        this.clearTimer(removed.id);
      }
    }

    // Set auto-dismiss timer if duration > 0
    if (toast.duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, toast.duration);
      this.timers.set(id, timer);
    }

    this.notifyListeners();
    logger.info(`🍞 Toast shown: [${type}] ${message}`);

    return id;
  }

  /**
   * Show a success toast
   */
  static success(message: string, details?: string): string {
    return this.show(message, { type: 'success', details });
  }

  /**
   * Show an error toast
   */
  static error(message: string, details?: string): string {
    return this.show(message, { type: 'error', details, dismissible: true });
  }

  /**
   * Show a warning toast
   */
  static warning(message: string, details?: string): string {
    return this.show(message, { type: 'warning', details });
  }

  /**
   * Show an info toast
   */
  static info(message: string, details?: string): string {
    return this.show(message, { type: 'info', details });
  }

  /**
   * Dismiss a specific toast by ID
   */
  static dismiss(id: string): void {
    const index = this.toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.toasts.splice(index, 1);
      this.clearTimer(id);
      this.notifyListeners();
      logger.info(`🍞 Toast dismissed: ${id}`);
    }
  }

  /**
   * Clear timer for a toast
   */
  private static clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  /**
   * Dismiss all toasts
   */
  static dismissAll(): void {
    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();

    // Clear toasts
    this.toasts = [];
    this.notifyListeners();
    logger.info('🍞 All toasts dismissed');
  }

  /**
   * Get current toasts (readonly copy)
   */
  static getToasts(): readonly Toast[] {
    return [...this.toasts];
  }

  /**
   * Subscribe to toast changes
   * @returns Unsubscribe function
   */
  static subscribe(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.add(listener);

    // Immediately notify with current state
    listener([...this.toasts]);

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
