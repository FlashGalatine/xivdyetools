/**
 * XIV Dye Tools - Component Testing Utilities
 *
 * Helper functions for testing BaseComponent subclasses.
 * Provides DOM manipulation, event simulation, and async utilities.
 *
 * @module __tests__/component-utils
 */

import { vi } from 'vitest';

// ============================================================================
// DOM Container Management
// ============================================================================

/**
 * Create a test container element attached to document.body
 * @param id - Optional ID for the container (default: 'test-container')
 * @returns The created container element
 */
export function createTestContainer(id = 'test-container'): HTMLElement {
  // Remove existing container if present
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  return container;
}

/**
 * Clean up a test container and remove from DOM
 * @param container - The container to remove
 */
export function cleanupTestContainer(container: HTMLElement): void {
  container.remove();
}

// ============================================================================
// Async Utilities
// ============================================================================

// ============================================================================
// Event Simulation
// ============================================================================

/**
 * Simulate a click event on an element
 * @param element - Element to click (or null for no-op)
 * @param options - Optional MouseEvent options
 */
export function click(element: Element | null, options?: MouseEventInit): void {
  if (!element) return;
  element.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ...options,
    })
  );
}

/**
 * Simulate an input event on a form element
 * @param element - Input element to update
 * @param value - New value to set
 */
export function input(element: HTMLInputElement | HTMLTextAreaElement | null, value: string): void {
  if (!element) return;
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

// ============================================================================
// Custom Event Utilities
// ============================================================================

/**
 * Create a spy for custom events on an element
 * @param element - Element to monitor
 * @param eventName - Name of the custom event
 * @returns A vi.fn() spy that captures event details
 */
export function spyOnCustomEvent(
  element: HTMLElement,
  eventName: string
): ReturnType<typeof vi.fn> {
  const spy = vi.fn();
  element.addEventListener(eventName, (event) => {
    spy((event as CustomEvent).detail);
  });
  return spy;
}

// ============================================================================
// Component Testing Helpers
// ============================================================================

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Query for an element within a container
 * @param container - Container to search in
 * @param selector - CSS selector
 * @returns The found element or null
 */
export function query<T extends Element = Element>(container: Element, selector: string): T | null {
  return container.querySelector<T>(selector);
}

/**
 * Query for all elements matching a selector
 * @param container - Container to search in
 * @param selector - CSS selector
 * @returns Array of matching elements
 */
export function queryAll<T extends Element = Element>(container: Element, selector: string): T[] {
  return Array.from(container.querySelectorAll<T>(selector));
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Check if an element has a specific class
 * @param element - Element to check
 * @param className - Class name to look for
 * @returns True if element has the class
 */
export function hasClass(element: Element | null, className: string): boolean {
  return element?.classList.contains(className) ?? false;
}

/**
 * Get the text content of an element (trimmed)
 * @param element - Element to get text from
 * @returns Trimmed text content or empty string
 */
export function getText(element: Element | null): string {
  return element?.textContent?.trim() ?? '';
}

/**
 * Get an attribute value
 * @param element - Element to query
 * @param attr - Attribute name
 * @returns Attribute value or null
 */
export function getAttr(element: Element | null, attr: string): string | null {
  return element?.getAttribute(attr) ?? null;
}
