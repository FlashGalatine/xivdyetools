/**
 * Discord interaction timestamp freshness (FINDING-021, 2026-08-21 audit).
 *
 * Ed25519 covers `timestamp + body`, but without a freshness check a captured
 * interaction could be replayed indefinitely. Reject timestamps older than
 * 5 minutes (Discord retries within seconds) or more than a minute in the future.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyDiscordRequest, DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS } from './discord.js';

vi.mock('discord-interactions', () => ({ verifyKey: vi.fn(async () => true) }));

function signedRequest(timestampSeconds: number): Request {
  return new Request('https://example.com/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-Ed25519': 'valid-signature',
      'X-Signature-Timestamp': String(timestampSeconds),
    },
    body: JSON.stringify({ type: 1 }),
  });
}

describe('verifyDiscordRequest timestamp freshness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a fresh timestamp', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await verifyDiscordRequest(signedRequest(now - 5), 'key');
    expect(result.isValid).toBe(true);
  });

  it('rejects a timestamp older than the default window', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await verifyDiscordRequest(
      signedRequest(now - DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS - 1),
      'key',
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/timestamp/i);
  });

  it('rejects a timestamp far in the future', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await verifyDiscordRequest(signedRequest(now + 600), 'key');
    expect(result.isValid).toBe(false);
  });

  it('honours a caller-supplied window', async () => {
    const now = Math.floor(Date.now() / 1000);
    const result = await verifyDiscordRequest(signedRequest(now - 120), 'key', {
      maxTimestampAgeSeconds: 60,
    });
    expect(result.isValid).toBe(false);
  });

  it('rejects a non-numeric timestamp', async () => {
    const req = new Request('https://example.com/interactions', {
      method: 'POST',
      headers: { 'X-Signature-Ed25519': 'sig', 'X-Signature-Timestamp': 'yesterday' },
      body: '{}',
    });
    const result = await verifyDiscordRequest(req, 'key');
    expect(result.isValid).toBe(false);
  });
});
