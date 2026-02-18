/**
 * XIV Dye Tools - Utility Functions Tests
 *
 * Comprehensive tests for all utility functions in utils.ts
 *
 * @module shared/__tests__/utils.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Math utilities
  clamp,
  lerp,
  toRadians,
  toDegrees,
  round,
  distance,
  isEven,
  isOdd,
  // String utilities
  escapeHTML,
  formatNumber,
  slugify,
  capitalize,
  camelToTitle,
  truncate,
  repeatString,
  // Array utilities
  unique,
  groupBy,
  sortByProperty,
  filterNulls,
  flatten,
  chunk,
  difference,
  intersection,
  // Object utilities
  deepClone,
  mergeObjects,
  pick,
  omit,
  // DOM utilities
  createElement,
  querySelector,
  querySelectorAll,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  clearContainer,
  // Validation utilities
  isValidHexColor,
  isValidRGB,
  isValidHSV,
  isValidEmail,
  isValidURL,
  // Debounce and throttle
  debounce,
  throttle,
  // Promise utilities
  sleep,
  retry,
  withTimeout,
  // Type guards
  isString,
  isNumber,
  isArray,
  isObject,
  isNullish,
  // Checksum
  generateChecksum,
} from '../utils';

// ==========================================================================
// Math Utilities
// ==========================================================================

describe('Math Utilities', () => {
  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should return min when value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should return max when value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle equal min and max', () => {
      expect(clamp(5, 5, 5)).toBe(5);
    });
  });

  describe('lerp', () => {
    it('should return a when t is 0', () => {
      expect(lerp(0, 100, 0)).toBe(0);
    });

    it('should return b when t is 1', () => {
      expect(lerp(0, 100, 1)).toBe(100);
    });

    it('should return midpoint when t is 0.5', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
    });

    it('should handle negative values', () => {
      expect(lerp(-100, 100, 0.5)).toBe(0);
    });
  });

  describe('toRadians', () => {
    it('should convert 0 degrees to 0 radians', () => {
      expect(toRadians(0)).toBe(0);
    });

    it('should convert 180 degrees to PI radians', () => {
      expect(toRadians(180)).toBeCloseTo(Math.PI);
    });

    it('should convert 90 degrees to PI/2 radians', () => {
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('toDegrees', () => {
    it('should convert 0 radians to 0 degrees', () => {
      expect(toDegrees(0)).toBe(0);
    });

    it('should convert PI radians to 180 degrees', () => {
      expect(toDegrees(Math.PI)).toBeCloseTo(180);
    });

    it('should convert PI/2 radians to 90 degrees', () => {
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90);
    });
  });

  describe('round', () => {
    it('should round to integers by default', () => {
      expect(round(3.7)).toBe(4);
      expect(round(3.2)).toBe(3);
    });

    it('should round to specified decimals', () => {
      expect(round(3.14159, 2)).toBe(3.14);
      expect(round(3.14159, 4)).toBe(3.1416);
    });

    it('should handle negative numbers', () => {
      expect(round(-3.7)).toBe(-4);
      expect(round(-3.14159, 2)).toBe(-3.14);
    });
  });

  describe('distance', () => {
    it('should return 0 for same point', () => {
      expect(distance(0, 0, 0, 0)).toBe(0);
    });

    it('should calculate horizontal distance', () => {
      expect(distance(0, 0, 10, 0)).toBe(10);
    });

    it('should calculate vertical distance', () => {
      expect(distance(0, 0, 0, 10)).toBe(10);
    });

    it('should calculate diagonal distance', () => {
      expect(distance(0, 0, 3, 4)).toBe(5); // 3-4-5 triangle
    });
  });

  describe('isEven', () => {
    it('should return true for even numbers', () => {
      expect(isEven(0)).toBe(true);
      expect(isEven(2)).toBe(true);
      expect(isEven(-4)).toBe(true);
    });

    it('should return false for odd numbers', () => {
      expect(isEven(1)).toBe(false);
      expect(isEven(3)).toBe(false);
      expect(isEven(-5)).toBe(false);
    });
  });

  describe('isOdd', () => {
    it('should return true for odd numbers', () => {
      expect(isOdd(1)).toBe(true);
      expect(isOdd(3)).toBe(true);
      expect(isOdd(-5)).toBe(true);
    });

    it('should return false for even numbers', () => {
      expect(isOdd(0)).toBe(false);
      expect(isOdd(2)).toBe(false);
      expect(isOdd(-4)).toBe(false);
    });
  });
});

// ==========================================================================
// String Utilities
// ==========================================================================

describe('String Utilities', () => {
  describe('escapeHTML', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHTML('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert("XSS")&lt;/script&gt;'
      );
    });

    it('should handle plain text', () => {
      expect(escapeHTML('Hello World')).toBe('Hello World');
    });

    it('should handle ampersands', () => {
      expect(escapeHTML('foo & bar')).toBe('foo &amp; bar');
    });
  });

  describe('formatNumber', () => {
    it('should format number with thousand separators', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
    });

    it('should format with decimal places', () => {
      expect(formatNumber(1234.567, 2)).toBe('1,234.57');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('slugify', () => {
    it('should convert to lowercase', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('foo bar baz')).toBe('foo-bar-baz');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello! @World#')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('foo   bar')).toBe('foo-bar');
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should lowercase rest of string', () => {
      expect(capitalize('HELLO')).toBe('Hello');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });
  });

  describe('camelToTitle', () => {
    it('should convert camelCase to Title Case', () => {
      expect(camelToTitle('helloWorld')).toBe('Hello World');
    });

    it('should handle consecutive capitals', () => {
      expect(camelToTitle('myHTTPServer')).toBe('My H T T P Server');
    });

    it('should handle single word', () => {
      expect(camelToTitle('hello')).toBe('Hello');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings with ellipsis', () => {
      expect(truncate('Hello World', 8)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should handle exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });
  });

  describe('repeatString', () => {
    it('should repeat string n times', () => {
      expect(repeatString('ab', 3)).toBe('ababab');
    });

    it('should return empty for 0 times', () => {
      expect(repeatString('ab', 0)).toBe('');
    });

    it('should handle negative times', () => {
      expect(repeatString('ab', -1)).toBe('');
    });
  });
});

// ==========================================================================
// Array Utilities
// ==========================================================================

describe('Array Utilities', () => {
  describe('unique', () => {
    it('should remove duplicates', () => {
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
    });

    it('should handle empty array', () => {
      expect(unique([])).toEqual([]);
    });

    it('should work with strings', () => {
      expect(unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });
  });

  describe('groupBy', () => {
    it('should group by key function', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = groupBy(items, (item) => item.type);
      expect(result['a'].length).toBe(2);
      expect(result['b'].length).toBe(1);
    });

    it('should handle empty array', () => {
      expect(groupBy([], () => 'key')).toEqual({});
    });
  });

  describe('sortByProperty', () => {
    it('should sort ascending by default', () => {
      const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }];
      const result = sortByProperty(items, 'name');
      expect(result.map((i) => i.name)).toEqual(['a', 'b', 'c']);
    });

    it('should sort descending', () => {
      const items = [{ value: 1 }, { value: 3 }, { value: 2 }];
      const result = sortByProperty(items, 'value', 'desc');
      expect(result.map((i) => i.value)).toEqual([3, 2, 1]);
    });
  });

  describe('filterNulls', () => {
    it('should remove null values', () => {
      expect(filterNulls([1, null, 2, null])).toEqual([1, 2]);
    });

    it('should remove undefined values', () => {
      expect(filterNulls([1, undefined, 2])).toEqual([1, 2]);
    });

    it('should keep falsy values that are not null/undefined', () => {
      expect(filterNulls([0, '', false, null])).toEqual([0, '', false]);
    });
  });

  describe('flatten', () => {
    it('should flatten nested arrays', () => {
      expect(flatten([[1, 2], [3, 4], 5])).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle empty arrays', () => {
      expect(flatten([])).toEqual([]);
    });

    it('should handle non-nested arrays', () => {
      expect(flatten([1, 2, 3])).toEqual([1, 2, 3]);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      expect(chunk([], 2)).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
    });
  });

  describe('difference', () => {
    it('should find elements in first array not in second', () => {
      expect(difference([1, 2, 3, 4], [2, 4])).toEqual([1, 3]);
    });

    it('should handle empty arrays', () => {
      expect(difference([], [1, 2])).toEqual([]);
      expect(difference([1, 2], [])).toEqual([1, 2]);
    });
  });

  describe('intersection', () => {
    it('should find common elements', () => {
      expect(intersection([1, 2, 3], [2, 3, 4])).toEqual([2, 3]);
    });

    it('should handle no common elements', () => {
      expect(intersection([1, 2], [3, 4])).toEqual([]);
    });
  });
});

// ==========================================================================
// Object Utilities
// ==========================================================================

describe('Object Utilities', () => {
  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(5)).toBe(5);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(null)).toBe(null);
    });

    it('should clone arrays', () => {
      const arr = [1, [2, 3]];
      const cloned = deepClone(arr);
      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[1]).not.toBe(arr[1]);
    });

    it('should clone objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should clone Date objects', () => {
      const date = new Date('2024-01-01');
      const cloned = deepClone(date);
      expect(cloned.getTime()).toBe(date.getTime());
      expect(cloned).not.toBe(date);
    });
  });

  describe('mergeObjects', () => {
    it('should merge objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      expect(mergeObjects(target, source)).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects', () => {
      const target = { a: { x: 1 } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const source = { a: { y: 2 } } as any;
      expect(mergeObjects(target, source)).toEqual({ a: { x: 1, y: 2 } });
    });
  });

  describe('pick', () => {
    it('should pick specified properties', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(pick(obj, 'a', 'c')).toEqual({ a: 1, c: 3 });
    });

    it('should handle missing properties', () => {
      const obj = { a: 1 };
      expect(pick(obj, 'a')).toEqual({ a: 1 });
    });
  });

  describe('omit', () => {
    it('should omit specified properties', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(omit(obj, 'b')).toEqual({ a: 1, c: 3 });
    });

    it('should handle missing properties', () => {
      const obj = { a: 1, b: 2 };
      expect(omit(obj, 'a')).toEqual({ b: 2 });
    });
  });
});

// ==========================================================================
// DOM Utilities
// ==========================================================================

describe('DOM Utilities', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('createElement', () => {
    it('should create element with tag name', () => {
      const el = createElement('div');
      expect(el.tagName).toBe('DIV');
    });

    it('should set className', () => {
      const el = createElement('div', { className: 'foo bar' });
      expect(el.className).toBe('foo bar');
    });

    it('should set id', () => {
      const el = createElement('div', { id: 'my-id' });
      expect(el.id).toBe('my-id');
    });

    it('should set textContent', () => {
      const el = createElement('div', { textContent: 'Hello' });
      expect(el.textContent).toBe('Hello');
    });

    it('should set innerHTML', () => {
      const el = createElement('div', { innerHTML: '<span>Test</span>' });
      expect(el.innerHTML).toBe('<span>Test</span>');
    });
  });

  describe('querySelector', () => {
    it('should find element in document', () => {
      container.innerHTML = '<div id="test"></div>';
      const el = querySelector('#test');
      expect(el).not.toBeNull();
    });

    it('should find element within parent', () => {
      container.innerHTML = '<div class="inner"><span id="nested"></span></div>';
      const el = querySelector('#nested', container);
      expect(el).not.toBeNull();
    });

    it('should return null for non-existent element', () => {
      expect(querySelector('#non-existent')).toBeNull();
    });
  });

  describe('querySelectorAll', () => {
    it('should find all matching elements', () => {
      container.innerHTML = '<div class="item">1</div><div class="item">2</div>';
      const els = querySelectorAll('.item', container);
      expect(els.length).toBe(2);
    });

    it('should return array', () => {
      container.innerHTML = '<div class="item">1</div>';
      const els = querySelectorAll('.item', container);
      expect(Array.isArray(els)).toBe(true);
    });
  });

  describe('addClass', () => {
    it('should add class to element', () => {
      const el = document.createElement('div');
      addClass(el, 'test-class');
      expect(el.classList.contains('test-class')).toBe(true);
    });
  });

  describe('removeClass', () => {
    it('should remove class from element', () => {
      const el = document.createElement('div');
      el.classList.add('test-class');
      removeClass(el, 'test-class');
      expect(el.classList.contains('test-class')).toBe(false);
    });
  });

  describe('toggleClass', () => {
    it('should toggle class on element', () => {
      const el = document.createElement('div');
      toggleClass(el, 'test-class');
      expect(el.classList.contains('test-class')).toBe(true);
      toggleClass(el, 'test-class');
      expect(el.classList.contains('test-class')).toBe(false);
    });

    it('should force class state', () => {
      const el = document.createElement('div');
      toggleClass(el, 'test-class', true);
      expect(el.classList.contains('test-class')).toBe(true);
      toggleClass(el, 'test-class', true);
      expect(el.classList.contains('test-class')).toBe(true);
    });
  });

  describe('hasClass', () => {
    it('should return true if element has class', () => {
      const el = document.createElement('div');
      el.classList.add('test-class');
      expect(hasClass(el, 'test-class')).toBe(true);
    });

    it('should return false if element does not have class', () => {
      const el = document.createElement('div');
      expect(hasClass(el, 'test-class')).toBe(false);
    });
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
  });
});

// ==========================================================================
// Validation Utilities
// ==========================================================================

describe('Validation Utilities', () => {
  describe('isValidHexColor', () => {
    it('should validate 3-digit hex colors', () => {
      expect(isValidHexColor('#FFF')).toBe(true);
      expect(isValidHexColor('#abc')).toBe(true);
    });

    it('should validate 6-digit hex colors', () => {
      expect(isValidHexColor('#FFFFFF')).toBe(true);
      expect(isValidHexColor('#aabbcc')).toBe(true);
    });

    it('should reject invalid hex colors', () => {
      expect(isValidHexColor('FFF')).toBe(false);
      expect(isValidHexColor('#GGG')).toBe(false);
      expect(isValidHexColor('#FFFFFFF')).toBe(false);
    });
  });

  describe('isValidRGB', () => {
    it('should validate valid RGB values', () => {
      expect(isValidRGB(0, 0, 0)).toBe(true);
      expect(isValidRGB(255, 255, 255)).toBe(true);
      expect(isValidRGB(128, 64, 192)).toBe(true);
    });

    it('should reject invalid RGB values', () => {
      expect(isValidRGB(-1, 0, 0)).toBe(false);
      expect(isValidRGB(256, 0, 0)).toBe(false);
      expect(isValidRGB(0, 300, 0)).toBe(false);
    });
  });

  describe('isValidHSV', () => {
    it('should validate valid HSV values', () => {
      expect(isValidHSV(0, 0, 0)).toBe(true);
      expect(isValidHSV(360, 100, 100)).toBe(true);
      expect(isValidHSV(180, 50, 50)).toBe(true);
    });

    it('should reject invalid HSV values', () => {
      expect(isValidHSV(-1, 0, 0)).toBe(false);
      expect(isValidHSV(361, 0, 0)).toBe(false);
      expect(isValidHSV(0, 101, 0)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should validate valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });
  });

  describe('isValidURL', () => {
    it('should validate valid URLs', () => {
      expect(isValidURL('https://example.com')).toBe(true);
      expect(isValidURL('http://foo.bar.com/path')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidURL('not a url')).toBe(false);
      expect(isValidURL('ftp://not-http.com')).toBe(false);
    });
  });
});

// ==========================================================================
// Debounce and Throttle
// ==========================================================================

describe('Debounce and Throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('should delay function execution', () => {
      const fn = vi.fn();
      const { fn: debouncedFn } = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only call function once for rapid calls', () => {
      const fn = vi.fn();
      const { fn: debouncedFn } = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should provide cleanup function to cancel pending execution', () => {
      const fn = vi.fn();
      const { fn: debouncedFn, cleanup } = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      // Cleanup before timeout
      cleanup();
      vi.advanceTimersByTime(100);

      // Function should not have been called because cleanup was called
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('throttle', () => {
    it('should call function immediately on first call', () => {
      const fn = vi.fn();
      const { fn: throttledFn } = throttle(fn, 100);

      throttledFn();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should limit function calls', () => {
      const fn = vi.fn();
      const { fn: throttledFn } = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should provide cleanup function to cancel trailing call', () => {
      const fn = vi.fn();
      const { fn: throttledFn, cleanup } = throttle(fn, 100);

      throttledFn(); // Immediate call
      expect(fn).toHaveBeenCalledTimes(1);

      throttledFn(); // Scheduled trailing call
      cleanup(); // Cancel trailing call

      vi.advanceTimersByTime(100);
      // Should still only be 1 call (the immediate one)
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});

// ==========================================================================
// Promise Utilities
// ==========================================================================

describe('Promise Utilities', () => {
  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      vi.useFakeTimers();

      const promise = sleep(100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('retry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      await expect(retry(fn, 3, 10)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('withTimeout', () => {
    it('should resolve before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should reject on timeout', async () => {
      vi.useFakeTimers();

      const promise = new Promise(() => {}); // Never resolves
      const timeoutPromise = withTimeout(promise, 100);

      vi.advanceTimersByTime(100);

      await expect(timeoutPromise).rejects.toThrow('Operation timed out');

      vi.useRealTimers();
    });
  });
});

// ==========================================================================
// Type Guards
// ==========================================================================

describe('Type Guards', () => {
  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for numbers', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-1.5)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray('array')).toBe(false);
      expect(isArray({ length: 0 })).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isObject([])).toBe(false);
    });
  });

  describe('isNullish', () => {
    it('should return true for null', () => {
      expect(isNullish(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isNullish(undefined)).toBe(true);
    });

    it('should return false for other values', () => {
      expect(isNullish(0)).toBe(false);
      expect(isNullish('')).toBe(false);
      expect(isNullish(false)).toBe(false);
    });
  });
});

// ==========================================================================
// Checksum
// ==========================================================================

describe('generateChecksum', () => {
  it('should generate consistent checksum for same data', () => {
    const data = { foo: 'bar' };
    const checksum1 = generateChecksum(data);
    const checksum2 = generateChecksum(data);
    expect(checksum1).toBe(checksum2);
  });

  it('should generate different checksums for different data', () => {
    const checksum1 = generateChecksum({ foo: 'bar' });
    const checksum2 = generateChecksum({ foo: 'baz' });
    expect(checksum1).not.toBe(checksum2);
  });

  it('should return string', () => {
    expect(typeof generateChecksum({})).toBe('string');
  });
});
