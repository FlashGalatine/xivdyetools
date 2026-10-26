/**
 * The `.chara` attachment guards `/swatch` and `/glamour` share.
 *
 * FINDING-033 (2026-08-21 security audit): the download is hardened the way
 * image-worker hardens `/extractor image` — Discord-CDN host allowlist,
 * 10 s timeout, no redirect following, and a streamed byte cap that does not
 * trust the Discord-reported `size`. Since the 2026-10-15 import review the
 * file must also be named `*.chara` (FINDING-003) and the cap is core's
 * 8 KiB `MAX_CHARA_FILE_BYTES`, down from 1 MiB.
 *
 * @module utils/chara-attachment
 */

import { MAX_CHARA_FILE_BYTES } from '@xivdyetools/core';
import type { Translator } from '@xivdyetools/bot-logic/i18n';
import { readBytesCapped } from './read-text-capped.js';
import type { DiscordInteraction } from '../types/env.js';

/** The cap as the refusal states it ("larger than 8 KB"). */
const MAX_FILE_KB = MAX_CHARA_FILE_BYTES / 1024;

/**
 * A refusal in the reader's language (HC-002, 2026-10-04 i18n audit): the
 * frame and its reason are both bot-logic keys. The reasons used to be English
 * text inside the translated frame, in every locale.
 */
function refusal(
  t: Translator,
  reasonKey: string,
  vars?: Record<string, string | number>
): { ok: false; message: string } {
  return { ok: false, message: t.t('card.swatchParseError', { message: t.t(reasonKey, vars) }) };
}

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
 * attachment called `*.chara`, it is under the cap, and it lives on Discord's
 * CDN. A failure carries the localized reply for an ephemeral response.
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
  // FINDING-003 (2026-10-15 import review): a `.pose` used to be downloaded
  // and parsed before it failed. The name decides, case-insensitive:
  // `content_type` is optional and Discord's guess, and the CDN URL is not
  // ours to interpret. A renamed pose still fails in the parser.
  if (!attachment.filename.toLowerCase().endsWith('.chara')) {
    return refusal(t, 'card.charaFileReason.notChara');
  }
  if (attachment.size > MAX_CHARA_FILE_BYTES) {
    return refusal(t, 'card.charaFileReason.tooLarge', { kb: MAX_FILE_KB });
  }
  // FINDING-033: only Discord's own CDN hosts are ever fetched
  if (!isAllowedAttachmentUrl(attachment.url)) {
    return refusal(t, 'card.charaFileReason.notOnDiscord');
  }
  return { ok: true, url: attachment.url };
}

/** A downloaded attachment: its decoded text, and with `withBytes` the bytes as received. */
type DownloadedChara<B extends boolean> = B extends true
  ? { ok: true; text: string; bytes: Uint8Array }
  : { ok: true; text: string };

/**
 * Download the attachment's text: bounded wait, no redirect following,
 * bounded read. With `withBytes` the capped bytes come back too, undecoded,
 * so the `.chara` reader sees invalid UTF-8 instead of the U+FFFD the
 * non-fatal decode puts in its place. `manual`, NOT `error`: workerd implements only follow/manual
 * and throws on `error` (which broke every /swatch download until
 * 2026-08-29). A redirect surfaces as a 3xx response, refused by the `!ok`
 * check. A refused download carries the localized reply; a network failure
 * or timeout throws, for the caller to report as its own error.
 */
export async function downloadCharaAttachment<B extends boolean = false>(
  url: string,
  t: Translator,
  withBytes?: B
): Promise<DownloadedChara<B> | { ok: false; message: string }> {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    // An expired / forbidden attachment URL or a redirect: the file could not be read.
    return refusal(t, 'card.charaFileReason.downloadFailed', { status: response.status });
  }
  // The reported size can be absent or wrong: count the bytes that arrive
  const bytes = await readBytesCapped(response, MAX_CHARA_FILE_BYTES);
  if (bytes === null) {
    return refusal(t, 'card.charaFileReason.tooLarge', { kb: MAX_FILE_KB });
  }
  const text = new TextDecoder().decode(bytes);
  return (withBytes ? { ok: true, text, bytes } : { ok: true, text }) as DownloadedChara<B>;
}
