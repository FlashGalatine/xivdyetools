/**
 * HMAC signature helpers for testing bot authentication
 *
 * Provides functions to create HMAC-SHA256 signatures for testing
 * bot-to-API authentication flows.
 *
 * @example
 * ```typescript
 * // Create a bot signature
 * const timestamp = Math.floor(Date.now() / 1000).toString();
 * const signature = await createBotSignature(
 *   timestamp,
 *   'user-discord-id',
 *   'username',
 *   'signing-secret'
 * );
 *
 * // Use in request headers
 * const headers = {
 *   'X-Request-Signature': signature,
 *   'X-Request-Timestamp': timestamp,
 *   'X-User-Discord-ID': 'user-discord-id',
 *   'X-User-Discord-Name': 'username',
 * };
 * ```
 */

import { bytesToHex } from '../utils/crypto.js';

/** Default signing secret for tests */
export const TEST_SIGNING_SECRET = 'test-signing-secret';

/**
 * Creates an HMAC-SHA256 signature for bot authentication
 *
 * The signature is created from: `${timestamp}:${userDiscordId}:${userName}`
 *
 * @param timestamp - Unix timestamp string
 * @param userDiscordId - Discord user ID
 * @param userName - Discord username
 * @param secret - Signing secret (defaults to TEST_SIGNING_SECRET)
 * @returns Hex-encoded HMAC-SHA256 signature
 */
export async function createBotSignature(
  timestamp: string,
  userDiscordId: string,
  userName: string,
  secret: string = TEST_SIGNING_SECRET
): Promise<string> {
  const message = `${timestamp}:${userDiscordId}:${userName}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Creates a signature with the current timestamp
 *
 * @param userDiscordId - Discord user ID
 * @param userName - Discord username
 * @param secret - Signing secret (defaults to TEST_SIGNING_SECRET)
 * @returns Object with signature and timestamp
 */
export async function createTimestampedSignature(
  userDiscordId: string,
  userName: string,
  secret: string = TEST_SIGNING_SECRET
): Promise<{ signature: string; timestamp: string }> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await createBotSignature(timestamp, userDiscordId, userName, secret);
  return { signature, timestamp };
}

/**
 * Verifies an HMAC-SHA256 signature
 *
 * @param signature - The signature to verify (hex string)
 * @param timestamp - Unix timestamp string
 * @param userDiscordId - Discord user ID
 * @param userName - Discord username
 * @param secret - Signing secret
 * @returns True if signature is valid
 */
export async function verifyBotSignature(
  signature: string,
  timestamp: string,
  userDiscordId: string,
  userName: string,
  secret: string = TEST_SIGNING_SECRET
): Promise<boolean> {
  const expected = await createBotSignature(timestamp, userDiscordId, userName, secret);
  return signature === expected;
}
