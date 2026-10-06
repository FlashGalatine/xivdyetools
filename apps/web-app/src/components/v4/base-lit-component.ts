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
   * Report a component error
   * Logs the message when an Error is passed
   */
  protected setError(message: string, error?: Error): void {
    if (error) {
      logger.error(`[${this.tagName}] ${message}`, error);
    }
  }
}
