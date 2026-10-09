/**
 * BUG-126 (2026-10-04 deep dive): every call site hands the translator
 * factories the request logger it holds.
 *
 * `createUserTranslator` / `createUserTranslatorWithPrefs`
 * (src/services/bot-i18n.ts) forward their 4th argument to bot-logic's
 * `resolveUserLocale`, which logs a KV failure only when it is given a
 * logger. A call site that drops the logger puts that failure back to a
 * silent fall-back to the Discord locale — and no behavioural test notices,
 * because the reply still arrives in a valid language.
 *
 * Source-level on purpose. Per-adapter assertions would need a mock of
 * bot-i18n in every handler's test and would say nothing about a handler
 * added later; this scan covers every call in `src/` — commands, buttons and
 * the router — including ones that do not exist yet. It walks each call's
 * parentheses rather than matching a line, so a call split over several
 * lines (manual.ts) is read whole. The TypeScript compiler API would be the
 * sturdier parser, but `typescript` is only a root devDependency, and
 * importing it from this workspace is an unlisted dependency to knip.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

interface CallSite {
  file: string;
  line: number;
  args: string[];
}

/** Every non-test TypeScript source under `dir`, recursively. */
function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')
      ? [path]
      : [];
  });
}

/**
 * The top-level arguments of the call whose `(` is at `open`: brackets are
 * depth-counted and quoted strings skipped, so a comma or parenthesis inside
 * either does not split an argument.
 */
function argumentsAt(text: string, open: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const close = text.indexOf(ch, i + 1);
      if (close === -1) break;
      i = close;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        args.push(text.slice(start, i));
        break;
      }
    } else if (ch === ',' && depth === 1) {
      args.push(text.slice(start, i));
      start = i + 1;
    }
  }
  // A trailing comma leaves an empty last argument
  return args.map((a) => a.trim()).filter((a) => a.length > 0);
}

/** Every call to either factory in `src/`, skipping their declarations and comments. */
function findCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const path of listSources(SRC)) {
    const text = readFileSync(path, 'utf-8').replace(/\r\n/g, '\n');
    for (const match of text.matchAll(/\bcreateUserTranslator(?:WithPrefs)?\(/g)) {
      const at = match.index;
      const lineStart = text.lastIndexOf('\n', at) + 1;
      const before = text.slice(lineStart, at);
      if (/^\s*(\/\/|\*|\/\*)/.test(before)) continue; // a comment
      if (/\bfunction\s+$/.test(before)) continue; // the declaration itself
      sites.push({
        file: relative(SRC, path).replace(/\\/g, '/'),
        line: text.slice(0, at).split('\n').length,
        args: argumentsAt(text, at + match[0].length - 1),
      });
    }
  }
  return sites;
}

const passesLogger = (site: CallSite): boolean => site.args[3] === 'logger';
const label = (site: CallSite): string => `${site.file}:${site.line}`;

describe('BUG-126: the translator factories get the request logger', () => {
  const sites = findCallSites();

  it('finds the call sites (the scan is not vacuous)', () => {
    // 21 at the time of writing: 18 in the command handlers (extractor has
    // two), 1 in the button dispatcher and 2 in the router. A floor, not an
    // exact count, so a new or removed handler does not have to touch this
    // file — what this guards is the scan itself matching nothing.
    expect(sites.length).toBeGreaterThanOrEqual(20);
    for (const site of sites) expect(site.args.length, label(site)).toBeGreaterThanOrEqual(3);
  });

  // Every handler receives the request logger from the dispatcher (the
  // router test in src/index.test.ts pins that), so there is no exception
  // list: a handler without one in scope should be given one.
  it('passes `logger` as the 4th argument at every call site', () => {
    const missing = sites.filter((site) => !passesLogger(site)).map(label);
    expect(missing).toEqual([]);
  });
});
