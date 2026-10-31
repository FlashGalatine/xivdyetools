import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestHarness, TestHarnessOptions } from 'wrangler';
import { mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, URL } from 'node:url';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const providerName = 'xivdyetools-discord-worker-dev';
const path = '/webhooks/preset-submission';
const secret = 'fake-local-notification-secret-at-least-32-characters';
const payload = JSON.stringify({
  type: 'preview_image',
  preset: { id: '12345678-1234-4123-8123-123456789abc', name: 'Local test' },
  preview_image_key:
    '12345678-1234-4123-8123-123456789abc/abcdefab-cdef-4def-8abc-defabcdefabc.webp',
});
let harness: TestHarness;
let compatibility: Array<{ status: number; body: unknown }>;
let shortSecretStatus: number;
const saved = new Map<string, string | undefined>();
const init = (body = payload, auth = `Bearer ${secret}`) => ({
  method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/json' },
  body,
});

beforeAll(async () => {
  // Refuse, without reading, any real local secret file next to the ACTUAL config.
  if (
    readdirSync(source('..')).some((name) => name === '.dev.vars' || name.startsWith('.dev.vars.'))
  ) {
    throw new Error('Runtime tests require a checkout without local .dev.vars files');
  }
  // A short isolated OS temp root avoids Windows child-process path limits.
  const temporary = mkdtempSync(resolve(tmpdir(), 'd8ng-'));
  const root = resolve(
    source('../../../.superpowers/sdd/REMEDIATION_PLAN'),
    `guard-fix1-runtime-${process.pid}`,
  );
  mkdirSync(resolve(root, 'profile'), { recursive: true });
  for (const [key, value] of Object.entries({
    TEMP: temporary,
    TMP: temporary,
    USERPROFILE: resolve(root, 'profile'),
    APPDATA: resolve(root, 'roaming'),
    LOCALAPPDATA: resolve(root, 'local'),
    XDG_CONFIG_HOME: resolve(root, 'config'),
    XDG_CACHE_HOME: resolve(root, 'cache'),
    WRANGLER_LOG_PATH: resolve(root, 'logs'),
    WRANGLER_SEND_METRICS: 'false',
    CLOUDFLARE_API_TOKEN: 'fake-local-only-token',
    CLOUDFLARE_ACCOUNT_ID: '00000000000000000000000000000000',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
  })) {
    saved.set(key, process.env[key]);
    process.env[key] = value;
  }
  // Wrangler must be imported AFTER profile/cache/config/credentials are isolated.
  const { createTestHarness } = await import('wrangler');
  const options = (flag?: string, short = false): TestHarnessOptions => ({
    root,
    workers: [
      {
        config: {
          name: 'notification-caller',
          main: source('./fixtures/preset-notification-caller.ts'),
          compatibility_date: '2026-10-23',
          services: [
            { binding: 'DISCORD_WORKER', service: providerName, entrypoint: 'PresetNotifications' },
          ],
        },
      },
      {
        configPath: source('../wrangler.toml'),
        vars: {
          ...(flag === undefined ? {} : { PRESET_WEBHOOK_BINDING_ONLY: flag }),
          ...(short ? { ENVIRONMENT: 'production' } : {}),
        },
        secrets: {
          DISCORD_TOKEN: 'fake-local-discord-token',
          DISCORD_PUBLIC_KEY: '0'.repeat(64),
          INTERNAL_WEBHOOK_SECRET: short ? 'x'.repeat(31) : secret,
        },
        bindingOverrides: {
          PRESETS_API: 'notification-unused',
          UNIVERSALIS_PROXY: 'notification-unused',
          IMAGE_WORKER: 'notification-unused',
        },
      },
      {
        config: {
          name: 'notification-unused',
          main: source('./fixtures/unused-service.ts'),
          compatibility_date: '2026-10-23',
        },
      },
    ],
  });
  // The shipped compatibility configuration must serve both old/default and named Fetchers.
  harness = createTestHarness(options());
  await harness.listen();
  compatibility = await Promise.all(
    [provider(), caller()].map(async (worker) => {
      const response = await worker.fetch(`https://internal${path}`, init());
      return { status: response.status, body: await response.json() };
    }),
  );
  // Test each configuration from a fresh runtime; multiworker hot reload can expose old vars.
  await harness.close();
  harness = createTestHarness(options('true', true));
  await harness.listen();
  const shortResponse = await caller().fetch(`https://internal${path}`, init());
  shortSecretStatus = shortResponse.status;
  await shortResponse.arrayBuffer();
  await harness.close();
  harness = createTestHarness(options('true'));
  await harness.listen();
}, 60000);

afterAll(async () => {
  try {
    if (harness) await harness.close();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}, 30000);
const provider = () => harness.getWorker(providerName);
const caller = () => harness.getWorker('notification-caller');

describe('actual Wrangler entrypoint in local workerd', () => {
  it('supports unchanged producer Fetcher JSON/bearer requests through default and named entrypoints before cutover', () => {
    expect(compatibility).toEqual([
      { status: 200, body: { success: true } },
      { status: 200, body: { success: true } },
    ]);
    expect(shortSecretStatus).toBe(503);
  });

  it('requires the named binding and bearer after cutover', async () => {
    for (const auth of [`Bearer ${secret}`, 'Bearer wrong']) {
      const response = await provider().fetch(
        `https://internal${path}`,
        init('invalid json', auth),
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    }
    const privateResponse = await caller().fetch(`https://internal${path}`, init());
    expect(privateResponse.status).toBe(200);
    expect(await privateResponse.json()).toEqual({ success: true });
    const unauthorized = await caller().fetch(
      `https://internal${path}`,
      init('invalid json', 'Bearer wrong'),
    );
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: 'Unauthorized' });
  });

  it('rejects wrong method/path at the named entrypoint before any public router delegation', async () => {
    for (const [method, target] of [
      ['OPTIONS', path],
      ['GET', '/health'],
      ['POST', '/webhooks/github'],
      ['POST', '/'],
    ]) {
      const response = await caller().fetch(`https://internal${target}`, { method });
      expect(response.status, `${method} ${target}`).toBe(404);
      expect(await response.json()).toEqual({ error: 'Not found' });
    }
  });

  it('keeps JSON validation and actual-byte streaming caps on the named Fetcher', async () => {
    for (const body of [
      'invalid json',
      JSON.stringify({ type: 'wrong' }),
      JSON.stringify({ type: 'submission' }),
    ]) {
      const response = await caller().fetch(`https://internal${path}`, init(body));
      expect(response.status).toBe(400);
      await response.arrayBuffer();
    }
    // String length stays below the cap; its received UTF-8 bytes exceed it.
    const oversized = JSON.stringify({ type: 'submission', text: '😀'.repeat(3000) });
    expect(oversized.length).toBeLessThan(10240);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(oversized));
        controller.close();
      },
    });
    const response = await caller().fetch(`https://internal${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      body,
      duplex: 'half',
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Payload too large' });
  });

  it('never grants public requests capability from forged headers/query/body/IP or concurrent private traffic', async () => {
    const [privateResponse, publicResponse] = await Promise.all([
      caller().fetch(`https://internal${path}`, init()),
      provider().fetch(`https://internal${path}?presetNotificationEntrypoint=true&binding=true`, {
        ...init(JSON.stringify({ presetNotificationEntrypoint: true, binding: true })),
        headers: {
          ...init().headers,
          'CF-Connecting-IP': '127.0.0.1',
          'X-Preset-Notification-Entrypoint': 'true',
          'X-Internal-Webhook': 'true',
        },
      }),
    ]);
    expect(privateResponse.status).toBe(200);
    await privateResponse.arrayBuffer();
    expect(publicResponse.status).toBe(404);
    await publicResponse.arrayBuffer();
    expect((await provider().fetch(`https://internal${path}`, init())).status).toBe(404);
  });

  it('does not let public floods consume an admission quota for valid named notifications', async () => {
    for (let i = 0; i < 40; i++) {
      const publicResponse = await provider().fetch(
        `https://internal${path}`,
        init('invalid json', `Bearer guess-${i}`),
      );
      expect(publicResponse.status).toBe(404);
      await publicResponse.arrayBuffer();
      const privateResponse = await caller().fetch(`https://internal${path}`, init());
      expect(privateResponse.status).toBe(200);
      await privateResponse.arrayBuffer();
    }
  });

  it('preserves public health, GitHub and signed-interaction authentication routes', async () => {
    const health = await provider().fetch('/health');
    expect(health.status).toBe(200);
    await health.arrayBuffer();
    const interaction = await provider().fetch('/', { method: 'POST', body: '{}' });
    expect(interaction.status).toBe(401);
    await interaction.arrayBuffer();
    const github = await provider().fetch('/webhooks/github', { method: 'POST', body: '{}' });
    expect(github.status).toBe(401);
    await github.arrayBuffer();
    for (const target of ['/PresetNotifications', '/fetchPresetNotification']) {
      expect((await provider().fetch(target, { method: 'POST', body: '{}' })).status).toBe(404);
    }
  });
});
