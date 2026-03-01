/**
 * Tests for Discord REST API utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    sendFollowUp,
    editOriginalResponse,
    deleteOriginalResponse,
    sendMessage,
    editMessage,
    type FollowUpOptions,
} from './discord-api.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('discord-api.ts', () => {
    const mockApplicationId = '123456789';
    const mockInteractionToken = 'mock-token';
    const mockBotToken = 'mock-bot-token';
    const mockChannelId = '987654321';
    const mockMessageId = '111111111';

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('sendFollowUp', () => {
        it('should send a JSON follow-up without file', async () => {
            const options: FollowUpOptions = {
                content: 'Hello world',
                embeds: [{ title: 'Test' }],
            };

            await sendFollowUp(mockApplicationId, mockInteractionToken, options);

            expect(mockFetch).toHaveBeenCalledWith(
                `https://discord.com/api/v10/webhooks/${mockApplicationId}/${mockInteractionToken}`,
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: expect.any(String),
                })
            );

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.content).toBe('Hello world');
            expect(body.embeds).toHaveLength(1);
        });

        it('should include ephemeral flag when set', async () => {
            const options: FollowUpOptions = {
                content: 'Secret message',
                ephemeral: true,
            };

            await sendFollowUp(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.flags).toBe(64);
        });

        it('should send multipart form data when file is present', async () => {
            const options: FollowUpOptions = {
                content: 'Here is an image',
                file: {
                    name: 'test.png',
                    data: new Uint8Array([1, 2, 3]),
                    contentType: 'image/png',
                },
            };

            await sendFollowUp(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[1].method).toBe('POST');
            expect(callArgs[1].body).toBeInstanceOf(FormData);
        });

        it('should replace image placeholder in embeds with attachment reference', async () => {
            const options: FollowUpOptions = {
                embeds: [{
                    title: 'Image Embed',
                    image: { url: 'attachment://image.png' },
                }],
                file: {
                    name: 'result.png',
                    data: new Uint8Array([1, 2, 3]),
                    contentType: 'image/png',
                },
            };

            await sendFollowUp(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            const formData = callArgs[1].body as FormData;

            // Check that the payload_json has the correct attachment reference
            const payloadJson = formData.get('payload_json');
            expect(payloadJson).toBeTruthy();

            const payload = JSON.parse(payloadJson as string);
            expect(payload.embeds[0].image.url).toBe('attachment://result.png');
        });

        it('should include components in the request', async () => {
            const options: FollowUpOptions = {
                content: 'Click the button',
                components: [{
                    type: 1,
                    components: [{ type: 2, style: 1, label: 'Button', custom_id: 'btn' }],
                }],
            };

            await sendFollowUp(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.components).toHaveLength(1);
        });

        it('should handle empty options', async () => {
            await sendFollowUp(mockApplicationId, mockInteractionToken, {});

            expect(mockFetch).toHaveBeenCalled();
        });

        it('should preserve embed without image placeholder when file is present', async () => {
            const options: FollowUpOptions = {
                embeds: [{
                    title: 'Text Only Embed',
                    description: 'No image here',
                }],
                file: {
                    name: 'result.png',
                    data: new Uint8Array([1, 2, 3]),
                    contentType: 'image/png',
                },
            };

            await sendFollowUp(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            const formData = callArgs[1].body as FormData;
            const payloadJson = formData.get('payload_json');
            const payload = JSON.parse(payloadJson as string);

            // Embed should remain unchanged (no image.url replacement)
            expect(payload.embeds[0].title).toBe('Text Only Embed');
            expect(payload.embeds[0].image).toBeUndefined();
        });

        it('should include embeds without file', async () => {
            // Test the branch where embeds exist but no file (covers line 163-164)
            const options: FollowUpOptions = {
                embeds: [{
                    title: 'No File Embed',
                    description: 'Just text',
                }],
                ephemeral: true,
            };

            await sendFollowUp(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.embeds).toHaveLength(1);
            expect(body.embeds[0].title).toBe('No File Embed');
        });
    });

    describe('editOriginalResponse', () => {
        it('should send a PATCH request to edit the original message', async () => {
            const options: FollowUpOptions = {
                content: 'Updated message',
            };

            await editOriginalResponse(mockApplicationId, mockInteractionToken, options);

            expect(mockFetch).toHaveBeenCalledWith(
                `https://discord.com/api/v10/webhooks/${mockApplicationId}/${mockInteractionToken}/messages/@original`,
                expect.objectContaining({
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        });

        it('should send multipart form data when file is present for edit', async () => {
            const options: FollowUpOptions = {
                embeds: [{ title: 'New image' }],
                file: {
                    name: 'new-image.png',
                    data: new Uint8Array([4, 5, 6]),
                    contentType: 'image/png',
                },
            };

            await editOriginalResponse(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            expect(callArgs[1].method).toBe('PATCH');
            expect(callArgs[1].body).toBeInstanceOf(FormData);
        });

        it('should replace image placeholder in embeds for edit', async () => {
            const options: FollowUpOptions = {
                embeds: [{
                    title: 'Updated',
                    image: { url: 'attachment://image.png' },
                }],
                file: {
                    name: 'updated.png',
                    data: new Uint8Array([7, 8, 9]),
                    contentType: 'image/png',
                },
            };

            await editOriginalResponse(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            const formData = callArgs[1].body as FormData;
            const payloadJson = formData.get('payload_json');
            const payload = JSON.parse(payloadJson as string);

            expect(payload.embeds[0].image.url).toBe('attachment://updated.png');
        });

        it('should preserve embed without image placeholder when file is present', async () => {
            const options: FollowUpOptions = {
                embeds: [{
                    title: 'Text Only Embed',
                    description: 'No image placeholder',
                }],
                file: {
                    name: 'updated.png',
                    data: new Uint8Array([7, 8, 9]),
                    contentType: 'image/png',
                },
            };

            await editOriginalResponse(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            const formData = callArgs[1].body as FormData;
            const payloadJson = formData.get('payload_json');
            const payload = JSON.parse(payloadJson as string);

            // Embed should remain unchanged
            expect(payload.embeds[0].title).toBe('Text Only Embed');
            expect(payload.embeds[0].image).toBeUndefined();
        });

        it('should handle embeds without file for edit (else branch)', async () => {
            // This test specifically targets the else branch at lines 249-250
            // where we have embeds but no file in the multipart path
            // Note: This won't hit that branch directly since we need a file to enter
            // the multipart code path. The JSON path handles embeds without file.
            const options: FollowUpOptions = {
                embeds: [{
                    title: 'JSON Only Edit',
                    description: 'No file attached',
                }],
            };

            await editOriginalResponse(mockApplicationId, mockInteractionToken, options);

            const callArgs = mockFetch.mock.calls[0];
            // This should be JSON, not FormData
            expect(callArgs[1].headers['Content-Type']).toBe('application/json');
            const body = JSON.parse(callArgs[1].body);
            expect(body.embeds).toHaveLength(1);
        });
    });

    describe('deleteOriginalResponse', () => {
        it('should send a DELETE request to remove the original message', async () => {
            await deleteOriginalResponse(mockApplicationId, mockInteractionToken);

            expect(mockFetch).toHaveBeenCalledWith(
                `https://discord.com/api/v10/webhooks/${mockApplicationId}/${mockInteractionToken}/messages/@original`,
                expect.objectContaining({ method: 'DELETE' })
            );
        });
    });

    describe('sendMessage', () => {
        it('should send a POST request with bot authorization', async () => {
            await sendMessage(mockBotToken, mockChannelId, {
                content: 'Bot message',
            });

            expect(mockFetch).toHaveBeenCalledWith(
                `https://discord.com/api/v10/channels/${mockChannelId}/messages`,
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bot ${mockBotToken}`,
                    },
                })
            );

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.content).toBe('Bot message');
        });

        it('should include embeds and components', async () => {
            await sendMessage(mockBotToken, mockChannelId, {
                embeds: [{ title: 'Embed' }],
                components: [{
                    type: 1,
                    components: [{ type: 2, style: 1, label: 'Btn', custom_id: 'b' }],
                }],
            });

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.embeds).toHaveLength(1);
            expect(body.components).toHaveLength(1);
        });
    });

    describe('editMessage', () => {
        it('should send a PATCH request with bot authorization', async () => {
            await editMessage(mockBotToken, mockChannelId, mockMessageId, {
                content: 'Edited message',
            });

            expect(mockFetch).toHaveBeenCalledWith(
                `https://discord.com/api/v10/channels/${mockChannelId}/messages/${mockMessageId}`,
                expect.objectContaining({
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bot ${mockBotToken}`,
                    },
                })
            );

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.content).toBe('Edited message');
        });

        it('should update embeds and components', async () => {
            await editMessage(mockBotToken, mockChannelId, mockMessageId, {
                embeds: [{ title: 'Updated Embed' }],
                components: [],
            });

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.embeds).toHaveLength(1);
            expect(body.embeds[0].title).toBe('Updated Embed');
        });
    });

});
