/**
 * I18N-001 (2026-09-19 i18n audit): emit the `commands.<cmd>.options.<…>.description` subtree
 * that `commands/localize.ts` reads, straight from the registered schema, and merge it into
 * bot-logic's en.json. The schema's English `description` IS the en value — this script keeps
 * the two from drifting. Idempotent. Run: `npx tsx scripts/gen-option-description-keys.ts`
 *
 * Key shape mirrors the schema's own nesting:
 *   commands.harmony.options.type.description
 *   commands.dye.options.search.description
 *   commands.dye.options.search.options.query.description
 *
 * `buildOptionDescriptionTree()` is exported so `localize.test.ts` can build the
 * SAME tree straight from `schemas.ts` and diff it against en.json's committed
 * subtree — a schema edit without re-running this script then fails that test
 * instead of silently drifting. Everything below the exports only runs when
 * this file executes as the CLI entry point, never on import, since a test
 * importing it must not also rewrite en.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commands } from '../src/commands/schemas.js';

export interface SchemaOption {
  name: string;
  description: string;
  options?: ReadonlyArray<SchemaOption>;
}
export interface OptionDescriptionNode {
  description: string;
  options?: Record<string, OptionDescriptionNode>;
}

// `fileURLToPath(new URL(relative, import.meta.url))` does not type-check in
// this app: it loads both @cloudflare/workers-types and @types/node, so the
// global `URL` is not the `node:url` one the overload wants — pass the
// import.meta.url STRING through fileURLToPath first, as font-coverage.test.ts
// and font-coverage.filter.test.ts already do, then join the relative path.
const EN = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'bot-logic',
  'src',
  'i18n',
  'locales',
  'en.json',
);

export function buildOptionDescriptionTree(
  opts: ReadonlyArray<SchemaOption> | undefined,
): Record<string, OptionDescriptionNode> | undefined {
  if (!opts || opts.length === 0) return undefined;
  const out: Record<string, OptionDescriptionNode> = {};
  for (const o of opts) {
    const node: OptionDescriptionNode = { description: o.description };
    const sub = buildOptionDescriptionTree(o.options);
    if (sub) node.options = sub;
    out[o.name] = node;
  }
  return out;
}

function main(): void {
  const en = JSON.parse(readFileSync(EN, 'utf8')) as { commands: Record<string, OptionDescriptionNode> };
  let count = 0;
  const tally = (n: Record<string, OptionDescriptionNode> | undefined): void => {
    for (const v of Object.values(n ?? {})) {
      count++;
      tally(v.options);
    }
  };
  for (const cmd of commands as ReadonlyArray<SchemaOption>) {
    const entry = en.commands[cmd.name];
    if (!entry) throw new Error(`en.json has no commands.${cmd.name}`);
    const sub = buildOptionDescriptionTree(cmd.options);
    if (sub) entry.options = sub;
    else delete entry.options;
    tally(sub);
  }
  writeFileSync(EN, JSON.stringify(en, null, 2) + '\n', 'utf8');
  console.log(`wrote ${count} option/subcommand descriptions into commands.*.options`);
}

// Run only as the CLI entry point (`npx tsx scripts/gen-option-description-keys.ts`),
// never when `localize.test.ts` imports `buildOptionDescriptionTree` — importing
// this module must never write en.json as a side effect.
const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
