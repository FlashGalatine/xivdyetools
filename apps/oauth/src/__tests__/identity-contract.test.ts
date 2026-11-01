import { expect, it } from 'vitest';
import {
  continuityHash,
  validateContinuityRequest,
  validateReceipt,
  continuityBinding,
} from '../services/identity-contract.js';
const U = '10000000-0000-4000-8000-000000000001';
const N = '10000000-0000-4000-8000-000000000002';
const D = '123456789012345678';
const base = {
  v: 1 as const,
  operationId: U,
  kind: 'detach' as const,
  sourceIds: [U, D],
  destinationIds: [N],
  createdAt: 100,
  expiresAt: 200,
};
async function signed(overrides = {}) {
  const request = { ...base, ...overrides };
  return { ...request, payloadHash: await continuityHash(request) };
}
it('hashes canonical key order and sorted duplicate-free identities', async () => {
  expect(await continuityHash({ ...base, sourceIds: [D, U] })).toBe(await continuityHash(base));
  expect((await validateContinuityRequest(await signed(), 150)).sourceIds).toEqual([U, D].sort());
});
it.each([
  { sourceIds: [U] },
  { sourceIds: [U, N] },
  { destinationIds: [U] },
  { kind: 'attach', destinationIds: [N] },
  { kind: 'detach', destinationIds: [D] },
])('rejects the wrong primitive edge %#', async (override) => {
  await expect(validateContinuityRequest(await signed(override), 150)).rejects.toMatchObject({
    code: 'malformed',
  });
});
it('accepts an immutable refused receipt and rejects a malformed refusal', async () => {
  const request = await signed();
  const receipt = {
    v: 1,
    operationId: U,
    payloadHash: request.payloadHash,
    status: 'refused',
    reason: 'review_required',
  };
  expect(validateReceipt(receipt, request)).toEqual(receipt);
  expect(() => validateReceipt({ ...receipt, reason: 'whatever' }, request)).toThrow();
});
it.each([
  { extra: true },
  { v: 2 },
  { operationId: D },
  { kind: 'other' },
  { createdAt: 101.5 },
  { createdAt: -1 },
  { createdAt: 201 },
  { expiresAt: 100 },
  { expiresAt: 1001 },
  { payloadHash: 'A'.repeat(64) },
  { sourceIds: [U, D, N] },
  { sourceIds: [] },
  { destinationIds: [] },
  { sourceIds: [U, 'bad'] },
])('rejects malformed continuity request %#', async (override) => {
  const candidate = { ...(await signed()), ...override };
  await expect(validateContinuityRequest(candidate, 150)).rejects.toMatchObject({
    code: 'malformed',
  });
});
it('rejects a different hash and expired apply while retaining same-hash expired recovery', async () => {
  const request = await signed();
  await expect(
    validateContinuityRequest({ ...request, payloadHash: '0'.repeat(64) }, 150),
  ).rejects.toMatchObject({ code: 'conflict' });
  await expect(validateContinuityRequest(request, 200)).rejects.toMatchObject({ code: 'expired' });
  expect(await validateContinuityRequest(request, 200, true)).toEqual({
    ...request,
    sourceIds: [U, D].sort(),
  });
  expect(
    await validateContinuityRequest(await signed({ kind: 'attach', destinationIds: [D, U] }), 150),
  ).toMatchObject({ kind: 'attach', destinationIds: [U, D].sort() });
});
it.each([
  null,
  [],
  {},
  { status: 'applied', matchedBanCount: -1 },
  { status: 'applied', matchedBanCount: 17 },
  { status: 'applied', matchedBanCount: 1.5 },
  { status: 'applied', matchedBanCount: 0, reason: 'overflow' },
  { status: 'missing', matchedBanCount: 0 },
  { status: 'refused', reason: 'review_required', matchedBanCount: 0 },
  { status: 'other' },
])('rejects malformed boundary response %#', async (override) => {
  const request = await signed();
  const response =
    override && !Array.isArray(override)
      ? { v: 1, operationId: U, payloadHash: request.payloadHash, ...override }
      : override;
  expect(() => validateReceipt(response, request)).toThrow();
});
it('distinguishes authoritative missing and error statuses from applied zero bans', async () => {
  const request = await signed();
  const base = { v: 1, operationId: U, payloadHash: request.payloadHash };
  expect(validateReceipt({ ...base, status: 'missing' }, request)).toBe('missing');
  expect(
    validateReceipt({ ...base, status: 'applied', matchedBanCount: 0 }, request),
  ).toMatchObject({ status: 'applied', matchedBanCount: 0 });
  for (const status of ['malformed', 'conflict', 'expired', 'overflow', 'unavailable']) {
    expect(() => validateReceipt({ ...base, status }, request)).toThrow(
      expect.objectContaining({ code: status }),
    );
  }
  expect(() =>
    validateReceipt(
      { ...base, status: 'applied', matchedBanCount: 0, payloadHash: '0'.repeat(64) },
      request,
    ),
  ).toThrow();
  expect(() =>
    validateReceipt({ ...base, status: 'applied', matchedBanCount: 0, operationId: N }, request),
  ).toThrow();
  expect(continuityBinding({ apply() {}, getOperation() {}, acknowledge() {} })).toBe(true);
  expect(continuityBinding({ apply() {} })).toBe(false);
  expect(continuityBinding(null)).toBe(false);
});
