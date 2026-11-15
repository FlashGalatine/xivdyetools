import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyJwtData } from '../services/jwt-service.js';
import { signState, verifyState, type StateData } from '../utils/state-signing.js';

const SECRET = 'state-test-secret-at-least-32-bytes';
// Historical: the raw-HMAC issuance cutoff of the closed 3.1.x -> 3.2.0 window (no longer in code).
const CUTOFF = Date.parse('2026-10-28T00:00:00Z') / 1000;

function payload(overrides: Record<string, unknown> = {}): StateData {
  return {
    csrf: 'independent-csrf',
    code_challenge: 'public-challenge',
    redirect_uri: 'https://xivdyetools.app/auth/callback',
    return_path: '/palette',
    provider: 'discord',
    iat: CUTOFF,
    exp: CUTOFF + 600,
    ...overrides,
  } as StateData;
}

function encode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Deliberately independent of signState/signJwtData and their encoding helpers.
async function rawHmac(data: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return encode(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}

async function fixture(state: StateData, prefix = '', secret = SECRET): Promise<string> {
  const encoded = encode(JSON.stringify(state));
  return `${encoded}.${await rawHmac(prefix + encoded, secret)}`;
}

function at(seconds: number): void {
  vi.setSystemTime(seconds * 1000);
}

describe('OAuth state HMAC domain separation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    at(CUTOFF);
  });
  afterEach(() => vi.useRealTimers());

  it('signs the exact prefixed bytes while preserving the two-part wire and JSON shape', async () => {
    const state = payload();
    const signed = await signState(state, SECRET);
    const encoded = encode(JSON.stringify(state));
    expect(signed.split('.')).toHaveLength(2);
    expect(signed).toBe(`${encoded}.${await rawHmac('oauth-state-v1:' + encoded)}`);
  });

  it('does not produce a signature valid for raw JWT signing data', async () => {
    const [encoded, signature] = (await signState(payload(), SECRET)).split('.');
    expect(await verifyJwtData(encoded, signature, SECRET)).toBe(false);
  });

  it.each([CUTOFF - 1, CUTOFF, CUTOFF + 601])('accepts independent prefixed signatures at %i', async (now) => {
    at(now);
    const state = payload({ iat: now, exp: now + 600 });
    await expect(verifyState(await fixture(state, 'oauth-state-v1:'), SECRET)).resolves.toEqual(state);
  });

  it.each([CUTOFF - 600, CUTOFF - 1, CUTOFF, CUTOFF + 600, CUTOFF + 601])(
    'rejects a correctly keyed raw-HMAC (unprefixed) state at %i',
    async (now) => {
      at(now);
      const state = payload({ iat: now, exp: now + 600 });
      await expect(verifyState(await fixture(state), SECRET)).rejects.toThrow('Invalid state signature');
    }
  );

  it.each(['', 'oauth-state-v1:'])('rejects tampering and wrong keys for prefix %s', async (prefix) => {
    const signed = await fixture(payload(), prefix);
    const [, signature] = signed.split('.');
    await expect(verifyState(`${encode(JSON.stringify(payload({ csrf: 'forged' })))}.${signature}`, SECRET)).rejects.toThrow('Invalid state signature');
    await expect(verifyState(signed, SECRET + '-wrong')).rejects.toThrow('Invalid state signature');
  });

  it('verifies HMAC before decoding an untrusted payload', async () => {
    await expect(verifyState(`${encode('not json')}.${await rawHmac('different bytes')}`, SECRET)).rejects.toThrow('Invalid state signature');
  });

  it.each([
    ['missing expiry', { exp: undefined }, 'missing expiration'],
    ['expired', { exp: CUTOFF - 1 }, 'expired'],
  ])('preserves prefixed signed-state %s rejection', async (_name, overrides, message) => {
    await expect(verifyState(await fixture(payload(overrides), 'oauth-state-v1:'), SECRET)).rejects.toThrow(message);
  });

  it('preserves prefixed state acceptance at its exact expiry', async () => {
    const state = payload({ exp: CUTOFF });
    await expect(verifyState(await fixture(state, 'oauth-state-v1:'), SECRET)).resolves.toEqual(state);
  });

  it('keeps unsigned compatibility explicit and independent of signed-state verification', async () => {
    at(CUTOFF + 601);
    const state = payload({ exp: undefined });
    const unsigned = btoa(JSON.stringify(state));
    await expect(verifyState(unsigned, SECRET)).rejects.toThrow('signature required');
    await expect(verifyState(unsigned, SECRET, true)).resolves.toEqual(JSON.parse(JSON.stringify(state)));
    await expect(verifyState('not-base64!', SECRET, true)).rejects.toThrow('Invalid state format');
    await expect(verifyState('too.many.parts', SECRET, true)).rejects.toThrow('signature required');
    await expect(verifyState(btoa(JSON.stringify(payload())), SECRET, true)).rejects.toThrow('expired');
  });
});
