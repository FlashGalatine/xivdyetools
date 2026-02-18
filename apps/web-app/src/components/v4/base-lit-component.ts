/**
 * XIV Dye Tools v4.0 - Base Lit Component
 *
 * Abstract base class for all v4 Lit-based components.
 * Provides common functionality for theming, services, and utilities.
 *
 * @module components/v4/base-lit-component
 */

import { LitElement, css, CSSResultGroup } from 'lit';
import { state } from 'lit/decorators.js';
import { logger } from '@shared/logger';

/**
 * Abstract base class for v4 Lit components
 *
 * Provides:
 * - Theme-aware styling via CSS custom properties
 * - Service integration helpers
 * - Common utility methods
 * - Consistent lifecycle patterns
 */
export abstract class BaseLitComponent extends LitElement {
  /**
   * Whether the component has completed first render
   */
  @state()
  protected isReady: boolean = false;

  /**
   * Component error state for graceful degradation
   */
  @state()
  protected hasError: boolean = false;

  @state()
  protected errorMessage: string = '';

  /**
   * Base styles shared by all v4 components
   * Includes CSS custom property references for theming
   */
  static baseStyles: CSSResultGroup = css`
    :host {
      display: block;
      box-sizing: border-box;
    }

    :host([hidden]) {
      display: none;
    }

    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }

    /* Theme-aware text colors */
    .text-primary {
      color: var(--theme-text, #e0e0e0);
    }

    .text-secondary {
      color: var(--v4-text-secondary, #a0a0a0);
    }

    .text-accent {
      color: var(--theme-primary, #d4af37);
    }

    /* Glassmorphism utilities */
    .glass-panel {
      background: var(--v4-glass-bg, rgba(30, 30, 30, 0.7));
      backdrop-filter: var(--v4-glass-blur, blur(12px));
      -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
      border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
      border-radius: 12px;
    }
  `;

  /**
   * Lifecycle: Called when element is added to DOM
   */
  connectedCallback(): void {
    super.connectedCallback();
    logger.debug(`[${this.tagName}] Connected to DOM`);
  }

  /**
   * Lifecycle: Called when element is removed from DOM
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    logger.debug(`[${this.tagName}] Disconnected from DOM`);
  }

  /**
   * Lifecycle: Called after first render
   */
  protected firstUpdated(): void {
    this.isReady = true;
    logger.debug(`[${this.tagName}] First render complete`);
  }

  /**
   * Emit a custom event with optional detail payload
   * Mirrors BaseComponent's emit() method for consistency
   */
  protected emit<T>(eventName: string, detail?: T): void {
    this.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Set component error state
   * Used for graceful degradation when rendering fails
   */
  protected setError(message: string, error?: Error): void {
    this.hasError = true;
    this.errorMessage = message;
    if (error) {
      logger.error(`[${this.tagName}] ${message}`, error);
    }
  }

  /**
   * Clear error state and attempt recovery
   */
  protected clearError(): void {
    this.hasError = false;
    this.errorMessage = '';
    this.requestUpdate();
  }
}
