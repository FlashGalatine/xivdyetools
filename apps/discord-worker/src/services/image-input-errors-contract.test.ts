/**
 * The marker table vs. what image-worker can actually throw.
 *
 * image-stoat-07 (deep dive 2026-09-02): `'Image file is empty'` had no marker,
 * so an empty 200 from the Discord CDN was classified as an internal failure —
 * `imageInputReason` returned null, `command-trace` recorded the outcome as
 * `unknown` rather than `image_input`, and the user saw the generic
 * `matchImage.processingFailed` instead of a message about their file.
 *
 * The existing suite tests the table against the messages it *lists*, which
 * cannot catch a message image-worker throws that the table has never heard of.
 * This reads image-worker's own source instead — the same shape as
 * `moderation-worker/tests/moderation-stats-contract.test.ts`, which reads
 * presets-api's SQL rather than trusting a mock built from what the client
 * expects.
 *
 * A message this test cannot see is one built at runtime from a value it cannot
 * predict; those are listed in `RUNTIME_COMPOSED` with the literal prefix that
 * *is* checkable, so the file still fails when a prefix is reworded.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { imageInputReason, IMAGE_INPUT_MARKERS } from './image-input-errors.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGE_WORKER_SRC = join(HERE, '..', '..', '..', 'image-worker', 'src');

function read(file: string): string {
  return readFileSync(join(IMAGE_WORKER_SRC, file), 'utf8');
}

/**
 * Messages image-worker composes at runtime — the literal prefix is what the
 * marker table can match, so that is what is asserted.
 */
const RUNTIME_COMPOSED: readonly string[] = [
  'Failed to load image: boom',
  'Unsafe redirect target: Only Discord CDN URLs are allowed for security',
  'Failed to fetch image: HTTP 502',
  'Image too large. Maximum size is 10MB',
  'Image too large (15.0MB). Maximum size is 10MB',
  'Image too large (5000x5000). Maximum dimension is 4096px',
  'Image has too many pixels (24.0MP). Maximum is 4MP',
];

/**
 * Ours, not the user's: a malformed request WE sent, or an image-worker
 * internal failure. `image-input-errors.ts` documents these as deliberately
 * unmatched, and misclassifying one as the user's fault would hide a client bug
 * behind a "check your image" message.
 */
const OUR_FAULT: readonly string[] = [
  'Invalid maxDimension: expected an integer between 16 and 4096',
  'Invalid JSON body',
  'Image processing failed',
];

/**
 * `POST /thumbnail`'s own rejections. That route takes raw bytes from
 * presets-api's preview-image upload; discord-worker never calls it, so its
 * messages can never reach this table. Listed rather than skipped so that
 * adding a /thumbnail message is a decision someone makes here.
 */
const OTHER_ROUTE: readonly string[] = ['No image data provided'];

const DELIBERATELY_UNMATCHED: readonly string[] = [...OUR_FAULT, ...OTHER_ROUTE];

/** Every single-quoted string literal passed to `throw new Error(...)` or returned as `error:`. */
function literalMessages(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/(?:throw new Error\(|error: |return )'([^']{8,})'/g)) {
    out.push(match[1]);
  }
  return out;
}

describe('image-input-errors: the table vs. image-worker’s actual messages', () => {
  const sources = ['validators.ts', 'photon.ts', 'index.ts'].map(read);

  it('reads image-worker’s source (the test is worthless if the path is wrong)', () => {
    expect(sources[0]).toContain('export function validateFileSize');
    expect(sources[0]).toContain('Image file is empty');
  });

  it('classifies every literal message image-worker can throw', () => {
    const unmatched: string[] = [];
    for (const source of sources) {
      for (const message of literalMessages(source)) {
        if (DELIBERATELY_UNMATCHED.some((m) => message.includes(m))) continue;
        if (imageInputReason(new Error(message)) === null) unmatched.push(message);
      }
    }
    expect(unmatched, 'messages with no marker in IMAGE_INPUT_MARKERS').toEqual([]);
  });

  it('classifies every runtime-composed message too', () => {
    for (const message of RUNTIME_COMPOSED) {
      expect(imageInputReason(new Error(message)), message).not.toBeNull();
    }
  });

  it('still refuses to classify our own malformed requests as the user’s image', () => {
    for (const message of DELIBERATELY_UNMATCHED) {
      expect(imageInputReason(new Error(message)), message).toBeNull();
    }
  });

  it('an empty file reads as a format problem, not a size one (image-stoat-07)', () => {
    expect(imageInputReason(new Error('Image file is empty'))).toBe('format');
  });

  it('every marker is a substring of a message image-worker can produce', () => {
    // The other direction: a marker matching nothing is dead weight that makes
    // the table look more complete than it is.
    const haystack = sources.join('\n') + '\n' + RUNTIME_COMPOSED.join('\n');
    for (const [, marker] of IMAGE_INPUT_MARKERS) {
      expect(haystack, `marker "${marker}" matches nothing image-worker says`).toContain(marker);
    }
  });
});
