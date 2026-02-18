/**
 * Timing-Safe Comparison Utilities
 *
 * Provides constant-time comparison to prevent timing attacks.
 * Regular string comparison (===) can leak information about secrets
 * because it short-circuits on the first non-matching character.
 *
 * @module timing
 */

/**
 * Performs a constant-time string comparison to prevent timing attacks.
 *
 * Uses `crypto.subtle.timingSafeEqual()` when available (Cloudflare Workers),
 * with a fallback XOR-based implementation for other environments.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await timingSafeEqual(providedToken, expectedToken);
 * ```
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  // If lengths differ, we still need to do constant-time comparison
  // to avoid leaking length information. Use the longer length.
  const maxLength = Math.max(aBytes.length, bBytes.length);

  // Pad shorter array to match length (prevents length-based timing leak)
  const aPadded = new Uint8Array(maxLength);
  const bPadded = new Uint8Array(maxLength);
  aPadded.set(aBytes);
  bPadded.set(bBytes);

  // Use crypto.subtle.timingSafeEqual if available (Cloudflare Workers)
  try {
    const result = await crypto.subtle.timingSafeEqual(aPadded, bPadded);
    // Also check original lengths matched
    return result && aBytes.length === bBytes.length;
  } catch {
    // Fallback: manual constant-time comparison (for environments without timingSafeEqual)
    let diff = aBytes.length ^ bBytes.length;
    for (let i = 0; i < maxLength; i++) {
      diff |= aPadded[i] ^ bPadded[i];
    }
    return diff === 0;
  }
}

/**
 * Performs constant-time comparison on Uint8Arrays.
 *
 * @param a - First array to compare
 * @param b - Second array to compare
 * @returns true if arrays are equal, false otherwise
 */
export async function timingSafeEqualBytes(
  a: Uint8Array,
  b: Uint8Array
): Promise<boolean> {
  const maxLength = Math.max(a.length, b.length);

  const aPadded = new Uint8Array(maxLength);
  const bPadded = new Uint8Array(maxLength);
  aPadded.set(a);
  bPadded.set(b);

  try {
    const result = await crypto.subtle.timingSafeEqual(aPadded, bPadded);
    return result && a.length === b.length;
  } catch {
    let diff = a.length ^ b.length;
    for (let i = 0; i < maxLength; i++) {
      diff |= aPadded[i] ^ bPadded[i];
    }
    return diff === 0;
  }
}
