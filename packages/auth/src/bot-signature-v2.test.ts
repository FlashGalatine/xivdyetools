/**
 * Bot request signature v2 (FINDING-014, 2026-08-21 security audit).
 *
 * v1 signed only `timestamp:userId:userName` — no method, path or body, an
 * ambiguous `:` delimiter and a 5-minute window. v2 binds the whole request
 * (method, path, SHA-256 of the body, timestamp, optional nonce, identity)
 * with an unambiguous encoding and a 60 s default window.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBotSignatureV2, verifyBotSignatureV2, BOT_SIGNATURE_V2_MAX_AGE_MS } from './hmac.js';

const secret = 'bot-signing-secret-that-is-at-least-32-bytes-long!!';

describe('bot signature v2', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const base = () => ({
    method: 'post',
    path: '/api/v1/presets',
    body: '{"name":"x"}',
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: 'n-1',
    userDiscordId: '123456789012345678',
    userName: 'Tester',
  });

  it('round-trips a signed request', async () => {
    const req = base();
    const sig = await createBotSignatureV2(req, secret);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    await expect(verifyBotSignatureV2(sig, req, secret)).resolves.toBe(true);
  });

  it('binds method, path and body', async () => {
    const req = base();
    const sig = await createBotSignatureV2(req, secret);
    await expect(verifyBotSignatureV2(sig, { ...req, method: 'DELETE' }, secret)).resolves.toBe(false);
    await expect(verifyBotSignatureV2(sig, { ...req, path: '/api/v1/presets/other' }, secret)).resolves.toBe(false);
    await expect(verifyBotSignatureV2(sig, { ...req, body: '{"name":"y"}' }, secret)).resolves.toBe(false);
  });

  it('treats the method case-insensitively and the body as bytes', async () => {
    const req = base();
    const sig = await createBotSignatureV2(req, secret);
    await expect(verifyBotSignatureV2(sig, { ...req, method: 'POST' }, secret)).resolves.toBe(true);
    const bytesReq = { ...req, body: new TextEncoder().encode(req.body) };
    await expect(verifyBotSignatureV2(sig, bytesReq, secret)).resolves.toBe(true);
  });

  it('is not ambiguous under the v1 delimiter collision (123,"a:b") vs ("123:a","b")', async () => {
    const a = await createBotSignatureV2({ ...base(), userDiscordId: '123', userName: 'a:b' }, secret);
    const b = await createBotSignatureV2({ ...base(), userDiscordId: '123:a', userName: 'b' }, secret);
    expect(a).not.toBe(b);
  });

  it('rejects a signature older than the default 60 s window and far-future timestamps', async () => {
    const req = base();
    const sig = await createBotSignatureV2(req, secret);
    vi.advanceTimersByTime(BOT_SIGNATURE_V2_MAX_AGE_MS + 2000);
    await expect(verifyBotSignatureV2(sig, req, secret)).resolves.toBe(false);

    const future = { ...base(), timestamp: String(Math.floor(Date.now() / 1000) + 600) };
    const futureSig = await createBotSignatureV2(future, secret);
    await expect(verifyBotSignatureV2(futureSig, future, secret)).resolves.toBe(false);
  });

  it('rejects missing signature, missing timestamp and non-numeric timestamps', async () => {
    const req = base();
    await expect(verifyBotSignatureV2(undefined, req, secret)).resolves.toBe(false);
    await expect(verifyBotSignatureV2('00', { ...req, timestamp: undefined }, secret)).resolves.toBe(false);
    await expect(verifyBotSignatureV2('00', { ...req, timestamp: 'abc' }, secret)).resolves.toBe(false);
  });

  it('signs an empty body and absent identity deterministically', async () => {
    const req = { method: 'GET', path: '/api/v1/presets/mine', timestamp: String(Math.floor(Date.now() / 1000)) };
    const sig = await createBotSignatureV2(req, secret);
    await expect(verifyBotSignatureV2(sig, req, secret)).resolves.toBe(true);
    await expect(verifyBotSignatureV2(sig, { ...req, body: '' }, secret)).resolves.toBe(true);
  });
});
