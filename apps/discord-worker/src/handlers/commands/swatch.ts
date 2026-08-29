/**
 * /swatch Command Handler (Adapter) — 5.0 character-file frame.
 *
 * The 4.x index/grid subcommands are replaced by a required `file:`
 * attachment (.chara). This worker DOES receive the file — it downloads the
 * attachment (size-capped), passes its text to bot-logic's executeSwatch
 * (core parse rules: key presence not TypeName, gamma on the floats, flag
 * gating, never Base64Image), and posts the rendered card. A file that fails
 * to parse is embed text with the field and value named, never a frame.
 *
 * FINDING-033 (2026-08-21 security audit): the download is hardened the way
 * image-worker hardens `/extractor image` — Discord-CDN host allowlist,
 * 10 s timeout, no redirect following, and a streamed byte cap that does not
 * trust the Discord-reported `size`. FINDING-019: the parser echoes `.chara`
 * field VALUES into its message, and that message lands in a PUBLIC embed,
 * so it goes through the shared embed sanitiser first.
 *
 * @module handlers/commands/swatch
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed, ephemeralResponse } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode, type LocaleCode } from '../../services/i18n.js';
import {
  executeSwatch,
  sanitizeEmbedText,
  type SwatchInput,
  type SwatchSlotOption,
} from '@xivdyetools/bot-logic';
import { getUserPreferences } from '../../services/preferences.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

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

/** Cap on the sanitised parse-error text that goes into the public embed. */
const MAX_ERROR_TEXT = 1024;

const SLOT_VALUES: readonly SwatchSlotOption[] = [
  'skin',
  'hair',
  'highlights',
  'eyes',
  'lip',
  'facepaint',
  'limbal',
];

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
 * Read a response body as text, refusing anything over `maxBytes`.
 *
 * Checks the declared Content-Length first (no read at all when it is over
 * the cap), then counts bytes as they stream so a body that lies about its
 * size — or has no length at all — is cut off at the cap instead of being
 * buffered whole.
 *
 * @returns the text, or null when the body exceeds the cap
 */
async function readTextCapped(response: Response, maxBytes: number): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  if (!response.body) {
    // Bodiless responses (test doubles, HEAD-like answers): text() then measure
    const text = await response.text();
    return new TextEncoder().encode(text).byteLength > maxBytes ? null : text;
  }

  // workers-types declares `body` as ReadableStream<any>; pin the chunk type
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function handleSwatchCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const t = userId
    ? await createUserTranslator(env.KV, userId, interaction.locale)
    : createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');
  const theme = userId ? (await getUserPreferences(env.KV, userId)).theme : undefined;

  const options = interaction.data?.options || [];
  const fileId = options.find((opt) => opt.name === 'file')?.value as string | undefined;
  const orderRaw = options.find((opt) => opt.name === 'order')?.value as string | undefined;
  const slotRaw = options.find((opt) => opt.name === 'slot')?.value as string | undefined;

  const attachment = fileId ? interaction.data?.resolved?.attachments?.[fileId] : undefined;
  if (!attachment) {
    return ephemeralResponse(t.t('errors.missingInput'));
  }
  if (attachment.size > MAX_FILE_BYTES) {
    return ephemeralResponse(
      t.t('card.swatchParseError', { message: `file too large (${attachment.size} bytes)` })
    );
  }
  // FINDING-033: only Discord's own CDN hosts are ever fetched
  if (!isAllowedAttachmentUrl(attachment.url)) {
    return ephemeralResponse(
      t.t('card.swatchParseError', { message: 'attachment must be uploaded to Discord' })
    );
  }

  const input: SwatchInput = {
    fileText: '',
    fileName: attachment.filename,
    locale: t.getLocale(),
    logger,
  };
  if (theme) input.theme = theme;
  if (orderRaw === 'hardest' || orderRaw === 'slots') input.order = orderRaw;
  if (slotRaw && (SLOT_VALUES as readonly string[]).includes(slotRaw)) {
    input.slot = slotRaw as SwatchSlotOption;
  }

  const deferResponse = deferredResponse();
  ctx.waitUntil(processSwatchCommand(interaction, env, attachment.url, input, logger));
  return deferResponse;
}

async function processSwatchCommand(
  interaction: DiscordInteraction,
  env: Env,
  fileUrl: string,
  input: SwatchInput,
  logger?: ExtendedLogger
): Promise<void> {
  const locale: LocaleCode = input.locale;
  const t = createTranslator(locale);

  try {
    // FINDING-033: bounded wait, no redirect following, bounded read.
    // `manual`, NOT `error`: workerd implements only follow/manual and throws
    // on `error` (which broke every /swatch download until 2026-08-29). A
    // redirect now surfaces as a 3xx response, refused by the `!ok` check.
    const fileResponse = await fetch(fileUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!fileResponse.ok) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(
            t.t('common.error'),
            t.t('card.swatchParseError', { message: `download failed (${fileResponse.status})` })
          ),
        ],
      });
      return;
    }
    const fileText = await readTextCapped(fileResponse, MAX_FILE_BYTES);
    if (fileText === null) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(
            t.t('common.error'),
            t.t('card.swatchParseError', {
              message: `file too large (over ${MAX_FILE_BYTES} bytes)`,
            })
          ),
        ],
      });
      return;
    }
    input.fileText = fileText;
  } catch (error) {
    if (logger) logger.error('Swatch download error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  const result = await executeSwatch(input);

  if (!result.ok) {
    if (logger) logger.warn('Swatch command failed', { error: result.error });
    // FINDING-019: the parser names the offending field VALUE (file content)
    // and this edit is public — escape markdown / masked links, defuse
    // mentions, strip controls and cap it before it goes out.
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        errorEmbed(t.t('common.error'), sanitizeEmbedText(result.errorMessage, MAX_ERROR_TEXT)),
      ],
    });
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: result.embed.title,
          description: result.embed.description,
          color: result.embed.color,
          image: { url: 'attachment://swatch.png' },
        },
      ],
      file: { name: 'swatch.png', data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    if (logger) logger.error('Swatch render error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}
