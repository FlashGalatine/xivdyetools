/**
 * Daily retention job: all three prunes run, one failing never stops the
 * others, and the Cron entry point hands the work to ctx.waitUntil.
 *
 * BUG-066 (2026-10-04 deep-dive): every prune catches its own D1 error, so a
 * sweep whose DELETEs all failed used to report `{ fulfilled: 3, rejected: 0 }`
 * and log nothing above a warning. Each prune now resolves to whether its sweep
 * ran, and the job counts a reported failure exactly like a throw; the promise
 * the Cron entry point hands to ctx.waitUntil rejects when any sweep failed.
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.events.mockResolvedValue(true);
    mocks.failed.mockResolvedValue(true);
    mocks.moderation.mockResolvedValue(true);
  });

  it('invokes all three prunes with the database', async () => {
    const db = {} as D1Database;
    const result = await runRetentionJob(db);

    expect(mocks.events).toHaveBeenCalledWith(db, expect.anything());
    expect(mocks.failed).toHaveBeenCalledWith(db, expect.anything());
    expect(mocks.moderation).toHaveBeenCalledWith(db, expect.anything());
    expect(result).toEqual({ fulfilled: 3, rejected: 0, failed: [] });
  });

  it('still runs the others when one prune throws, and logs only the error name', async () => {
    mocks.failed.mockRejectedValue(new TypeError('statement text: DELETE FROM failed_notifications ...'));
    const warn = vi.fn();
    const error = vi.fn();

    const result = await runRetentionJob({} as D1Database, { warn, error });

    expect(mocks.events).toHaveBeenCalledTimes(1);
    expect(mocks.moderation).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fulfilled: 2, rejected: 1, failed: ['failed_notifications'] });
    expect(warn).toHaveBeenCalledWith('[retention-job] a prune threw', { cause: 'TypeError' });
    expect(error).toHaveBeenCalledWith('[retention-job] retention sweep failed', {
      failed: ['failed_notifications'],
    });
    expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls])).not.toContain('DELETE FROM');
  });

  it('reports a prune that caught its own D1 error as failed, at error level', async () => {
    // What every real prune does on a D1 error: warn, swallow, resolve.
    mocks.events.mockResolvedValue(false);
    mocks.moderation.mockResolvedValue(false);
    const warn = vi.fn();
    const error = vi.fn();

    const result = await runRetentionJob({} as D1Database, { warn, error });

    expect(result).toEqual({
      fulfilled: 3,
      rejected: 0,
      failed: ['submission_events', 'moderation_records'],
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('[retention-job] retention sweep failed', {
      failed: ['submission_events', 'moderation_records'],
    });
  });

  it('logs nothing at error level when every sweep ran', async () => {
    const error = vi.fn();

    await runRetentionJob({} as D1Database, { warn: vi.fn(), error });

    expect(error).not.toHaveBeenCalled();
  });

  it('falls back to console.error when no logger is passed (the cron path)', async () => {
    mocks.failed.mockResolvedValue(false);

    await runRetentionJob({} as D1Database);

    expect(console.error).toHaveBeenCalledWith('[retention-job] retention sweep failed', {
      failed: ['failed_notifications'],
    });
  });

  it('survives every prune throwing', async () => {
    mocks.events.mockRejectedValue('boom');
    mocks.failed.mockRejectedValue(new Error('x'));
    mocks.moderation.mockRejectedValue(new Error('y'));

    await expect(
      runRetentionJob({} as D1Database, { warn: vi.fn(), error: vi.fn() })
    ).resolves.toEqual({
      fulfilled: 0,
      rejected: 3,
      failed: ['submission_events', 'failed_notifications', 'moderation_records'],
    });
  });

  /** Invoke the Cron entry point; returns the one promise it handed to ctx.waitUntil. */
  function runScheduled(env = createMockEnv()): Promise<unknown> {
    const waitUntil = vi.fn();
    scheduled({ cron: '23 4 * * *' } as ScheduledController, env, { waitUntil } as unknown as ExecutionContext);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    return waitUntil.mock.calls[0][0] as Promise<unknown>;
  }

  it('scheduled() keeps the isolate alive with ctx.waitUntil, does not throw, and resolves when every sweep ran', async () => {
    const env = createMockEnv();

    await expect(runScheduled(env)).resolves.toBeUndefined();

    expect(mocks.events).toHaveBeenCalledWith(env.DB, expect.anything());
    expect(mocks.failed).toHaveBeenCalledTimes(1);
    expect(mocks.moderation).toHaveBeenCalledTimes(1);
  });

  // BUG-066, the durable half: Workers Logs are pinned off (FINDING-022), so
  // the console.error above goes nowhere in production. A rejected waitUntil
  // promise is what fails the cron invocation itself.
  it('scheduled() rejects, naming only the failed prunes, when a prune reports a failed sweep', async () => {
    mocks.failed.mockResolvedValue(false);
    mocks.moderation.mockResolvedValue(false);

    const outcome = runScheduled();

    await expect(outcome).rejects.toThrow(Error);
    const err = (await outcome.catch((e: unknown) => e)) as Error;
    expect(err.message).toBe(
      '[retention-job] retention sweep failed: failed_notifications, moderation_records'
    );
    // Every prune still ran — failing the invocation does not cut the sweep short
    expect(mocks.events).toHaveBeenCalledTimes(1);
  });

  it('scheduled() rejects without the thrown error text when a prune throws', async () => {
    mocks.events.mockRejectedValue(new Error('D1_ERROR: DELETE FROM submission_events WHERE user = 42'));

    const err = (await runScheduled().catch((e: unknown) => e)) as Error;

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('[retention-job] retention sweep failed: submission_events');
    expect(err.message).not.toContain('DELETE');
  });
});
