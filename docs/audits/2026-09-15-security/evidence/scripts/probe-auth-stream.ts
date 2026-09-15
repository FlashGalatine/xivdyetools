import assert from 'node:assert/strict';
import { verifyDiscordRequest } from '../../../../../packages/auth/src/discord.ts';

// Local synthetic stream only. It deliberately exceeds the cap by a small,
// bounded amount; no network calls or authentic credentials are involved.
let pulledBytes = 0;
let cancelled = false;
const chunkSize = 64 * 1024;
const totalChunks = 16;
const stream = new ReadableStream<Uint8Array>({
  pull(controller) {
    if (pulledBytes === chunkSize * totalChunks) {
      controller.close();
      return;
    }
    pulledBytes += chunkSize;
    controller.enqueue(new Uint8Array(chunkSize).fill(97));
  },
  cancel() { cancelled = true; },
});
const request = new Request('https://audit.invalid/', {
  method: 'POST', body: stream, duplex: 'half',
  headers: {
    'X-Signature-Ed25519': 'invalid-synthetic-signature',
    'X-Signature-Timestamp': String(Math.floor(Date.now() / 1000)),
  },
} as RequestInit);
const result = await verifyDiscordRequest(request, 'synthetic-public-key', { maxBodySize: 100_000 });
assert.equal(result.isValid, false);
assert.equal(result.error, 'Request body too large');
assert.equal(pulledBytes, chunkSize * totalChunks);
assert.equal(cancelled, false);
console.log(JSON.stringify({
  capBytes: 100_000, suppliedBytes: chunkSize * totalChunks,
  pulledBytes, cancelled, result,
  verdict: 'Entire 1 MiB stream consumed before enforcing 100 KB cap, before signature verification',
}, null, 2));
