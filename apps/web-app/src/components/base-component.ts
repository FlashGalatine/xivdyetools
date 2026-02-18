/**
 * XIV Dye Tools v2.0.0 - Base Component Class
 *
 * Phase 12: Architecture Refactor
 * Abstract base class for all UI components
 *
 * @module components/base-component
 */

import { ErrorHandler } from '@shared/error-handler';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { LanguageService } from '@services/index';

/**
 * Options for creating HTML elements within components
 */
export interface ElementOptions {
  className?: string;
  id?: string;
  innerHTML?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  dataAttributes?: Record<string, string>;
}

/**
 * Event handler type with component context
 */
export type EventHandler<T extends Event = Event> = (this: BaseComponent, event: T) => void;

/**
 * Component lifecycle hooks
 */
export interface ComponentLifecycle {
  onMount?(): void;
  onUnmount?(): void;
  onUpdate?(): void;
}

/**
 * Component error state for error boundary handling
 * Tracks whether a component has encountered a render error and provides
 * information for the fallback UI
 */
export interface ComponentErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
  retryCount: number;
}

// ============================================================================
// Base Component Class
// ============================================================================

/**
 * Abstract base class for all UI components
 * Provides common functionality for rendering, event handling, and lifecycle
 */
export abstract class BaseComponent implements ComponentLifecycle {
  protected container: HTMLElement;
  protected element: HTMLElement | null = null;
  protected listeners: Map<
    string,
    { target: HTMLElement | Document | Window; event: string; handler: EventListener }
  > = new Map();
  protected isInitialized: boolean = false;
  protected isDestroyed: boolean = false;
  // Track pending timers for cleanup to prevent memory leaks
  private pendingTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  // WEB-PERF-003: Use counter instead of Math.random() to prevent key collision
  private listenerCounter: number = 0;

  // Error boundary state - tracks render errors for graceful degradation
  protected errorState: ComponentErrorState = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  };

  // Maximum retry attempts before hiding the retry button
  protected static readonly MAX_RETRY_COUNT = 3;

  // Lifecycle hooks - optional for subclasses to override
  onMount?(): void;
  onUnmount?(): void;
  onUpdate?(): void;

  /**
   * Constructor - initialize component with container element
   */
  constructor(container: HTMLElement) {
    this.container = container;
  }

  // ============================================================================
  // Public Accessors
  // ============================================================================

  /**
   * Get the component's root element.
   * Used by external code to access the element for event delegation.
   */
  getElement(): HTMLElement | null {
    return this.element;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Initialize the component
   * Call after constructor to render and bind events
   */
  init(): this {
    if (this.isInitialized) {
      logger.warn('Component already initialized');
      return this;
    }

    try {
      this.render();
      this.bindEvents();
      this.isInitialized = true;
      this.onMount?.();
      return this;
    } catch (error) {
      console.error('BaseComponent.init failed:', error);
      ErrorHandler.log(error);
      throw error;
    }
  }

  /**
   * Re-render the component
   */
  update(): void {
    if (!this.isInitialized) {
      logger.warn('Component not initialized');
      return;
    }

    try {
      // CRITICAL: Unbind all events before rebinding to prevent listener accumulation
      this.unbindAllEvents();
      this.render();
      this.bindEvents();
      this.onUpdate?.();
    } catch (error) {
      ErrorHandler.log(error);
    }
  }

  /**
   * Destroy the component and clean up
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    try {
      this.unbindAllEvents();
      this.clearAllTimeouts();
      this.onUnmount?.();
      this.isDestroyed = true;
      this.element?.remove();
    } catch (error) {
      ErrorHandler.log(error);
    }
  }

  // ============================================================================
  // Timer Management
  // ============================================================================

  /**
   * Set a timeout that will be automatically cleaned up when the component is destroyed
   * Use this instead of raw setTimeout to prevent memory leaks
   */
  protected safeTimeout(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
    // Don't schedule timeouts on destroyed components
    if (this.isDestroyed) {
      return setTimeout(() => {}, 0); // Return a dummy timeout ID
    }

    const timeoutId = setTimeout(() => {
      this.pendingTimeouts.delete(timeoutId);
      // Only execute callback if component isn't destroyed
      if (!this.isDestroyed) {
        callback();
      }
    }, delay);

    this.pendingTimeouts.add(timeoutId);
    return timeoutId;
  }

  /**
   * Clear a specific timeout and remove it from tracking
   */
  protected clearSafeTimeout(timeoutId: ReturnType<typeof setTimeout>): void {
    clearTimeout(timeoutId);
    this.pendingTimeouts.delete(timeoutId);
  }

  /**
   * Clear all pending timeouts - called automatically on destroy
   */
  private clearAllTimeouts(): void {
    for (const timeoutId of this.pendingTimeouts) {
      clearTimeout(timeoutId);
    }
    this.pendingTimeouts.clear();
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================

  /**
   * Render the component content to the DOM
   * Override this method in child components (replaces previous render())
   */
  abstract renderContent(): void;

  /**
   * Bind event listeners
   */
  abstract bindEvents(): void;

  // ============================================================================
  // Error Boundary Methods
  // ============================================================================

  /**
   * Render method with error boundary protection
   * Wraps renderContent() in try/catch and shows error UI on failure
   */
  render(): void {
    // Check if component should show error state
    if (this.errorState.hasError) {
      this.renderError();
      return;
    }

    // Attempt safe render
    this.safeRender();
  }

  /**
   * Safely execute renderContent with error catching
   * Note: This only catches synchronous errors. For async operations, use safeAsync().
   */
  protected safeRender(): void {
    try {
      this.renderContent();
      // Clear error state on successful render after a retry
      if (this.errorState.retryCount > 0) {
        this.clearErrorState();
      }
    } catch (error) {
      this.handleRenderError(error);
    }
  }

  /**
   * Wrap an async operation with error boundary handling
   * Use this in onMount() or event handlers for async operations that should
   * trigger error UI on failure.
   *
   * @example
   * async onMount() {
   *   await this.safeAsync(async () => {
   *     const data = await fetchData();
   *     this.renderData(data);
   *   });
   * }
   */
  protected async safeAsync<T>(operation: () => Promise<T>): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      this.handleRenderError(error);
      return null;
    }
  }

  /**
   * Handle render errors - log, store state, show fallback UI
   */
  protected handleRenderError(error: unknown): void {
    const normalizedError = error instanceof Error ? error : new Error(String(error));

    // Log the error
    ErrorHandler.log(error);
    logger.error(`[${this.constructor.name}] Render failed:`, normalizedError.message);

    // Update error state
    this.errorState = {
      hasError: true,
      error: normalizedError,
      errorInfo: `Component: ${this.constructor.name}`,
      retryCount: this.errorState.retryCount,
    };

    // Show error UI
    this.renderError();
  }

  /**
   * Render the error fallback UI
   * Can be overridden by child components for custom error display
   */
  protected renderError(): void {
    // Don't render if destroyed
    if (this.isDestroyed) return;

    clearContainer(this.container);

    const errorWrapper = this.createElement('div', {
      className: 'component-error-boundary',
      attributes: {
        role: 'alert',
        'aria-live': 'assertive',
      },
    });

    // Error icon
    const iconWrapper = this.createElement('div', {
      className: 'component-error-icon',
      innerHTML: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4m0 4h.01"/>
      </svg>`,
      attributes: { 'aria-hidden': 'true' },
    });
    errorWrapper.appendChild(iconWrapper);

    // Error message
    const title = this.createElement('h3', {
      className: 'component-error-title',
      textContent: LanguageService.t('errors.somethingWentWrong'),
    });
    errorWrapper.appendChild(title);

    // Error details
    const details = this.createElement('p', {
      className: 'component-error-details',
      textContent: this.errorState.error?.message || LanguageService.t('errors.unexpectedError'),
    });
    errorWrapper.appendChild(details);

    // Actions container
    const actions = this.createElement('div', {
      className: 'component-error-actions',
    });

    // Retry button (if under max retries)
    if (this.errorState.retryCount < BaseComponent.MAX_RETRY_COUNT) {
      const retryBtn = this.createElement('button', {
        className: 'component-error-btn component-error-btn-primary',
        textContent: LanguageService.t('errors.tryAgain'),
        attributes: { type: 'button' },
        dataAttributes: { action: 'retry' },
      });
      retryBtn.addEventListener('click', () => this.handleRetry());
      actions.appendChild(retryBtn);
    }

    // Reset button (always available)
    const resetBtn = this.createElement('button', {
      className: 'component-error-btn component-error-btn-secondary',
      textContent: LanguageService.t('errors.resetComponent'),
      attributes: { type: 'button' },
      dataAttributes: { action: 'reset' },
    });
    resetBtn.addEventListener('click', () => this.handleReset());
    actions.appendChild(resetBtn);

    errorWrapper.appendChild(actions);

    // Show retry count info if retries have been attempted
    if (this.errorState.retryCount > 0) {
      const retryInfo = this.createElement('p', {
        className: 'component-error-retry-info',
        textContent: LanguageService.t('errors.retryAttempts')
          .replace('{count}', String(this.errorState.retryCount))
          .replace('{max}', String(BaseComponent.MAX_RETRY_COUNT)),
      });
      errorWrapper.appendChild(retryInfo);
    }

    this.element = errorWrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Handle retry button click
   */
  protected handleRetry(): void {
    if (this.isDestroyed) return;

    this.errorState.retryCount++;
    this.errorState.hasError = false;

    // Re-attempt render
    this.render();

    // Rebind events if render succeeded
    if (!this.errorState.hasError) {
      this.bindEvents();
    }
  }

  /**
   * Handle reset button click - full component reset
   */
  protected handleReset(): void {
    if (this.isDestroyed) return;

    this.clearErrorState();

    // Full re-initialization
    this.unbindAllEvents();
    this.render();
    this.bindEvents();
  }

  /**
   * Clear error state
   */
  protected clearErrorState(): void {
    this.errorState = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  /**
   * Check if component is in error state
   */
  public hasErrorState(): boolean {
    return this.errorState.hasError;
  }

  /**
   * Get current error (for debugging/logging)
   */
  public getError(): Error | null {
    return this.errorState.error;
  }

  // ============================================================================
  // DOM Creation Utilities
  // ============================================================================

  /**
   * Create an HTML element with optional attributes
   *
   * SECURITY NOTE on innerHTML option:
   * The innerHTML option is intended ONLY for static SVG icons defined in
   * shared/*-icons.ts files. These are compile-time constants, not user input.
   *
   * For user-controlled content, ALWAYS use textContent instead.
   * See ui-icons.ts for detailed security rationale.
   */
  /**
   * Public createElement for use by external utilities (e.g., tool-panel-builders).
   * Subclasses continue to use this method directly.
   */
  public createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options?: ElementOptions
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);

    if (options) {
      if (options.className) {
        element.className = options.className;
      }
      if (options.id) {
        element.id = options.id;
      }
      if (options.innerHTML) {
        // SECURITY: Only use innerHTML for static SVG icons from *-icons.ts files
        // Never pass user-controlled content here
        element.innerHTML = options.innerHTML;
      }
      if (options.textContent) {
        element.textContent = options.textContent;
      }
      if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
          element.setAttribute(key, value);
        }
      }
      if (options.dataAttributes) {
        for (const [key, value] of Object.entries(options.dataAttributes)) {
          element.dataset[key] = value;
        }
      }
    }

    return element;
  }

  /**
   * Set element content
   */
  protected setContent(element: HTMLElement, content: string | HTMLElement): void {
    clearContainer(element);
    if (typeof content === 'string') {
      element.textContent = content;
    } else {
      element.appendChild(content);
    }
  }

  /**
   * Query selector within component
   */
  protected querySelector<T extends Element = Element>(selector: string): T | null {
    return (this.element || this.container).querySelector(selector) as T | null;
  }

  /**
   * Query all selectors within component
   */
  protected querySelectorAll<T extends Element = Element>(selector: string): T[] {
    return Array.from((this.element || this.container).querySelectorAll(selector)) as T[];
  }

  /**
   * Add class to element
   */
  protected addClass(element: HTMLElement, className: string): void {
    element.classList.add(className);
  }

  /**
   * Remove class from element
   */
  protected removeClass(element: HTMLElement, className: string): void {
    element.classList.remove(className);
  }

  /**
   * Toggle class on element
   */
  protected toggleClass(element: HTMLElement, className: string, force?: boolean): void {
    element.classList.toggle(className, force);
  }

  /**
   * Check if element has class
   */
  protected hasClass(element: HTMLElement, className: string): boolean {
    return element.classList.contains(className);
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add event listener with automatic context binding
   */
  protected on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Document | Window,
    event: K,
    handler: EventHandler<HTMLElementEventMap[K]>
  ): void {
    // console.log('BaseComponent.on called', { target, event, type: typeof handler });
    if (!handler || typeof handler !== 'function') {
      console.error('BaseComponent.on: handler is invalid', { target, event, handler });
      return;
    }
    const boundHandler = handler.bind(this) as EventListener;
    const eventName = event as string;

    // Check if target can receive events (handles fake timer environments where
    // window may not pass instanceof Window check)
    const isValidTarget =
      target instanceof HTMLElement ||
      target instanceof Document ||
      target instanceof Window ||
      target === globalThis.window ||
      target === globalThis ||
      (typeof target === 'object' &&
        target !== null &&
        typeof (target as EventTarget).addEventListener === 'function');

    if (isValidTarget) {
      (target as EventTarget).addEventListener(eventName, boundHandler);
    } else {
      console.error('BaseComponent.on: Target is not HTMLElement, Document, or Window', target);
    }

    // Store listener for cleanup with event name
    // WEB-PERF-003: Use counter instead of Math.random() to prevent key collision
    const key = `${eventName}_${++this.listenerCounter}`;
    this.listeners.set(key, { target, event: eventName, handler: boundHandler });
  }

  /**
   * Remove specific event listener
   */
  protected off<K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Document | Window,
    event: K,
    handler: EventListener
  ): void {
    const eventName = event as string;
    target.removeEventListener(eventName, handler);

    // Remove from stored listeners
    for (const [key, listener] of this.listeners.entries()) {
      if (
        listener.target === target &&
        listener.event === eventName &&
        listener.handler === handler
      ) {
        this.listeners.delete(key);
        break;
      }
    }
  }

  /**
   * Remove all event listeners
   * Protected to allow error boundary reset functionality
   */
  protected unbindAllEvents(): void {
    for (const { target, event, handler } of this.listeners.values()) {
      try {
        target.removeEventListener(event, handler);
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.listeners.clear();
  }

  /**
   * Emit custom event from component
   */
  protected emit<T extends CustomEvent>(eventName: string, detail?: T['detail']): boolean {
    const event = new CustomEvent(eventName, { detail, bubbles: true, cancelable: true });
    return (this.element || this.container).dispatchEvent(event);
  }

  /**
   * Listen for custom events
   */
  protected onCustom(eventName: string, handler: (event: CustomEvent) => void): void {
    const boundHandler = (event: Event) => {
      if (event instanceof CustomEvent) {
        handler.call(this, event);
      }
    };

    const target = this.element || this.container;
    target.addEventListener(eventName, boundHandler);

    // Use unique key with timestamp to prevent overwrites when same event is registered multiple times
    const listenerKey = `custom_${eventName}_${Date.now()}_${this.listeners.size}`;
    this.listeners.set(listenerKey, {
      target,
      event: eventName,
      handler: boundHandler,
    });
  }

  // ============================================================================
  // State Management Utilities
  // ============================================================================

  /**
   * Get component state (for subclasses to override)
   */
  protected getState(): Record<string, unknown> {
    return {};
  }

  /**
   * Set component state (for subclasses to override)
   */
  protected setState(_newState: Record<string, unknown>): void {
    // Subclasses should override this to implement state management
  }

  // ============================================================================
  // Visibility and Styling
  // ============================================================================

  /**
   * Show the component
   */
  show(): void {
    if (this.element) {
      this.element.style.display = '';
    }
  }

  /**
   * Hide the component
   */
  hide(): void {
    if (this.element) {
      this.element.style.display = 'none';
    }
  }

  /**
   * Check if component is visible
   */
  isVisible(): boolean {
    return this.element ? this.element.style.display !== 'none' : false;
  }

  /**
   * Set component CSS
   */
  setStyle(styles: Partial<CSSStyleDeclaration>): void {
    if (!this.element) return;

    for (const [key, value] of Object.entries(styles)) {
      (this.element.style as unknown as Record<string, string>)[key] = value as string;
    }
  }

  // ============================================================================
  // Debugging & Utilities
  // ============================================================================

  /**
   * Get component debug info
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      name: this.constructor.name,
      initialized: this.isInitialized,
      destroyed: this.isDestroyed,
      element: this.element?.tagName,
      container: this.container.tagName,
      listeners: this.listeners.size,
      state: this.getState(),
    };
  }

  /**
   * Log debug info
   */
  debug(): void {
    logger.info(`🔍 ${this.constructor.name} Debug Info`);
    logger.info(this.getDebugInfo());
    logger.info('--- End Debug Info ---');
  }
}
