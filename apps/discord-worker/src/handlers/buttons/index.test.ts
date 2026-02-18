/**
 * Tests for Button Handlers Index
 *
 * Note: Moderation buttons (preset approve/reject/revert, ban confirm/cancel)
 * are now handled by xivdyetools-moderation-worker.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleButtonInteraction } from './index.js';

// Mock the individual button handlers
vi.mock('./copy.js', () => ({
    handleCopyHex: vi.fn(() => new Response(JSON.stringify({ type: 4, data: { content: 'hex copied' } }))),
    handleCopyRgb: vi.fn(() => new Response(JSON.stringify({ type: 4, data: { content: 'rgb copied' } }))),
    handleCopyHsv: vi.fn(() => new Response(JSON.stringify({ type: 4, data: { content: 'hsv copied' } }))),
    createCopyButtons: vi.fn(),
    createHexButton: vi.fn(),
}));

import { handleCopyHex, handleCopyRgb, handleCopyHsv } from './copy.js';

interface InteractionResponseBody {
    type: number;
    data?: {
        content?: string;
        flags?: number;
    };
}

describe('buttons/index.ts', () => {
    const mockEnv = {} as any;
    const mockCtx = {} as ExecutionContext;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleButtonInteraction', () => {
        it('should route copy_hex_ buttons to handleCopyHex', async () => {
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
                data: { custom_id: 'copy_hex_FF5733' },
            };

            const response = await handleButtonInteraction(interaction, mockEnv, mockCtx);

            expect(handleCopyHex).toHaveBeenCalledWith(interaction);
            expect(response).toBeInstanceOf(Response);
        });

        it('should route copy_rgb_ buttons to handleCopyRgb', async () => {
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
                data: { custom_id: 'copy_rgb_255_87_51' },
            };

            await handleButtonInteraction(interaction, mockEnv, mockCtx);

            expect(handleCopyRgb).toHaveBeenCalledWith(interaction);
        });

        it('should route copy_hsv_ buttons to handleCopyHsv', async () => {
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
                data: { custom_id: 'copy_hsv_11_80_100' },
            };

            await handleButtonInteraction(interaction, mockEnv, mockCtx);

            expect(handleCopyHsv).toHaveBeenCalledWith(interaction);
        });

        it('should return ephemeral message for unknown buttons', async () => {
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
                data: { custom_id: 'unknown_button_id' },
            };

            const response = await handleButtonInteraction(interaction, mockEnv, mockCtx);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data?.content).toBe('This button is not recognized.');
            expect(body.data?.flags).toBe(64);
        });

        it('should handle empty custom_id gracefully', async () => {
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
                data: { custom_id: '' },
            };

            const response = await handleButtonInteraction(interaction, mockEnv, mockCtx);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data?.content).toBe('This button is not recognized.');
        });

        it('should handle missing data gracefully', async () => {
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
            };

            const response = await handleButtonInteraction(interaction, mockEnv, mockCtx);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data?.content).toBe('This button is not recognized.');
        });

        it('should log info when logger is provided', async () => {
            const mockLogger = { info: vi.fn(), warn: vi.fn() };
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
                data: { custom_id: 'copy_hex_FF5733' },
            };

            await handleButtonInteraction(interaction, mockEnv, mockCtx, mockLogger as any);

            expect(mockLogger.info).toHaveBeenCalledWith('Handling button', { customId: 'copy_hex_FF5733' });
        });

        it('should log warning for unknown buttons when logger is provided', async () => {
            const mockLogger = { info: vi.fn(), warn: vi.fn() };
            const interaction = {
                id: '123',
                token: 'token',
                application_id: 'app_id',
                data: { custom_id: 'totally_unknown_button' },
            };

            await handleButtonInteraction(interaction, mockEnv, mockCtx, mockLogger as any);

            expect(mockLogger.warn).toHaveBeenCalledWith('Unknown button custom_id: totally_unknown_button');
        });
    });
});
