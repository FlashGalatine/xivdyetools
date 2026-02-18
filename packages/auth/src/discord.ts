/**
 * Discord Request Verification
 *
 * Wraps the `discord-interactions` library's Ed25519 signature verification
 * with additional security checks (body size limits, header validation).
 *
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 * @module discord
 */

import { verifyKey } from 'discord-interactions';

/**
 * Result of Discord request verification
 */
export interface DiscordVerificationResult {
  /** Whether the signature is valid */
  isValid: boolean;
  /** The raw request body (needed for parsing after verification) */
  body: string;
  /** Error message if verification failed */
  error?: string;
}

/**
 * Options for Discord verification
 */
export interface DiscordVerifyOptions {
  /** Maximum request body size in bytes (default: 100KB) */
  maxBodySize?: number;
}

/** Default maximum body size (100KB) */
const DEFAULT_MAX_BODY_SIZE = 100_000;

/**
 * Verify that a request came from Discord using Ed25519 signature verification.
 *
 * Security features:
 * - Content-Length header check (before reading body)
 * - Actual body size validation (Content-Length can be spoofed)
 * - Required header validation (X-Signature-Ed25519, X-Signature-Timestamp)
 *
 * @param request - The incoming HTTP request
 * @param publicKey - Your Discord application's public key
 * @param options - Verification options
 * @returns Verification result with the request body
 *
 * @example
 * ```typescript
 * const result = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
 * if (!result.isValid) {
 *   return new Response(result.error, { status: 401 });
 * }
 * const interaction = JSON.parse(result.body);
 * ```
 */
export async function verifyDiscordRequest(
  request: Request,
  publicKey: string,
  options: DiscordVerifyOptions = {}
): Promise<DiscordVerificationResult> {
  const maxBodySize = options.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

  // Check Content-Length header first (if present) to reject obviously large requests
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength, 10) > maxBodySize) {
    return {
      isValid: false,
      body: '',
      error: 'Request body too large',
    };
  }

  // Get required headers
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');

  if (!signature || !timestamp) {
    return {
      isValid: false,
      body: '',
      error: 'Missing signature headers',
    };
  }

  // Get the raw body
  const body = await request.text();

  // Verify actual body size (Content-Length can be spoofed)
  if (body.length > maxBodySize) {
    return {
      isValid: false,
      body: '',
      error: 'Request body too large',
    };
  }

  // Verify the signature using discord-interactions library
  try {
    const isValid = await verifyKey(body, signature, timestamp, publicKey);

    return {
      isValid,
      body,
      error: isValid ? undefined : 'Invalid signature',
    };
  } catch (error) {
    return {
      isValid: false,
      body,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Creates a 401 Unauthorized response for failed verification.
 *
 * @param message - Error message (default: 'Invalid request signature')
 * @returns Response object
 */
export function unauthorizedResponse(
  message = 'Invalid request signature'
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a 400 Bad Request response.
 *
 * @param message - Error message
 * @returns Response object
 */
export function badRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
