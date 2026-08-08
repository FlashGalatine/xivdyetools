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
 * @module handlers/commands/swatch
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed, ephemeralResponse } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode, type LocaleCode } from '../../services/i18n.js';
import { executeSwatch, type SwatchInput, type SwatchSlotOption } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';

/** .chara files are small JSON — anything past 1 MiB is not one. */
const MAX_FILE_BYTES = 1_048_576;

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

  const input: SwatchInput = {
    fileText: '',
    fileName: attachment.filename,
    locale: t.getLocale(),
  };
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
    const fileResponse = await fetch(fileUrl);
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
    input.fileText = await fileResponse.text();
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
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), result.errorMessage)],
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
