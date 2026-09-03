/**
 * Tests for command handlers index exports
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mock WASM dependencies that command handlers may import transitively
vi.mock('@resvg/resvg-wasm', () => ({
  initWasm: vi.fn().mockResolvedValue(undefined),
  Resvg: class MockResvg {
    render() {
      return { asPng: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]) };
    }
  },
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
  default: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
}));

vi.mock('../../services/fonts', () => ({
  getFontBuffers: vi.fn(() => []),
}));

describe('commands/index exports', () => {
  // discord-handlers-16: this file used to be 20+ pairs of
  // `expect(commands.handleX).toBeDefined()` / `expect(typeof ...).toBe('function')`
  // over a barrel of re-exports -- the canonical shape that cannot fail for any
  // change the compiler already admits. What the barrel import genuinely buys
  // is that every handler module (and its transitive deps -- WASM, fonts,
  // locales) loads at all, so keep exactly one smoke assertion for that, and
  // spend the rest on the drift this file was presumably meant to catch.
  it('the barrel loads every handler module', { timeout: 30_000 }, async () => {
    const commands = await import('./index.js');

    // A representative handler from each corner of the barrel: if any module in
    // the graph fails to load, the import above throws before we get here.
    expect(typeof commands.handleHarmonyCommand).toBe('function');
    expect(typeof commands.handlePresetCommand).toBe('function');
    expect(typeof commands.handleStatsCommand).toBe('function');
  });

  // The real risk: a command in COMMAND_REGISTRY -- which /about lists and
  // register-commands publishes to Discord -- with no branch in the
  // interaction dispatch. Users would see the command in Discord's picker and
  // get "Unknown command" when they ran it. Nothing tied the two together.
  it('every registered command has a dispatch branch in index.ts', async () => {
    const { COMMAND_REGISTRY } = await import('../../commands/registry.js');
    // `fileURLToPath` needs the import.meta.url STRING: with workers-types and
    // @types/node both loaded the global URL is not node:url's URL, and passing
    // a constructed one fails type-check (og-worker hit this in 0de6f12e).
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, '..', '..', 'index.ts'), 'utf8');

    // A superset: `case` labels from any switch in the file count, so this can
    // only UNDER-report. That is the safe direction for a drift guard.
    const dispatched = new Set(
      [...source.matchAll(/^\s*case '([a-z0-9_-]+)':/gm)].map((m) => m[1])
    );

    const missing = COMMAND_REGISTRY.filter((entry) => !entry.deprecated)
      .map((entry) => entry.name)
      .filter((name) => !dispatched.has(name));

    expect(missing, 'registered commands with no dispatch branch').toEqual([]);
  });
});
