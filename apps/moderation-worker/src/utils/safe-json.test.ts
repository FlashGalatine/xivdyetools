import { describe, it, expect } from 'vitest';
import { safeParseJSON } from './safe-json.js';

/**
 * Tests for safeParseJSON — validates prototype pollution detection using
 * Object.hasOwn (only triggers on OWN properties, not inherited ones).
 */
describe('safe-json', () => {
  describe('safeParseJSON', () => {
    describe('invalid JSON syntax', () => {
      it('should reject invalid JSON', () => {
        const result = safeParseJSON('{invalid}');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid JSON syntax');
      });

      it('should reject trailing commas', () => {
        const result = safeParseJSON('{"a": 1,}');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid JSON syntax');
      });

      it('should reject single quotes', () => {
        const result = safeParseJSON("{'name': 'test'}");

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid JSON syntax');
      });

      it('should reject unquoted keys', () => {
        const result = safeParseJSON('{name: "test"}');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid JSON syntax');
      });

      it('should reject empty string', () => {
        const result = safeParseJSON('');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid JSON syntax');
      });
    });

    describe('prototype pollution detection on objects', () => {
      it('should allow simple objects without pollution keys', () => {
        const result = safeParseJSON('{"name": "test"}');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ name: 'test' });
      });

      it('should allow nested objects without pollution keys', () => {
        const result = safeParseJSON('{"user": {"name": "Alice"}}');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ user: { name: 'Alice' } });
      });

      it('should allow empty object', () => {
        const result = safeParseJSON('{}');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({});
      });

      it('should allow array', () => {
        const result = safeParseJSON('[1, 2, 3]');

        expect(result.success).toBe(true);
        expect(result.data).toEqual([1, 2, 3]);
      });

      it('should allow empty array', () => {
        const result = safeParseJSON('[]');

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should detect explicit __proto__ key', () => {
        const result = safeParseJSON('{"__proto__": {"isAdmin": true}}');

        expect(result.success).toBe(false);
        expect(result.error).toContain('prototype pollution');
        expect(result.error).toContain('__proto__');
      });

      it('should detect explicit constructor key', () => {
        const result = safeParseJSON('{"constructor": {"prototype": {}}}');

        expect(result.success).toBe(false);
        expect(result.error).toContain('prototype pollution');
        expect(result.error).toContain('constructor');
      });

      it('should detect explicit prototype key', () => {
        const result = safeParseJSON('{"prototype": {}}');

        expect(result.success).toBe(false);
        expect(result.error).toContain('prototype pollution');
        expect(result.error).toContain('prototype');
      });

      it('should detect nested prototype pollution', () => {
        const result = safeParseJSON('{"user": {"__proto__": {"isAdmin": true}}}');

        expect(result.success).toBe(false);
        expect(result.error).toContain('prototype pollution');
      });
    });

    describe('primitives (only values that can be parsed successfully)', () => {
      it('should parse string primitives', () => {
        const result = safeParseJSON<string>('"hello"');

        expect(result.success).toBe(true);
        expect(result.data).toBe('hello');
      });

      it('should parse empty string', () => {
        const result = safeParseJSON<string>('""');

        expect(result.success).toBe(true);
        expect(result.data).toBe('');
      });

      it('should parse string with special characters', () => {
        const result = safeParseJSON<string>('"hello\\nworld"');

        expect(result.success).toBe(true);
        expect(result.data).toBe('hello\nworld');
      });

      it('should parse string with unicode', () => {
        const result = safeParseJSON<string>('"日本語"');

        expect(result.success).toBe(true);
        expect(result.data).toBe('日本語');
      });

      it('should parse positive number', () => {
        const result = safeParseJSON<number>('42');

        expect(result.success).toBe(true);
        expect(result.data).toBe(42);
      });

      it('should parse negative number', () => {
        const result = safeParseJSON<number>('-42');

        expect(result.success).toBe(true);
        expect(result.data).toBe(-42);
      });

      it('should parse decimal number', () => {
        const result = safeParseJSON<number>('3.14159');

        expect(result.success).toBe(true);
        expect(result.data).toBeCloseTo(3.14159);
      });

      it('should parse zero', () => {
        const result = safeParseJSON<number>('0');

        expect(result.success).toBe(true);
        expect(result.data).toBe(0);
      });

      it('should parse boolean true', () => {
        const result = safeParseJSON<boolean>('true');

        expect(result.success).toBe(true);
        expect(result.data).toBe(true);
      });

      it('should parse boolean false', () => {
        const result = safeParseJSON<boolean>('false');

        expect(result.success).toBe(true);
        expect(result.data).toBe(false);
      });

      it('should parse null', () => {
        const result = safeParseJSON<null>('null');

        expect(result.success).toBe(true);
        expect(result.data).toBe(null);
      });
    });

    describe('options with primitives', () => {
      it('should not freeze primitive values', () => {
        // Primitives cannot be frozen, but should not throw
        const result = safeParseJSON<string>('"hello"', { freezeResult: true });

        expect(result.success).toBe(true);
        expect(result.data).toBe('hello');
      });

      it('should work with validateStructure false for primitives', () => {
        const result = safeParseJSON<number>('42', { validateStructure: false });

        expect(result.success).toBe(true);
        expect(result.data).toBe(42);
      });

      it('should work with custom maxDepth for primitives', () => {
        const result = safeParseJSON<string>('"test"', { maxDepth: 1 });

        expect(result.success).toBe(true);
        expect(result.data).toBe('test');
      });
    });

    describe('structure validation', () => {
      it('should reject arrays exceeding max length', () => {
        const arr = new Array(1001).fill(1);
        const json = JSON.stringify(arr);

        const result = safeParseJSON(json);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Array exceeds maximum length');
      });

      it('should reject deeply nested arrays', () => {
        let json = '';
        for (let i = 0; i < 25; i++) {
          json += '[';
        }
        json += '1';
        for (let i = 0; i < 25; i++) {
          json += ']';
        }

        const result = safeParseJSON(json, { maxDepth: 20 });

        expect(result.success).toBe(false);
        expect(result.error).toContain('nesting exceeds maximum depth');
      });
    });
  });
});
