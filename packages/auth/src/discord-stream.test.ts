import { beforeAll, describe, expect, it } from 'vitest';
import { verifyDiscordRequest } from './discord.js';
import { bytesToHex } from './encoding/hex.js';

describe('Discord request stream limits', () => {
  let keys: CryptoKeyPair;
  let publicKey: string;

  beforeAll(async () => {
    const generated = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
    if (!('privateKey' in generated)) throw new Error('Expected an Ed25519 key pair');
    keys = generated;
    const exported = await crypto.subtle.exportKey('raw', keys.publicKey);
    if (!(exported instanceof ArrayBuffer)) throw new Error('Expected a raw public key');
    publicKey = bytesToHex(new Uint8Array(exported));
  });

  async function signedRequest(chunks: Uint8Array[], contentLength?: string) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const prefix = new TextEncoder().encode(timestamp);
    const signed = new Uint8Array(prefix.length + chunks.reduce((n, chunk) => n + chunk.length, 0));
    signed.set(prefix);
    let offset = prefix.length;
    for (const chunk of chunks) {
      signed.set(chunk, offset);
      offset += chunk.length;
    }
    const signature = bytesToHex(
      new Uint8Array(await crypto.subtle.sign('Ed25519', keys.privateKey, signed)),
    );
    const state = { reads: 0, cancelled: false };
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (state.reads < chunks.length) controller.enqueue(chunks[state.reads++]);
          else controller.close();
        },
        cancel() {
          state.cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const headers: Record<string, string> = {
      'X-Signature-Ed25519': signature,
      'X-Signature-Timestamp': timestamp,
    };
    if (contentLength !== undefined) headers['Content-Length'] = contentLength;
    const init: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers,
      body: stream,
      duplex: 'half',
    };
    return { request: new Request('https://example.com/interactions', init), state, stream };
  }

  it.each([undefined, '1'])(
    'cancels on the first chunk beyond the byte cap (Content-Length %s)',
    async (length) => {
      const { request, state, stream } = await signedRequest(
        [new Uint8Array(8), new Uint8Array(3), new Uint8Array(100)],
        length,
      );
      const result = await verifyDiscordRequest(request, publicKey, { maxBodySize: 10 });
      expect(result).toEqual({ isValid: false, body: '', error: 'Request body too large' });
      expect(state).toEqual({ reads: 2, cancelled: true });
      expect(stream.locked).toBe(false);
    },
  );

  it('verifies an exact-cap signature with a UTF-8 character split between chunks', async () => {
    const body = '{"text":"染😀"}';
    const bytes = new TextEncoder().encode(body);
    const { request } = await signedRequest([
      bytes.slice(0, 10),
      bytes.slice(10, 14),
      bytes.slice(14),
    ]);
    const result = await verifyDiscordRequest(request, publicKey, { maxBodySize: bytes.length });
    expect(result.isValid).toBe(true);
    expect(result.body).toBe(body);
  });

  it('rejects multibyte content on byte count before reading the remaining stream', async () => {
    const { request, state } = await signedRequest([
      new TextEncoder().encode('染'),
      new TextEncoder().encode('料'),
      new Uint8Array(20),
    ]);
    const result = await verifyDiscordRequest(request, publicKey, { maxBodySize: 5 });
    expect(result.error).toBe('Request body too large');
    expect(state).toEqual({ reads: 2, cancelled: true });
  });

  it('verifies the received bytes rather than re-encoding malformed UTF-8', async () => {
    const { request } = await signedRequest([new Uint8Array([0xff])]);
    const result = await verifyDiscordRequest(request, publicKey);
    expect(result.isValid).toBe(true);
    expect(result.body).toBe('\uFFFD');
  });

  it('rejects a signature for different bytes', async () => {
    const { request } = await signedRequest([new TextEncoder().encode('{"type":1}')]);
    const tampered = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: '{"type":2}',
    });
    expect((await verifyDiscordRequest(tampered, publicKey)).isValid).toBe(false);
  });

  it('rejects even a bodyless request when its configured cap is negative', async () => {
    const request = new Request('https://example.com/interactions', {
      method: 'POST',
      headers: {
        'X-Signature-Ed25519': 'invalid',
        'X-Signature-Timestamp': String(Math.floor(Date.now() / 1000)),
      },
    });
    expect(await verifyDiscordRequest(request, publicKey, { maxBodySize: -1 })).toEqual({
      isValid: false,
      body: '',
      error: 'Request body too large',
    });
  });
});
