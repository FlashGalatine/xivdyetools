/**
 * Tests for auth header builders
 */
import { describe, it, expect } from 'vitest';
import { authHeaders } from '../../src/auth/headers.js';

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
