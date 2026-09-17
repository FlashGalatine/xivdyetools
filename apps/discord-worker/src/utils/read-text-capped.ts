/**
 * BUG-013: shared body-size cap for anything read as text — lifted out of
 * `handlers/commands/swatch.ts` (FINDING-033) so `/webhooks/preset-submission`
 * can use the same guard instead of trusting a client-supplied
 * `Content-Length` and then buffering `c.req.json()` unbounded.
 *
 * @module utils/read-text-capped
 */

/**
 * The structural surface this needs from either a `Request` or a `Response`
 * — both expose `headers`, a streamable `body`, and `text()`.
 */
export interface CappedTextSource {
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

/**
 * Read a body as text, refusing anything over `maxBytes`.
 *
 * Checks the declared Content-Length first (no read at all when it is over
 * the cap), then counts bytes as they stream so a body that lies about its
 * size — or has no length at all — is cut off at the cap instead of being
 * buffered whole.
 *
 * @returns the text, or null when the body exceeds the cap
 */
export async function readTextCapped(
  source: CappedTextSource,
  maxBytes: number,
): Promise<string | null> {
  const declared = Number(source.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  if (!source.body) {
    // Bodiless sources (test doubles, HEAD-like answers): text() then measure
    const text = await source.text();
    return new TextEncoder().encode(text).byteLength > maxBytes ? null : text;
  }

  const reader = source.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // Decoded text, unlike `/webhooks/github`'s own capped reader in
  // `index.ts`: that route keeps the raw bytes because its HMAC must verify
  // the undecoded payload — don't unify the two.
  return new TextDecoder().decode(merged);
}
