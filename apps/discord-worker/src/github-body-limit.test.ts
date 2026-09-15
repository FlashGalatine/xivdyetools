/** Regression coverage for FINDING-003's GitHub webhook byte limit. */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './types/env.js';

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
  handleExtractorCommand: vi.fn(),
  handleGradientCommand: vi.fn(),
  handlePreferencesCommand: vi.fn(),
  handleMixerV4Command: vi.fn(),
  handleSwatchCommand: vi.fn(),
  handleAccessibilityCommand: vi.fn(),
  handleContrastCommand: vi.fn(),
  handleManualCommand: vi.fn(),
  handleComparisonCommand: vi.fn(),
  handlePresetCommand: vi.fn(),
  handleStatsCommand: vi.fn(),
  handleBudgetCommand: vi.fn(),
  handleBudgetAutocomplete: vi.fn(),
  handleChangelogCommand: vi.fn(),
}));
vi.mock('./handlers/buttons/index.js', () => ({ handleButtonInteraction: vi.fn() }));
vi.mock('./services/analytics.js', () => ({
  trackCommandWithKV: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./services/rate-limiter.js', () => ({
  checkRateLimit: vi.fn(),
  formatRateLimitMessage: vi.fn(),
  rateLimitBindings: {},
  resolveRateLimitScope: vi.fn(),
}));
vi.mock('./services/preset-api.js', () => ({
  searchPresetsForAutocomplete: vi.fn(),
  getMyPresets: vi.fn(),
}));
vi.mock('./utils/discord-api.js', () => ({ sendMessage: vi.fn(), sendFollowUp: vi.fn() }));
vi.mock('./utils/github-verify.js', () => ({ verifyGitHubSignature: vi.fn() }));
vi.mock('./services/changelog-parser.js', () => ({ parseLatestVersion: vi.fn() }));
vi.mock('./services/announcements.js', () => ({
  sendAnnouncement: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('./services/i18n.js', () => ({
  getLocalizedDyeName: vi.fn((_itemId: number, name: string) => name),
  discordLocaleToLocaleCode: vi.fn(() => 'en'),
  resolveUserLocale: vi.fn().mockResolvedValue('en'),
  initializeLocale: vi.fn().mockResolvedValue(undefined),
  isValidLocale: vi.fn(() => true),
}));
vi.mock('./services/bot-i18n.js', () => ({
  createTranslator: vi.fn(),
  createUserTranslator: vi.fn(),
}));
vi.mock('@xivdyetools/bot-logic', () => ({
  dyeService: { getDyeById: vi.fn(), getByStainId: vi.fn() },
  searchDyesByName: vi.fn(),
}));
vi.mock('./services/command-trace.js', () => ({
  startCommandTrace: vi.fn(),
  tracedExecutionContext: vi.fn(),
  markCommandOutcome: vi.fn(),
  finishCommandTrace: vi.fn(),
  classifyError: vi.fn(),
  trackedCommandName: vi.fn(),
  subcommandOf: vi.fn(),
  interactionIdentity: vi.fn(),
  buttonKindOf: vi.fn(),
  trackButtonClick: vi.fn(),
}));
vi.mock('./services/preset-favorites.js', () => ({
  getPresetFavoriteEntries: vi.fn(),
  savePresetFavoriteEntries: vi.fn(),
}));
vi.mock('./services/budget/index.js', () => ({ getWorldAutocomplete: vi.fn() }));
vi.mock('./utils/env-validation.js', () => ({
  validateEnv: vi.fn(() => ({ valid: true, errors: [] })),
  logValidationErrors: vi.fn(),
  PRODUCTION_ENV_ERROR_PREFIX: 'Missing required env var in production:',
}));
vi.mock('@xivdyetools/worker-kit', () => ({
  requestIdMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  loggerMiddleware:
    () => async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
      c.set('logger', { error: vi.fn(), warn: vi.fn(), info: vi.fn() });
      await next();
    },
}));
vi.mock('./types/preferences.js', () => ({ CLANS_BY_RACE: {} }));
vi.mock('@xivdyetools/core', () => ({
  DyeService: class {
    getDyeById(id: number) {
      return { id, name: `Dye ${id}`, hex: '#FF0000', itemID: id, stainID: id };
    }
    getByStainId(id: number) {
      return this.getDyeById(id);
    }
    searchByName() {
      return [];
    }
    getAllDyes() {
      return [];
    }
  },
  dyeDatabase: {},
  COLOR_WHEEL_IDS: ['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'],
  isColorWheelId: () => true,
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
}));

import app from './index.js';

const MAX_BYTES = 1_048_576;
const encoder = new TextEncoder();

function githubEnv(): Env {
  return {
    DISCORD_PUBLIC_KEY: 'test-public-key',
    DISCORD_TOKEN: 'test-token',
    DISCORD_CLIENT_ID: 'test-app-id',
    PRESETS_API_URL: 'https://test-api.example.com',
    INTERNAL_WEBHOOK_SECRET: 'test-webhook-secret',
    GITHUB_WEBHOOK_SECRET: 'test-github-secret',
    ANNOUNCEMENT_CHANNEL_ID: 'test-announcement-channel',
    KV: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace,
    MODERATION_CHANNEL_ID: 'test-moderation-channel',
    SUBMISSION_LOG_CHANNEL_ID: 'test-submission-log-channel',
  };
}

function context(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;
}

function githubRequest(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/webhooks/github', {
    method: 'POST',
    headers: { 'X-Hub-Signature-256': 'sha256=test', 'X-GitHub-Event': 'ping', ...headers },
    body,
    duplex: 'half',
  } as RequestInit);
}

describe('POST /webhooks/github body byte limit (FINDING-003)', () => {
  beforeEach(async () => {
    const { verifyGitHubSignature } = await import('./utils/github-verify.js');
    vi.mocked(verifyGitHubSignature).mockReset();
  });

  it.each([
    ['no Content-Length', {}],
    ["a false Content-Length of '1'", { 'Content-Length': '1' }],
  ])(
    'cancels %s at the first over-limit chunk and returns 413 before HMAC',
    async (_label, headers) => {
      const chunks = [new Uint8Array(MAX_BYTES), new Uint8Array([0]), new Uint8Array([1, 2, 3])];
      let chunksRead = 0;
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            controller.enqueue(chunks[chunksRead++]!);
            if (chunksRead === chunks.length) controller.close();
          },
          cancel,
        },
        { highWaterMark: 0 },
      );
      const { verifyGitHubSignature } = await import('./utils/github-verify.js');

      const response = await app.fetch(githubRequest(body, headers), githubEnv(), context());

      expect(response.status).toBe(413);
      expect(chunksRead).toBe(2);
      expect(cancel).toHaveBeenCalledOnce();
      expect(verifyGitHubSignature).not.toHaveBeenCalled();
    },
  );

  it('rejects a first all-multibyte over-limit chunk by bytes before HMAC', async () => {
    const bodyText = '😀'.repeat(262_145);
    const bodyBytes = encoder.encode(bodyText);
    expect(bodyText.length).toBeLessThan(MAX_BYTES);
    expect(bodyBytes.byteLength).toBe(MAX_BYTES + 4);
    const chunks = [bodyBytes, new Uint8Array([0])];
    let chunksRead = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          controller.enqueue(chunks[chunksRead++]!);
          if (chunksRead === chunks.length) controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const { verifyGitHubSignature } = await import('./utils/github-verify.js');

    const response = await app.fetch(githubRequest(body), githubEnv(), context());

    expect(response.status).toBe(413);
    expect(chunksRead).toBe(1);
    expect(verifyGitHubSignature).not.toHaveBeenCalled();
  });

  it('preserves an exact 1 MiB UTF-8 body split inside an emoji when passed to HMAC verification', async () => {
    const bodyText = `${'a'.repeat(MAX_BYTES - 4)}😀`;
    const bodyBytes = encoder.encode(bodyText);
    expect(bodyBytes.byteLength).toBe(MAX_BYTES);
    const emojiStart = MAX_BYTES - 4;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bodyBytes.slice(0, emojiStart + 2));
        controller.enqueue(bodyBytes.slice(emojiStart + 2));
        controller.close();
      },
    });
    const { verifyGitHubSignature } = await import('./utils/github-verify.js');
    vi.mocked(verifyGitHubSignature).mockResolvedValue(true);

    const response = await app.fetch(githubRequest(body), githubEnv(), context());

    expect(response.status).toBe(200);
    expect(verifyGitHubSignature).toHaveBeenCalledWith(
      'test-github-secret',
      bodyText,
      'sha256=test',
    );
  });
});
