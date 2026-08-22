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

import type { Env, DiscordInteraction } from '../../types/env.js';
import { createUserTranslator } from '../../services/bot-i18n.js';
import { ephemeralResponse } from '../../utils/response.js';
import { BRAND_ACCENT } from '../../utils/brand.js';
import { parseAll, type ChangelogEntry } from '../../services/changelog-parser.js';
import changelogMarkdown from '../../../CHANGELOG-laymans.md';

/** Collapsed one-liners under the expanded newest entry. */
const COLLAPSED_COUNT = 5;

/**
 * Discord's embed-description ceiling is 4096; stop short of it, and on a
 * line boundary, so a long release never ends mid-bullet (the same rule the
 * release announcement follows in services/announcements.ts).
 */
const DESCRIPTION_BUDGET = 4000;
const CUT_MARKER = '…';

function renderEntry(entry: ChangelogEntry): string {
  const lines: string[] = [];
  for (const section of entry.sections) {
    lines.push(`**${section.title}**`);
    for (const item of section.items) lines.push(`• ${item}`);
  }
  const text = lines.join('\n');
  if (text.length <= DESCRIPTION_BUDGET) return text;

  const cut = text.slice(0, DESCRIPTION_BUDGET - CUT_MARKER.length - 1);
  const lastBreak = cut.lastIndexOf('\n');
  return `${(lastBreak > 0 ? cut.slice(0, lastBreak) : cut).trimEnd()}\n${CUT_MARKER}`;
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

  // Parsed per call: the file is a few KB and the parse is one line scan,
  // which keeps the module free of load-time work in the Worker isolate.
  const entries = parseAll(changelogMarkdown);
  if (entries.length === 0) {
    // Parse failures are silent by design (changelog-parser.ts); a file that
    // drifted off the grammar must still answer. The contract test next to
    // the parser is what keeps this branch from ever being reached.
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
          description: renderEntry(expanded),
          color: BRAND_ACCENT,
          fields,
        },
      ],
      flags: 64, // Ephemeral
    },
  });
}
