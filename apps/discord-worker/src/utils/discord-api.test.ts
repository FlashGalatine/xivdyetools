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
    InteractionContext,
    createInteractionContext,
    sendFollowUpWithDeadline,
    editOriginalResponseWithDeadline,
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

    // ========================================================================
    // InteractionContext Tests
    // ========================================================================

    describe('InteractionContext', () => {
        describe('constructor', () => {
            it('should initialize with applicationId and interactionToken', () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken);

                expect(context.applicationId).toBe(mockApplicationId);
                expect(context.interactionToken).toBe(mockInteractionToken);
            });

            it('should use default deadline of 2800ms', () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken);

                // Initially, should not be past deadline
                expect(context.isDeadlineExceeded).toBe(false);
            });

            it('should accept custom deadline', () => {
                // Create with very short deadline (1ms)
                const context = new InteractionContext(mockApplicationId, mockInteractionToken, 1);

                // Wait a bit and check if deadline is exceeded
                // Since startTime is captured at construction, a 1ms deadline should pass quickly
                expect(context.remainingMs).toBeLessThanOrEqual(1);
            });
        });

        describe('elapsedMs', () => {
            it('should return elapsed time since context creation', async () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken);

                // Small delay to ensure some time has passed
                await new Promise((resolve) => setTimeout(resolve, 10));

                // Use a lower bound of 5ms to account for timer imprecision on CI runners
                expect(context.elapsedMs).toBeGreaterThanOrEqual(5);
            });
        });

        describe('remainingMs', () => {
            it('should return positive remaining time before deadline', () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken);

                expect(context.remainingMs).toBeGreaterThan(0);
                expect(context.remainingMs).toBeLessThanOrEqual(2800);
            });

            it('should return 0 when deadline is exceeded', async () => {
                // Create with very short deadline
                const context = new InteractionContext(mockApplicationId, mockInteractionToken, 1);

                // Wait for deadline to pass
                await new Promise((resolve) => setTimeout(resolve, 5));

                expect(context.remainingMs).toBe(0);
            });
        });

        describe('isDeadlineExceeded', () => {
            it('should return false before deadline', () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken);

                expect(context.isDeadlineExceeded).toBe(false);
            });

            it('should return true after deadline', async () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken, 1);

                // Wait for deadline to pass
                await new Promise((resolve) => setTimeout(resolve, 5));

                expect(context.isDeadlineExceeded).toBe(true);
            });
        });

        describe('logDeadlineStatus', () => {
            it('should not log when deadline is not exceeded', () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken);
                const mockLogger = { warn: vi.fn() };

                context.logDeadlineStatus('test operation', mockLogger as never);

                expect(mockLogger.warn).not.toHaveBeenCalled();
            });

            it('should log warning when deadline is exceeded with logger', async () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken, 1);
                const mockLogger = { warn: vi.fn() };

                // Wait for deadline to pass
                await new Promise((resolve) => setTimeout(resolve, 5));

                context.logDeadlineStatus('test operation', mockLogger as never);

                expect(mockLogger.warn).toHaveBeenCalled();
                expect(mockLogger.warn.mock.calls[0][0]).toContain('DISCORD-PERF-001');
                expect(mockLogger.warn.mock.calls[0][0]).toContain('test operation');
            });

            it('should not log when deadline exceeded but no logger provided', async () => {
                const context = new InteractionContext(mockApplicationId, mockInteractionToken, 1);

                // Wait for deadline to pass
                await new Promise((resolve) => setTimeout(resolve, 5));

                // Should not throw
                expect(() => context.logDeadlineStatus('test operation')).not.toThrow();
            });
        });
    });

    describe('createInteractionContext', () => {
        it('should create an InteractionContext instance', () => {
            const context = createInteractionContext(mockApplicationId, mockInteractionToken);

            expect(context).toBeInstanceOf(InteractionContext);
            expect(context.applicationId).toBe(mockApplicationId);
            expect(context.interactionToken).toBe(mockInteractionToken);
        });
    });

    // ========================================================================
    // Deadline-Aware Helper Tests
    // ========================================================================

    describe('sendFollowUpWithDeadline', () => {
        it('should send follow-up when deadline not exceeded', async () => {
            const context = new InteractionContext(mockApplicationId, mockInteractionToken);
            const options: FollowUpOptions = { content: 'Hello' };

            const result = await sendFollowUpWithDeadline(context, options);

            expect(result.sent).toBe(true);
            expect(result.deadlineExceeded).toBe(false);
            expect(result.response).toBeDefined();
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should not send follow-up when deadline is exceeded', async () => {
            const context = new InteractionContext(mockApplicationId, mockInteractionToken, 1);

            // Wait for deadline to pass
            await new Promise((resolve) => setTimeout(resolve, 5));

            const options: FollowUpOptions = { content: 'Hello' };
            const result = await sendFollowUpWithDeadline(context, options);

            expect(result.sent).toBe(false);
            expect(result.deadlineExceeded).toBe(true);
            expect(result.response).toBeUndefined();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should include elapsed time in result', async () => {
            const context = new InteractionContext(mockApplicationId, mockInteractionToken);
            const options: FollowUpOptions = { content: 'Hello' };

            const result = await sendFollowUpWithDeadline(context, options);

            expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('editOriginalResponseWithDeadline', () => {
        it('should edit response when deadline not exceeded', async () => {
            const context = new InteractionContext(mockApplicationId, mockInteractionToken);
            const options: FollowUpOptions = { content: 'Updated' };

            const result = await editOriginalResponseWithDeadline(context, options);

            expect(result.sent).toBe(true);
            expect(result.deadlineExceeded).toBe(false);
            expect(result.response).toBeDefined();
            expect(mockFetch).toHaveBeenCalled();
        });

        it('should not edit response when deadline is exceeded', async () => {
            const context = new InteractionContext(mockApplicationId, mockInteractionToken, 1);

            // Wait for deadline to pass
            await new Promise((resolve) => setTimeout(resolve, 5));

            const options: FollowUpOptions = { content: 'Updated' };
            const result = await editOriginalResponseWithDeadline(context, options);

            expect(result.sent).toBe(false);
            expect(result.deadlineExceeded).toBe(true);
            expect(result.response).toBeUndefined();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should include elapsed time in result', async () => {
            const context = new InteractionContext(mockApplicationId, mockInteractionToken);
            const options: FollowUpOptions = { content: 'Updated' };

            const result = await editOriginalResponseWithDeadline(context, options);

            expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
        });
    });
});
