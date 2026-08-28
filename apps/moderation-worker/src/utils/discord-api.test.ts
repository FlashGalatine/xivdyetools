import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendFollowUp,
  editOriginalResponse,
  deleteOriginalResponse,
  sendMessage,
  editMessage,
  type FollowUpOptions,
  type SendMessageOptions,
} from './discord-api.js';

describe('discord-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const mockApplicationId = 'app-123';
  const mockToken = 'interaction-token-456';
  const mockBotToken = 'Bot.Token.Here';
  const mockChannelId = 'channel-789';

  describe('sendFollowUp', () => {
    it('should send follow-up message with content', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: FollowUpOptions = {
        content: 'Follow-up message',
      };

      await sendFollowUp(mockApplicationId, mockToken, options);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/webhooks/${mockApplicationId}/${mockToken}`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowed_mentions: { parse: [] }, content: 'Follow-up message' }),
        })
      );
    });

    it('should send follow-up with embeds', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const embeds = [{ title: 'Embed Title', description: 'Description', color: 0xff0000 }];
      const options: FollowUpOptions = { embeds };

      await sendFollowUp(mockApplicationId, mockToken, options);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds).toEqual(embeds);
    });

    it('should send follow-up with components', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const components = [
        {
          type: 1,
          components: [{ type: 2, style: 1, label: 'Button', custom_id: 'btn' }],
        },
      ];
      const options: FollowUpOptions = { components: components as any };

      await sendFollowUp(mockApplicationId, mockToken, options);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.components).toEqual(components);
    });

    it('should set ephemeral flag when requested', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: FollowUpOptions = {
        content: 'Private message',
        ephemeral: true,
      };

      await sendFollowUp(mockApplicationId, mockToken, options);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.flags).toBe(64);
    });

    it('should send all options together', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: FollowUpOptions = {
        content: 'Message',
        embeds: [{ title: 'Title' }],
        components: [{ type: 1, components: [] }] as any,
        ephemeral: true,
      };

      await sendFollowUp(mockApplicationId, mockToken, options);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.content).toBe('Message');
      expect(body.embeds).toBeDefined();
      expect(body.components).toBeDefined();
      expect(body.flags).toBe(64);
    });

    it('should construct correct URL', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await sendFollowUp('app-id', 'token', { content: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/webhooks/app-id/token',
        expect.any(Object)
      );
    });
  });

  describe('editOriginalResponse', () => {
    it('should edit original response with content', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: FollowUpOptions = {
        content: 'Updated message',
      };

      await editOriginalResponse(mockApplicationId, mockToken, options);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/webhooks/${mockApplicationId}/${mockToken}/messages/@original`,
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowed_mentions: { parse: [] }, content: 'Updated message' }),
        })
      );
    });

    it('should edit with embeds and components', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: FollowUpOptions = {
        embeds: [{ title: 'Updated' }],
        components: [{ type: 1, components: [] }] as any,
      };

      await editOriginalResponse(mockApplicationId, mockToken, options);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds).toBeDefined();
      expect(body.components).toBeDefined();
    });

    it('should not include ephemeral flag in edit', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: FollowUpOptions = {
        content: 'Edit',
        ephemeral: true, // This should be ignored for edits
      };

      await editOriginalResponse(mockApplicationId, mockToken, options);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.flags).toBeUndefined();
    });

    it('should use PATCH method', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await editOriginalResponse(mockApplicationId, mockToken, { content: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  describe('deleteOriginalResponse', () => {
    it('should delete original response', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('', { status: 200 }))) as any;

      await deleteOriginalResponse(mockApplicationId, mockToken);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/webhooks/${mockApplicationId}/${mockToken}/messages/@original`,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should construct correct URL', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('', { status: 200 }))) as any;

      await deleteOriginalResponse('app-123', 'token-456');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/webhooks/app-123/token-456/messages/@original',
        expect.any(Object)
      );
    });
  });

  describe('sendMessage', () => {
    it('should send message with bot token authentication', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: SendMessageOptions = {
        content: 'Bot message',
      };

      await sendMessage(mockBotToken, mockChannelId, options);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/channels/${mockChannelId}/messages`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${mockBotToken}`,
          },
        })
      );
    });

    it('should send message with content', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await sendMessage(mockBotToken, mockChannelId, { content: 'Hello' });

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.content).toBe('Hello');
    });

    it('should send message with embeds', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const embeds = [{ title: 'Log', description: 'Action logged' }];
      await sendMessage(mockBotToken, mockChannelId, { embeds });

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds).toEqual(embeds);
    });

    it('should include timeout signal', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await sendMessage(mockBotToken, mockChannelId, { content: 'test' });

      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].signal).toBeDefined();
    });

    it('should construct correct channel URL', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await sendMessage(mockBotToken, 'channel-abc', { content: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel-abc/messages',
        expect.any(Object)
      );
    });
  });

  describe('editMessage', () => {
    const mockMessageId = 'message-999';

    it('should edit message with bot token authentication', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: SendMessageOptions = {
        content: 'Updated content',
      };

      await editMessage(mockBotToken, mockChannelId, mockMessageId, options);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/channels/${mockChannelId}/messages/${mockMessageId}`,
        expect.objectContaining({
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${mockBotToken}`,
          },
        })
      );
    });

    it('should edit message content', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await editMessage(mockBotToken, mockChannelId, mockMessageId, {
        content: 'New content',
      });

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.content).toBe('New content');
    });

    it('should edit message embeds and components', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      const options: SendMessageOptions = {
        embeds: [{ title: 'Updated' }],
        components: [{ type: 1, components: [] }] as any,
      };

      await editMessage(mockBotToken, mockChannelId, mockMessageId, options);

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.embeds).toBeDefined();
      expect(body.components).toBeDefined();
    });

    it('should include timeout signal', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await editMessage(mockBotToken, mockChannelId, mockMessageId, { content: 'test' });

      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].signal).toBeDefined();
    });

    it('should use PATCH method', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await editMessage(mockBotToken, mockChannelId, mockMessageId, { content: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should construct correct message URL', async () => {
      global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;

      await editMessage(mockBotToken, 'ch-123', 'msg-456', { content: 'test' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/ch-123/messages/msg-456',
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('should propagate fetch errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

      await expect(sendFollowUp(mockApplicationId, mockToken, { content: 'test' })).rejects.toThrow(
        'Network error'
      );
    });

    it('should return Response even if status is not OK', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve(new Response('{"error": "Unauthorized"}', { status: 401 }))
      ) as any;

      const response = await sendMessage(mockBotToken, mockChannelId, { content: 'test' });

      expect(response.status).toBe(401);
    });
  });
});

// FINDING-019 (2026-08-21 security audit): every outbound Discord payload
// carries `allowed_mentions` that parse nothing unless a caller overrides it.
describe('allowed_mentions on outbound payloads (FINDING-019)', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as any;
  });

  const bodyOfLastCall = (): any => JSON.parse((global.fetch as any).mock.calls[0][1].body);

  it('sendFollowUp sends allowed_mentions: { parse: [] }', async () => {
    await sendFollowUp('app', 'tok', { content: '@everyone hi' });
    expect(bodyOfLastCall().allowed_mentions).toEqual({ parse: [] });
  });

  it('editOriginalResponse sends allowed_mentions: { parse: [] }', async () => {
    await editOriginalResponse('app', 'tok', { embeds: [{ title: 'x' }] });
    expect(bodyOfLastCall().allowed_mentions).toEqual({ parse: [] });
  });

  it('sendMessage sends allowed_mentions: { parse: [] }', async () => {
    await sendMessage('bot', 'chan', { content: '<@&123456789012345678>' });
    expect(bodyOfLastCall().allowed_mentions).toEqual({ parse: [] });
  });

  it('editMessage sends allowed_mentions: { parse: [] }', async () => {
    await editMessage('bot', 'chan', 'msg', { embeds: [] });
    expect(bodyOfLastCall().allowed_mentions).toEqual({ parse: [] });
  });

  it('a caller-supplied allowed_mentions overrides the default', async () => {
    await sendMessage('bot', 'chan', {
      content: 'x',
      allowed_mentions: { parse: ['users'] },
    });
    expect(bodyOfLastCall().allowed_mentions).toEqual({ parse: ['users'] });
  });
});
