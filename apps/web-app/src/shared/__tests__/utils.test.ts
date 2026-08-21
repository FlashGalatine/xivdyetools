/**
 * XIV Dye Tools - Utility Functions Tests
 *
 * @module shared/__tests__/utils.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clearContainer, escapeHtml } from '../utils';

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;'
    );
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Snow White 2')).toBe('Snow White 2');
    expect(escapeHtml('')).toBe('');
  });

  it('yields text, not elements, once parsed as HTML', () => {
    const host = document.createElement('div');
    host.innerHTML = `<p>${escapeHtml('<img src=x onerror=alert(1)><b>bold</b>')}</p>`;
    expect(host.querySelector('img, b')).toBeNull();
    expect(host.querySelector('p')!.textContent).toBe('<img src=x onerror=alert(1)><b>bold</b>');
  });
});

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
