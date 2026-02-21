/**
 * XIV Dye Tools - Component Testing Utilities
 *
 * Helper functions for testing BaseComponent subclasses.
 * Provides DOM manipulation, event simulation, and async utilities.
 *
 * @module __tests__/component-utils
 */

import { vi } from 'vitest';
import type { BaseComponent } from '@components/base-component';

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

/**
 * Create multiple test containers for components with panels
 * Useful for tools that expect leftPanel/rightPanel structure
 */
export function createPanelContainers(): {
  container: HTMLElement;
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
} {
  const container = createTestContainer();

  const leftPanel = document.createElement('div');
  leftPanel.className = 'left-panel';
  container.appendChild(leftPanel);

  const rightPanel = document.createElement('div');
  rightPanel.className = 'right-panel';
  container.appendChild(rightPanel);

  return { container, leftPanel, rightPanel };
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Wait for the next animation frame
 * Useful for waiting for component renders
 */
export function waitForRender(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Wait for multiple animation frames
 * @param count - Number of frames to wait
 */
export async function waitForFrames(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await waitForRender();
  }
}

/**
 * Wait for a specified timeout
 * @param ms - Milliseconds to wait
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait (default: 1000ms)
 * @param interval - Check interval (default: 50ms)
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) return;
    await wait(interval);
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Flush all pending microtasks (Promise callbacks)
 */
export function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

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
 * Simulate a double click event
 * @param element - Element to double-click
 */
export function doubleClick(element: Element | null): void {
  if (!element) return;
  element.dispatchEvent(
    new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
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

/**
 * Simulate a change event on a form element
 * @param element - Element that changed
 * @param value - New value (optional, for select elements)
 */
export function change(element: HTMLInputElement | HTMLSelectElement | null, value?: string): void {
  if (!element) return;
  if (value !== undefined) {
    element.value = value;
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate a keyboard event
 * @param element - Element to receive the event
 * @param eventType - 'keydown', 'keyup', or 'keypress'
 * @param key - Key value (e.g., 'Enter', 'Escape', 'a')
 * @param options - Additional KeyboardEvent options
 */
export function keyboard(
  element: Element | null,
  eventType: 'keydown' | 'keyup' | 'keypress',
  key: string,
  options?: Partial<KeyboardEventInit>
): void {
  if (!element) return;
  element.dispatchEvent(
    new KeyboardEvent(eventType, {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    })
  );
}

/**
 * Simulate pressing Enter key
 * @param element - Element to receive the event
 */
export function pressEnter(element: Element | null): void {
  keyboard(element, 'keydown', 'Enter');
}

/**
 * Simulate pressing Escape key
 * @param element - Element to receive the event
 */
export function pressEscape(element: Element | null): void {
  keyboard(element, 'keydown', 'Escape');
}

/**
 * Simulate a focus event
 * @param element - Element to focus
 */
export function focus(element: Element | null): void {
  if (!element) return;
  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
}

/**
 * Simulate a blur event
 * @param element - Element to blur
 */
export function blur(element: Element | null): void {
  if (!element) return;
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

/**
 * Simulate mouse hover (mouseenter)
 * @param element - Element to hover
 */
export function hover(element: Element | null): void {
  if (!element) return;
  element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
}

/**
 * Simulate mouse leave
 * @param element - Element to leave
 */
export function unhover(element: Element | null): void {
  if (!element) return;
  element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
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

/**
 * Dispatch a custom event with detail
 * @param element - Element to dispatch from
 * @param eventName - Name of the custom event
 * @param detail - Event detail payload
 */
export function dispatchCustomEvent<T>(element: Element, eventName: string, detail?: T): void {
  element.dispatchEvent(
    new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true,
    })
  );
}

// ============================================================================
// Component Testing Helpers
// ============================================================================

/**
 * Initialize a BaseComponent subclass for testing
 * @param ComponentClass - The component class to instantiate
 * @param container - Container element (optional, creates one if not provided)
 * @param options - Options to pass to the component constructor
 * @returns The initialized component and its container
 */
export function setupComponent<T extends BaseComponent, O = unknown>(
  ComponentClass: new (container: HTMLElement, options?: O) => T,
  options?: O,
  container?: HTMLElement
): { component: T; container: HTMLElement } {
  const testContainer = container || createTestContainer();
  const component = new ComponentClass(testContainer, options);
  component.init();
  return { component, container: testContainer };
}

/**
 * Clean up a component and its container
 * @param component - Component to destroy
 * @param container - Container to remove
 */
export function cleanupComponent(
  component: BaseComponent | null,
  container: HTMLElement | null
): void {
  if (component) {
    try {
      component.destroy();
    } catch {
      // Ignore errors during cleanup
    }
  }
  if (container) {
    container.remove();
  }
}

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

/**
 * Query by text content
 * @param container - Container to search in
 * @param text - Text to search for
 * @param selector - Optional selector to filter (default: '*')
 * @returns The first element containing the text, or null
 */
export function queryByText(container: Element, text: string, selector = '*'): Element | null {
  const elements = container.querySelectorAll(selector);
  for (const el of elements) {
    if (el.textContent?.includes(text)) {
      return el;
    }
  }
  return null;
}

/**
 * Query by data attribute
 * @param container - Container to search in
 * @param dataAttr - Data attribute name (without 'data-' prefix)
 * @param value - Optional value to match
 * @returns The found element or null
 */
export function queryByData(container: Element, dataAttr: string, value?: string): Element | null {
  const selector = value !== undefined ? `[data-${dataAttr}="${value}"]` : `[data-${dataAttr}]`;
  return container.querySelector(selector);
}

/**
 * Query by role attribute (for accessibility testing)
 * @param container - Container to search in
 * @param role - ARIA role to search for
 * @returns The found element or null
 */
export function queryByRole(container: Element, role: string): Element | null {
  return container.querySelector(`[role="${role}"]`);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Check if an element is visible (not display:none or visibility:hidden)
 * @param element - Element to check
 * @returns True if visible
 */
export function isVisible(element: Element | null): boolean {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

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
