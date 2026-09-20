#!/usr/bin/env node
// /manual check — Discord size limits per locale + roster coverage.
//
//   node manual-check.mjs <xivdyetools-dir> [--ref <git-ref>]
//
// With --ref (e.g. origin/main, or the deployed revision) files are read via
// `git show <ref>:<path>`; without it, from the working tree (a worktree after
// edits). Keys are derived from manual.ts itself, so the script follows the
// handler instead of a hard-coded key list.
//
// Discord counts title + description + field name/value + footer + author
// across ALL embeds of one message against 6,000 chars; field value ≤ 1,024,
// description ≤ 4,096, ≤ 25 fields per embed, ≤ 10 embeds. Over-limit replies
// are rejected by Discord (400) — the user sees "interaction failed".
// Exit 1 when any reply is over a limit, 0 otherwise.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [repo, flag, refArg] = process.argv.slice(2);
if (!repo) {
  console.error('usage: node manual-check.mjs <xivdyetools-dir> [--ref <git-ref>]');
  process.exit(2);
}
const ref = flag === '--ref' ? refArg : undefined;
const read = (p) =>
  ref
    ? execFileSync('git', ['-C', repo, 'show', `${ref}:${p}`], { encoding: 'utf8' })
    : readFileSync(join(repo, p), 'utf8');

const MANUAL = 'apps/discord-worker/src/handlers/commands/manual.ts';
const REGISTRY = 'apps/discord-worker/src/commands/registry.ts';
const LOCALES = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];
const LIMIT = { total: 6000, value: 1024, description: 4096 };

const src = read(MANUAL);
const fnBody = (name) => {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name}() not found in ${MANUAL} — update this script`);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
};
const keysIn = (body) => [...body.matchAll(/t\.t\(\s*['`]([\w.]+)['`]/g)].map((m) => m[1]);
const valueKeysIn = (body) => [...body.matchAll(/value:\s*t\.t\(\s*['`]([\w.]+)['`]/g)].map((m) => m[1]);
const literalsIn = (body) => [...body.matchAll(/'(•[^']*)'/g)].map((m) => m[1]);
const embedCount = (body) => (body.match(/color:\s*BRAND_ACCENT/g) ?? []).length;

const replies = {
  overview: fnBody('buildEmbeds'),
  match_image: fnBody('buildMatchImageHelpEmbeds'),
};
const topics = [...(src.match(/const TOPIC_KEYS[^{]*\{([\s\S]*?)\};/)?.[1] ?? '').matchAll(/(\w+):\s*'(\w+)'/g)]
  .map((m) => ({ id: m[1], key: m[2] }));

const get = (o, k) => k.split('.').reduce((a, s) => (a == null ? a : a[s]), o);
const chars = (s) => [...String(s ?? '')].length;
let over = false;

console.log('| locale | reply | total/6000 | max field value/1024 | embeds | missing keys |');
console.log('|---|---|---|---|---|---|');
const en = JSON.parse(read('packages/bot-logic/src/i18n/locales/en.json'));
for (const loc of LOCALES) {
  const j = JSON.parse(read(`packages/bot-logic/src/i18n/locales/${loc}.json`));
  const rows = Object.entries(replies).map(([name, body]) => {
    const keys = keysIn(body);
    const missing = keys.filter((k) => get(j, k) == null);
    const total = keys.reduce((a, k) => a + chars(get(j, k) ?? k), 0)
      + literalsIn(body).reduce((a, s) => a + chars(s), 0)
      + embedCount(body) * 3; // "📖 " style emoji prefixes
    const maxValue = Math.max(0, ...valueKeysIn(body).map((k) => chars(get(j, k))));
    return { name, total, maxValue, embeds: embedCount(body), missing };
  });
  for (const { id, key: t } of topics) {
    const total = chars(get(j, `manual5.topics.${t}.name`)) + chars(get(j, `manual5.topics.${t}.body`))
      + chars(get(j, 'manual5.learnLead')) + 120; // link markdown allowance
    const missing = [`manual5.topics.${t}.name`, `manual5.topics.${t}.body`].filter((k) => get(j, k) == null);
    rows.push({ name: `topic:${id}`, total, maxValue: 0, embeds: 1, missing, description: total });
  }
  for (const r of rows) {
    const bad = r.total > LIMIT.total || r.maxValue > LIMIT.value || r.embeds > 10
      || (r.description ?? 0) > LIMIT.description || r.missing.length > 0;
    over ||= bad;
    console.log(`| ${loc} | ${r.name} | ${r.total}${bad ? ' **OVER/BROKEN**' : ''} | ${r.maxValue} | ${r.embeds} | ${r.missing.join(', ') || '—'} |`);
  }
}

// Roster coverage: every registered command should be findable in the English
// overview. Aliases (a11y → accessibility) and deliberate omissions are the
// coordinator's call — this only lists what is absent.
const registry = read(REGISTRY);
const commands = [...registry.matchAll(/\{\s*name:\s*'([\w-]+)'[^}]*\}/g)]
  .filter((m) => !/deprecated:\s*true/.test(m[0]))
  .map((m) => m[1]);
const overviewText = keysIn(replies.overview).map((k) => String(get(en, k) ?? '')).join('\n');
const absent = commands.filter((c) => !new RegExp(`/${c}\\b`).test(overviewText));
console.log(`\nRegistry commands: ${commands.length} · absent from the /manual overview (en): ${absent.map((c) => '/' + c).join(', ') || 'none'}`);
console.log(`Topic handlers (TOPIC_KEYS + match_image): ${['match_image', ...topics.map((t) => t.id)].join(', ')}`);
process.exit(over ? 1 : 0);
