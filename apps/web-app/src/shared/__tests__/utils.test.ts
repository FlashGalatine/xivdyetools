/**
 * XIV Dye Tools - Utility Functions Tests
 *
 * @module shared/__tests__/utils.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clearContainer } from '../utils';

describe('DOM Utilities', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('clearContainer', () => {
    it('should remove all children', () => {
      container.innerHTML = '<div>1</div><div>2</div><div>3</div>';
      clearContainer(container);
      expect(container.children.length).toBe(0);
    });

    it('should handle empty container', () => {
      clearContainer(container);
      expect(container.children.length).toBe(0);
    });

    it('should call __cleanup on child elements that have it', () => {
      const child = document.createElement('div');
      let cleanupCalled = false;
      (child as unknown as HTMLElement & { __cleanup: () => void }).__cleanup = () => {
        cleanupCalled = true;
      };
      container.appendChild(child);
      clearContainer(container);
      expect(cleanupCalled).toBe(true);
      expect(container.children.length).toBe(0);
    });
  });
});
