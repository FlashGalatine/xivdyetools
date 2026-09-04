/**
 * Tests for the main Hono app and interaction handlers
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import app from './index.js';
import {
  InteractionType,
  InteractionResponseType,
  type InteractionResponseBody,
} from './types/env.js';
import type { Env } from './types/env.js';
import type { CommunityPreset } from '@xivdyetools/types/preset';

// Mock dependencies
vi.mock('@xivdyetools/auth', () => ({
  verifyDiscordRequest: vi.fn(),
  unauthorizedResponse: vi.fn(
    (error: string) => new Response(JSON.stringify({ error }), { status: 401 }),
  ),
  badRequestResponse: vi.fn(
    (error: string) => new Response(JSON.stringify({ error }), { status: 400 }),
  ),
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
  handleAccessibilityCommand: vi.fn(),
  handleManualCommand: vi.fn(),
  handleChangelogCommand: vi.fn(),
  handleComparisonCommand: vi.fn(),
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

vi.mock('./services/rate-limiter.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/rate-limiter.js')>()),
  checkRateLimit: vi.fn(),
  formatRateLimitMessage: vi.fn(),
}));

vi.mock('./services/preset-api.js', () => ({
  searchPresetsForAutocomplete: vi.fn(),
  getMyPresets: vi.fn(),
}));

vi.mock('./utils/discord-api.js', () => ({
  sendMessage: vi.fn(),
  sendFollowUp: vi.fn(),
}));

// /webhooks/github: the HMAC check and the two downstream services are
// mocked so the route's own gates (size, ref, changelog detection) are
// what the tests exercise.
vi.mock('./utils/github-verify.js', () => ({
  verifyGitHubSignature: vi.fn(),
}));

vi.mock('./services/changelog-parser.js', () => ({
  parseLatestVersion: vi.fn(),
}));

vi.mock('./services/announcements.js', () => ({
  sendAnnouncement: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('./services/i18n.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/i18n.js')>()),
  getLocalizedDyeName: vi.fn((_itemId: number, name: string) => name),
  resolveUserLocale: vi.fn().mockResolvedValue('en'),
  initializeLocale: vi.fn().mockResolvedValue(undefined),
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
        stainID: 7,
      };
    }
    getByStainId(stainId: number) {
      return this.getAllDyes().find((d) => d.stainID === stainId) ?? null;
    }
    searchByName(_query: string) {
      return [
        { id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'Standard', stainID: 1 },
        { id: 2, name: 'Ash Grey', hex: '#CCCCCC', category: 'Standard', stainID: 2 },
      ];
    }
    getAllDyes() {
      return [
        { id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'Standard', stainID: 1 },
        { id: 2, name: 'Ash Grey', hex: '#CCCCCC', category: 'Standard', stainID: 2 },
        { id: 3, name: 'Red', hex: '#FF0000', category: 'Facewear', stainID: null },
      ];
    }
  }

  return {
    DyeService: MockDyeService,
    dyeDatabase: {},
    // `types/preferences.ts` builds MATCHING_METHODS at module scope from
    // these two, so they must exist on the mock or importing it throws before
    // any test runs. `oklab` is ΔEOK2 — the metric became ΔEOK2 in core 5.1.0.
    MATCHING_METHODS: ['ciede2000', 'oklab', 'cie76', 'redmean', 'rgb', 'distinguish'],
    MATCHING_METHOD_TAGS: {
      ciede2000: 'ΔE2000',
      oklab: 'ΔEOK2',
      cie76: 'ΔE76',
      redmean: 'REDMEAN',
      rgb: 'RGB DIST',
      distinguish: 'DISTINGUISH %',
      ratio: 'RATIO',
    },
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
    };

    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

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

  /**
   * FINDING-013 (2026-08-29 security audit): `validateEnv` raises
   * `Missing required env var in production: RL_N` for each rate-limit tier a
   * PRODUCTION worker is missing, and the middleware must refuse the request
   * on it exactly as it does for a missing Discord secret. Workers Logs are
   * off on this script, so the once-per-isolate console line is not a signal
   * anyone would see; a bot that answers errors is noticed in minutes. The
   * beta worker (`ENVIRONMENT = "development"`) keeps the log-only behaviour
   * and its KV fallback.
   */
  describe('environment validation (FINDING-013)', () => {
    let consoleErrorSpy: MockInstance;

    const TIER_NAMES = ['RL_5', 'RL_10', 'RL_15', 'RL_20', 'RL_30', 'RL_70'] as const;

    /** The six `[[ratelimits]]` bindings as both environments bind them. */
    function boundTiers(except?: (typeof TIER_NAMES)[number]): Partial<Env> {
      return Object.fromEntries(
        TIER_NAMES.filter((name) => name !== except).map((name) => [
          name,
          { limit: vi.fn().mockResolvedValue({ success: true }) },
        ]),
      ) as unknown as Partial<Env>;
    }

    /** POST one command interaction through the real middleware chain. */
    async function postCommand(env: Env): Promise<Response> {
      const { verifyDiscordRequest } = await import('@xivdyetools/auth');
      const { checkRateLimit } = await import('./services/rate-limiter.js');
      const interaction = {
        type: InteractionType.APPLICATION_COMMAND,
        data: { name: 'unknown_command' },
        user: { id: 'user-123' },
      };
      vi.mocked(verifyDiscordRequest).mockResolvedValue({
        isValid: true,
        body: JSON.stringify(interaction),
        error: '',
      });
      vi.mocked(checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 14,
        resetAt: Date.now() + 60_000,
      });
      return app.fetch(
        new Request('http://localhost/', { method: 'POST', body: JSON.stringify(interaction) }),
        env,
        mockCtx,
      );
    }

    beforeEach(() => {
      // logValidationErrors() falls through to console.error when it is given
      // no logger — keep the suite's output clean.
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('refuses an interaction when DISCORD_TOKEN is missing (the shape below must match)', async () => {
      const res = await postCommand({ ...mockEnv, DISCORD_TOKEN: '' });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Service misconfigured' });
    });

    it('refuses an interaction when a production RL_* binding is missing', async () => {
      const res = await postCommand({
        ...mockEnv,
        ENVIRONMENT: 'production',
        ...boundTiers('RL_5'),
      } as Env);

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Service misconfigured' });
    });

    it('serves an interaction when production binds all six tiers', async () => {
      const res = await postCommand({
        ...mockEnv,
        ENVIRONMENT: 'production',
        ...boundTiers(),
      } as Env);

      expect(res.status).toBe(200);
      const data = (await res.json()) as InteractionResponseBody;
      expect(data.data!.content).toContain('not yet implemented');
    });

    it('serves an interaction on the beta worker with no tier bound (KV fallback)', async () => {
      const res = await postCommand({ ...mockEnv, ENVIRONMENT: 'development' } as Env);

      expect(res.status).toBe(200);
      const data = (await res.json()) as InteractionResponseBody;
      expect(data.data!.content).toContain('not yet implemented');
    });

    it('refuses /health on a misconfigured production worker, exactly as a missing token does', async () => {
      const missingTier = await app.fetch(
        new Request('http://localhost/health'),
        { ...mockEnv, ENVIRONMENT: 'production', ...boundTiers('RL_70') } as Env,
        mockCtx,
      );
      const missingToken = await app.fetch(
        new Request('http://localhost/health'),
        { ...mockEnv, DISCORD_TOKEN: '' },
        mockCtx,
      );

      expect(missingTier.status).toBe(500);
      expect(await missingTier.json()).toEqual({ error: 'Service misconfigured' });
      // The two failures are indistinguishable to a caller, by design.
      expect(missingTier.status).toBe(missingToken.status);
    });
  });

  describe('POST /webhooks/preset-submission', () => {
    it('should reject unauthorized requests', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      vi.mocked(timingSafeEqual).mockResolvedValue(false);

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong-secret' },
        body: JSON.stringify({ type: 'submission' }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(401);
    });

    it('should reject invalid JSON', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: 'invalid json',
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(400);
    });

    it('should reject invalid payload type', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'invalid' }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(400);
    });

    it('should handle pending preset submission', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
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
        headers: { Authorization: 'Bearer test-webhook-secret' },
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
        }),
      );
      // BUG-009: without MODERATION_BOT_TOKEN the buttons would route to the
      // wrong Discord application — the shared builder omits them and adds a
      // "/preset moderate" hint instead
      const call = vi.mocked(sendMessage).mock.calls.at(-1)?.[2] as {
        components?: unknown[];
        embeds: Array<{ description?: string }>;
      };
      expect(call.components).toBeUndefined();
      expect(call.embeds[0].description).toContain('/preset moderate');
    });

    // discord-core-13: every webhook fixture in this file already carries the
    // correct stainID shape (`dyes: [1, 2, 3]`), but no assertion ever read the
    // rendered `Dyes` field -- only the title, the absence of components, and
    // the log line. So discord-core-01 (the embed resolving ids through
    // `getDyeById` instead of `getByStainId`, printing raw numbers or the
    // WRONG dye) was invisible here: replacing formatDyesForEmbed's body with
    // `dyeIds.join(', ')` kept every test in the file green.
    it('renders dye NAMES in the moderation embed, not raw stain ids', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));

      const preset = {
        id: 'preset-124',
        name: 'Test Preset',
        description: 'A test preset',
        category_id: 'test-category',
        author_name: 'Test Author',
        source: 'web' as const,
        dyes: [1, 2, 3],
        tags: [],
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      };

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'submission', preset }),
      });

      await app.fetch(req, mockEnv, mockCtx);

      const sent = vi.mocked(sendMessage).mock.calls.at(-1)?.[2] as {
        embeds: Array<{ fields?: Array<{ name: string; value: string }> }>;
      };
      const dyeField = sent.embeds[0].fields?.find((f) => /dye/i.test(f.name));

      expect(dyeField, 'the embed has no Dyes field').toBeDefined();
      // The fixture names stains 1 and 2 (Snow White, Ash Grey); stain 3 is
      // absent from it, so it falls through to the legacy `getDyeById` arm and
      // renders 'Dye 3'. Pinning all three covers BOTH arms in the right
      // order: swapping them -- which is discord-core-01 -- turns stain 1 into
      // 'Dye 1'.
      expect(dyeField?.value).toBe('Snow White, Ash Grey, Dye 3');
      expect(dyeField?.value).not.toBe('1, 2, 3');
    });

    // FINDING-011 (2026-08-29 security audit): the webhook's own log line
    // carried `presetName` — user-authored free text describing an
    // unpublished submission — into the structured log sink. The assertion is
    // on what actually reaches the sink (the JSON adapter writes to
    // console.log), not on the call arguments, so a name reintroduced
    // anywhere in this request's logging fails it.
    it('logs the preset id and source, never the submitted name', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));
      const sink = vi.spyOn(console, 'log').mockImplementation(() => {});

      const preset = {
        id: 'preset-789',
        name: 'Sunset Over Costa del Sol',
        description: 'A private draft',
        category_id: 'test-category',
        author_name: 'Test Author',
        source: 'web' as const,
        dyes: [1, 2, 3],
        tags: [],
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      };

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'submission', preset }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      const emitted = sink.mock.calls.map(([line]) => String(line));
      sink.mockRestore();

      expect(res.status).toBe(200);
      const webhookLine = emitted.find((line) => line.includes('Received preset webhook'));
      expect(webhookLine, 'the webhook log line never ran').toBeDefined();
      expect(
        (JSON.parse(webhookLine!) as { context?: Record<string, unknown> }).context,
      ).toMatchObject({ presetId: 'preset-789', source: 'web' });
      expect(emitted.filter((line) => line.includes(preset.name))).toEqual([]);
    });

    it('should handle approved preset submission', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
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
        headers: { Authorization: 'Bearer test-webhook-secret' },
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
        }),
      );
    });

    // FINDING-019 (2026-08-21 security audit): author name and tags on the
    // webhook embeds are user content — the name/description already went
    // through the sanitiser; these two did not.
    it('sanitises author name and tags on the auto-approved submission-log embed', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));

      const preset = {
        id: 'preset-789',
        name: 'Plain Name',
        description: 'Plain description',
        category_id: 'aesthetics',
        author_name: '<@999> [Mallory](https://phish.example) @everyone',
        source: 'web' as const,
        dyes: [1],
        tags: ['ok', '[tag](https://evil.example) @here'],
        status: 'approved' as const,
        created_at: new Date().toISOString(),
      };

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'submission', preset }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(200);

      const call = vi.mocked(sendMessage).mock.calls.at(-1)?.[2] as {
        embeds: Array<{ fields: Array<{ name: string; value: string }> }>;
      };
      const fields = call.embeds[0].fields;
      const authorField = fields.find((f) => f.value.includes('Mallory'));
      expect(authorField).toBeDefined();
      expect(authorField!.value).not.toContain('<@999>');
      expect(authorField!.value).not.toContain('[Mallory](https://phish.example)');
      expect(authorField!.value).not.toContain('@everyone');
      const tagsField = fields.find((f) => f.value.includes('evil.example'));
      expect(tagsField).toBeDefined();
      expect(tagsField!.value).not.toContain('[tag](https://evil.example)');
      expect(tagsField!.value).not.toContain('@here');
      expect(tagsField!.value).toContain('ok');
    });

    it('sanitises tags on the pending moderation embed extra fields', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));

      const preset = {
        id: 'preset-790',
        name: 'Plain Name',
        description: 'Plain description',
        category_id: 'aesthetics',
        author_name: 'Author',
        source: 'web' as const,
        dyes: [1],
        tags: ['[tag](https://evil.example) @everyone'],
        status: 'pending' as const,
        created_at: new Date().toISOString(),
      };

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({ type: 'submission', preset }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(200);

      const call = vi.mocked(sendMessage).mock.calls.at(-1)?.[2] as {
        embeds: Array<{ fields?: Array<{ name: string; value: string }> }>;
      };
      const tagsField = call.embeds[0].fields?.find((f) => f.value.includes('evil.example'));
      expect(tagsField).toBeDefined();
      expect(tagsField!.value).not.toContain('[tag](https://evil.example)');
      expect(tagsField!.value).not.toContain('@everyone');
    });

    // FINDING 4 (2026-08-10 final review): a pending image is a moderation
    // task, so it belongs in the moderation channel. It used to go to the
    // submission log — where *published* presets are announced — which both
    // misfiled the work and showed an unapproved image to the wrong audience.
    it('posts a review message carrying the pending preview image to the moderation channel', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({
          type: 'preview_image',
          preset: { id: 'p1', name: 'Test', author_name: 'Author' },
          preview_image_key: 'p1/abc.webp',
        }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(200);

      expect(sendMessage).toHaveBeenCalledWith(
        'test-token',
        'test-moderation-channel',
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              image: { url: 'https://shots.xivdyetools.app/p1/abc.webp' },
            }),
          ]),
        }),
      );
    });

    // Task 9: the approve/reject buttons must carry the previewimg_ prefix
    // (not preset_, which moderation-worker already owns) and must be posted
    // with this app's own token so the clicks route back here.
    it('attaches approve/reject buttons carrying the previewimg_ custom_id prefix', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null));

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({
          type: 'preview_image',
          preset: { id: 'p1', name: 'Test', author_name: 'Author' },
          preview_image_key: 'p1/abc.webp',
        }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(200);

      expect(sendMessage).toHaveBeenCalledWith(
        'test-token',
        'test-moderation-channel',
        expect.objectContaining({
          components: [
            expect.objectContaining({
              type: 1,
              components: expect.arrayContaining([
                expect.objectContaining({
                  type: 2,
                  style: 3,
                  custom_id: 'previewimg_approve_p1',
                }),
                expect.objectContaining({
                  type: 2,
                  style: 4,
                  custom_id: 'previewimg_reject_p1',
                }),
              ]),
            }),
          ],
        }),
      );
    });

    // The 502 is load-bearing: presets-api only retries and dead-letters a
    // notification it is told failed. Swallowing a Discord rejection here
    // would lose the moderation-queue entry silently.
    it('returns 502 when Discord rejects the preview-image notification', async () => {
      const { timingSafeEqual } = await import('@xivdyetools/auth');
      const { sendMessage } = await import('./utils/discord-api.js');
      vi.mocked(timingSafeEqual).mockResolvedValue(true);
      vi.mocked(sendMessage).mockResolvedValue(new Response(null, { status: 500 }));

      const req = new Request('http://localhost/webhooks/preset-submission', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-webhook-secret' },
        body: JSON.stringify({
          type: 'preview_image',
          preset: { id: 'p1', name: 'Test', author_name: 'Author' },
          preview_image_key: 'p1/abc.webp',
        }),
      });

      const res = await app.fetch(req, mockEnv, mockCtx);
      expect(res.status).toBe(502);
    });
  });

  describe('POST /webhooks/github', () => {
    /**
     * KV double this suite asserts on directly: the announce-once memo
     * (`announced:v:<version>`, FINDING-021) is read and written through it.
     */
    const announceKV = () => ({
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
      getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null }),
    });

    const githubEnv = (kv: ReturnType<typeof announceKV> = announceKV()): Env => ({
      ...mockEnv,
      KV: kv as unknown as KVNamespace,
      GITHUB_WEBHOOK_SECRET: 'test-github-secret', // pragma: allowlist secret
      ANNOUNCEMENT_CHANNEL_ID: 'test-announcement-channel',
    });

    /** A push payload shaped like GitHub's, padded to a realistic size. */
    const pushPayload = (overrides: Record<string, unknown> = {}) => ({
      ref: 'refs/heads/main',
      repository: {
        full_name: 'FlashGalatine/xivdyetools',
        html_url: 'https://github.com/FlashGalatine/xivdyetools',
        // GitHub's real `repository` object alone is several KB; this pushes the
        // body past the old 10 KB cap the way a two-commit merge push did
        // (18,196 bytes on 2026-08-29).
        description: 'x'.repeat(16_000),
      },
      commits: [],
      head_commit: null,
      ...overrides,
    });

    /** A head commit whose file list touches the product-level changelog. */
    const changelogCommit = (overrides: Record<string, unknown> = {}) => ({
      id: 'abc',
      message: 'Merge pull request',
      timestamp: '2026-08-28T23:36:41Z',
      url: 'https://github.com/FlashGalatine/xivdyetools/commit/abc',
      author: { name: 'x', email: 'x@example.com', username: 'x' },
      added: [],
      removed: [],
      modified: ['CHANGELOG-laymans.md'],
      ...overrides,
    });

    /**
     * `options.headers` overrides the defaults; an explicit `undefined` drops
     * the header entirely (GitHub always stamps `X-GitHub-Event`, but a
     * hand-rolled caller need not).
     */
    const postPush = (
      body: string,
      options: { env?: Env; headers?: Record<string, string | undefined> } = {},
    ) => {
      const merged: Record<string, string | undefined> = {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': 'sha256=irrelevant-mocked',
        'X-GitHub-Event': 'push',
        ...options.headers,
      };
      const headers = Object.fromEntries(
        Object.entries(merged).filter((pair): pair is [string, string] => pair[1] !== undefined),
      );
      return app.fetch(
        new Request('http://localhost/webhooks/github', { method: 'POST', headers, body }),
        options.env ?? githubEnv(),
        mockCtx,
      );
    };

    let fetchSpy: MockInstance<typeof fetch> | undefined;
    let logSpy: MockInstance<typeof console.log> | undefined;

    /** Signature verified + changelog fetched/parsed — the announce path's setup. */
    const arrangeAnnounce = async () => {
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');
      const { parseLatestVersion } = await import('./services/changelog-parser.js');
      const { sendAnnouncement } = await import('./services/announcements.js');
      vi.mocked(verifyGitHubSignature).mockResolvedValue(true);
      const entry = { version: '5.0.0', date: '2026-08-28', sections: [] };
      vi.mocked(parseLatestVersion).mockReturnValue(entry as never);
      // A fresh Response per call: a redelivery test calls the route twice and
      // a Response body can only be consumed once.
      fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(async () => new Response('## [5.0.0] - 2026-08-28\n', { status: 200 }));
      return { entry, fetchSpy, sendAnnouncement: vi.mocked(sendAnnouncement) };
    };

    /** Captures the structured logger's JSON lines (it writes via console.log). */
    const captureLogLines = (): string[] => {
      const lines: string[] = [];
      logSpy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
        lines.push(String(line));
      });
      return lines;
    };

    afterEach(() => {
      fetchSpy?.mockRestore();
      fetchSpy = undefined;
      logSpy?.mockRestore();
      logSpy = undefined;
    });

    it('accepts a real-sized push payload (> 10 KB) instead of answering 413', async () => {
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');
      vi.mocked(verifyGitHubSignature).mockResolvedValue(true);

      const body = JSON.stringify(pushPayload({ ref: 'refs/heads/topic' }));
      expect(body.length).toBeGreaterThan(10_240);

      const res = await postPush(body);

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ message: 'Not main branch, skipping' });
      expect(verifyGitHubSignature).toHaveBeenCalledOnce();
    });

    it('still refuses a body over 1 MiB', async () => {
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');
      vi.mocked(verifyGitHubSignature).mockResolvedValue(true);

      const body = JSON.stringify(pushPayload({ padding: 'y'.repeat(1_100_000) }));
      const res = await postPush(body);

      expect(res.status).toBe(413);
      expect(verifyGitHubSignature).not.toHaveBeenCalled();
    });

    // discord-core-14: no test anywhere stubbed a NON-2xx send. BUG-026 is
    // that a Discord rejection used to resolve as success, after which the
    // caller wrote the `announced:v:<version>` memo -- and every later
    // Redeliver short-circuited on it, so that release could never be
    // announced again. The memo not being written is the whole recovery story.
    it('writes no announce memo and answers 502 when Discord rejects the send', async () => {
      const { sendAnnouncement } = await arrangeAnnounce();
      sendAnnouncement.mockResolvedValue({
        ok: false,
        status: 403,
        body: 'Missing Permissions',
      });

      const kv = announceKV();
      const res = await postPush(
        JSON.stringify(pushPayload({ commits: [], head_commit: changelogCommit() })),
        { env: githubEnv(kv) },
      );

      // GitHub must log a FAILED delivery -- that is what makes a Redeliver
      // both possible and correct.
      expect(res.status).toBe(502);
      expect(kv.put).not.toHaveBeenCalled();
    });

    it('writes the announce memo once the send succeeded', async () => {
      const { sendAnnouncement, entry } = await arrangeAnnounce();
      sendAnnouncement.mockResolvedValue({ ok: true });

      const kv = announceKV();
      const res = await postPush(
        JSON.stringify(pushPayload({ commits: [], head_commit: changelogCommit() })),
        { env: githubEnv(kv) },
      );

      expect(res.status).toBe(200);
      expect(kv.put).toHaveBeenCalledWith(
        `announced:v:${entry.version}`,
        '1',
        expect.anything(),
      );
    });

    it('announces when only head_commit lists CHANGELOG-laymans.md (commits truncated)', async () => {
      const { fetchSpy: fetched, sendAnnouncement, entry } = await arrangeAnnounce();

      const res = await postPush(
        JSON.stringify(pushPayload({ commits: [], head_commit: changelogCommit() })),
      );

      expect(res.status).toBe(200);
      expect(fetched).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/FlashGalatine/xivdyetools/main/CHANGELOG-laymans.md',
        expect.anything(),
      );
      expect(sendAnnouncement).toHaveBeenCalledWith(
        'test-token',
        'test-announcement-channel',
        entry,
        'https://github.com/FlashGalatine/xivdyetools',
      );
    });

    it('skips when neither commits nor head_commit touch the changelog', async () => {
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');
      const { sendAnnouncement } = await import('./services/announcements.js');
      vi.mocked(verifyGitHubSignature).mockResolvedValue(true);

      const res = await postPush(
        JSON.stringify(
          pushPayload({
            head_commit: changelogCommit({ id: 'def', modified: ['README.md'] }),
          }),
        ),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ message: 'Changelog not modified, skipping' });
      expect(sendAnnouncement).not.toHaveBeenCalled();
    });

    // FINDING-021: the HMAC secret is the only gate on this route, so a holder
    // of it must not be able to choose which repository gets announced.
    it('refuses a push whose repository is not the pinned one', async () => {
      const { fetchSpy: fetched, sendAnnouncement } = await arrangeAnnounce();

      const res = await postPush(
        JSON.stringify(
          pushPayload({
            repository: {
              full_name: 'evil/xivdyetools',
              html_url: 'https://evil.example/x',
              description: 'x'.repeat(16_000),
            },
            head_commit: changelogCommit(),
          }),
        ),
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: 'Repository not allowed' });
      expect(fetched).not.toHaveBeenCalled();
      expect(sendAnnouncement).not.toHaveBeenCalled();
    });

    // FINDING-021: the announced link is a constant, so a payload that lies
    // about `html_url` cannot mask an arbitrary destination in the embed.
    it('announces with the pinned repository URL, not the payload html_url', async () => {
      const { fetchSpy: fetched, sendAnnouncement, entry } = await arrangeAnnounce();

      const res = await postPush(
        JSON.stringify(
          pushPayload({
            repository: {
              full_name: 'FlashGalatine/xivdyetools',
              html_url: 'https://evil.example/x',
              description: 'x'.repeat(16_000),
            },
            head_commit: changelogCommit(),
          }),
        ),
      );

      expect(res.status).toBe(200);
      expect(fetched).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/FlashGalatine/xivdyetools/main/CHANGELOG-laymans.md',
        expect.anything(),
      );
      expect(sendAnnouncement).toHaveBeenCalledWith(
        'test-token',
        'test-announcement-channel',
        entry,
        'https://github.com/FlashGalatine/xivdyetools',
      );
    });

    // FINDING-021: GitHub signs the `ping` it sends when a hook is created.
    it('answers a ping with pong without parsing the body', async () => {
      const { fetchSpy: fetched, sendAnnouncement } = await arrangeAnnounce();

      // Deliberately not JSON: a 200 pong proves the body is never parsed.
      const res = await postPush('{ this is not json', {
        headers: { 'X-GitHub-Event': 'ping' },
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, message: 'pong' });
      expect(fetched).not.toHaveBeenCalled();
      expect(sendAnnouncement).not.toHaveBeenCalled();
    });

    // FINDING-015 follow-up: the signature check must gate every event type,
    // `ping` included — an unsigned caller must not be able to reach the
    // pong-only branch just by claiming to be a hook-creation ping. This pins
    // the ordering (signature verified before the event-type switch); if the
    // handler were reordered to check the event type first, an unsigned ping
    // would answer 200 pong instead of 401 and this test would catch it.
    it('refuses an unsigned ping with 401 before checking the event type', async () => {
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');
      const { sendAnnouncement } = await import('./services/announcements.js');
      vi.mocked(verifyGitHubSignature).mockResolvedValue(false);

      const res = await postPush(JSON.stringify(pushPayload()), {
        headers: { 'X-GitHub-Event': 'ping' },
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: 'Unauthorized' });
      expect(sendAnnouncement).not.toHaveBeenCalled();
    });

    // FINDING-021: 2xx (not 4xx) keeps the hook healthy in GitHub's delivery log.
    it.each([
      ['a non-push event', { 'X-GitHub-Event': 'release' }],
      ['a delivery with no event header', { 'X-GitHub-Event': undefined }],
    ])('ignores %s', async (_label, headers) => {
      const { fetchSpy: fetched, sendAnnouncement } = await arrangeAnnounce();

      const res = await postPush(JSON.stringify(pushPayload({ head_commit: changelogCommit() })), {
        headers,
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, message: 'Ignored event' });
      expect(fetched).not.toHaveBeenCalled();
      expect(sendAnnouncement).not.toHaveBeenCalled();
    });

    // FINDING-021: the hook fires before the deploy finishes, so a Redeliver is
    // routine — it must not re-post a version that already went out (3× on
    // 2026-08-29).
    it('memoises the announced version for 90 days', async () => {
      const { sendAnnouncement } = await arrangeAnnounce();
      const kv = announceKV();

      const res = await postPush(JSON.stringify(pushPayload({ head_commit: changelogCommit() })), {
        env: githubEnv(kv),
      });

      expect(res.status).toBe(200);
      expect(sendAnnouncement).toHaveBeenCalledOnce();
      expect(kv.put).toHaveBeenCalledWith(
        'announced:v:5.0.0',
        '1',
        expect.objectContaining({ expirationTtl: 7_776_000 }),
      );
    });

    it('skips a version the memo already holds', async () => {
      const { sendAnnouncement } = await arrangeAnnounce();
      const kv = announceKV();
      kv.get.mockImplementation(async (key: string) => (key === 'announced:v:5.0.0' ? '1' : null));

      const res = await postPush(JSON.stringify(pushPayload({ head_commit: changelogCommit() })), {
        env: githubEnv(kv),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        success: true,
        message: 'Already announced',
        version: '5.0.0',
      });
      expect(sendAnnouncement).not.toHaveBeenCalled();
      expect(kv.put).not.toHaveBeenCalled();
    });

    it('does not memoise a failed send, so a redelivery still announces', async () => {
      const { sendAnnouncement } = await arrangeAnnounce();
      // A stateful memo: what the first delivery writes, the second reads.
      const memo = new Map<string, string>();
      const kv = announceKV();
      kv.get.mockImplementation(async (key: string) => memo.get(key) ?? null);
      kv.put.mockImplementation(async (key: string, value: string) => {
        memo.set(key, value);
      });
      const env = githubEnv(kv);
      const body = JSON.stringify(pushPayload({ head_commit: changelogCommit() }));

      sendAnnouncement.mockRejectedValueOnce(new Error('Discord rejected the embed'));
      const failed = await postPush(body, { env });

      expect(failed.status).toBe(500);
      expect(await failed.json()).toMatchObject({ error: 'Internal Server Error' });
      expect(memo.has('announced:v:5.0.0')).toBe(false);

      const retried = await postPush(body, { env });

      expect(retried.status).toBe(200);
      expect(sendAnnouncement).toHaveBeenCalledTimes(2);
      expect(memo.get('announced:v:5.0.0')).toBe('1');
    });

    /**
     * BUG-026: the test above only ever made the send THROW, which is the one
     * failure the old code noticed — `sendAnnouncement` awaited `sendMessage`
     * and discarded its Response, so a Discord 403 (no SEND_MESSAGES in the
     * announcement channel) or 400 (rejected embed) resolved as success. The
     * memo was written anyway and every later Redeliver short-circuited on it,
     * making that release permanently unannounceable.
     */
    it('does not memoise a send Discord REJECTED, so a redelivery still announces', async () => {
      const { sendAnnouncement } = await arrangeAnnounce();
      const memo = new Map<string, string>();
      const kv = announceKV();
      kv.get.mockImplementation(async (key: string) => memo.get(key) ?? null);
      kv.put.mockImplementation(async (key: string, value: string) => {
        memo.set(key, value);
      });
      const env = githubEnv(kv);
      const body = JSON.stringify(pushPayload({ head_commit: changelogCommit() }));

      // Resolves — it does not throw — with Discord's refusal.
      sendAnnouncement.mockResolvedValueOnce({
        ok: false,
        status: 403,
        body: '{"message":"Missing Permissions","code":50013}',
      });
      const refused = await postPush(body, { env });

      expect(refused.status).toBe(502);
      expect(memo.has('announced:v:5.0.0')).toBe(false);

      const retried = await postPush(body, { env });

      expect(retried.status).toBe(200);
      expect(sendAnnouncement).toHaveBeenCalledTimes(2);
      expect(memo.get('announced:v:5.0.0')).toBe('1');
    });

    // FINDING-021: the release is already posted by the time the memo is
    // written, so a KV failure must not become a 500 — that shows as a failed
    // delivery and invites the Redeliver that double-posts.
    it('answers 200 and warns when the memo write fails after a successful send', async () => {
      const { sendAnnouncement } = await arrangeAnnounce();
      const kv = announceKV();
      kv.put.mockRejectedValue(new Error('KV unavailable'));
      const logLines = captureLogLines();

      const res = await postPush(JSON.stringify(pushPayload({ head_commit: changelogCommit() })), {
        env: githubEnv(kv),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, version: '5.0.0' });
      expect(sendAnnouncement).toHaveBeenCalledOnce();

      const warned = logLines.filter((line) => line.includes('Announcement memo write failed'));
      expect(warned).toHaveLength(1);
      expect(warned[0]).toContain('"level":"warn"');
      expect(warned[0]).toContain('"version":"5.0.0"');
    });
  });

  describe('POST / - Discord interactions', () => {
    describe('Signature verification', () => {
      it('should reject invalid signature', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        vi.mocked(checkRateLimit).mockResolvedValue({
          allowed: true,
          remaining: 14,
          resetAt: Date.now() + 60000,
        });
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        vi.mocked(checkRateLimit).mockResolvedValue({
          allowed: true,
          remaining: 14,
          resetAt: Date.now() + 60000,
        });
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        const { checkRateLimit, formatRateLimitMessage } =
          await import('./services/rate-limiter.js');

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

      // FINDING-033 (2026-08-21 security audit): /stats summary runs paginated
      // KV list() scans and was on the rate-limit exemption list
      it('applies the per-user rate limiter to /stats like any other command', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        const { checkRateLimit, formatRateLimitMessage } =
          await import('./services/rate-limiter.js');
        const { handleStatsCommand } = await import('./handlers/commands/index.js');

        const interaction = {
          type: InteractionType.APPLICATION_COMMAND,
          data: { name: 'stats', options: [{ name: 'summary', type: 1 }] },
          user: { id: 'user-123' },
        };
        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify(interaction),
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
          body: JSON.stringify(interaction),
        });

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(checkRateLimit).toHaveBeenCalledWith(
          expect.anything(),
          'user-123',
          'stats',
          // the request logger — the limiter's degradation warnings are
          // attributed to this request (FINDING-007)
          expect.objectContaining({ warn: expect.any(Function) }),
          undefined,
        );
        expect(data.data!.flags).toBe(64);
        expect(handleStatsCommand).not.toHaveBeenCalled();
      });

      // FINDING-020 (2026-08-29 security audit): /about, /manual and
      // /changelog were exempt from the limiter, yet each call still made the
      // three shared hot-key KV counter writes in trackCommandWithKV — the
      // cheapest denial-of-service in the worker. They now take the 30/min
      // tier worker-kit already defined for them.
      it.each([
        ['about', 'handleAboutCommand'],
        ['manual', 'handleManualCommand'],
        ['changelog', 'handleChangelogCommand'],
      ] as const)('rate-limits /%s like any other command', async (command, handlerName) => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        const { checkRateLimit, formatRateLimitMessage } = await import(
          './services/rate-limiter.js'
        );
        const handlers = await import('./handlers/commands/index.js');

        const interaction = {
          type: InteractionType.APPLICATION_COMMAND,
          data: { name: command },
          user: { id: 'user-123' },
        };
        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify(interaction),
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
          body: JSON.stringify(interaction),
        });

        // Bind the 30/min tier so the assertion below proves the dispatcher
        // really lifts the binding off `env` into the limiter config.
        const env = { ...mockEnv, RL_30: { limit: vi.fn() } } as unknown as Env;
        const res = await app.fetch(req, env, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(checkRateLimit).toHaveBeenCalledWith(
          expect.objectContaining({
            bindings: expect.objectContaining({ RL_30: env.RL_30 }),
            kv: expect.anything(),
          }),
          'user-123',
          command,
          expect.objectContaining({ warn: expect.any(Function) }),
          undefined,
        );
        expect(data.data!.flags).toBe(64); // Ephemeral
        expect(data.data!.content).toBe('Rate limited');
        expect(vi.mocked(handlers[handlerName])).not.toHaveBeenCalled();
      });

      /**
       * FINDING-007 follow-up: the limiter's two degradation signals — the
       * one-time "running on the KV fallback" warning and the per-request
       * fail-open report — only exist if the dispatcher actually hands
       * `checkRateLimit` the request logger. Both were unreachable in the
       * deployed worker while the call sites passed `undefined`. These run
       * the REAL rate limiter through the real route and read the JSON the
       * request logger writes.
       */
      describe('limiter degradation reaches the request logger', () => {
        let logLines: string[];
        let logSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(async () => {
          const actual = await vi.importActual<typeof import('./services/rate-limiter.js')>(
            './services/rate-limiter.js',
          );
          actual.resetRateLimiterInstance();
          // Undo this file's blanket mock for these tests only.
          const { checkRateLimit } = await import('./services/rate-limiter.js');
          vi.mocked(checkRateLimit).mockImplementation(actual.checkRateLimit);

          // @xivdyetools/logger's worker preset (JsonAdapter) writes every
          // level as one JSON line through console.log.
          logLines = [];
          logSpy = vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
            logLines.push(String(line));
          });
        });

        afterEach(async () => {
          logSpy.mockRestore();
          // `vi.clearAllMocks()` clears calls but not implementations — put
          // the module mock back so later tests get the bare vi.fn() again.
          const { checkRateLimit } = await import('./services/rate-limiter.js');
          vi.mocked(checkRateLimit).mockReset();
        });

        async function dispatchAbout(env: Env): Promise<void> {
          const { verifyDiscordRequest } = await import('@xivdyetools/auth');
          const { handleAboutCommand } = await import('./handlers/commands/index.js');
          const interaction = {
            type: InteractionType.APPLICATION_COMMAND,
            data: { name: 'about' },
            user: { id: 'user-123' },
          };
          vi.mocked(verifyDiscordRequest).mockResolvedValue({
            isValid: true,
            body: JSON.stringify(interaction),
            error: '',
          });
          vi.mocked(handleAboutCommand).mockResolvedValue(new Response('{}'));

          await app.fetch(
            new Request('http://localhost/', {
              method: 'POST',
              body: JSON.stringify(interaction),
            }),
            env,
            mockCtx,
          );
        }

        it('warns that it is running on the KV fallback when no RL_* tier is bound', async () => {
          await dispatchAbout(mockEnv); // mockEnv binds KV only

          const warning = logLines.find((line) => line.includes('KV fallback'));
          expect(warning).toBeDefined();
          expect(warning).toContain('no RL_* binding bound');
          // Written by the request-scoped logger, so it carries the request id.
          expect(warning).toContain('"requestId"');
        });

        it('reports the fail-open when the rate-limit binding throws', async () => {
          const { handleAboutCommand } = await import('./handlers/commands/index.js');
          const failing = {
            limit: vi.fn().mockRejectedValue(new Error('binding unavailable')),
          };

          await dispatchAbout({ ...mockEnv, RL_30: failing } as unknown as Env);

          expect(failing.limit).toHaveBeenCalled();
          const failOpen = logLines.find((line) => line.includes('Rate limit check failed'));
          expect(failOpen).toBeDefined();
          expect(failOpen).toContain('"requestId"');
          // Fail-open: the command still runs.
          expect(handleAboutCommand).toHaveBeenCalled();
        });
      });

      it('should handle unknown command', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        vi.mocked(checkRateLimit).mockResolvedValue({
          allowed: true,
          remaining: 14,
          resetAt: Date.now() + 60000,
        });

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

    describe('first-run notice (FINDING-008)', () => {
      it('flags the first-run KV marker with a 180-day TTL, not a permanent one', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        const { handleAboutCommand } = await import('./handlers/commands/index.js');
        const { sendFollowUp } = await import('./utils/discord-api.js');

        const body = {
          type: InteractionType.APPLICATION_COMMAND,
          data: { name: 'about' },
          user: { id: 'user-firstrun' },
        };
        vi.mocked(verifyDiscordRequest).mockResolvedValue({
          isValid: true,
          body: JSON.stringify(body),
          error: '',
        });
        vi.mocked(checkRateLimit).mockResolvedValue({
          allowed: true,
          remaining: 14,
          resetAt: Date.now() + 60000,
        });
        vi.mocked(handleAboutCommand).mockResolvedValue(new Response());
        vi.mocked(sendFollowUp).mockResolvedValue(new Response(null, { status: 200 }));

        // handleCommand fires the notice via ctx.waitUntil without awaiting
        // it, so this ExecutionContext keeps every waitUntil promise for the
        // test to await once app.fetch() returns.
        const collected: Promise<unknown>[] = [];
        const ctx = {
          waitUntil: vi.fn((p: Promise<unknown>) => {
            collected.push(p);
          }),
          passThroughOnException: vi.fn(),
        } as unknown as ExecutionContext;

        const req = new Request('http://localhost/', {
          method: 'POST',
          body: JSON.stringify(body),
        });

        await app.fetch(req, mockEnv, ctx);
        await Promise.all(collected);

        expect(mockEnv.KV.put).toHaveBeenCalledWith(
          'firstrun:v5:user-firstrun',
          '1',
          expect.objectContaining({ expirationTtl: 15_552_000 }),
        );
      });
    });

    describe('AUTOCOMPLETE interactions', () => {
      // OPT-007 rate-limits autocomplete; the bare vi.fn() mock resolved to
      // undefined and `acLimit.allowed` threw, so this block had been red.
      beforeEach(async () => {
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        vi.mocked(checkRateLimit).mockResolvedValue({
          allowed: true,
          remaining: 10,
          resetAt: Date.now() + 60_000,
        });
      });

      it('should handle dye autocomplete with query', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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

      // 2026-08-29: the value was the English canonical name (so `/dye info
      // name: Carmine Red` echoed English under every locale); it is the
      // stainID now, and every resolver accepts one.
      it('offers dye choices whose value is the stainID', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        const body = JSON.stringify({
          type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
          data: {
            name: 'harmony',
            options: [{ name: 'dye', value: 'snow', focused: true }],
          },
          user: { id: 'user-123' },
        });
        vi.mocked(verifyDiscordRequest).mockResolvedValue({ isValid: true, body, error: '' });

        const res = await app.fetch(
          new Request('http://localhost/', { method: 'POST', body }),
          mockEnv,
          mockCtx,
        );
        const data = (await res.json()) as InteractionResponseBody;
        const choices = data.data!.choices as Array<{ name: string; value: string }>;

        expect(choices[0]).toEqual({ name: 'Snow White (#FFFFFF)', value: '1' });
        for (const choice of choices) expect(choice.value).toMatch(/^\d{1,3}$/);
      });

      // The typed query may itself be a stainID or a legacy item id (or a name
      // in any supported locale — that path is searchDyesByName's own tests).
      it('resolves a numeric query — stainID or legacy item id — to that one dye', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        const ask = async (value: string): Promise<Array<{ name: string; value: string }>> => {
          const body = JSON.stringify({
            type: InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE,
            data: { name: 'harmony', options: [{ name: 'dye', value, focused: true }] },
            user: { id: 'user-123' },
          });
          vi.mocked(verifyDiscordRequest).mockResolvedValue({ isValid: true, body, error: '' });
          const res = await app.fetch(
            new Request('http://localhost/', { method: 'POST', body }),
            mockEnv,
            mockCtx,
          );
          return ((await res.json()) as InteractionResponseBody).data!.choices as Array<{
            name: string;
            value: string;
          }>;
        };

        expect(await ask('2')).toEqual([{ name: 'Ash Grey (#CCCCCC)', value: '2' }]);
        expect(await ask('13114')).toEqual([{ name: 'Dye 13114 (#FF0000)', value: '7' }]);
      });

      it('should handle preset autocomplete for approved presets', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        await res.json();
        expect(searchPresetsForAutocomplete).toHaveBeenCalledWith(mockEnv, 'test', {
          status: 'approved',
        });
      });

      it('should handle preset edit autocomplete (user own presets)', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        await res.json();
        expect(getMyPresets).toHaveBeenCalledWith(mockEnv, 'user-123');
      });

      it('should handle preset show autocomplete (approved presets)', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        expect(searchPresetsForAutocomplete).toHaveBeenCalledWith(mockEnv, 'test', {
          status: 'approved',
        });
      });

      it('should handle preset dye autocomplete', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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

      it('should handle getMyPresets with empty presets', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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
          headers: { Authorization: 'Bearer some-secret' },
          body: JSON.stringify({ type: 'submission' }),
        });

        const res = await app.fetch(req, envWithoutSecret, mockCtx);
        expect(res.status).toBe(401);
      });
    });

    describe('Analytics error handling', () => {
      it('should handle analytics tracking failure gracefully', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
        vi.mocked(checkRateLimit).mockResolvedValue({
          allowed: true,
          remaining: 14,
          resetAt: Date.now() + 60000,
        });
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

    describe('Tier A command trace', () => {
      function post(body: unknown) {
        return new Request('http://localhost/', { method: 'POST', body: JSON.stringify(body) });
      }
      async function allowRateLimit() {
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, remaining: 14, resetAt: Date.now() + 60000 });
      }
      async function verified(body: unknown) {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
        vi.mocked(verifyDiscordRequest).mockResolvedValue({ isValid: true, body: JSON.stringify(body), error: '' });
      }
      /** A real-ish ExecutionContext that keeps every waitUntil promise so the test can await the trace's write. */
      function collectingCtx() {
        const collected: Promise<unknown>[] = [];
        const ctx = {
          waitUntil: vi.fn((p: Promise<unknown>) => { collected.push(p); }),
          passThroughOnException: vi.fn(),
        } as unknown as ExecutionContext;
        return { ctx, collected };
      }
      afterEach(async () => {
        // The outer beforeEach only clears call history: a `mockRejectedValue`
        // or an `allowed: false` armed here would otherwise leak into every
        // later test that does not re-arm the mock.
        const { handleHarmonyCommand } = await import('./handlers/commands/index.js');
        vi.mocked(handleHarmonyCommand).mockReset();
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        vi.mocked(checkRateLimit).mockReset();
      });

      it('writes one datapoint for an immediate command with subcommand and locale bucket', async () => {
        const body = {
          type: InteractionType.APPLICATION_COMMAND,
          data: { name: 'dye', options: [{ name: 'info', type: 1, options: [] }] },
          member: { user: { id: 'user-123' } },
          guild_id: 'g1',
          locale: 'ja',
        };
        await verified(body);
        await allowRateLimit();
        const { handleDyeCommand } = await import('./handlers/commands/index.js');
        vi.mocked(handleDyeCommand).mockResolvedValue(new Response());
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const { ctx, collected } = collectingCtx();

        await app.fetch(post(body), mockEnv, ctx);
        await Promise.all(collected);

        expect(trackCommandWithKV).toHaveBeenCalledTimes(1);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({
          commandName: 'dye', subcommand: 'info', userId: 'user-123', guildId: 'g1', locale: 'ja',
          success: true, outcome: 'ok', kind: 'command', latencyMs: expect.any(Number),
        }));
      });

      it('waits for a deferring handler\'s work and records its marked outcome', async () => {
        const body = { type: InteractionType.APPLICATION_COMMAND, data: { name: 'harmony' }, user: { id: 'user-123' } };
        await verified(body);
        await allowRateLimit();
        const { handleHarmonyCommand } = await import('./handlers/commands/index.js');
        const { markCommandOutcome } = await import('./services/command-trace.js');
        let release!: () => void;
        const work = new Promise<void>((r) => { release = r; });
        vi.mocked(handleHarmonyCommand).mockImplementation(async (interaction, _env, handlerCtx) => {
          handlerCtx.waitUntil(work.then(() => { markCommandOutcome(interaction, 'render'); }));
          return new Response(JSON.stringify({ type: 5 }));
        });
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const { ctx, collected } = collectingCtx();

        await app.fetch(post(body), mockEnv, ctx);
        expect(trackCommandWithKV).not.toHaveBeenCalled();
        release();
        await Promise.all(collected);

        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({
          commandName: 'harmony', success: false, outcome: 'render', kind: 'command',
        }));
      });

      it('records a rate-limited request as rate_limited', async () => {
        const body = { type: InteractionType.APPLICATION_COMMAND, data: { name: 'harmony' }, user: { id: 'user-123' } };
        await verified(body);
        const { checkRateLimit } = await import('./services/rate-limiter.js');
        vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const { ctx, collected } = collectingCtx();

        await app.fetch(post(body), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({
          commandName: 'harmony', success: false, outcome: 'rate_limited',
        }));
      });

      it('records a handler throw as unknown', async () => {
        const body = { type: InteractionType.APPLICATION_COMMAND, data: { name: 'harmony' }, user: { id: 'user-123' } };
        await verified(body);
        await allowRateLimit();
        const { handleHarmonyCommand } = await import('./handlers/commands/index.js');
        vi.mocked(handleHarmonyCommand).mockRejectedValue(new Error('boom'));
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const { ctx, collected } = collectingCtx();

        await app.fetch(post(body), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, expect.objectContaining({ success: false, outcome: 'unknown' }));
      });

      it('writes no datapoint when the interaction carries no command name', async () => {
        const body = { type: InteractionType.APPLICATION_COMMAND, data: {}, user: { id: 'user-123' } };
        await verified(body);
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const { ctx, collected } = collectingCtx();

        await app.fetch(post(body), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).not.toHaveBeenCalled();
      });

      it('writes a button datapoint for copy buttons and nothing for other buttons', async () => {
        const { handleButtonInteraction } = await import('./handlers/buttons/index.js');
        vi.mocked(handleButtonInteraction).mockResolvedValue(new Response());
        const { trackCommandWithKV } = await import('./services/analytics.js');
        vi.mocked(trackCommandWithKV).mockClear();
        const { ctx, collected } = collectingCtx();

        const copy = { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: 'copy_hex_FF0000', component_type: 2 }, user: { id: 'user-123' }, locale: 'de' };
        await verified(copy);
        await app.fetch(post(copy), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).toHaveBeenCalledWith(mockEnv, {
          commandName: 'button', userId: 'user-123', guildId: undefined, success: true,
          outcome: 'ok', subcommand: 'copy_hex', locale: 'de', kind: 'button', latencyMs: 0,
        });

        vi.mocked(trackCommandWithKV).mockClear();
        const other = { type: InteractionType.MESSAGE_COMPONENT, data: { custom_id: 'preview_approve_1', component_type: 2 }, user: { id: 'user-123' } };
        await verified(other);
        await app.fetch(post(other), mockEnv, ctx);
        await Promise.all(collected);
        expect(trackCommandWithKV).not.toHaveBeenCalled();
      });
    });

    describe('Preset edit autocomplete without user', () => {
      it('should return empty choices when no user ID available for edit', async () => {
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');
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
          { name: 'accessibility', handler: commands.handleAccessibilityCommand },
          { name: 'manual', handler: commands.handleManualCommand },
          { name: 'comparison', handler: commands.handleComparisonCommand },
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
          vi.mocked(checkRateLimit).mockResolvedValue({
            allowed: true,
            remaining: 14,
            resetAt: Date.now() + 60000,
          });
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
        const { verifyDiscordRequest } = await import('@xivdyetools/auth');

        // Import stats handler - need to add it to the mock
        vi.doMock('./handlers/commands/index.js', async (importOriginal) => {
          const original = (await importOriginal()) as Record<string, unknown>;
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
  });
});
