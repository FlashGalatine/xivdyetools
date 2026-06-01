/**
 * XIV Dye Tools - Shared Utilities
 *
 * @module shared/utils
 */

import { logger } from './logger';

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
