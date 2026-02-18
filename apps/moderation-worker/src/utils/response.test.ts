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
    expect(body.data).toEqual({});
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

describe('embedResponse', () => {
  it('should create embed response without components', async () => {
    const embed: DiscordEmbed = {
      title: 'Test',
      description: 'Description',
      color: 0x00ff00,
    };

    const response = embedResponse(embed);
    const body = await response.json() as any;

    expect(body.data.embeds).toHaveLength(1);
    expect(body.data.embeds[0]).toEqual(embed);
    expect(body.data.components).toBeUndefined();
  });

  it('should create embed response with components', async () => {
    const embed: DiscordEmbed = {
      title: 'Test',
      description: 'Description',
    };

    const button: DiscordButton = {
      type: 2,
      style: 1,
      label: 'Button',
      custom_id: 'btn',
    };

    const actionRow: DiscordActionRow = {
      type: 1,
      components: [button],
    };

    const response = embedResponse(embed, [actionRow]);
    const body = await response.json() as any;

    expect(body.data.embeds).toHaveLength(1);
    expect(body.data.components).toHaveLength(1);
    expect(body.data.components[0].components[0].label).toBe('Button');
  });

  it('should handle embed with all optional fields', async () => {
    const embed: DiscordEmbed = {
      title: 'Title',
      description: 'Description',
      color: 0xff0000,
      fields: [
        { name: 'Field 1', value: 'Value 1', inline: true },
        { name: 'Field 2', value: 'Value 2', inline: false },
      ],
      footer: {
        text: 'Footer text',
        icon_url: 'https://example.com/icon.png',
      },
      image: {
        url: 'https://example.com/image.png',
      },
      thumbnail: {
        url: 'https://example.com/thumb.png',
      },
      author: {
        name: 'Author Name',
        icon_url: 'https://example.com/author.png',
        url: 'https://example.com/author',
      },
      timestamp: '2025-01-15T12:00:00Z',
    };

    const response = embedResponse(embed);
    const body = await response.json() as any;

    expect(body.data.embeds[0]).toEqual(embed);
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

describe('autocompleteResponse', () => {
  it('should create autocomplete response with choices', async () => {
    const choices = [
      { name: 'Option 1', value: 'opt1' },
      { name: 'Option 2', value: 'opt2' },
      { name: 'Option 3', value: 'opt3' },
    ];

    const response = autocompleteResponse(choices);
    const body = await response.json() as any;

    expect(body.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
    expect(body.data.choices).toEqual(choices);
    expect(body.data.choices).toHaveLength(3);
  });

  it('should handle empty choices array', async () => {
    const response = autocompleteResponse([]);
    const body = await response.json() as any;

    expect(body.data.choices).toEqual([]);
  });

  it('should handle single choice', async () => {
    const choices = [{ name: 'Only Option', value: 'only' }];

    const response = autocompleteResponse(choices);
    const body = await response.json() as any;

    expect(body.data.choices).toHaveLength(1);
    expect(body.data.choices[0].name).toBe('Only Option');
  });

  it('should handle choices with special characters', async () => {
    const choices = [
      { name: 'Option with "quotes"', value: 'quotes' },
      { name: 'Option with <html>', value: 'html' },
    ];

    const response = autocompleteResponse(choices);
    const body = await response.json() as any;

    expect(body.data.choices[0].name).toBe('Option with "quotes"');
    expect(body.data.choices[1].name).toBe('Option with <html>');
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

describe('infoEmbed', () => {
  it('should create info embed with Discord blurple color', () => {
    const embed = infoEmbed('Info Title', 'Info description');

    expect(embed.title).toBe('ℹ️ Info Title');
    expect(embed.description).toBe('Info description');
    expect(embed.color).toBe(0x5865f2); // Discord blurple
  });

  it('should prepend info emoji to title', () => {
    const embed = infoEmbed('Notice', 'Please read this');

    expect(embed.title).toContain('ℹ️');
    expect(embed.title).toContain('Notice');
  });

  it('should handle multiline descriptions', () => {
    const multiline = 'Line 1\nLine 2\nLine 3';
    const embed = infoEmbed('Info', multiline);

    expect(embed.description).toBe(multiline);
  });
});

describe('hexToDiscordColor', () => {
  it('should convert hex string with hash to number', () => {
    const color = hexToDiscordColor('#ff0000');
    expect(color).toBe(0xff0000);
  });

  it('should convert hex string without hash to number', () => {
    const color = hexToDiscordColor('00ff00');
    expect(color).toBe(0x00ff00);
  });

  it('should handle lowercase hex', () => {
    const color = hexToDiscordColor('#abcdef');
    expect(color).toBe(0xabcdef);
  });

  it('should handle uppercase hex', () => {
    const color = hexToDiscordColor('#ABCDEF');
    expect(color).toBe(0xabcdef);
  });

  it('should handle mixed case hex', () => {
    const color = hexToDiscordColor('#AbCdEf');
    expect(color).toBe(0xabcdef);
  });

  it('should handle black color', () => {
    const color = hexToDiscordColor('#000000');
    expect(color).toBe(0x000000);
  });

  it('should handle white color', () => {
    const color = hexToDiscordColor('#ffffff');
    expect(color).toBe(0xffffff);
  });

  it('should handle Discord blurple', () => {
    const color = hexToDiscordColor('#5865f2');
    expect(color).toBe(0x5865f2);
  });

  it('should handle short hex codes', () => {
    const color = hexToDiscordColor('#fff');
    expect(color).toBe(0xfff);
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
