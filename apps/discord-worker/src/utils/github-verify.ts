/**
 * GitHub Webhook Signature Verification
 *
 * Verifies the HMAC-SHA256 signature sent by GitHub in the
 * `X-Hub-Signature-256` header to ensure the payload is authentic.
 *
 * Uses the Web Crypto API (native in Cloudflare Workers) for
 * HMAC computation and timing-safe comparison.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 * @module utils/github-verify
 */

/**
 * Verifies a GitHub webhook signature against the raw request body.
 *
 * @param secret - The webhook secret configured in GitHub
 * @param payload - The raw request body as a string
 * @param signature - The `X-Hub-Signature-256` header value (format: `sha256=<hex>`)
 * @returns true if the signature is valid
 */
export async function verifyGitHubSignature(
  secret: string,
  payload: string,
  signature: string
): Promise<boolean> {
  if (!signature.startsWith('sha256=')) {
    return false;
  }

  const expectedHex = signature.slice('sha256='.length);

  // Import the secret as an HMAC key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Compute the HMAC of the payload
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );

  // Convert to hex string
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison: always compare full length to prevent timing attacks
  if (computedHex.length !== expectedHex.length) {
    return false;
  }

  // Use subtle crypto timing-safe equal if available, otherwise constant-time compare
  const encoder = new TextEncoder();
  const a = encoder.encode(computedHex);
  const b = encoder.encode(expectedHex);

  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(a, b);
  }

  // Fallback: XOR-based constant-time comparison
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
