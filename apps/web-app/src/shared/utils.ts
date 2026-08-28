/**
 * XIV Dye Tools - Shared Utilities
 *
 * @module shared/utils
 */

import { logger } from './logger';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a string for interpolation into an HTML template that is assigned
 * to `innerHTML` (text content or a quoted attribute value).
 *
 * Prefer `textContent` / Lit text bindings when building DOM; this is for the
 * imperative template-string renderers (my-submissions-modal, empty-state)
 * where a remote or user-typed string has to ride along in the markup
 * (2026-08-21 security audit, FINDING-011).
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Clear all children from an element safely.
 * Calls __cleanup() on child elements if it exists to prevent memory leaks.
 */
export function clearContainer(element: HTMLElement): void {
  const children = Array.from(element.children);
  for (const child of children) {
    const elementWithCleanup = child as Element & { __cleanup?: () => void };
    if (typeof elementWithCleanup.__cleanup === 'function') {
      try {
        elementWithCleanup.__cleanup();
      } catch (error) {
        logger.warn('Error during element cleanup:', error);
      }
    }
  }

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}
