/**
 * Tests for command handlers index exports
 */
import { describe, it, expect, vi } from 'vitest';

// Mock WASM dependencies that command handlers may import transitively
vi.mock('@resvg/resvg-wasm', () => ({
    initWasm: vi.fn().mockResolvedValue(undefined),
    Resvg: class MockResvg {
        render() {
            return { asPng: () => new Uint8Array([0x89, 0x50, 0x4E, 0x47]) };
        }
    },
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
    default: new Uint8Array([0x00, 0x61, 0x73, 0x6D]),
}));

vi.mock('../../services/fonts', () => ({
    getFontBuffers: vi.fn(() => []),
}));

describe('commands/index exports', () => {
    it('exports all command handlers', async () => {
        const commands = await import('./index.js');

        expect(commands.handleHarmonyCommand).toBeDefined();
        expect(typeof commands.handleHarmonyCommand).toBe('function');

        expect(commands.getHarmonyTypeChoices).toBeDefined();
        expect(typeof commands.getHarmonyTypeChoices).toBe('function');

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
        expect(commands.handleMixerCommand).toBeDefined();
        expect(typeof commands.handleMixerCommand).toBe('function');

        expect(commands.handleMatchCommand).toBeDefined();
        expect(typeof commands.handleMatchCommand).toBe('function');

        expect(commands.handleMatchImageCommand).toBeDefined();
        expect(typeof commands.handleMatchImageCommand).toBe('function');

        expect(commands.handleAccessibilityCommand).toBeDefined();
        expect(typeof commands.handleAccessibilityCommand).toBe('function');

        expect(commands.handleManualCommand).toBeDefined();
        expect(typeof commands.handleManualCommand).toBe('function');

        expect(commands.handleComparisonCommand).toBeDefined();
        expect(typeof commands.handleComparisonCommand).toBe('function');

        expect(commands.handleLanguageCommand).toBeDefined();
        expect(typeof commands.handleLanguageCommand).toBe('function');

        expect(commands.handleFavoritesCommand).toBeDefined();
        expect(typeof commands.handleFavoritesCommand).toBe('function');

        expect(commands.handleCollectionCommand).toBeDefined();
        expect(typeof commands.handleCollectionCommand).toBe('function');

        expect(commands.handlePresetCommand).toBeDefined();
        expect(typeof commands.handlePresetCommand).toBe('function');
    });
});
