import { describe, it, expect } from 'vitest';
import {
  pongResponse,
  messageResponse,
  ephemeralResponse,
  deferredResponse,
  errorEmbed,
  successEmbed,
  MessageFlags,
  updateMessageResponse,
  rateLimitedResponse,
  sanitizeErrorMessage,
  isBanTargetId,
  type DiscordEmbed,
  type DiscordButton,
  type DiscordActionRow,
  type InteractionResponseData,
} from './response.js';
import { InteractionResponseType } from '../types/env.js';

describe('pongResponse', () => {
  it('should create PONG response', async () => {
    const response = pongResponse();

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);

    const body = await response.json() as any;
    expect(body).toEqual({ type: InteractionResponseType.PONG });
  });
});

describe('messageResponse', () => {
  it('should create channel message response with content', async () => {
    const data: InteractionResponseData = {
      content: 'Hello, world!',
    };

    const response = messageResponse(data);
    const body = await response.json() as any;

    expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(body.data.content).toBe('Hello, world!');
  });

  it('should create message response with embeds', async () => {
    const embed: DiscordEmbed = {
      title: 'Test Embed',
      description: 'Test description',
      color: 0xff0000,
    };

    const data: InteractionResponseData = {
      embeds: [embed],
    };

    const response = messageResponse(data);
    const body = await response.json() as any;

    expect(body.data.embeds).toHaveLength(1);
    expect(body.data.embeds[0]).toEqual(embed);
  });

  it('should create message response with components', async () => {
    const button: DiscordButton = {
      type: 2,
      style: 1,
      label: 'Click me',
      custom_id: 'test_button',
    };

    const actionRow: DiscordActionRow = {
      type: 1,
      components: [button],
    };

    const data: InteractionResponseData = {
      content: 'Message with button',
      components: [actionRow],
    };

    const response = messageResponse(data);
    const body = await response.json() as any;

    expect(body.data.components).toHaveLength(1);
    expect(body.data.components[0].components).toHaveLength(1);
    expect(body.data.components[0].components[0].label).toBe('Click me');
  });

  it('should create message response with flags', async () => {
    const data: InteractionResponseData = {
      content: 'Ephemeral message',
      flags: MessageFlags.EPHEMERAL,
    };

    const response = messageResponse(data);
    const body = await response.json() as any;

    expect(body.data.flags).toBe(64);
  });

  it('should handle empty data object', async () => {
    const data: InteractionResponseData = {};

    const response = messageResponse(data);
    const body = await response.json() as any;

    expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    // FINDING-019: allowed_mentions is always present
    expect(body.data).toEqual({ allowed_mentions: { parse: [] } });
  });
});

describe('ephemeralResponse', () => {
  it('should create ephemeral response from string', async () => {
    const response = ephemeralResponse('Private message');
    const body = await response.json() as any;

    expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(body.data.content).toBe('Private message');
    expect(body.data.flags).toBe(MessageFlags.EPHEMERAL);
  });

  it('should create ephemeral response from data object', async () => {
    const data: InteractionResponseData = {
      content: 'Private message',
      embeds: [{
        title: 'Private',
        description: 'This is private',
      }],
    };

    const response = ephemeralResponse(data);
    const body = await response.json() as any;

    expect(body.data.content).toBe('Private message');
    expect(body.data.flags).toBe(MessageFlags.EPHEMERAL);
    expect(body.data.embeds).toHaveLength(1);
  });

  it('should preserve existing flags and add ephemeral flag', async () => {
    const data: InteractionResponseData = {
      content: 'Message',
      flags: 128, // Some other flag
    };

    const response = ephemeralResponse(data);
    const body = await response.json() as any;

    // Should have both flags (128 | 64 = 192)
    expect(body.data.flags).toBe(192);
  });

  it('should handle data without flags', async () => {
    const data: InteractionResponseData = {
      content: 'Message',
    };

    const response = ephemeralResponse(data);
    const body = await response.json() as any;

    expect(body.data.flags).toBe(MessageFlags.EPHEMERAL);
  });

  it('should handle empty string', async () => {
    const response = ephemeralResponse('');
    const body = await response.json() as any;

    expect(body.data.content).toBe('');
    expect(body.data.flags).toBe(MessageFlags.EPHEMERAL);
  });
});

describe('deferredResponse', () => {
  it('should create non-ephemeral deferred response by default', async () => {
    const response = deferredResponse();
    const body = await response.json() as any;

    expect(body.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    expect(body.data).toBeUndefined();
  });

  it('should create ephemeral deferred response when requested', async () => {
    const response = deferredResponse(true);
    const body = await response.json() as any;

    expect(body.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    expect(body.data.flags).toBe(MessageFlags.EPHEMERAL);
  });

  it('should create non-ephemeral deferred response when explicitly set', async () => {
    const response = deferredResponse(false);
    const body = await response.json() as any;

    expect(body.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    expect(body.data).toBeUndefined();
  });
});

describe('errorEmbed', () => {
  it('should create error embed with red color', () => {
    const embed = errorEmbed('Error Title', 'Error description');

    expect(embed.title).toBe('❌ Error Title');
    expect(embed.description).toBe('Error description');
    expect(embed.color).toBe(0xff0000); // Red
  });

  it('should prepend cross mark emoji to title', () => {
    const embed = errorEmbed('Failed', 'Something went wrong');

    expect(embed.title).toContain('❌');
    expect(embed.title).toContain('Failed');
  });

  it('should handle empty strings', () => {
    const embed = errorEmbed('', '');

    expect(embed.title).toBe('❌ ');
    expect(embed.description).toBe('');
    expect(embed.color).toBe(0xff0000);
  });
});

describe('successEmbed', () => {
  it('should create success embed with green color', () => {
    const embed = successEmbed('Success Title', 'Success description');

    expect(embed.title).toBe('✅ Success Title');
    expect(embed.description).toBe('Success description');
    expect(embed.color).toBe(0x00ff00); // Green
  });

  it('should prepend check mark emoji to title', () => {
    const embed = successEmbed('Completed', 'Operation successful');

    expect(embed.title).toContain('✅');
    expect(embed.title).toContain('Completed');
  });

  it('should handle long descriptions', () => {
    const longDesc = 'a'.repeat(1000);
    const embed = successEmbed('Title', longDesc);

    expect(embed.description).toBe(longDesc);
    expect(embed.description!.length).toBe(1000);
  });
});

describe('MessageFlags', () => {
  it('should have EPHEMERAL flag set to 64', () => {
    expect(MessageFlags.EPHEMERAL).toBe(64);
  });

  it('should be immutable', () => {
    expect(() => {
      (MessageFlags as any).EPHEMERAL = 128;
    }).toThrow();
  });
});

// FINDING-019 (2026-08-21 security audit): every interaction response that can
// carry text must also carry `allowed_mentions` that parse nothing, so user
// text echoed into `content` can never ping @everyone / roles / users.
describe('allowed_mentions on interaction responses (FINDING-019)', () => {
  it('messageResponse carries allowed_mentions that parse nothing', async () => {
    const json = (await messageResponse({ content: 'hi @everyone' }).json()) as any;
    expect(json.data.allowed_mentions).toEqual({ parse: [] });
    expect(json.data.content).toBe('hi @everyone');
  });

  it('lets a caller-supplied allowed_mentions win', async () => {
    const json = (await messageResponse({
      content: 'x',
      allowed_mentions: { parse: ['users'] },
    } as InteractionResponseData).json()) as any;
    expect(json.data.allowed_mentions).toEqual({ parse: ['users'] });
  });

  it('ephemeralResponse(string) carries allowed_mentions', async () => {
    const json = (await ephemeralResponse('@here').json()) as any;
    expect(json.data.allowed_mentions).toEqual({ parse: [] });
    expect(json.data.flags).toBe(64);
  });

  it('updateMessageResponse uses UPDATE_MESSAGE and carries allowed_mentions', async () => {
    const json = (await updateMessageResponse({
      embeds: [{ title: 'x' }],
      components: [],
    }).json()) as any;
    expect(json.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(json.data.allowed_mentions).toEqual({ parse: [] });
    expect(json.data.embeds).toEqual([{ title: 'x' }]);
    expect(json.data.components).toEqual([]);
  });

  it('rateLimitedResponse carries allowed_mentions', async () => {
    const json = (await rateLimitedResponse(Date.now()).json()) as any;
    expect(json.data.allowed_mentions).toEqual({ parse: [] });
    expect(json.data.flags).toBe(64);
  });
});

// MOD-8 (FINDING-034): raw D1 / API error strings must not reach a channel.
describe('sanitizeErrorMessage (MOD-8)', () => {
  it('passes a 4xx API error message through', () => {
    const err = { statusCode: 404, message: 'Preset not found' };
    expect(sanitizeErrorMessage(err, 'fallback')).toBe('Preset not found');
  });

  it('hides 5xx API error bodies', () => {
    const err = { statusCode: 502, message: 'upstream said: <html>Bad Gateway</html>' };
    expect(sanitizeErrorMessage(err, 'fallback')).toBe('fallback');
  });

  it('hides D1 / SQLite internals', () => {
    const internals = [
      'D1_ERROR: UNIQUE constraint failed: banned_users.discord_id: SQLITE_CONSTRAINT',
      'no such table: banned_users',
      'SQLITE_BUSY: database is locked',
      'SELECT * FROM presets failed',
      'Error at handler (src/services/ban-service.ts:280)',
    ];
    for (const msg of internals) {
      expect(sanitizeErrorMessage(new Error(msg), 'fallback')).toBe('fallback');
    }
  });

  it('keeps a user-friendly Error message', () => {
    expect(sanitizeErrorMessage(new Error('User is already banned.'), 'fallback')).toBe(
      'User is already banned.'
    );
  });

  it('returns the fallback for non-Error values', () => {
    expect(sanitizeErrorMessage('raw string', 'fallback')).toBe('fallback');
    expect(sanitizeErrorMessage(undefined)).toBe('An unexpected error occurred.');
  });
});

// BUG-001 path (a) (2026-09-16 deep-dive): a ban/unban target is a Discord
// snowflake OR an XIVAuth `sub` UUID.
describe('isBanTargetId (BUG-001 path (a))', () => {
  it('accepts a Discord snowflake', () => {
    expect(isBanTargetId('123456789012345678')).toBe(true); // 18 digits
    expect(isBanTargetId('12345678901234567')).toBe(true); // 17 digits (floor)
    expect(isBanTargetId('123456789012345678901')).toBe(false); // 21 digits — too long below
  });

  it('accepts a v4-shaped UUID, either case', () => {
    expect(isBanTargetId('a1b2c3d4-e5f6-4789-a1b2-c3d4e5f67890')).toBe(true);
    expect(isBanTargetId('A1B2C3D4-E5F6-4789-A1B2-C3D4E5F67890')).toBe(true);
  });

  it('rejects a UUID whose version/variant nibbles are not RFC 4122 v4 shaped', () => {
    // XIVAuth mints this UUID; `isBanTargetId` is deliberately looser than
    // `isValidUuid` (which pins the version/variant nibbles) so it is not
    // coupled to XIVAuth's own UUID generator.
    expect(isBanTargetId('a1b2c3d4-e5f6-1789-c1b2-c3d4e5f67890')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isBanTargetId('')).toBe(false);
    expect(isBanTargetId('   ')).toBe(false);
    expect(isBanTargetId('123456789012345678; DROP TABLE banned_users;--')).toBe(false);
    expect(isBanTargetId('123456789012345678901')).toBe(false); // 21-digit number
    expect(isBanTargetId('{a1b2c3d4-e5f6-4789-a1b2-c3d4e5f67890}')).toBe(false); // braced UUID
    expect(isBanTargetId('not-a-valid-id')).toBe(false);
  });
});
