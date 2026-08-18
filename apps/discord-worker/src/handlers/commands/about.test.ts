/**
 * Tests for /about command handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAboutCommand } from './about.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';
import { SOCIAL_LINKS } from '@xivdyetools/core';
import { createMockKV } from '@xivdyetools/test-utils/cloudflare';

// Mock dependencies
vi.mock('../../services/bot-i18n.js', () => ({
  createUserTranslator: vi.fn().mockResolvedValue({
    t: (key: string, vars?: Record<string, any>) => {
      const translations: Record<string, string> = {
        'about.title': 'XIV Dye Tools',
        'about.description': 'Your ultimate FFXIV dye companion',
        'about.commands': 'Commands',
        'about.totalCount': `${vars?.count} total`,
        'about.links': 'Links',
        'about.poweredBy': 'Powered by xivdyetools-core',
        // Category names
        'about.categories.colorTools': 'Color Tools',
        'about.categories.dyeDatabase': 'Dye Database',
        'about.categories.analysis': 'Analysis',
        'about.categories.community': 'Community',
        'about.categories.utility': 'Utility',
      };
      return translations[key] || key;
    },
    getLocale: () => 'en',
  }),
}));

describe('about.ts', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: 'test-app-id',
      PRESETS_API_URL: 'https://test-api.example.com',
      INTERNAL_WEBHOOK_SECRET: 'test-secret',
      KV: mockKV,
    } as unknown as Env;

    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

    vi.clearAllMocks();
  });

  describe('handleAboutCommand', () => {
    it('should return bot information embed', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE
      expect(data.data!.embeds).toBeDefined();
      expect(data.data!.embeds!.length).toBe(1);
    });

    it('should include version in title', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const embed = data.data!.embeds![0];
      expect(embed.title).toContain('XIV Dye Tools');
      expect(embed.title).toMatch(/v\d+\.\d+\.\d+/); // Version pattern
    });

    it('should include all command categories', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const embed = data.data!.embeds![0];
      const commandListField = embed.fields!.find((f) => f.value.includes('/harmony'))!;

      // Check all category sections are present
      expect(commandListField.value).toContain('Color Tools');
      expect(commandListField.value).toContain('Dye Database');
      expect(commandListField.value).toContain('Analysis');
      expect(commandListField.value).toContain('Community');
      expect(commandListField.value).toContain('Utility');
    });

    it('should include all commands in the list', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const commandListField = data.data!.embeds![0].fields!.find((f) =>
        f.value.includes('/harmony'),
      )!;

      // 5.0 roster parity: every registered command appears, nothing else
      const { COMMAND_REGISTRY } = await import('../../commands/registry.js');
      for (const entry of COMMAND_REGISTRY) {
        expect(commandListField.value, entry.name).toContain(`/${entry.name}`);
      }

      // The v4 set is deleted from the roster (it lives in the Removed field)
      for (const dead of ['/match_image', '/favorites', '/collection', '/language']) {
        expect(commandListField.value).not.toContain(dead);
      }
    });

    it('carries the Removed-in-v5 field for one release', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const removedField = data.data!.embeds![0].fields!.find((f) =>
        f.name.includes('about.removedTitle'),
      );
      expect(removedField).toBeDefined();
      for (const dead of ['/match', '/match_image', '/favorites', '/collection', '/language']) {
        expect(removedField!.value).toContain(dead);
      }
    });

    it('should include total command count in description', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const embed = data.data!.embeds![0];
      // Total comes from the registry now
      expect(embed.description).toContain('total');
    });

    it('should include links field with all resources', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const linksField = data.data!.embeds![0].fields!.find((f: { name: string }) =>
        f.name.includes('Links'),
      );
      expect(linksField).toBeDefined();
      // The way in — a Discord reader has no other route to the app
      expect(linksField!.value).toContain('Web App');
      expect(linksField!.value).toContain('Invite Bot');
      expect(linksField!.value).toContain('xivdyetools.app');

      // ...then every place we are. Sourced from core so this list and the
      // web app's About modal cannot drift apart.
      for (const { label, url } of SOCIAL_LINKS) {
        expect(linksField!.value, label).toContain(`[${label}](${url})`);
      }
      expect(linksField!.value.length).toBeLessThanOrEqual(1024); // Discord's field cap
    });

    it('should include footer with powered by info', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const embed = data.data!.embeds![0];
      expect(embed.footer).toBeDefined();
      expect(embed.footer!.text).toContain('Powered by');
      expect(embed.footer!.text).toMatch(/v\d+\.\d+\.\d+/);
    });

    it('should include timestamp', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.data!.embeds![0].timestamp).toBeDefined();
      // Should be valid ISO timestamp
      expect(() => new Date(data.data!.embeds![0].timestamp!)).not.toThrow();
    });

    it('uses the product accent, never the platform’s brand', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // The accent bar is the only branding an embed has — #EA4133
      expect(data.data!.embeds![0].color).toBe(0xea4133);
    });

    it('should handle DM interactions with user field', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        user: { id: 'user-123' }, // DM uses user instead of member.user
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      expect(data.type).toBe(4);
      expect(data.data!.embeds![0].title).toContain('XIV Dye Tools');
    });

    it('should handle missing user ID gracefully', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        // No member or user
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      // Should still work, using 'unknown' as userId
      expect(data.type).toBe(4);
      expect(data.data!.embeds![0].title).toBeDefined();
    });

    it('should use locale from interaction', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        locale: 'ja',
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      await handleAboutCommand(interaction, mockEnv, mockCtx);

      // Verify createUserTranslator was called with the correct locale
      const { createUserTranslator } = await import('../../services/bot-i18n.js');
      expect(createUserTranslator).toHaveBeenCalledWith(mockKV, 'user-123', 'ja');
    });

    it('should include category emojis', async () => {
      const interaction: DiscordInteraction = {
        type: 2,
        data: { name: 'about' },
        member: { user: { id: 'user-123' } },
        id: 'int-1',
        application_id: 'app-1',
        token: 'token-1',
      };

      const response = await handleAboutCommand(interaction, mockEnv, mockCtx);
      const data = (await response.json()) as InteractionResponseBody;

      const commandListField = data.data!.embeds![0].fields!.find((f) =>
        f.value.includes('/harmony'),
      )!;

      // Check for category emojis
      expect(commandListField.value).toMatch(/🎨.*Color Tools/);
      expect(commandListField.value).toMatch(/📚.*Dye Database/);
      expect(commandListField.value).toMatch(/🔍.*Analysis/);
      expect(commandListField.value).toMatch(/🌐.*Community/);
      expect(commandListField.value).toMatch(/⚙️.*Utility/);
    });
  });
});
