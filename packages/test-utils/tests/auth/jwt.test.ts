/**
 * Tests for JWT creation helpers
 */
import { describe, it, expect } from 'vitest';
import {
  createTestJWT,
  createExpiredJWT,
  createJWTWithExpiration,
} from '../../src/auth/jwt.js';

describe('createTestJWT', () => {
  it('creates a valid JWT structure', async () => {
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
    });

    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
  });

  it('includes correct header', async () => {
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
    });

    const [headerB64] = jwt.split('.');
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(header.alg).toBe('HS256');
    expect(header.typ).toBe('JWT');
  });

  it('includes payload with custom claims', async () => {
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
      global_name: 'Test User',
      avatar: 'abc123',
    });

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.sub).toBe('user-123');
    expect(payload.username).toBe('TestUser');
    expect(payload.global_name).toBe('Test User');
    expect(payload.avatar).toBe('abc123');
  });

  it('includes standard claims', async () => {
    const beforeTime = Math.floor(Date.now() / 1000);
    
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
    });

    const afterTime = Math.floor(Date.now() / 1000);

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.iss).toBe('xivdyetools-oauth-worker');
    expect(payload.iat).toBeGreaterThanOrEqual(beforeTime);
    expect(payload.iat).toBeLessThanOrEqual(afterTime);
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('uses default expiry of 1 hour', async () => {
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
    });

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.exp - payload.iat).toBe(3600);
  });

  it('uses custom expiry when provided', async () => {
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
    }, 7200);

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.exp - payload.iat).toBe(7200);
  });

  it('uses custom issuer when provided', async () => {
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
    }, 3600, 'custom-issuer');

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.iss).toBe('custom-issuer');
  });

  it('handles null optional fields', async () => {
    const jwt = await createTestJWT('secret', {
      sub: 'user-123',
      username: 'TestUser',
      global_name: null,
      avatar: null,
    });

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.global_name).toBeNull();
    expect(payload.avatar).toBeNull();
  });
});

describe('createExpiredJWT', () => {
  it('creates an expired token', async () => {
    const jwt = await createExpiredJWT('secret');

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    const now = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeLessThan(now);
  });

  it('uses default payload when not provided', async () => {
    const jwt = await createExpiredJWT('secret');

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.sub).toBe('123');
    expect(payload.username).toBe('test');
  });

  it('uses custom payload when provided', async () => {
    const jwt = await createExpiredJWT('secret', {
      sub: 'custom-user',
      username: 'CustomUser',
    });

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    expect(payload.sub).toBe('custom-user');
    expect(payload.username).toBe('CustomUser');
  });
});

describe('createJWTWithExpiration', () => {
  it('creates token with specific expiration timestamp', async () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // 1 day from now

    const jwt = await createJWTWithExpiration('secret', {
      sub: 'user-123',
      username: 'TestUser',
    }, futureTimestamp);

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    // Due to timing, exp might be slightly different
    expect(Math.abs(payload.exp - futureTimestamp)).toBeLessThan(2);
  });

  it('can create already expired token', async () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

    const jwt = await createJWTWithExpiration('secret', {
      sub: 'user-123',
      username: 'TestUser',
    }, pastTimestamp);

    const [, payloadB64] = jwt.split('.');
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    const now = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeLessThan(now);
  });
});
