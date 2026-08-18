/**
 * Tests for command handlers index exports
 */
import { describe, it, expect, vi } from 'vitest';

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
  // The barrel import pulls every handler (and their transitive deps) in one
  // dynamic import — near the 5s default under parallel CI load, so it gets
  // an explicit budget instead of flaking the workspace gate.
  it('exports all command handlers', { timeout: 30_000 }, async () => {
    const commands = await import('./index.js');

    expect(commands.handleHarmonyCommand).toBeDefined();
    expect(typeof commands.handleHarmonyCommand).toBe('function');

    expect(commands.handleDyeCommand).toBeDefined();
    expect(typeof commands.handleDyeCommand).toBe('function');

    // V4 Commands
    expect(commands.handleExtractorCommand).toBeDefined();
    expect(typeof commands.handleExtractorCommand).toBe('function');

    expect(commands.handleGradientCommand).toBeDefined();
    expect(typeof commands.handleGradientCommand).toBe('function');

    // V4: Swatch command
    expect(commands.handleSwatchCommand).toBeDefined();
    expect(typeof commands.handleSwatchCommand).toBe('function');

    // Legacy commands (still exported for backward compatibility)

    expect(commands.handleAccessibilityCommand).toBeDefined();
    expect(typeof commands.handleAccessibilityCommand).toBe('function');

    expect(commands.handleManualCommand).toBeDefined();
    expect(typeof commands.handleManualCommand).toBe('function');

    expect(commands.handleComparisonCommand).toBeDefined();
    expect(typeof commands.handleComparisonCommand).toBe('function');

    expect(commands.handlePresetCommand).toBeDefined();
    expect(typeof commands.handlePresetCommand).toBe('function');
  });
});
