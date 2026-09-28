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
 * image-worker hardens `/extractor image` — the guards live in
 * `utils/chara-attachment.ts`, shared with `/glamour`. FINDING-019: the
 * parser echoes `.chara` field VALUES into its message, and that message
 * lands in a PUBLIC embed, so it goes through the shared embed sanitiser
 * first.
 *
 * @module handlers/commands/swatch
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed, ephemeralResponse } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { checkCharaAttachment, downloadCharaAttachment } from '../../utils/chara-attachment.js';
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
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

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
  const orderRaw = options.find((opt) => opt.name === 'order')?.value as string | undefined;
  const slotRaw = options.find((opt) => opt.name === 'slot')?.value as string | undefined;

  const attachment = checkCharaAttachment(interaction, t);
  if (!attachment.ok) {
    return ephemeralResponse(attachment.message);
  }

  const input: SwatchInput = {
    fileText: '',
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
    const file = await downloadCharaAttachment(fileUrl, t);
    if (!file.ok) {
      markCommandOutcome(interaction, 'image_input');
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), file.message)],
      });
      return;
    }
    input.fileText = file.text;
  } catch (error) {
    // Only the CDN fetch and the capped read live in this try: a network
    // failure or timeout here is neither our renderer nor the user's file.
    markCommandOutcome(interaction, classifyError(error, 'unknown'));
    if (logger) logger.error('Swatch download error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  const result = await executeSwatch(input);

  if (!result.ok) {
    // PARSE_FAILED = the .chara file could not be read (user input);
    // GENERATION_FAILED = the card generator threw. NO_LIVE_SLOTS /
    // SLOT_MISSING are answered like a validation reply and stay `ok`.
    if (result.error === 'PARSE_FAILED') markCommandOutcome(interaction, 'image_input');
    if (result.error === 'GENERATION_FAILED') markCommandOutcome(interaction, 'render');
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
    markCommandOutcome(interaction, classifyError(error, 'render'));
    if (logger) logger.error('Swatch render error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}
