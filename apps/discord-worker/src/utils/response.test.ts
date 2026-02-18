/**
 * Tests for Discord response builders
 */
import { describe, it, expect } from 'vitest';
import {
    pongResponse,
    messageResponse,
    ephemeralResponse,
    embedResponse,
    deferredResponse,
    autocompleteResponse,
    errorEmbed,
    successEmbed,
    infoEmbed,
    hexToDiscordColor,
    MessageFlags,
    type DiscordEmbed,
    type DiscordActionRow,
} from './response.js';
import { InteractionResponseType, type InteractionResponseBody } from '../types/env.js';

describe('response.ts', () => {
    describe('pongResponse', () => {
        it('should return a PONG response', async () => {
            const response = pongResponse();
            expect(response).toBeInstanceOf(Response);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body).toEqual({ type: InteractionResponseType.PONG });
        });
    });

    describe('messageResponse', () => {
        it('should return a message response with content', async () => {
            const response = messageResponse({ content: 'Hello world' });
            expect(response).toBeInstanceOf(Response);

            const body = (await response.json()) as InteractionResponseBody;
            expect(body).toEqual({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: 'Hello world' },
            });
        });

        it('should return a message response with embeds', async () => {
            const embed: DiscordEmbed = {
                title: 'Test Title',
                description: 'Test Description',
                color: 0xff0000,
            };

            const response = messageResponse({ embeds: [embed] });
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data!.embeds).toHaveLength(1);
            expect(body.data!.embeds![0]).toEqual(embed);
        });

        it('should return a message response with components', async () => {
            const actionRow: DiscordActionRow = {
                type: 1,
                components: [{
                    type: 2,
                    style: 1,
                    label: 'Click me',
                    custom_id: 'test_button',
                }],
            };

            const response = messageResponse({ components: [actionRow] });
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data!.components).toHaveLength(1);
            expect(body.data!.components![0].components![0].label).toBe('Click me');
        });

        it('should include flags when provided', async () => {
            const response = messageResponse({
                content: 'Ephemeral',
                flags: MessageFlags.EPHEMERAL,
            });

            const body = (await response.json()) as InteractionResponseBody;
            expect(body.data!.flags).toBe(64);
        });
    });

    describe('ephemeralResponse', () => {
        it('should return an ephemeral message', async () => {
            const response = ephemeralResponse('Secret message');
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data!.content).toBe('Secret message');
            expect(body.data!.flags).toBe(MessageFlags.EPHEMERAL);
        });

        it('should accept InteractionResponseData object', async () => {
            const response = ephemeralResponse({
                content: 'Complex message',
                embeds: [{ title: 'Embed Title' }],
            });
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data!.content).toBe('Complex message');
            expect(body.data!.embeds).toHaveLength(1);
            expect(body.data!.embeds![0].title).toBe('Embed Title');
            expect(body.data!.flags).toBe(MessageFlags.EPHEMERAL);
        });

        it('should preserve existing flags when adding ephemeral flag', async () => {
            const response = ephemeralResponse({
                content: 'Message with existing flags',
                flags: 0, // No existing flags
            });
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data!.flags).toBe(MessageFlags.EPHEMERAL);
        });

        it('should combine existing flags with ephemeral using bitwise OR', async () => {
            // Hypothetical existing flag value
            const response = ephemeralResponse({
                content: 'Message',
                flags: 128, // Some other flag
            });
            const body = (await response.json()) as InteractionResponseBody;

            // Should have both the ephemeral flag (64) and the original flag (128)
            expect(body.data!.flags).toBe(128 | MessageFlags.EPHEMERAL);
        });
    });

    describe('embedResponse', () => {
        it('should return a response with embed only', async () => {
            const embed: DiscordEmbed = {
                title: 'Embed Title',
                description: 'Embed Description',
            };

            const response = embedResponse(embed);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data!.embeds).toHaveLength(1);
            expect(body.data!.embeds![0]).toEqual(embed);
            expect(body.data!.components).toBeUndefined();
        });

        it('should return a response with embed and components', async () => {
            const embed: DiscordEmbed = { title: 'Title' };
            const actionRow: DiscordActionRow = {
                type: 1,
                components: [{ type: 2, style: 1, label: 'Button', custom_id: 'btn' }],
            };

            const response = embedResponse(embed, [actionRow]);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data!.embeds).toHaveLength(1);
            expect(body.data!.components).toHaveLength(1);
        });
    });

    describe('deferredResponse', () => {
        it('should return a non-ephemeral deferred response by default', async () => {
            const response = deferredResponse();
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data).toBeUndefined();
        });

        it('should return an ephemeral deferred response when specified', async () => {
            const response = deferredResponse(true);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
            expect(body.data!.flags).toBe(MessageFlags.EPHEMERAL);
        });
    });

    describe('autocompleteResponse', () => {
        it('should return autocomplete choices', async () => {
            const choices = [
                { name: 'Option 1', value: 'opt1' },
                { name: 'Option 2', value: 'opt2' },
            ];

            const response = autocompleteResponse(choices);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
            expect(body.data!.choices).toEqual(choices);
        });

        it('should handle empty choices', async () => {
            const response = autocompleteResponse([]);
            const body = (await response.json()) as InteractionResponseBody;

            expect(body.data!.choices).toEqual([]);
        });
    });

    describe('errorEmbed', () => {
        it('should create an error embed with red color', () => {
            const embed = errorEmbed('Error Title', 'Something went wrong');

            expect(embed.title).toBe('❌ Error Title');
            expect(embed.description).toBe('Something went wrong');
            expect(embed.color).toBe(0xff0000);
        });
    });

    describe('successEmbed', () => {
        it('should create a success embed with green color', () => {
            const embed = successEmbed('Success!', 'Operation completed');

            expect(embed.title).toBe('✅ Success!');
            expect(embed.description).toBe('Operation completed');
            expect(embed.color).toBe(0x00ff00);
        });
    });

    describe('infoEmbed', () => {
        it('should create an info embed with blurple color', () => {
            const embed = infoEmbed('Info Title', 'Here is some info');

            expect(embed.title).toBe('ℹ️ Info Title');
            expect(embed.description).toBe('Here is some info');
            expect(embed.color).toBe(0x5865f2);
        });
    });

    describe('hexToDiscordColor', () => {
        it('should convert hex with hash to Discord color', () => {
            expect(hexToDiscordColor('#ff0000')).toBe(0xff0000);
            expect(hexToDiscordColor('#00ff00')).toBe(0x00ff00);
            expect(hexToDiscordColor('#0000ff')).toBe(0x0000ff);
        });

        it('should convert hex without hash to Discord color', () => {
            expect(hexToDiscordColor('ff0000')).toBe(0xff0000);
            expect(hexToDiscordColor('ffffff')).toBe(0xffffff);
            expect(hexToDiscordColor('000000')).toBe(0x000000);
        });

        it('should handle lowercase and uppercase hex', () => {
            expect(hexToDiscordColor('#AbCdEf')).toBe(0xabcdef);
            expect(hexToDiscordColor('ABCDEF')).toBe(0xabcdef);
        });
    });

    describe('MessageFlags', () => {
        it('should have EPHEMERAL flag as 64', () => {
            expect(MessageFlags.EPHEMERAL).toBe(64);
        });
    });
});
