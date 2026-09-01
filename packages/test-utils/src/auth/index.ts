/**
 * Authentication helpers for testing
 *
 * Provides JWT creation and header builders.
 *
 * The v1 bot-signature helpers (`createBotSignature`, `createTimestampedSignature`,
 * `verifyBotSignature`) that used to live in `signature.ts` were removed 2026-08-31
 * (FINDING-015, 2026-08-29 security audit, Sprint 11 fix round) — they existed only
 * to support v1-signature test cases that were deleted in the same pass once
 * presets-api stopped accepting v1 entirely. See this package's CHANGELOG.md.
 */

export * from './jwt.js';
export * from './headers.js';
