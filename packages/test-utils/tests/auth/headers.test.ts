/**
 * Tests for auth header builders
 */
import { describe, it, expect } from 'vitest';
import {
  authHeaders,
  authHeadersWithSignature,
  jsonHeaders,
  mergeHeaders,
  authenticatedJsonHeaders,
} from '../../src/auth/headers.js';
import { TEST_SIGNING_SECRET, verifyBotSignature } from '../../src/auth/signature.js';

describe('authHeaders', () => {
  it('creates headers with bearer token', () => {
    const headers = authHeaders('my-jwt-token');

    expect(headers.Authorization).toBe('Bearer my-jwt-token');
  });

  it('includes user ID when provided', () => {
    const headers = authHeaders('token', '123456789');

    expect(headers.Authorization).toBe('Bearer token');
    expect(headers['X-User-Discord-ID']).toBe('123456789');
  });

  it('includes user name when provided', () => {
    const headers = authHeaders('token', '123456789', 'TestUser');

    expect(headers.Authorization).toBe('Bearer token');
    expect(headers['X-User-Discord-ID']).toBe('123456789');
    expect(headers['X-User-Discord-Name']).toBe('TestUser');
  });

  it('omits optional headers when not provided', () => {
    const headers = authHeaders('token');

    expect(headers['X-User-Discord-ID']).toBeUndefined();
    expect(headers['X-User-Discord-Name']).toBeUndefined();
  });
});

describe('authHeadersWithSignature', () => {
  it('creates headers with bearer token and signature', async () => {
    const headers = await authHeadersWithSignature('bot-token', '123456789', 'TestUser');

    expect(headers.Authorization).toBe('Bearer bot-token');
    expect(headers['X-Request-Signature']).toBeDefined();
    expect(headers['X-Request-Timestamp']).toBeDefined();
    expect(headers['X-User-Discord-ID']).toBe('123456789');
    expect(headers['X-User-Discord-Name']).toBe('TestUser');
  });

  it('generates valid signature', async () => {
    const headers = await authHeadersWithSignature('bot-token', '123456789', 'TestUser');

    const isValid = await verifyBotSignature(
      headers['X-Request-Signature'],
      headers['X-Request-Timestamp'],
      '123456789',
      'TestUser',
      TEST_SIGNING_SECRET
    );

    expect(isValid).toBe(true);
  });

  it('uses custom signing secret', async () => {
    const customSecret = 'my-custom-secret';
    const headers = await authHeadersWithSignature(
      'bot-token',
      '123456789',
      'TestUser',
      customSecret
    );

    const isValid = await verifyBotSignature(
      headers['X-Request-Signature'],
      headers['X-Request-Timestamp'],
      '123456789',
      'TestUser',
      customSecret
    );

    expect(isValid).toBe(true);
  });

  it('handles empty user ID and name', async () => {
    const headers = await authHeadersWithSignature('bot-token');

    expect(headers.Authorization).toBe('Bearer bot-token');
    expect(headers['X-Request-Signature']).toBeDefined();
    expect(headers['X-Request-Timestamp']).toBeDefined();
    expect(headers['X-User-Discord-ID']).toBeUndefined();
    expect(headers['X-User-Discord-Name']).toBeUndefined();
  });

  it('generates timestamp as Unix seconds', async () => {
    const before = Math.floor(Date.now() / 1000);
    const headers = await authHeadersWithSignature('bot-token');
    const after = Math.floor(Date.now() / 1000);

    const timestamp = parseInt(headers['X-Request-Timestamp'], 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

describe('jsonHeaders', () => {
  it('returns Content-Type header', () => {
    const headers = jsonHeaders();

    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('mergeHeaders', () => {
  it('merges multiple header objects', () => {
    const headers1 = { Authorization: 'Bearer token' };
    const headers2 = { 'Content-Type': 'application/json' };
    const headers3 = { 'X-Custom': 'value' };

    const merged = mergeHeaders(headers1, headers2, headers3);

    expect(merged.Authorization).toBe('Bearer token');
    expect(merged['Content-Type']).toBe('application/json');
    expect(merged['X-Custom']).toBe('value');
  });

  it('later headers override earlier ones', () => {
    const headers1 = { 'Content-Type': 'text/plain' };
    const headers2 = { 'Content-Type': 'application/json' };

    const merged = mergeHeaders(headers1, headers2);

    expect(merged['Content-Type']).toBe('application/json');
  });

  it('handles empty input', () => {
    const merged = mergeHeaders();

    expect(merged).toEqual({});
  });
});

describe('authenticatedJsonHeaders', () => {
  it('combines auth and json headers', () => {
    const headers = authenticatedJsonHeaders('my-token', '123456789', 'TestUser');

    expect(headers.Authorization).toBe('Bearer my-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-User-Discord-ID']).toBe('123456789');
    expect(headers['X-User-Discord-Name']).toBe('TestUser');
  });

  it('works with only token', () => {
    const headers = authenticatedJsonHeaders('my-token');

    expect(headers.Authorization).toBe('Bearer my-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-User-Discord-ID']).toBeUndefined();
  });
});
