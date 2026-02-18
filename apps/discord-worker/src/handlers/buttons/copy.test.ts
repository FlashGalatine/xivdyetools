/**
 * Tests for Copy Button Handlers
 */
import { describe, it, expect } from 'vitest';
import {
    handleCopyHex,
    handleCopyRgb,
    handleCopyHsv,
    createCopyButtons,
    createHexButton,
} from './copy.js';
import { InteractionResponseType, type InteractionResponseBody } from '../../types/env.js';

describe('copy.ts', () => {
    describe('handleCopyHex', () => {
        it('should return formatted hex code with hash prefix', async () => {
            const interaction = { data: { custom_id: 'copy_hex_FF5733' } };
            const response = handleCopyHex(interaction);

            expect(response).toBeInstanceOf(Response);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data!.content).toContain('#FF5733');
            expect(body.data!.flags).toBe(64); // Ephemeral
        });

        it('should handle hex code that already has hash prefix', async () => {
            const interaction = { data: { custom_id: 'copy_hex_#aabbcc' } };
            const response = handleCopyHex(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toContain('#AABBCC');
        });

        it('should handle lowercase hex codes', async () => {
            const interaction = { data: { custom_id: 'copy_hex_abc123' } };
            const response = handleCopyHex(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toContain('#ABC123');
        });

        it('should handle empty custom_id gracefully', async () => {
            const interaction = { data: { custom_id: '' } };
            const response = handleCopyHex(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toBeDefined();
        });

        it('should handle missing data gracefully', async () => {
            const interaction = {};
            const response = handleCopyHex(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            // With no custom_id, the hex extracted is 'copy_hex_' replaced with '', leaving '#'
            expect(body.data!.content).toBeDefined();
        });

        it('should handle undefined custom_id gracefully', async () => {
            const interaction = { data: {} };
            const response = handleCopyHex(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toBeDefined();
        });
    });

    describe('handleCopyRgb', () => {
        it('should return formatted RGB values', async () => {
            const interaction = { data: { custom_id: 'copy_rgb_255_87_51' } };
            const response = handleCopyRgb(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data!.content).toContain('rgb(255, 87, 51)');
            expect(body.data!.content).toContain('255, 87, 51');
            expect(body.data!.flags).toBe(64);
        });

        it('should handle edge case RGB values', async () => {
            const interaction = { data: { custom_id: 'copy_rgb_0_0_0' } };
            const response = handleCopyRgb(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toContain('rgb(0, 0, 0)');
        });

        it('should return error for invalid RGB format', async () => {
            const interaction = { data: { custom_id: 'copy_rgb_255_87' } }; // Missing B
            const response = handleCopyRgb(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toBe('Invalid RGB format.');
            expect(body.data!.flags).toBe(64);
        });

        it('should return error for too many RGB parts', async () => {
            const interaction = { data: { custom_id: 'copy_rgb_255_87_51_100' } };
            const response = handleCopyRgb(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toBe('Invalid RGB format.');
        });

        it('should handle missing data gracefully', async () => {
            const interaction = {};
            const response = handleCopyRgb(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            // With no custom_id, split results in wrong parts count
            expect(body.data!.content).toBe('Invalid RGB format.');
        });

        it('should handle undefined custom_id gracefully', async () => {
            const interaction = { data: {} };
            const response = handleCopyRgb(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toBe('Invalid RGB format.');
        });
    });

    describe('handleCopyHsv', () => {
        it('should return formatted HSV values', async () => {
            const interaction = { data: { custom_id: 'copy_hsv_11_80_100' } };
            const response = handleCopyHsv(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data!.content).toContain('H: 11°, S: 80%, V: 100%');
            expect(body.data!.flags).toBe(64);
        });

        it('should handle zero values', async () => {
            const interaction = { data: { custom_id: 'copy_hsv_0_0_0' } };
            const response = handleCopyHsv(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toContain('H: 0°, S: 0%, V: 0%');
        });

        it('should return error for invalid HSV format', async () => {
            const interaction = { data: { custom_id: 'copy_hsv_11_80' } }; // Missing V
            const response = handleCopyHsv(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toBe('Invalid HSV format.');
            expect(body.data!.flags).toBe(64);
        });

        it('should handle missing data gracefully', async () => {
            const interaction = {};
            const response = handleCopyHsv(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            // With no custom_id, split results in wrong parts count
            expect(body.data!.content).toBe('Invalid HSV format.');
        });

        it('should handle undefined custom_id gracefully', async () => {
            const interaction = { data: {} };
            const response = handleCopyHsv(interaction);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.content).toBe('Invalid HSV format.');
        });
    });

    describe('createCopyButtons', () => {
        it('should create button row with all three copy buttons', () => {
            const row = createCopyButtons(
                'FF5733',
                { r: 255, g: 87, b: 51 },
                { h: 11, s: 80, v: 100 }
            );

            expect(row.type).toBe(1); // ACTION_ROW
            expect(row.components).toHaveLength(3);

            // HEX button
            expect(row.components[0].type).toBe(2);
            expect(row.components[0].style).toBe(2);
            expect(row.components[0].label).toBe('HEX: #FF5733');
            expect(row.components[0].custom_id).toBe('copy_hex_FF5733');

            // RGB button
            expect(row.components[1].label).toBe('RGB: 255, 87, 51');
            expect(row.components[1].custom_id).toBe('copy_rgb_255_87_51');

            // HSV button
            expect(row.components[2].label).toBe('HSV: 11°, 80%, 100%');
            expect(row.components[2].custom_id).toBe('copy_hsv_11_80_100');
        });

        it('should remove hash from hex if present', () => {
            const row = createCopyButtons(
                '#aabbcc',
                { r: 170, g: 187, b: 204 },
                { h: 210, s: 17, v: 80 }
            );

            expect(row.components[0].label).toBe('HEX: #AABBCC');
            expect(row.components[0].custom_id).toBe('copy_hex_aabbcc');
        });
    });

    describe('createHexButton', () => {
        it('should create a single hex copy button', () => {
            const row = createHexButton('FF5733');

            expect(row.type).toBe(1);
            expect(row.components).toHaveLength(1);
            expect(row.components[0].type).toBe(2);
            expect(row.components[0].style).toBe(2);
            expect(row.components[0].label).toBe('Copy: #FF5733');
            expect(row.components[0].custom_id).toBe('copy_hex_FF5733');
        });

        it('should remove hash from hex if present', () => {
            const row = createHexButton('#abc123');

            expect(row.components[0].label).toBe('Copy: #ABC123');
            expect(row.components[0].custom_id).toBe('copy_hex_abc123');
        });
    });
});
