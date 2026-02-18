/**
 * @xivdyetools/types - Utility Types Tests
 *
 * Comprehensive tests for utility type guards and patterns.
 */
import { describe, it, expect } from 'vitest';
import { isOk, isErr, type Result, type AsyncResult, type Nullable, type Optional } from './index.js';
import { AppError } from '../error/app-error.js';
import { ErrorCode } from '../error/codes.js';

describe('isOk', () => {
  describe('with successful results', () => {
    it('should return true for ok result with value', () => {
      const result: Result<string> = { ok: true, value: 'success' };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with number value', () => {
      const result: Result<number> = { ok: true, value: 42 };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with object value', () => {
      const result: Result<{ id: number }> = { ok: true, value: { id: 1 } };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with array value', () => {
      const result: Result<number[]> = { ok: true, value: [1, 2, 3] };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with null value', () => {
      const result: Result<null> = { ok: true, value: null };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with undefined value', () => {
      const result: Result<undefined> = { ok: true, value: undefined };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with empty string', () => {
      const result: Result<string> = { ok: true, value: '' };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with zero', () => {
      const result: Result<number> = { ok: true, value: 0 };
      expect(isOk(result)).toBe(true);
    });

    it('should return true for ok result with false', () => {
      const result: Result<boolean> = { ok: true, value: false };
      expect(isOk(result)).toBe(true);
    });
  });

  describe('with error results', () => {
    it('should return false for error result', () => {
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, 'test');
      const result: Result<string> = { ok: false, error };
      expect(isOk(result)).toBe(false);
    });

    it('should return false for error result with custom error type', () => {
      const result: Result<string, Error> = { ok: false, error: new Error('test') };
      expect(isOk(result)).toBe(false);
    });

    it('should return false for error result with string error', () => {
      const result: Result<string, string> = { ok: false, error: 'Something went wrong' };
      expect(isOk(result)).toBe(false);
    });
  });

  describe('type narrowing', () => {
    it('should narrow type to success in if block', () => {
      const result: Result<number> = { ok: true, value: 42 };

      if (isOk(result)) {
        // TypeScript should know result.value exists here
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });

    it('should allow access to value after type guard', () => {
      const result: Result<{ name: string }> = { ok: true, value: { name: 'test' } };

      if (isOk(result)) {
        expect(result.value.name).toBe('test');
      }
    });
  });
});

describe('isErr', () => {
  describe('with error results', () => {
    it('should return true for error result with AppError', () => {
      const error = new AppError(ErrorCode.DYE_NOT_FOUND, 'Dye not found');
      const result: Result<string> = { ok: false, error };
      expect(isErr(result)).toBe(true);
    });

    it('should return true for error result with Error', () => {
      const result: Result<string, Error> = { ok: false, error: new Error('test') };
      expect(isErr(result)).toBe(true);
    });

    it('should return true for error result with string error', () => {
      const result: Result<string, string> = { ok: false, error: 'error message' };
      expect(isErr(result)).toBe(true);
    });

    it('should return true for error result with object error', () => {
      const result: Result<string, { code: number }> = { ok: false, error: { code: 404 } };
      expect(isErr(result)).toBe(true);
    });
  });

  describe('with successful results', () => {
    it('should return false for ok result', () => {
      const result: Result<string> = { ok: true, value: 'success' };
      expect(isErr(result)).toBe(false);
    });

    it('should return false for ok result with any value type', () => {
      const result: Result<number> = { ok: true, value: 0 };
      expect(isErr(result)).toBe(false);
    });
  });

  describe('type narrowing', () => {
    it('should narrow type to error in if block', () => {
      const error = new AppError(ErrorCode.INVALID_INPUT, 'Bad input');
      const result: Result<number> = { ok: false, error };

      if (isErr(result)) {
        // TypeScript should know result.error exists here
        expect(result.error.code).toBe(ErrorCode.INVALID_INPUT);
        expect(result.error.message).toBe('Bad input');
      }
    });

    it('should allow access to error after type guard', () => {
      const result: Result<string, { message: string; code: number }> = {
        ok: false,
        error: { message: 'Not found', code: 404 },
      };

      if (isErr(result)) {
        expect(result.error.message).toBe('Not found');
        expect(result.error.code).toBe(404);
      }
    });
  });
});

describe('isOk and isErr are mutually exclusive', () => {
  it('should have exactly one return true for ok result', () => {
    const result: Result<number> = { ok: true, value: 42 };
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it('should have exactly one return true for error result', () => {
    const result: Result<number> = { ok: false, error: new AppError('CODE', 'msg') };
    expect(isOk(result)).toBe(false);
    expect(isErr(result)).toBe(true);
  });

  it('should work in exhaustive switch-like pattern', () => {
    const processResult = <T>(result: Result<T>): string => {
      if (isOk(result)) {
        return 'success';
      }
      if (isErr(result)) {
        return 'error';
      }
      // This line should never be reached
      return 'unknown';
    };

    expect(processResult({ ok: true, value: 'test' })).toBe('success');
    expect(processResult({ ok: false, error: new AppError('CODE', 'msg') })).toBe('error');
  });
});

describe('Result type usage patterns', () => {
  it('should work with generic functions', () => {
    function divide(a: number, b: number): Result<number, string> {
      if (b === 0) {
        return { ok: false, error: 'Division by zero' };
      }
      return { ok: true, value: a / b };
    }

    const success = divide(10, 2);
    expect(isOk(success)).toBe(true);
    if (isOk(success)) {
      expect(success.value).toBe(5);
    }

    const failure = divide(10, 0);
    expect(isErr(failure)).toBe(true);
    if (isErr(failure)) {
      expect(failure.error).toBe('Division by zero');
    }
  });

  it('should work with AppError as default error type', () => {
    function validateHex(hex: string): Result<string> {
      if (!hex.startsWith('#')) {
        return {
          ok: false,
          error: new AppError(ErrorCode.INVALID_HEX_COLOR, 'Hex must start with #'),
        };
      }
      return { ok: true, value: hex };
    }

    const valid = validateHex('#FF0000');
    expect(isOk(valid)).toBe(true);

    const invalid = validateHex('FF0000');
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error.code).toBe(ErrorCode.INVALID_HEX_COLOR);
    }
  });

  it('should work with chained operations', () => {
    function parseNumber(str: string): Result<number, string> {
      const num = Number(str);
      if (isNaN(num)) {
        return { ok: false, error: `Cannot parse "${str}" as number` };
      }
      return { ok: true, value: num };
    }

    function doubleIfValid(str: string): Result<number, string> {
      const parsed = parseNumber(str);
      if (isErr(parsed)) {
        return parsed;
      }
      return { ok: true, value: parsed.value * 2 };
    }

    const result1 = doubleIfValid('21');
    expect(isOk(result1)).toBe(true);
    if (isOk(result1)) {
      expect(result1.value).toBe(42);
    }

    const result2 = doubleIfValid('abc');
    expect(isErr(result2)).toBe(true);
  });
});

describe('AsyncResult type', () => {
  it('should work with async functions', async () => {
    async function fetchData(shouldFail: boolean): AsyncResult<string, string> {
      if (shouldFail) {
        return { ok: false, error: 'Network error' };
      }
      return { ok: true, value: 'data' };
    }

    const success = await fetchData(false);
    expect(isOk(success)).toBe(true);

    const failure = await fetchData(true);
    expect(isErr(failure)).toBe(true);
  });

  it('should handle async operations with AppError', async () => {
    async function loadDye(id: number): AsyncResult<{ id: number; name: string }> {
      if (id < 1 || id > 200) {
        return {
          ok: false,
          error: new AppError(ErrorCode.DYE_NOT_FOUND, `Dye ${id} not found`),
        };
      }
      return { ok: true, value: { id, name: 'Test Dye' } };
    }

    const valid = await loadDye(42);
    expect(isOk(valid)).toBe(true);
    if (isOk(valid)) {
      expect(valid.value.id).toBe(42);
    }

    const invalid = await loadDye(999);
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error.code).toBe(ErrorCode.DYE_NOT_FOUND);
    }
  });
});

describe('Nullable type', () => {
  it('should accept value or null', () => {
    const withValue: Nullable<string> = 'hello';
    const withNull: Nullable<string> = null;

    expect(withValue).toBe('hello');
    expect(withNull).toBeNull();
  });

  it('should work with objects', () => {
    interface User {
      name: string;
    }

    const user: Nullable<User> = { name: 'Test' };
    const noUser: Nullable<User> = null;

    expect(user?.name).toBe('Test');
    expect(noUser).toBeNull();
  });

  it('should not accept undefined', () => {
    // This is a compile-time check - undefined is not assignable to Nullable<T>
    // At runtime, we just verify the behavior
    const nullable: Nullable<number> = null;
    expect(nullable).not.toBe(undefined);
    expect(nullable).toBeNull();
  });
});

describe('Optional type', () => {
  it('should accept value or undefined', () => {
    const withValue: Optional<string> = 'hello';
    const withUndefined: Optional<string> = undefined;

    expect(withValue).toBe('hello');
    expect(withUndefined).toBeUndefined();
  });

  it('should work with objects', () => {
    interface Config {
      debug: boolean;
    }

    const config: Optional<Config> = { debug: true };
    const noConfig: Optional<Config> = undefined;

    expect(config?.debug).toBe(true);
    expect(noConfig).toBeUndefined();
  });

  it('should not accept null', () => {
    // This is a compile-time check - null is not assignable to Optional<T>
    // At runtime, we just verify the behavior
    const optional: Optional<number> = undefined;
    expect(optional).not.toBeNull();
    expect(optional).toBeUndefined();
  });
});

describe('Real-world usage scenarios', () => {
  it('should handle color parsing result', () => {
    interface RGB {
      r: number;
      g: number;
      b: number;
    }

    function parseHexColor(hex: string): Result<RGB> {
      const match = hex.match(/^#([A-Fa-f0-9]{6})$/);
      if (!match) {
        return {
          ok: false,
          error: new AppError(ErrorCode.INVALID_HEX_COLOR, `Invalid hex: ${hex}`),
        };
      }

      const r = parseInt(match[1].substring(0, 2), 16);
      const g = parseInt(match[1].substring(2, 4), 16);
      const b = parseInt(match[1].substring(4, 6), 16);

      return { ok: true, value: { r, g, b } };
    }

    const red = parseHexColor('#FF0000');
    expect(isOk(red)).toBe(true);
    if (isOk(red)) {
      expect(red.value).toEqual({ r: 255, g: 0, b: 0 });
    }

    const invalid = parseHexColor('not-a-color');
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error.code).toBe(ErrorCode.INVALID_HEX_COLOR);
    }
  });

  it('should handle dye lookup result', () => {
    interface Dye {
      id: number;
      name: string;
      hex: string;
    }

    const dyeDatabase: Dye[] = [
      { id: 1, name: 'Snow White', hex: '#FFFFFF' },
      { id: 2, name: 'Soot Black', hex: '#000000' },
    ];

    function findDye(id: number): Result<Dye> {
      const dye = dyeDatabase.find((d) => d.id === id);
      if (!dye) {
        return {
          ok: false,
          error: new AppError(ErrorCode.DYE_NOT_FOUND, `Dye ${id} not found`),
        };
      }
      return { ok: true, value: dye };
    }

    const found = findDye(1);
    expect(isOk(found)).toBe(true);
    if (isOk(found)) {
      expect(found.value.name).toBe('Snow White');
    }

    const notFound = findDye(999);
    expect(isErr(notFound)).toBe(true);
  });
});
