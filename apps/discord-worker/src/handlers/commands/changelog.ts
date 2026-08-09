/**
 * /changelog Command Handler (5.0, net-new)
 *
 * Ephemeral. Renders the product-level CHANGELOG-laymans.md via parseAll():
 * the newest entry in full, the next five as collapsed one-liners, and a
 * `version:` option that expands any recorded release. The file is fetched
 * from the repository raw URL (same source the GitHub webhook reads) and
 * cached in KV briefly.
 *
 * @module handlers/commands/changelog
 */

import type { Env, DiscordInteraction } from '../../types/env.js';
import { createUserTranslator } from '../../services/bot-i18n.js';
import { ephemeralResponse } from '../../utils/response.js';
import { BRAND_ACCENT } from '../../utils/brand.js';
import { parseAll, type ChangelogEntry } from '../../services/changelog-parser.js';

const CHANGELOG_RAW_URL =
  'https://raw.githubusercontent.com/FlashGalatine/xivdyetools/main/CHANGELOG-laymans.md';

/** KV cache: the parsed source moves only on release pushes. */
const CACHE_KEY = 'changelog:raw:v1';
const CACHE_TTL_SECONDS = 600;

/** Collapsed one-liners under the expanded newest entry. */
const COLLAPSED_COUNT = 5;



async function fetchChangelog(env: Env): Promise<string | null> {
  const cached = await env.KV.get(CACHE_KEY);
  if (cached) return cached;
  try {
    const response = await fetch(CHANGELOG_RAW_URL, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const text = await response.text();
    await env.KV.put(CACHE_KEY, text, { expirationTtl: CACHE_TTL_SECONDS });
    return text;
  } catch {
    return null;
  }
}

function renderEntry(entry: ChangelogEntry): string {
  const lines: string[] = [];
  for (const section of entry.sections) {
    lines.push(`**${section.title}**`);
    for (const item of section.items) lines.push(`• ${item}`);
  }
  return lines.join('\n');
}

/**
 * Handles the /changelog command (always ephemeral).
 */
export async function handleChangelogCommand(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  const options = interaction.data?.options || [];
  const versionWanted = options.find((opt) => opt.name === 'version')?.value as string | undefined;

  const markdown = await fetchChangelog(env);
  const entries = markdown ? parseAll(markdown) : [];
  if (entries.length === 0) {
    return ephemeralResponse(t.t('changelog.empty'));
  }

  const expanded = versionWanted
    ? entries.find((e) => e.version === versionWanted.trim())
    : entries[0];
  if (!expanded) {
    return ephemeralResponse(t.t('changelog.notFound', { version: versionWanted ?? '' }));
  }

  const fields: Array<{ name: string; value: string; inline: boolean }> = [];
  // Collapsed one-liners: the next releases after the expanded one
  const rest = entries.filter((e) => e !== expanded).slice(0, COLLAPSED_COUNT);
  if (rest.length > 0) {
    fields.push({
      name: t.t('changelog.earlier'),
      value: rest
        .map((e) => `\`${e.version}\` — ${e.date} · \`/changelog version:${e.version}\``)
        .join('\n'),
      inline: false,
    });
  }

  return Response.json({
    type: 4,
    data: {
      embeds: [
        {
          title: `${t.t('changelog.title')} — ${expanded.version} (${expanded.date})`,
          description: renderEntry(expanded).slice(0, 4000),
          color: BRAND_ACCENT,
          fields,
        },
      ],
      flags: 64, // Ephemeral
    },
  });
}
