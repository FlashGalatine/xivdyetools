/**
 * /glamour Command Handler (Adapter) — the Glamour Reader in the bot.
 *
 * Same shape as /swatch: a required `file:` .chara attachment, the shared
 * attachment guards (`utils/chara-attachment.ts`), a deferred reply. The file
 * is read in memory only and never stored. bot-logic's executeGlamour parses
 * it, names each piece and draws the card; this adapter supplies the resolve
 * transport — api-worker's `POST /v1/chara/resolve` through the same service
 * binding /budget uses — and posts the PNG with the list in the embed.
 *
 * Every request through the binding shares one api-worker rate-limit key
 * (a binding request has no client IP), so a /glamour spends exactly one
 * resolve call and draws no item icons.
 *
 * @module handlers/commands/glamour
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  executeGlamour,
  sanitizeEmbedText,
  type GlamourInput,
  type GlamourResolveAnswer,
} from '@xivdyetools/bot-logic';
import type { CharaGearModel } from '@xivdyetools/core';
import { deferredResponse, errorEmbed, ephemeralResponse } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { checkCharaAttachment, downloadCharaAttachment } from '../../utils/chara-attachment.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { filterToRenderable } from '../../services/font-coverage.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode } from '../../services/i18n.js';
import { getUserPreferences } from '../../services/preferences.js';
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

/** Cap on the sanitised error text that goes into the public embed. */
const MAX_ERROR_TEXT = 1024;

/** api-worker answers a cold resolve in one XIVAPI search; 12 s matches the web app. */
const RESOLVE_TIMEOUT_MS = 12_000;

const RESOLVE_PATH = '/v1/chara/resolve';

interface ResolveEnvelope {
  success?: boolean;
  data?: { items?: GlamourResolveAnswer['items'] | null; glasses?: GlamourResolveAnswer['glasses'] };
}

/**
 * The resolver executeGlamour calls: the service binding in production,
 * `UNIVERSALIS_PROXY_URL` (api-worker's origin) in local development.
 */
function resolveThroughApiWorker(env: Env): GlamourInput['resolve'] {
  return async (gear: CharaGearModel[], glassesId: number | null) => {
    const body = JSON.stringify(glassesId && glassesId > 0 ? { gear, glasses: glassesId } : { gear });
    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
    };
    let response: Response;
    if (env.UNIVERSALIS_PROXY) {
      response = await env.UNIVERSALIS_PROXY.fetch(new Request(`https://internal${RESOLVE_PATH}`, init));
    } else if (env.UNIVERSALIS_PROXY_URL) {
      response = await fetch(`${env.UNIVERSALIS_PROXY_URL}${RESOLVE_PATH}`, init);
    } else {
      throw new Error('api-worker binding not configured');
    }
    if (!response.ok) throw new Error(`api-worker answered ${response.status}`);
    const envelope = (await response.json().catch(() => null)) as ResolveEnvelope | null;
    const items = envelope?.success === true ? envelope.data?.items : null;
    if (!items || typeof items !== 'object') throw new Error('Malformed resolve envelope');
    return { items, glasses: envelope?.data?.glasses ?? null };
  };
}

export async function handleGlamourCommand(
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

  const attachment = checkCharaAttachment(interaction, t);
  if (!attachment.ok) {
    return ephemeralResponse(attachment.message);
  }

  const deferResponse = deferredResponse();
  ctx.waitUntil(processGlamourCommand(interaction, env, attachment.url, t.getLocale(), theme, logger));
  return deferResponse;
}

async function processGlamourCommand(
  interaction: DiscordInteraction,
  env: Env,
  fileUrl: string,
  locale: GlamourInput['locale'],
  theme: GlamourInput['theme'],
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);
  const fail = (text: string): Promise<unknown> =>
    safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), text)],
    });

  let fileText: string;
  try {
    const file = await downloadCharaAttachment(fileUrl, t);
    if (!file.ok) {
      markCommandOutcome(interaction, 'image_input');
      await fail(file.message);
      return;
    }
    fileText = file.text;
  } catch (error) {
    // Only the CDN fetch and the capped read live in this try.
    markCommandOutcome(interaction, classifyError(error, 'unknown'));
    if (logger) logger.error('Glamour download error', error instanceof Error ? error : undefined);
    await fail(t.t('errors.generationFailed'));
    return;
  }

  const input: GlamourInput = {
    fileText,
    locale,
    resolve: resolveThroughApiWorker(env),
    // Item names arrive at run time; the CJK fonts are subsets (BUG-030)
    canDraw: (text) => filterToRenderable(text).dropped === 0,
    logger,
  };
  if (theme) input.theme = theme;
  const result = await executeGlamour(input);

  if (!result.ok) {
    if (result.error === 'PARSE_FAILED') markCommandOutcome(interaction, 'image_input');
    if (result.error === 'RESOLVE_FAILED') markCommandOutcome(interaction, 'unknown');
    if (result.error === 'GENERATION_FAILED') markCommandOutcome(interaction, 'render');
    if (logger) logger.warn('Glamour command failed', { error: result.error });
    // FINDING-019: the parser can echo .chara field VALUES; this edit is public
    await fail(sanitizeEmbedText(result.errorMessage, MAX_ERROR_TEXT));
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
          image: { url: 'attachment://glamour.png' },
        },
      ],
      file: { name: 'glamour.png', data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error, 'render'));
    if (logger) logger.error('Glamour render error', error instanceof Error ? error : undefined);
    await fail(t.t('errors.generationFailed'));
  }
}
