#!/usr/bin/env tsx
/**
 * Invariants for the root `knip.jsonc` `workspaces` block.
 *
 * knip resolves exactly ONE key per workspace and never merges: keys are sorted
 * by path depth and, at equal depth, a literal key beats a glob. That is easy to
 * forget, and forgetting it produced two false comments and one entirely dead
 * config block that survived several rounds of review — a `packages/*` entry
 * advertising entry/project patterns that had never applied to anything, because
 * all eight packages were also named literally.
 *
 * These tests re-implement knip's own selection rule and assert the mapping, so
 * config that cannot take effect fails `pnpm test:scripts` instead of quietly
 * reading as if it does.
 *
 * @module scripts/knip-config.test
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/** Strip `//` and block comments plus trailing commas, respecting string literals. */
function stripJsonc(text: string): string {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i++;
      } else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === '/' && next === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function knipWorkspaceKeys(): string[] {
  const parsed = JSON.parse(stripJsonc(readFileSync('knip.jsonc', 'utf8'))) as {
    workspaces?: Record<string, unknown>;
  };
  return Object.keys(parsed.workspaces ?? {});
}

/** Every workspace directory in the monorepo, from the files git tracks. */
function workspaceDirs(): string[] {
  const out = execFileSync('git', ['ls-files', 'packages/*/package.json', 'apps/*/package.json'], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter(Boolean)
    .map((f) => f.slice(0, f.lastIndexOf('/')))
    .sort();
}

/** Does a knip workspace key match this workspace path? Only `*` appears in practice. */
function matches(key: string, ws: string): boolean {
  if (key === ws) return true;
  if (!key.includes('*')) return false;
  const re = new RegExp(
    `^${key
      .split('*')
      .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*')}$`,
  );
  return re.test(ws);
}

/**
 * knip's own rule, from `util/workspace.js` `byPathDepth` +
 * `ConfigurationChief.getConfigKeyForWorkspace`: sort ascending by segment
 * count with globs first at equal depth, reverse, then take the first match.
 */
function resolveKey(keys: readonly string[], ws: string): string | undefined {
  const isGlob = (k: string): boolean => k.split('/').some((seg) => seg === '*' || seg === '**');
  const sorted = [...keys].sort((a, b) => {
    const da = a.split('/').length;
    const db = b.split('/').length;
    if (da !== db) return da - db;
    if (isGlob(a)) return -1;
    if (isGlob(b)) return 1;
    return a.length - b.length;
  });
  return sorted.reverse().find((k) => matches(k, ws));
}

test('knip.jsonc: a literal key always beats a glob, so glob settings never merge in', () => {
  const keys = knipWorkspaceKeys();
  // packages/core is named literally; if a `packages/*` glob is ever
  // reintroduced it still must not be what core resolves to.
  assert.equal(resolveKey([...keys, 'packages/*'], 'packages/core'), 'packages/core');
  assert.equal(resolveKey([...keys, 'apps/*'], 'apps/discord-worker'), 'apps/discord-worker');
  // A workspace with no literal key is the only thing a glob can reach.
  assert.equal(resolveKey(keys, 'apps/og-worker'), 'apps/*');
  assert.equal(resolveKey(keys, 'apps/stoat-worker'), 'apps/*');
});

test('knip.jsonc: every workspace key applies to at least one workspace', () => {
  const keys = knipWorkspaceKeys();
  const dirs = workspaceDirs();
  const dead = keys.filter((key) => {
    if (key === '.') return false; // the root package, deliberately emptied
    return !dirs.some((ws) => resolveKey(keys, ws) === key);
  });
  assert.deepEqual(
    dead,
    [],
    `these knip.jsonc workspace keys can never apply to any workspace, because a ` +
      `literal key outranks them — their settings are silently doing nothing: ${dead.join(', ')}`,
  );
});

test('knip.jsonc: every gated workspace resolves to its own literal key', () => {
  // The fourteen workspaces whose `lint:dead` runs against this root config.
  // If one of these ever resolves to a glob instead, its entry/project settings
  // changed without anyone editing its key.
  const gated = [
    'packages/types',
    'packages/logger',
    'packages/auth',
    'packages/worker-kit',
    'packages/core',
    'packages/svg',
    'packages/bot-logic',
    'packages/test-utils',
    'apps/api-worker',
    'apps/discord-worker',
    'apps/image-worker',
    'apps/moderation-worker',
    'apps/oauth',
    'apps/presets-api',
  ];
  const keys = knipWorkspaceKeys();
  for (const ws of gated) {
    assert.equal(resolveKey(keys, ws), ws, `${ws} must resolve to its own key`);
  }
});
