/**
 * Tests for the main Hono app and interaction handlers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  sendAnnouncement: vi.fn().mockResolvedValue(undefined),
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
    const githubEnv = (): Env => ({
      ...mockEnv,
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

    const postPush = (body: string, env: Env = githubEnv()) =>
      app.fetch(
        new Request('http://localhost/webhooks/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub-Signature-256': 'sha256=irrelevant-mocked',
          },
          body,
        }),
        env,
        mockCtx,
      );

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

    it('announces when only head_commit lists CHANGELOG-laymans.md (commits truncated)', async () => {
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');
      const { parseLatestVersion } = await import('./services/changelog-parser.js');
      const { sendAnnouncement } = await import('./services/announcements.js');
      vi.mocked(verifyGitHubSignature).mockResolvedValue(true);
      const entry = { version: '5.0.0', date: '2026-08-28', sections: [] };
      vi.mocked(parseLatestVersion).mockReturnValue(entry as never);
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('## [5.0.0] - 2026-08-28\n', { status: 200 }));

      try {
        const mergeCommit = {
          id: 'abc',
          message: 'Merge pull request',
          timestamp: '2026-08-28T23:36:41Z',
          url: 'https://github.com/FlashGalatine/xivdyetools/commit/abc',
          author: { name: 'x', email: 'x@example.com', username: 'x' },
          added: [],
          removed: [],
          modified: ['CHANGELOG-laymans.md'],
        };
        const res = await postPush(
          JSON.stringify(pushPayload({ commits: [], head_commit: mergeCommit })),
        );

        expect(res.status).toBe(200);
        expect(fetchSpy).toHaveBeenCalledWith(
          'https://raw.githubusercontent.com/FlashGalatine/xivdyetools/main/CHANGELOG-laymans.md',
          expect.anything(),
        );
        expect(sendAnnouncement).toHaveBeenCalledWith(
          'test-token',
          'test-announcement-channel',
          entry,
          'https://github.com/FlashGalatine/xivdyetools',
        );
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('skips when neither commits nor head_commit touch the changelog', async () => {
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');
      const { sendAnnouncement } = await import('./services/announcements.js');
      vi.mocked(verifyGitHubSignature).mockResolvedValue(true);

      const res = await postPush(
        JSON.stringify(
          pushPayload({
            head_commit: {
              id: 'def',
              message: 'chore',
              timestamp: '2026-08-29T00:00:00Z',
              url: 'https://github.com/FlashGalatine/xivdyetools/commit/def',
              author: { name: 'x', email: 'x@example.com', username: 'x' },
              added: [],
              removed: [],
              modified: ['README.md'],
            },
          }),
        ),
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ message: 'Changelog not modified, skipping' });
      expect(sendAnnouncement).not.toHaveBeenCalled();
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
          undefined,
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

        const res = await app.fetch(req, mockEnv, mockCtx);
        expect(res.status).toBe(200);
        const data = (await res.json()) as InteractionResponseBody;
        expect(checkRateLimit).toHaveBeenCalledWith(
          expect.anything(),
          'user-123',
          command,
          undefined,
          undefined,
        );
        expect(data.data!.flags).toBe(64); // Ephemeral
        expect(data.data!.content).toBe('Rate limited');
        expect(vi.mocked(handlers[handlerName])).not.toHaveBeenCalled();
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
