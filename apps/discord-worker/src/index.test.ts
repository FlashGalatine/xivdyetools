/**
 * Tests for the main Hono app and interaction handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from './index.js';
import { InteractionType, InteractionResponseType, type InteractionResponseBody } from './types/env.js';
import type { Env } from './types/env.js';
import type { CommunityPreset } from '@xivdyetools/types/preset';

// Mock dependencies
vi.mock('./utils/verify.js', () => ({
  verifyDiscordRequest: vi.fn(),
  unauthorizedResponse: vi.fn((error: string) => new Response(JSON.stringify({ error }), { status: 401 })),
  badRequestResponse: vi.fn((error: string) => new Response(JSON.stringify({ error }), { status: 400 })),
  timingSafeEqual: vi.fn(),
}));

vi.mock('./handlers/commands/index.js', () => ({
  handleAboutCommand: vi.fn(),
  handleHarmonyCommand: vi.fn(),
  handleDyeCommand: vi.fn(),
  // V4 Commands
  handleExtractorCommand: vi.fn(),
  handleGradientCommand: vi.fn(),
  handlePreferencesCommand: vi.fn(),
  handleMixerV4Command: vi.fn(),
  handleSwatchCommand: vi.fn(),
  // Legacy commands
  handleMixerCommand: vi.fn(),
  handleMatchCommand: vi.fn(),
  handleMatchImageCommand: vi.fn(),
  handleAccessibilityCommand: vi.fn(),
  handleManualCommand: vi.fn(),
  handleComparisonCommand: vi.fn(),
  handleLanguageCommand: vi.fn(),
  handleFavoritesCommand: vi.fn(),
  handleCollectionCommand: vi.fn(),
  handlePresetCommand: vi.fn(),
  handleStatsCommand: vi.fn(),
  handleBudgetCommand: vi.fn(),
  handleBudgetAutocomplete: vi.fn(),
}));

vi.mock('./handlers/buttons/index.js', () => ({
  handleButtonInteraction: vi.fn(),
}));

// Note: Modal handlers are now handled by xivdyetools-moderation-worker
// The modals/index.js exports nothing, so we don't need to mock it

vi.mock('./services/analytics.js', () => ({
  trackCommandWithKV: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./services/rate-limiter.js', () => ({
  checkRateLimit: vi.fn(),
  formatRateLimitMessage: vi.fn(),
}));

vi.mock('./services/user-storage.js', () => ({
  getCollections: vi.fn(),
}));

vi.mock('./services/preset-api.js', () => ({
  searchPresetsForAutocomplete: vi.fn(),
  getMyPresets: vi.fn(),
}));

vi.mock('./utils/discord-api.js', () => ({
  sendMessage: vi.fn(),
}));

vi.mock('./services/i18n.js', () => ({
  getLocalizedDyeName: vi.fn((itemId: number, name: string) => name),
}));

// Mock DyeService
vi.mock('@xivdyetools/core', () => {
  class MockDyeService {
    getDyeById(id: number) {
      return {
        id,
        name: `Dye ${id}`,
        hex: '#FF0000',
        itemID: id,
      };
    }
    searchByName(query: string) {
      return [
        { id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'Standard' },
        { id: 2, name: 'Ash Grey', hex: '#CCCCCC', category: 'Standard' },
      ];
    }
    getAllDyes() {
      return [
        { id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'Standard' },
        { id: 2, name: 'Ash Grey', hex: '#CCCCCC', category: 'Standard' },
        { id: 3, name: 'Red', hex: '#FF0000', category: 'Facewear' },
      ];
    }
  }

  return {
    DyeService: MockDyeService,
    dyeDatabase: {},
  };
});

describe('index.ts', () => {
  let mockEnv: Env;
  let mockCtx: ExecutionContext;

  beforeEach(() => {
    // Create a proper KV namespace mock with all required methods
    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
    } as unknown as KVNamespace;

    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_TOKEN: 'test-token',
      DISCORD_CLIENT_ID: 'test-app-id',
      PRESETS_API_URL: 'https://test-api.example.com',
      INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret', // pragma: allowlist secret
      KV: mockKV,
      MODERATION_CHANNEL_ID: 'test-moderation-channel',
      SUBMISSION_LOG_CHANNEL_ID: 'test-submission-log-channel',
      DB: {} as any,
    };

    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    };

    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const req = new Request('http://localhost/health');
      const res = await app.fetch(req, mockEnv, mockCtx);

      expect(res.status).toBe(200);
      const data = (await res.json()) as InteractionResponseBody;
      expect(data).toMatchObject({
        status: 'healthy',
        service: 'xivdyetools-discord-worker',
      });
      expect((data as any).timestamp).toBeDefined();
    });
  });

  describe('POST /webhooks/preset-submission', () => {
    it('should reject unauthorized requests', async () => {
      const { timingSafeEqual } = await import('./utils/verify.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(false);

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer wrong-secret' },
        body: JSON.stringify({ type: 'submission' }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(401);
    });

    it('should reject invalid JSON', async () => {
      const { timingSafeEqual } = await import('./utils/verify.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-webhook-secret' },
        body: 'invalid json',
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(400);
    });

    it('should reject invalid payload type', async () => {
      const { timingSafeEqual } = await import('./utils/verify.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'invalid' }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(400);
    });

    it('should handle pending preset submission', async () => {
      const { timingSafeEqual } = await import('./utils/verify.js');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));

      const preset = {
        id: 'preset-123',
        name: 'Test Preset',
        description: 'A test preset',
        category_id: 'test-category',
        author_name: 'Test Author',
        source: 'web' as const,
        dyes: [1, 2, 3],
        tags: ['test', 'example'],
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      };

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'submission', preset }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(
        'test-token',
        'test-moderation-channel',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '🟡 New Preset Awaiting Review',
            }),
          ]),
          components: expect.any(Array),
        })
      );
    });

    it('should handle approved preset submission', async () => {
      const { timingSafeEqual } = await import('./utils/verify.js');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));

      const preset = {
        id: 'preset-456',
        name: 'Auto-Approved Preset',
        description: 'An auto-approved preset',
        category_id: 'test-category',
        author_name: 'Test Author',
        source: 'discord' as const,
        dyes: [4, 5, 6],
        tags: [],
        status: 'approved' as const,
        created_at: new Date().toISOString(),
      };

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'submission', preset }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(200);
      expect(sendMessage).toHaveBeenCalledWith(
        'test-token',
        'test-submission-log-channel',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '🟢 New Preset Published',
            }),
          ]),
        })
      );
    });
  });

  describe('POST / - Discord interactions', () => {
    describe('Signature verification', () => {
      it('should reject invalid signature', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: false,
          body: '',
          error: 'Invalid signature',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({ type: InteractionType.PING }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(401);
      });

      it('should handle invalid JSON body', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: 'invalid json',
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: 'invalid json',
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(400);
      });
    });

    describe('PING interaction', () => {
      it('should respond to PING with PONG', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({ type: InteractionType.PING }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({ type: InteractionType.PING }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.type).toBe(1); // PONG
      });
    });

    describe('APPLICATION_COMMAND interactions', () => {
      it('should route to about command handler', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        const { handleAboutCommand } = await import('./handlers/commands/index.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'about' },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60000 });
        vi.mocked(handleAboutCommand).mockResolvedValue(new Response());

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'about' },
            user: { id: 'user-123' },
          }),
        });

        await app.fetch(req, mockEnv, mockCtx);
        expect(handleAboutCommand).toHaveBeenCalled();
      });

      it('should route to harmony command handler', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        const { handleHarmonyCommand } = await import('./handlers/commands/index.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'harmony' },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60000 });
        vi.mocked(handleHarmonyCommand).mockResolvedValue(new Response());

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'harmony' },
            user: { id: 'user-123' },
          }),
        });

        await app.fetch(req, mockEnv, mockCtx);
        expect(handleHarmonyCommand).toHaveBeenCalled();
      });

      it('should enforce rate limits', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { checkRateLimit, formatRateLimitMessage } = await import('./services/rate-limiter.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'dye' },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(checkRateLimit).mockResolvedValue({
          allowed: false,
          retryAfter: 30,
          remaining: 0,
          resetAt: Date.now() + 30000,
        });
        vi.mocked(formatRateLimitMessage).mockReturnValue('Rate limited');

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'dye' },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.flags).toBe(64); // Ephemeral
      });

      it('should handle unknown command', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { checkRateLimit } = await import('./services/rate-limiter.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'unknown_command' },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60000 });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'unknown_command' },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.content).toContain('not yet implemented');
      });
    });

    describe('AUTOCOMPLETE interactions', () => {
      it('should handle dye autocomplete with query', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'dye',
              options: [
                {
                  name: 'search',
                  type: 1,
                  options: [{ name: 'query', value: 'snow', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'dye',
              options: [
                {
                  name: 'search',
                  type: 1,
                  options: [{ name: 'query', value: 'snow', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
        expect(data.data!.choices).toBeInstanceOf(Array);
      });

      it('should handle collection autocomplete', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { getCollections } = await import('./services/user-storage.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'my', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(getCollections).mockResolvedValue([
          { id: 'coll-1', name: 'My Collection', dyes: [1, 2, 3], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ]);

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'my', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
        expect(data.data!.choices![0].name).toContain('My Collection');
      });

      it('should handle preset autocomplete for approved presets', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { searchPresetsForAutocomplete } = await import('./services/preset-api.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(searchPresetsForAutocomplete).mockResolvedValue([
          { name: 'Test Preset', value: 'preset-123' },
        ]);

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(searchPresetsForAutocomplete).toHaveBeenCalledWith(
          mockEnv,
          'test',
          { status: 'approved' }
        );
      });

      it('should handle preset edit autocomplete (user own presets)', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { getMyPresets } = await import('./services/preset-api.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'my', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(getMyPresets).mockResolvedValue([
          { id: 'preset-1', name: 'My Preset', status: 'approved' } as CommunityPreset,
          { id: 'preset-2', name: 'My Pending Preset', status: 'pending' } as CommunityPreset,
        ]);

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'my', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(getMyPresets).toHaveBeenCalledWith(mockEnv, 'user-123');
      });

      it('should handle preset show autocomplete (approved presets)', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { searchPresetsForAutocomplete } = await import('./services/preset-api.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'preset_id', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(searchPresetsForAutocomplete).mockResolvedValue([
          { name: 'Approved Preset', value: 'preset-approved' },
        ]);

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'preset_id', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        expect(searchPresetsForAutocomplete).toHaveBeenCalledWith(
          mockEnv,
          'test',
          { status: 'approved' }
        );
      });

      it('should handle preset dye autocomplete', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'submit',
                  type: 1,
                  options: [{ name: 'dye1', value: 'snow', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'submit',
                  type: 1,
                  options: [{ name: 'dye1', value: 'snow', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
      });

      it('should handle dye autocomplete with empty query (show popular dyes)', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'match',
              options: [{ name: 'color', value: '', focused: true }],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'match',
              options: [{ name: 'color', value: '', focused: true }],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
        expect(data.data!.choices).toBeInstanceOf(Array);
      });

      it('should handle collection dye autocomplete', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'add',
                  type: 1,
                  options: [{ name: 'dye', value: 'red', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'add',
                  type: 1,
                  options: [{ name: 'dye', value: 'red', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.type).toBe(InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT);
      });

      it('should handle collection autocomplete with empty collections', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { getCollections } = await import('./services/user-storage.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(getCollections).mockResolvedValue([]);

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.choices).toEqual([]);
      });

      it('should handle collection autocomplete error gracefully', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { getCollections } = await import('./services/user-storage.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(getCollections).mockRejectedValue(new Error('KV error'));

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.choices).toEqual([]);
      });

      it('should handle getMyPresets with empty presets', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { getMyPresets } = await import('./services/preset-api.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(getMyPresets).mockResolvedValue([]);

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.choices).toEqual([]);
      });

      it('should handle getMyPresets error gracefully', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { getMyPresets } = await import('./services/preset-api.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(getMyPresets).mockRejectedValue(new Error('API error'));

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'test', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.choices).toEqual([]);
      });
    });

    describe('MESSAGE_COMPONENT interactions', () => {
      it('should route button interactions', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { handleButtonInteraction } = await import('./handlers/buttons/index.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.MESSAGE_COMPONENT,
            data: { custom_id: 'copy_hex_FF0000', component_type: 2 },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(handleButtonInteraction).mockResolvedValue(new Response());

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.MESSAGE_COMPONENT,
            data: { custom_id: 'copy_hex_FF0000', component_type: 2 },
            user: { id: 'user-123' },
          }),
        });

        await app.fetch(req, mockEnv, mockCtx);
        expect(handleButtonInteraction).toHaveBeenCalled();
      });

      it('should handle unknown component types', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.MESSAGE_COMPONENT,
            data: { custom_id: 'select_menu', component_type: 3 },
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.MESSAGE_COMPONENT,
            data: { custom_id: 'select_menu', component_type: 3 },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.content).toContain('not yet supported');
      });
    });

    describe('MODAL_SUBMIT interactions', () => {
      // Note: All modal handlers have been moved to xivdyetools-moderation-worker
      // The main worker now returns "Unknown modal submission." for all modal submissions

      it('should return unknown modal for any modal submission', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.MODAL_SUBMIT,
            data: { custom_id: 'any_modal' },
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.MODAL_SUBMIT,
            data: { custom_id: 'any_modal' },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.content).toContain('Unknown modal');
      });
    });

    describe('Unknown interaction types', () => {
      it('should handle unknown interaction type', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: 999, // Unknown type
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: 999,
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(400);
      });
    });

    // Note: Ban user autocomplete and ban reason modal tests removed
    // Ban functionality has been moved to xivdyetools-moderation-worker

    describe('Webhook without secret', () => {
      it('should reject webhook when INTERNAL_WEBHOOK_SECRET is not configured', async () => {
        const envWithoutSecret = { ...mockEnv, INTERNAL_WEBHOOK_SECRET: '' };

        const req = new Request('http://localhost/webhooks/preset-submission', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer some-secret' },
          body: JSON.stringify({ type: 'submission' }),
        });

        const res = await app.fetch(req, envWithoutSecret, mockCtx);
        expect(res.status).toBe(401);
      });
    });

    describe('Analytics error handling', () => {
      it('should handle analytics tracking failure gracefully', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        const { trackCommandWithKV } = await import('./services/analytics.js');
        const { handleDyeCommand } = await import('./handlers/commands/index.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'dye' },
            member: { user: { id: 'user-123' } },
          }),
          error: '',
        });
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60000 });
        vi.mocked(trackCommandWithKV).mockRejectedValue(new Error('Analytics failed'));
        vi.mocked(handleDyeCommand).mockResolvedValue(new Response());

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'dye' },
            member: { user: { id: 'user-123' } },
          }),
        });

        // Should not throw, command should still work
        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res).toBeDefined();
        expect(handleDyeCommand).toHaveBeenCalled();
      });
    });

    describe('Collection autocomplete without user', () => {
      it('should return empty choices when no user ID available', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
            // No user or member
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: 'test', focused: true }],
                },
              ],
            },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.choices).toEqual([]);
      });
    });

    describe('Preset edit autocomplete without user', () => {
      it('should return empty choices when no user ID available for edit', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'test', focused: true }],
                },
              ],
            },
            // No user or member
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'preset',
              options: [
                {
                  name: 'edit',
                  type: 1,
                  options: [{ name: 'preset', value: 'test', focused: true }],
                },
              ],
            },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.choices).toEqual([]);
      });
    });

    describe('Command routing', () => {
      it('should route to all command handlers', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        const commands = await import('./handlers/commands/index.js');

        const commandHandlers = [
          { name: 'about', handler: commands.handleAboutCommand },
          { name: 'harmony', handler: commands.handleHarmonyCommand },
          { name: 'dye', handler: commands.handleDyeCommand },
          // V4 Commands
          { name: 'extractor', handler: commands.handleExtractorCommand },
          { name: 'gradient', handler: commands.handleGradientCommand },
          { name: 'preferences', handler: commands.handlePreferencesCommand },
          { name: 'mixer', handler: commands.handleMixerV4Command },
          { name: 'swatch', handler: commands.handleSwatchCommand },
          // Legacy commands
          { name: 'match', handler: commands.handleMatchCommand },
          { name: 'match_image', handler: commands.handleMatchImageCommand },
          { name: 'accessibility', handler: commands.handleAccessibilityCommand },
          { name: 'manual', handler: commands.handleManualCommand },
          { name: 'comparison', handler: commands.handleComparisonCommand },
          { name: 'language', handler: commands.handleLanguageCommand },
          { name: 'favorites', handler: commands.handleFavoritesCommand },
          { name: 'collection', handler: commands.handleCollectionCommand },
          { name: 'preset', handler: commands.handlePresetCommand },
          { name: 'stats', handler: commands.handleStatsCommand },
          { name: 'budget', handler: commands.handleBudgetCommand },
        ];

        for (const { name, handler } of commandHandlers) {
          vi.clearAllMocks();
          vi.mocked(verifyDiscordRequest).mockResolvedValue({
            isValid: true,
            body: JSON.stringify({
              type: InteractionType.APPLICATION_COMMAND,
              data: { name },
              user: { id: 'user-123' },
            }),
            error: '',
          });
          vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60000 });
          vi.mocked(handler).mockResolvedValue(new Response());

          const req = new Request('http://localhost/', {
            method: 'POST',
            body: JSON.stringify({
              type: InteractionType.APPLICATION_COMMAND,
              data: { name },
              user: { id: 'user-123' },
            }),
          });

          await app.fetch(req, mockEnv, mockCtx);
          expect(handler).toHaveBeenCalled();
        }
      });

      it('should route stats command handler', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');

        // Import stats handler - need to add it to the mock
        vi.doMock('./handlers/commands/index.js', async (importOriginal) => {
          const original = await importOriginal() as Record<string, unknown>;
          return {
            ...original,
            handleStatsCommand: vi.fn().mockResolvedValue(new Response()),
          };
        });

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'stats' },
            user: { id: 'user-123' },
          }),
          error: '',
        });

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'stats' },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res).toBeDefined();
      });
    });

    describe('Collection autocomplete with query filter', () => {
      it('should filter collections with empty query', async () => {
        const { verifyDiscordRequest } = await import('./utils/verify.js');
        const { getCollections } = await import('./services/user-storage.js');

        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: '', focused: true }], // Empty query
                },
              ],
            },
            user: { id: 'user-123' },
          }),
          error: '',
        });
        vi.mocked(getCollections).mockResolvedValue([
          { id: 'col-1', name: 'Collection A', dyes: [1], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: 'col-2', name: 'Collection B', dyes: [2], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ]);

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: {
              name: 'collection',
              options: [
                {
                  name: 'show',
                  type: 1,
                  options: [{ name: 'name', value: '', focused: true }],
                },
              ],
            },
            user: { id: 'user-123' },
          }),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(data.data!.choices!.length).toBe(2); // All collections returned
      });
    });
  });
});
