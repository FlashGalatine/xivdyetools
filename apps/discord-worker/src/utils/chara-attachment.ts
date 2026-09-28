/**
 * The `.chara` attachment guards `/swatch` and `/glamour` share.
 *
 * FINDING-033 (2026-08-21 security audit): the download is hardened the way
 * image-worker hardens `/extractor image` — Discord-CDN host allowlist,
 * 10 s timeout, no redirect following, and a streamed byte cap that does not
 * trust the Discord-reported `size`.
 *
 * @module utils/chara-attachment
 */

import type { Translator } from '@xivdyetools/bot-logic/i18n';
import { readTextCapped } from './read-text-capped.js';
import type { DiscordInteraction } from '../types/env.js';

/** .chara files are small JSON — anything past 1 MiB is not one. */
const MAX_FILE_BYTES = 1_048_576;

/** Attachment download timeout (ms) — the Discord REST helpers use 5–10 s too. */
const DOWNLOAD_TIMEOUT_MS = 10_000;

/**
 * The only hosts an attachment may be downloaded from (FINDING-033). Same
 * allowlist image-worker enforces for `/extractor image`.
 */
const ALLOWED_ATTACHMENT_HOSTS: ReadonlySet<string> = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
]);

/**
 * HTTPS + Discord CDN host only. The URL comes from the signed interaction
 * payload today; this keeps a future non-Discord URL from ever being fetched.
 */
function isAllowedAttachmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_ATTACHMENT_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * The checks that run before the command defers: the `file:` option names an
 * attachment, it is under the cap, and it lives on Discord's CDN. A failure
 * carries the localized reply for an ephemeral response.
 */
export function checkCharaAttachment(
  interaction: DiscordInteraction,
  t: Translator
): { ok: true; url: string } | { ok: false; message: string } {
  const options = interaction.data?.options || [];
  const fileId = options.find((opt) => opt.name === 'file')?.value as string | undefined;
  const attachment = fileId ? interaction.data?.resolved?.attachments?.[fileId] : undefined;
  if (!attachment) {
    return { ok: false, message: t.t('errors.missingInput') };
  }
  if (attachment.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: t.t('card.swatchParseError', { message: `file too large (${attachment.size} bytes)` }),
    };
  }
  // FINDING-033: only Discord's own CDN hosts are ever fetched
  if (!isAllowedAttachmentUrl(attachment.url)) {
    return {
      ok: false,
      message: t.t('card.swatchParseError', { message: 'attachment must be uploaded to Discord' }),
    };
  }
  return { ok: true, url: attachment.url };
}

/**
 * Download the attachment's text: bounded wait, no redirect following,
 * bounded read. `manual`, NOT `error`: workerd implements only follow/manual
 * and throws on `error` (which broke every /swatch download until
 * 2026-08-29). A redirect surfaces as a 3xx response, refused by the `!ok`
 * check. A refused download carries the localized reply; a network failure
 * or timeout throws, for the caller to report as its own error.
 */
export async function downloadCharaAttachment(
  url: string,
  t: Translator
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    // An expired / forbidden attachment URL or a redirect: the file could not be read.
    return {
      ok: false,
      message: t.t('card.swatchParseError', { message: `download failed (${response.status})` }),
    };
  }
  const text = await readTextCapped(response, MAX_FILE_BYTES);
  if (text === null) {
    return {
      ok: false,
      message: t.t('card.swatchParseError', { message: `file too large (over ${MAX_FILE_BYTES} bytes)` }),
    };
  }
  return { ok: true, text };
}
