/**
 * Every `--theme-*` token the app reads has to be declared by `themes.css` or
 * ThemeService. A token nothing declares paints its fallback forever, and no test or
 * type check notices: `--theme-primary-hover` went undeclared through the 5.0 theme
 * consolidation, so hovered controls kept showing a gold from the retired themes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const read = (p: string): string => readFileSync(resolve(APP_ROOT, p), 'utf-8');

/** Known gaps, each with its reason. An entry that stops being a gap fails the test. */
const UNDECLARED: Record<string, string> = {
  '--theme-empty-state-background': 'v4-layout empty state, which only has its own rgba fallback',
};

function declaredTokens(): Set<string> {
  const stylesheet = read('src/styles/themes.css').matchAll(/^\s*(--theme-[a-z0-9-]+):/gm);
  const service = read('src/services/theme-service.ts').matchAll(
    /setProperty\('(--theme-[a-z0-9-]+)'/g
  );
  return new Set([...stylesheet, ...service].map((match) => match[1]));
}

/** Every non-test stylesheet and TypeScript source under `src/`, relative to it. */
function sourceFiles(): string[] {
  return readdirSync(resolve(APP_ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .map((file) => file.split(sep).join('/'))
    .filter((file) => /\.(ts|css)$/.test(file) && !/\.test\.ts$|\.d\.ts$|__tests__\//.test(file));
}

function tokensRead(): Set<string> {
  const tokens = sourceFiles().flatMap((file) =>
    [...read(`src/${file}`).matchAll(/var\(\s*(--theme-[a-z0-9-]+)/g)].map((match) => match[1])
  );
  return new Set(tokens);
}

describe('theme token contract', () => {
  const declared = declaredTokens();
  const tokens = [...tokensRead()];

  it('keeps the gold of the retired themes out of every source', () => {
    const gold = /#d4af37|#c49[df]2f|212,\s*175,\s*55/i;
    const offenders = sourceFiles().flatMap((file) =>
      read(`src/${file}`)
        .split('\n')
        .flatMap((line, index) => (gold.test(line) ? [`${file}:${index + 1}: ${line.trim()}`] : []))
    );
    expect(offenders).toEqual([]);
  });

  it('declares every token the app reads', () => {
    const missing = tokens.filter((token) => !declared.has(token) && !(token in UNDECLARED));
    expect(missing).toEqual([]);
  });

  it('has no stale exceptions', () => {
    const stale = Object.keys(UNDECLARED).filter(
      (token) => declared.has(token) || !tokens.includes(token)
    );
    expect(stale).toEqual([]);
  });
});
