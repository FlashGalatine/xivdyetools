/**
 * Tests for /about command handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleAboutCommand } from './about.js';
import type { Env, DiscordInteraction, InteractionResponseBody } from '../../types/env.js';

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
        'about.categories.userData': 'Your Data',
        'about.categories.community': 'Community',
        'about.categories.utility': 'Utility',
        // Command descriptions
        'about.cmd.harmony': 'Generate color harmonies',
        'about.cmd.match': 'Find closest FFXIV dye',
        'about.cmd.matchImage': 'Extract colors from an image',
        'about.cmd.mixer': 'Create color gradients between two colors',
        'about.cmd.dyeSearch': 'Search dyes by name',
        'about.cmd.dyeInfo': 'Get detailed dye information',
        'about.cmd.dyeList': 'List dyes by category',
        'about.cmd.dyeRandom': 'Get random dye suggestions',
        'about.cmd.comparison': 'Compare 2-4 dyes side by side',
        'about.cmd.accessibility': 'Colorblindness simulation & contrast',
        'about.cmd.favorites': 'Manage your favorite dyes',
        'about.cmd.collection': 'Create custom dye collections',
        'about.cmd.preset': 'Browse, submit & vote on community presets',
        'about.cmd.language': 'Set your preferred language',
        'about.cmd.manual': 'Show help guide',
        'about.cmd.about': 'Bot information (this command)',
        'about.cmd.stats': 'Usage statistics (authorized only)',
      };
      return translations[key] || key;
    },
    getLocale: () => 'en',
  }),
}));

// Create mock KV namespace
function createMockKV() {
  return {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
  } as unknown as KVNamespace;
}

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
      const commandListField = embed.fields![0];

      // Check all category sections are present
      expect(commandListField.value).toContain('Color Tools');
      expect(commandListField.value).toContain('Dye Database');
      expect(commandListField.value).toContain('Analysis');
      expect(commandListField.value).toContain('Your Data');
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

      const commandListField = data.data!.embeds![0].fields![0];

      // Color Tools
      expect(commandListField.value).toContain('/harmony');
      expect(commandListField.value).toContain('/match');
      expect(commandListField.value).toContain('/match_image');
      expect(commandListField.value).toContain('/mixer');

      // Dye Database
      expect(commandListField.value).toContain('/dye search');
      expect(commandListField.value).toContain('/dye info');
      expect(commandListField.value).toContain('/dye list');
      expect(commandListField.value).toContain('/dye random');

      // Analysis
      expect(commandListField.value).toContain('/comparison');
      expect(commandListField.value).toContain('/accessibility');

      // User Data
      expect(commandListField.value).toContain('/favorites');
      expect(commandListField.value).toContain('/collection');

      // Community
      expect(commandListField.value).toContain('/preset');

      // Utility
      expect(commandListField.value).toContain('/language');
      expect(commandListField.value).toContain('/manual');
      expect(commandListField.value).toContain('/about');
      expect(commandListField.value).toContain('/stats');
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
      // Should show total command count (18 commands based on COMMAND_CATEGORIES)
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

      const linksField = data.data!.embeds![0].fields!.find(
        (f: { name: string }) => f.name.includes('Links')
      );
      expect(linksField).toBeDefined();
      expect(linksField!.value).toContain('Web App');
      expect(linksField!.value).toContain('GitHub');
      expect(linksField!.value).toContain('Invite Bot');
      expect(linksField!.value).toContain('Patreon');
      expect(linksField!.value).toContain('xivdyetools.app');
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

    it('should use blurple embed color', async () => {
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

      // Discord blurple is 0x5865F2
      expect(data.data!.embeds![0].color).toBe(0x5865f2);
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
      expect(createUserTranslator).toHaveBeenCalledWith(
        mockKV,
        'user-123',
        'ja'
      );
    });

    it('should include command descriptions', async () => {
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

      const commandListField = data.data!.embeds![0].fields![0];

      // Check for command descriptions
      expect(commandListField.value).toContain('Generate color harmonies');
      expect(commandListField.value).toContain('Find closest FFXIV dye');
      expect(commandListField.value).toContain('Extract colors from an image');
      expect(commandListField.value).toContain('Search dyes by name');
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

      const commandListField = data.data!.embeds![0].fields![0];

      // Check for category emojis
      expect(commandListField.value).toMatch(/🎨.*Color Tools/);
      expect(commandListField.value).toMatch(/📚.*Dye Database/);
      expect(commandListField.value).toMatch(/🔍.*Analysis/);
      expect(commandListField.value).toMatch(/💾.*Your Data/);
      expect(commandListField.value).toMatch(/🌐.*Community/);
      expect(commandListField.value).toMatch(/⚙️.*Utility/);
    });
  });
});
