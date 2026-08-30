/**
 * The image-worker's input-rejection contract, in one place.
 *
 * `services/image-client.ts` rethrows image-worker's error message verbatim
 * (`apps/image-worker/src/validators.ts`, `index.ts`, `photon.ts`), and two
 * consumers substring-match it: the extractor picks the localized message the
 * user sees, and `command-trace.ts` classifies the failure as `image_input`
 * (the user's image, not our renderer or an upstream). Both read THIS table
 * so a reworded or new rejection is added once. The message itself is never
 * recorded anywhere.
 *
 * Deliberately not matched: `Image processing failed` (image-worker's 500
 * envelope and image-client's status fallback), `Invalid JSON body` /
 * `Invalid maxDimension` (our own request was malformed) — those are ours.
 */

/** Why the image could not be used, coarse enough to pick a user message. */
export type ImageInputReason = 'url' | 'too_large' | 'format' | 'timeout' | 'fetch';

/** Case-sensitive substrings of image-worker's messages, by reason. */
export const IMAGE_INPUT_MARKERS: ReadonlyArray<readonly [ImageInputReason, string]> = [
  // validateImageUrl / redirect guard (validators.ts)
  ['url', 'No image URL'],
  ['url', 'Invalid URL format'],
  ['url', 'Only HTTPS'],
  ['url', 'Discord CDN'],
  ['url', 'Private network'],
  ['url', 'Redirect without'],
  ['url', 'Unsafe redirect'],
  // validateFileSize / validateDimensions
  ['too_large', 'too large'],
  ['too_large', 'too many pixels'],
  // validateImageFormat / assertImageDimensionsFromHeader / photon decode
  ['format', 'Unsupported image format'],
  ['format', 'invalid dimensions'],
  ['format', 'Failed to load image'],
  // fetchImageWithTimeout
  ['timeout', 'timed out'],
  ['fetch', 'Failed to fetch image'],
];

/** The reason an image-worker error names, or null when the message is not an input rejection. */
export function imageInputReason(error: unknown): ImageInputReason | null {
  if (!(error instanceof Error)) return null;
  const hit = IMAGE_INPUT_MARKERS.find(([, marker]) => error.message.includes(marker));
  return hit ? hit[0] : null;
}

/** True when the thrown value is image-worker rejecting the user's image. */
export function isImageInputError(error: unknown): boolean {
  return imageInputReason(error) !== null;
}
