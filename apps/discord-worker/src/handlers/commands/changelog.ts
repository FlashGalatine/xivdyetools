/**
 * /changelog Command Handler (5.0, net-new)
 *
 * Ephemeral. Renders the bot's OWN release notes —
 * `apps/discord-worker/CHANGELOG-laymans.md`, bundled into the Worker as a
 * string at build time (wrangler `[[rules]] type = "Text"`, mirrored for tests
 * by vitest.markdown-plugin.ts) — via `parseAll()`: the newest entry in full,
 * the next five as collapsed one-liners, and a `version:` option that expands
 * any recorded release.
 *
 * The notes ship with the deployed code, so there is nothing to fetch and
 * nothing to cache, the version numbers are the Worker's own, and the beta
 * bot shows the beta's notes. The product-level root `CHANGELOG-laymans.md`
 * (web app + bot + link previews) feeds the release-announcement webhook in
 * index.ts instead — see services/announcements.ts.
 *
 * @module handlers/commands/changelog
 */

import { sanitizeEmbedText } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { createUserTranslator } from '../../services/bot-i18n.js';
import { ephemeralResponse } from '../../utils/response.js';
import { BRAND_ACCENT } from '../../utils/brand.js';
import { cutOnLineBoundary } from '../../utils/text.js';
import { parseAll, type ChangelogEntry } from '../../services/changelog-parser.js';
import changelogMarkdown from '../../../CHANGELOG-laymans.md';

/** Collapsed one-liners under the expanded newest entry. */
const COLLAPSED_COUNT = 5;

/**
 * Discord's embed-description ceiling is 4096; stop short of it, and on a
 * line boundary, so a long release never ends mid-bullet. The contract test
 * next to the parser asserts the newest entry fits uncut.
 */
export const DESCRIPTION_BUDGET = 4000;

/** Where the whole file lives, for the cut marker. */
const BOT_NOTES_URL =
  'https://github.com/FlashGalatine/xivdyetools/blob/main/apps/discord-worker/CHANGELOG-laymans.md';

/**
 * Render one entry as the embed description: bold section titles, bulleted
 * items, cut on a line boundary with a pointer to the full file if it would
 * not fit. Exported for the contract test on the bundled file.
 */
export function renderEntry(entry: ChangelogEntry): string {
  const lines: string[] = [];
  for (const section of entry.sections) {
    lines.push(`**${section.title}**`);
    for (const item of section.items) lines.push(`• ${item}`);
  }
  return cutOnLineBoundary(lines.join('\n'), DESCRIPTION_BUDGET, `\n… ${BOT_NOTES_URL}`);
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
  const rawVersion = options.find((opt) => opt.name === 'version')?.value;
  const versionWanted = typeof rawVersion === 'string' ? rawVersion.trim() : undefined;

  // Parsed per call: the file is a few KB and the parse is one line scan,
  // which keeps the module free of load-time work in the Worker isolate.
  const entries = parseAll(changelogMarkdown);
  if (entries.length === 0) {
    // Parse failures are silent by design (changelog-parser.ts); a file that
    // drifted off the grammar must still answer. The contract test next to
    // the parser is what keeps this branch from ever being reached.
    return ephemeralResponse(t.t('changelog.empty'));
  }

  const expanded = versionWanted ? entries.find((e) => e.version === versionWanted) : entries[0];
  if (!expanded) {
    // User text echoed back: sanitised and capped like every other echo.
    return ephemeralResponse(
      t.t('changelog.notFound', { version: sanitizeEmbedText(versionWanted ?? '', 64) })
    );
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
          description: renderEntry(expanded),
          color: BRAND_ACCENT,
          fields,
        },
      ],
      flags: 64, // Ephemeral
    },
  });
}
