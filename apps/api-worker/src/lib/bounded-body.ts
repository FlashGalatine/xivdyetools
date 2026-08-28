/**
 * Byte-budgeted body readers (FINDING-025 / API-2, API-12).
 *
 * `Content-Length` is advisory — a chunked or HTTP/2 body carries none, and
 * `Request.text()` / `Response.arrayBuffer()` buffer the whole thing before
 * any size check can run (up to the platform's ~100 MB into a 128 MB
 * isolate). These helpers count bytes as they stream and cancel the reader
 * the moment the budget is exceeded, so the cap costs at most one chunk over.
 */

export class BodyTooLargeError extends Error {
  constructor(
    public readonly maxBytes: number,
    public readonly readBytes: number,
  ) {
    super(`Body exceeds ${maxBytes} bytes`);
    this.name = 'BodyTooLargeError';
  }
}

/**
 * Read a stream to completion, throwing `BodyTooLargeError` (and cancelling
 * the reader) as soon as more than `maxBytes` have arrived. A `null` body
 * reads as empty.
 */
export async function readBoundedBytes(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError(maxBytes, total);
    }
    chunks.push(value);
  }
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** `readBoundedBytes` decoded as UTF-8 — the budget is bytes, not UTF-16 units. */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  return new TextDecoder().decode(await readBoundedBytes(body, maxBytes));
}
