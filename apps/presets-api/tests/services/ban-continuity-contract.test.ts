import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  continuityHash,
  validateContinuityRequest,
  validateOperationKey,
} from '../../src/services/ban-continuity-contract.js';
const U = '10000000-0000-4000-8000-000000000001',
  N = '10000000-0000-4000-8000-000000000002',
  D = '123456789012345678';
const base = {
  v: 1 as const,
  operationId: '20000000-0000-4000-8000-000000000001',
  kind: 'detach' as const,
  sourceIds: [U, D],
  destinationIds: [N],
  createdAt: 100,
  expiresAt: 1000,
};
describe('canonical private protocol', () => {
  it('hashes exact provider key order, ASCII sorted deduplicated IDs and no hash field', async () => {
    const canonical = {
      v: 1,
      operationId: base.operationId,
      kind: 'detach',
      sourceIds: [U, D].sort(),
      destinationIds: [N],
      createdAt: 100,
      expiresAt: 1000,
    };
    const expected = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
    expect(await continuityHash(base)).toBe(expected);
    expect(await continuityHash({ ...base, sourceIds: [D, U] })).toBe(expected);
    expect(await validateContinuityRequest({ ...base, payloadHash: expected })).toMatchObject(
      canonical,
    );
  });
  it.each([
    { extra: 'private' },
    { v: 2 },
    { operationId: 'A0000000-0000-4000-8000-000000000001' },
    { kind: 'merge' },
    { sourceIds: [U] },
    { sourceIds: [U, U] },
    { sourceIds: [U, D, D] },
    { sourceIds: [U, '18446744073709551616'] },
    { sourceIds: [U, '012345678901234567'] },
    { destinationIds: [U] },
    { destinationIds: [D] },
    { destinationIds: [N, U] },
    { createdAt: -1 },
    { createdAt: 1.5 },
    { expiresAt: 100 },
    { expiresAt: 1001 },
    { payloadHash: 'A'.repeat(64) },
    { payloadHash: 'a'.repeat(63) },
  ])('rejects malformed shapes before SQL %j', async (patch) => {
    await expect(
      validateContinuityRequest({ ...base, payloadHash: await continuityHash(base), ...patch }),
    ).rejects.toMatchObject({ code: 'malformed' });
  });
  it('refuses an altered payload hash and ATTACH coverage-changing shapes', async () => {
    await expect(
      validateContinuityRequest({ ...base, payloadHash: 'a'.repeat(64) }),
    ).rejects.toMatchObject({ code: 'conflict' });
    const attach = { ...base, kind: 'attach' as const, destinationIds: [D, U] };
    expect(
      await validateContinuityRequest({ ...attach, payloadHash: await continuityHash(attach) }),
    ).toMatchObject({ kind: 'attach', destinationIds: [U, D].sort() });
    await expect(
      validateContinuityRequest({
        ...attach,
        destinationIds: [N],
        payloadHash: await continuityHash(attach),
      }),
    ).rejects.toMatchObject({ code: 'malformed' });
  });
  it('validates recovery/ack keys and rejects unknown fields and wrong outcomes', () => {
    const key = { operationId: U, payloadHash: 'a'.repeat(64) };
    expect(validateOperationKey(key)).toEqual(key);
    expect(validateOperationKey({ ...key, outcome: 'complete' }, true)).toMatchObject({
      outcome: 'complete',
    });
    for (const value of [null, [], {}, { ...key, extra: true }, { ...key, outcome: 'complete' }])
      expect(() => validateOperationKey(value)).toThrow();
    for (const outcome of [undefined, null, 'applied', 'refused'])
      expect(() => validateOperationKey({ ...key, outcome }, true)).toThrow();
  });
});
