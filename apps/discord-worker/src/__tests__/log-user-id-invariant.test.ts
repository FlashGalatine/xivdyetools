/**
 * Keeps PRIVACY_POLICY.md §5 true: "Two of [the log lines] include your
 * Discord User ID — one when a command starts, one when a command is rate
 * limited." (FINDING-018, 2026-10-03 security audit.)
 *
 * A source scan, not a runtime test: it finds every logger call in non-test
 * source whose arguments mention a user-id identifier, and requires that
 * exactly the two documented sites remain. Adding a third means either
 * dropping the id from the line (preferred; the request id already ties lines
 * to "Handling command") or updating the policy and this allow-list together.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url).href), '..');

const USER_ID_WORD = /\b(userId|user_id|discordId|discord_id|discordUserId|authorId)\b/;
/** `logger.info(`, `log.warn(`, `this.logger.error(`, `reqLogger?.debug(`, `console.log(` ... */
const LOG_CALL = /\b(?:\w*[lL]og(?:ger)?\w*|console)\??\.(?:info|warn|error|debug|log)\(/g;

/** The only two sites the policy documents. Matched on the message string. */
const ALLOWED_MESSAGES = ['Handling command', 'User rate limited'];

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      out.push(...listSourceFiles(full));
    } else if (
      /\.(ts|tsx)$/.test(name) &&
      !/\.(test|spec)\.tsx?$/.test(name) &&
      !/^test-utils/.test(name)
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Blank out comments (keeping offsets and newlines) so prose cannot match. */
function blankComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, (m, pre: string) => pre + ' '.repeat(m.length - pre.length));
}

/** The text between a call's `(` at `open` and its matching `)`. */
function callArguments(src: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

/** Drop plain '...' / "..." literals (prose) but keep template `${}` interpolations. */
function withoutPlainStrings(args: string): string {
  return args.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
}

interface Site {
  file: string;
  line: number;
  message: string;
}

function findUserIdLogSites(): Site[] {
  const sites: Site[] = [];
  for (const file of listSourceFiles(SRC)) {
    const src = blankComments(readFileSync(file, 'utf8'));
    for (const match of src.matchAll(LOG_CALL)) {
      const open = match.index! + match[0].length - 1;
      const args = callArguments(src, open);
      if (!USER_ID_WORD.test(withoutPlainStrings(args))) continue;
      const message = /^\s*['"`]([^'"`]*)['"`]/.exec(args)?.[1] ?? args.trim().slice(0, 60);
      sites.push({
        file: relative(SRC, file).split(sep).join('/'),
        line: src.slice(0, match.index).split('\n').length,
        message,
      });
    }
  }
  return sites;
}

describe('log lines that carry a Discord user id (PRIVACY_POLICY.md §5)', () => {
  const sites = findUserIdLogSites();
  const describeSites = sites.map((s) => `${s.file}:${s.line} "${s.message}"`);

  it('the scan sees the source tree (guards against a vacuous pass)', () => {
    expect(listSourceFiles(SRC).length).toBeGreaterThan(50);
  });

  it('exactly the two documented lines remain: command start and rate limited', () => {
    expect(sites.map((s) => s.message).sort(), describeSites.join('\n')).toEqual(
      [...ALLOWED_MESSAGES].sort(),
    );
  });

  it('both documented lines live in the request router', () => {
    for (const s of sites) expect(s.file).toBe('index.ts');
  });
});
