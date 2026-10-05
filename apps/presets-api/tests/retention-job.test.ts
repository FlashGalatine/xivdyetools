/**
 * Daily retention job: all three prunes run, one failing never stops the
 * others, and the Cron entry point hands the work to ctx.waitUntil.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  events: vi.fn(),
  failed: vi.fn(),
  moderation: vi.fn(),
}));

vi.mock('../src/services/rate-limit-service', () => ({ pruneSubmissionEvents: mocks.events }));
vi.mock('../src/services/notification-service', () => ({ pruneFailedNotifications: mocks.failed }));
vi.mock('../src/services/moderation-retention-service', () => ({
  pruneModerationRecords: mocks.moderation,
}));

import { runRetentionJob, scheduled } from '../src/retention-job';
import { createMockEnv } from './test-utils';

describe('retention job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.events.mockResolvedValue(undefined);
    mocks.failed.mockResolvedValue(undefined);
    mocks.moderation.mockResolvedValue(undefined);
  });

  it('invokes all three prunes with the database', async () => {
    const db = {} as D1Database;
    const result = await runRetentionJob(db);

    expect(mocks.events).toHaveBeenCalledWith(db, expect.anything());
    expect(mocks.failed).toHaveBeenCalledWith(db, expect.anything());
    expect(mocks.moderation).toHaveBeenCalledWith(db, expect.anything());
    expect(result).toEqual({ fulfilled: 3, rejected: 0 });
  });

  it('still runs the others when one prune throws, and logs only the error name', async () => {
    mocks.failed.mockRejectedValue(new TypeError('statement text: DELETE FROM failed_notifications ...'));
    const warn = vi.fn();

    const result = await runRetentionJob({} as D1Database, { warn });

    expect(mocks.events).toHaveBeenCalledTimes(1);
    expect(mocks.moderation).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fulfilled: 2, rejected: 1 });
    expect(warn).toHaveBeenCalledWith('[retention-job] a prune threw', { cause: 'TypeError' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('DELETE FROM');
  });

  it('survives every prune throwing', async () => {
    mocks.events.mockRejectedValue('boom');
    mocks.failed.mockRejectedValue(new Error('x'));
    mocks.moderation.mockRejectedValue(new Error('y'));

    await expect(runRetentionJob({} as D1Database, { warn: vi.fn() })).resolves.toEqual({
      fulfilled: 0,
      rejected: 3,
    });
  });

  it('scheduled() keeps the isolate alive with ctx.waitUntil and does not throw', async () => {
    const env = createMockEnv();
    const waitUntil = vi.fn();

    scheduled({ cron: '23 4 * * *' } as ScheduledController, env, { waitUntil } as unknown as ExecutionContext);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(mocks.events).toHaveBeenCalledWith(env.DB, expect.anything());
    expect(mocks.failed).toHaveBeenCalledTimes(1);
    expect(mocks.moderation).toHaveBeenCalledTimes(1);
  });
});
