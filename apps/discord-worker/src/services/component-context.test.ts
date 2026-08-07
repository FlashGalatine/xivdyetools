/**
 * Tests for Component Context Service (KV-backed, 5.0)
 */

import { describe, it, expect, vi } from 'vitest';
import { createMockKV } from '@xivdyetools/test-utils';
import {
  buildCustomId,
  parseCustomId,
  storeContext,
  getContext,
  updateContext,
  verifyContextUser,
  CONTEXT_TTL,
} from './component-context.js';
import type { ComponentContext } from './component-context.js';

// Mock logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const baseContext = {
  command: 'mixer',
  userId: 'user123',
  data: { dyeA: 5729, dyeB: 5734 },
};

function kvns() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createMockKV() as any;
}

describe('buildCustomId', () => {
  it('builds {action}_{command}_{hash} format', () => {
    expect(buildCustomId('algo', 'mixer', 'a1b2c3d4')).toBe('algo_mixer_a1b2c3d4');
  });

  it('appends an optional value', () => {
    expect(buildCustomId('algo', 'mixer', 'a1b2c3d4', 'oklab')).toBe('algo_mixer_a1b2c3d4_oklab');
  });

  it('throws when exceeding the 100-char Discord limit', () => {
    expect(() => buildCustomId('algo', 'mixer', 'h', 'x'.repeat(120))).toThrow(/100/);
  });
});

describe('parseCustomId', () => {
  it('round-trips a built custom id', () => {
    const parsed = parseCustomId('page_preset_deadbeef_2');
    expect(parsed).toEqual({ action: 'page', command: 'preset', hash: 'deadbeef', value: '2' });
  });

  it('rejects unknown actions and malformed ids', () => {
    expect(parseCustomId('bogus_mixer_hash')).toBeNull();
    expect(parseCustomId('tooshort')).toBeNull();
  });
});

describe('storeContext / getContext (KV)', () => {
  it('stores and retrieves a context by hash', async () => {
    const kv = kvns();
    const hash = await storeContext(kv, baseContext, CONTEXT_TTL.STANDARD, mockLogger);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);

    const result = await getContext(kv, hash, mockLogger);
    expect(result?.command).toBe('mixer');
    expect(result?.userId).toBe('user123');
    expect(result?.data).toEqual(baseContext.data);
    expect(result?.expiresAt).toBeGreaterThan(Date.now());
  });

  it('returns null for a missing hash', async () => {
    expect(await getContext(kvns(), 'nonexistent', mockLogger)).toBeNull();
  });

  it('returns null for a context past its expiresAt stamp', async () => {
    const kv = kvns();
    const expired: ComponentContext = {
      ...baseContext,
      expiresAt: Date.now() - 1000,
    };
    await kv.put('ctx:v2:deadbeef', JSON.stringify(expired));
    expect(await getContext(kv, 'deadbeef', mockLogger)).toBeNull();
  });

  it('does not store interaction tokens (fresh ones arrive per interaction)', async () => {
    const kv = kvns();
    const hash = await storeContext(kv, baseContext, CONTEXT_TTL.STANDARD, mockLogger);
    const result = await getContext(kv, hash, mockLogger);
    expect(result).not.toHaveProperty('interactionToken');
    expect(result).not.toHaveProperty('applicationId');
  });
});

describe('updateContext', () => {
  it('merges data and extends TTL', async () => {
    const kv = kvns();
    const hash = await storeContext(kv, baseContext, CONTEXT_TTL.STANDARD, mockLogger);
    const updated = await updateContext(
      kv,
      hash,
      { data: { ratio: 60 } },
      CONTEXT_TTL.STANDARD,
      mockLogger
    );
    expect(updated?.data).toEqual({ dyeA: 5729, dyeB: 5734, ratio: 60 });

    const readBack = await getContext(kv, hash, mockLogger);
    expect(readBack?.data['ratio']).toBe(60);
  });

  it('returns null for an unknown hash', async () => {
    expect(await updateContext(kvns(), 'missing', { data: {} })).toBeNull();
  });
});

describe('verifyContextUser', () => {
  it('gates on the stored userId (hash collisions are possible)', () => {
    const context: ComponentContext = { ...baseContext, expiresAt: Date.now() + 1000 };
    expect(verifyContextUser(context, 'user123')).toBe(true);
    expect(verifyContextUser(context, 'someone-else')).toBe(false);
  });
});
