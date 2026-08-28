/**
 * Example-link validation, shared by the preset submission and edit forms.
 *
 * 8A stores a link to a glamour page, never a copy of the image, and the
 * presets-api enforces an allowlist of hosts. This is the client mirror of
 * that list — it lives here so the two forms cannot drift into disagreeing
 * about what a valid link is, which is exactly how the edit form ended up
 * with a different dye range than submit.
 *
 * @module shared/example-link
 */

import { LanguageService } from '@services/language-service';

/** Client mirror of the presets-api example-link host allowlist. */
const EXAMPLE_LINK_HOSTS = [
  'eorzeacollection.com',
  'mirapri.com',
  'reddit.com',
  'redd.it',
  'x.com',
  'twitter.com',
  'bsky.app',
  'instagram.com',
  'pixiv.net',
  'finalfantasyxiv.com',
  'misskey.io',
];

/** Is `trimmed` (non-empty) an https URL on an allowlisted host? */
function isAllowedExampleLink(trimmed: string): boolean {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const allowed = EXAMPLE_LINK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return url.protocol === 'https:' && allowed;
}

/** Validate an example link locally; returns an error string or null. */
export function exampleLinkError(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  return isAllowedExampleLink(trimmed) ? null : LanguageService.t('preset.fieldLinkHint');
}

/**
 * Read-path counterpart of `exampleLinkError`: the link as stored by the API
 * (or a localStorage snapshot) is bound to `href` in trusted cards, so it
 * passes the same https + host-allowlist policy on the way in, and anything
 * else renders as "no link" (2026-08-21 security audit, WEB-14). Trims.
 */
export function sanitizeExampleLink(link: string | null | undefined): string | null {
  const trimmed = link?.trim() ?? '';
  if (!trimmed) return null;
  // The form validator tolerates a missing scheme; the read path does not —
  // a stored value without one would have failed server-side validation.
  if (!/^https:\/\//i.test(trimmed)) return null;
  return isAllowedExampleLink(trimmed) ? trimmed : null;
}

/**
 * Read-path guard for the author-uploaded preview image URL: only an absolute
 * https URL reaches an `<img src>` (the CSP's img-src decides the host). Any
 * other scheme, a relative path or an unparsable value renders as "no image".
 */
export function sanitizePreviewImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
