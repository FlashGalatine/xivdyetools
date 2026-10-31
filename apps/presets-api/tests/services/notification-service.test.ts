import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notifyDiscordBot, toDeadLetterRecord,
  type PresetNotificationPayload,
  type PresetSubmissionNotification,
} from '../../src/services/notification-service';
import type { Env } from '../../src/types';

describe('submission notification dead-letter allowlist', () => {
  it('drops current and replaced links and snapshot content while retaining revision identifiers', () => {
    const payload: PresetSubmissionNotification = {
      type: 'submission', is_edit: true, edited_from_status: 'approved',
      edited_from: { name: 'Before', description: 'Before description', tags: ['before'], dyes: [1, 2, 3], example_link: 'https://ffxiv.eorzeacollection.com/glamour/private-old?secret=old' },
      preset: {
        id: 'p', name: 'After', description: 'After description', category_id: 'jobs', dyes: [1, 2, 3], tags: ['after'],
        author_name: 'Owner', author_discord_id: 'owner', status: 'pending', content_revision: 7, moderation_status: 'flagged', source: 'bot', created_at: '2026-10-27T12:00:00.000Z',
        previous_values: { name: 'Approved', description: 'Approved description', tags: ['approved'], dyes: [1, 2, 3], example_link: 'https://ffxiv.eorzeacollection.com/glamour/private-snapshot?secret=snapshot' },
        ...{ example_link: 'https://ffxiv.eorzeacollection.com/glamour/private-current?secret=current' },
      },
    };
    expect(toDeadLetterRecord(payload)).toEqual({ type: 'submission', preset_id: 'p', moderation_status: 'flagged', content_revision: 7 });
  });
});

const secret = 'default-notification-test-secret-at-least-32';
const submission: PresetSubmissionNotification = {
  type: 'submission',
  is_edit: false,
  preset: {
    id: 'preset-123', name: 'New preset', description: 'Review this preset',
    category_id: 'jobs', dyes: [1, 2, 3], tags: ['test'],
    author_name: 'Owner', author_discord_id: '12345678901234567',
    status: 'pending', content_revision: 7, moderation_status: 'flagged',
    source: 'web', created_at: '2026-10-29T12:00:00.000Z',
    previous_values: null,
  },
};
const before = {
  name: 'Approved preset', description: 'Before edit', dyes: [3, 2, 1],
  tags: ['before'], example_link: null,
};
const edit: PresetSubmissionNotification = {
  ...submission,
  is_edit: true,
  edited_from_status: 'approved',
  edited_from: before,
  preset: { ...submission.preset, content_revision: 8, previous_values: before },
};
const preview: PresetNotificationPayload = {
  type: 'preview_image',
  preview_image_key: 'preset-123/01234567-89ab-4cde-8fab-0123456789ab.webp',
  preset: { id: 'preset-123', name: 'New preset', author_name: 'Owner' },
};
const cases: [string, PresetNotificationPayload][] = [
  ['submission', submission], ['edit', edit], ['preview', preview],
];

describe('notifyDiscordBot default Fetch binding protocol', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function harness() {
    const requests: Request[] = [];
    const bodies: unknown[] = [];
    const fetch = vi.fn(async (request: Request) => {
      requests.push(request);
      // Consume the actual Request, so retries must construct a fresh body.
      bodies.push(await request.json());
      return new Response(null, { status: 200 });
    });
    const env = {
      DISCORD_WORKER: { fetch }, INTERNAL_WEBHOOK_SECRET: secret,
    } as unknown as Env;
    const logger = { info: vi.fn() };
    return { env, fetch, requests, bodies, logger };
  }

  it.each(cases)('sends %s unchanged to the existing default webhook', async (_name, payload) => {
    const h = harness();
    await notifyDiscordBot(h.env, payload, h.logger);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.requests[0].url).toBe('https://internal/webhooks/preset-submission');
    expect(h.requests[0].method).toBe('POST');
    expect(h.requests[0].headers.get('Content-Type')).toBe('application/json');
    expect(h.requests[0].headers.get('Authorization')).toBe(`Bearer ${secret}`);
    expect(h.bodies).toEqual([payload]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(cases)('retries a transient %s failure with its complete payload', async (_name, payload) => {
    const h = harness();
    const capture = h.fetch.getMockImplementation()!;
    h.fetch.mockImplementationOnce(async request => {
      await capture(request);
      return new Response(null, { status: 503 });
    });
    const result = notifyDiscordBot(h.env, payload, h.logger).then(() => null, error => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeNull();
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.requests[0]).not.toBe(h.requests[1]);
    expect(h.bodies).toEqual([payload, payload]);
    for (const request of h.requests) {
      expect(request.url).toBe('https://internal/webhooks/preset-submission');
      expect(request.method).toBe('POST');
      expect(request.headers.get('Authorization')).toBe(`Bearer ${secret}`);
    }
    expect(h.logger.info).toHaveBeenCalledWith('Discord notification succeeded on retry 1');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a network failure and preserves the submission body', async () => {
    const h = harness();
    h.fetch.mockRejectedValueOnce(new Error('binding unavailable'));
    const result = notifyDiscordBot(h.env, submission, h.logger).then(() => null, error => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeNull();
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.bodies).toEqual([submission]);
  });

  it('rejects a permanent 4xx without scheduling a retry', async () => {
    const h = harness();
    h.fetch.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    await expect(notifyDiscordBot(h.env, edit, h.logger)).rejects.toThrow(
      'Discord worker returned 401: Unauthorized',
    );
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects after the initial attempt plus three transient retries', async () => {
    const h = harness();
    const capture = h.fetch.getMockImplementation()!;
    h.fetch.mockImplementation(async request => {
      await capture(request);
      return new Response(null, { status: 503 });
    });
    const failure = expect(notifyDiscordBot(h.env, preview, h.logger)).rejects.toThrow(
      'Discord worker returned 503',
    );
    await vi.runAllTimersAsync();
    await failure;
    expect(h.fetch).toHaveBeenCalledTimes(4);
    expect(h.bodies).toEqual([preview, preview, preview, preview]);
    expect(new Set(h.requests).size).toBe(4);
    expect(vi.getTimerCount()).toBe(0);
  });
});
