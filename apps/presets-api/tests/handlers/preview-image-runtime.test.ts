import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetsRouter } from '../../src/handlers/presets';
import { moderationRouter } from '../../src/handlers/moderation';
import type { AuthContext, Env } from '../../src/types';
import { createD1Runtime } from '../d1-runtime';
import { createMockEnv } from '../test-utils';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

describe('preview ownership and attempt accounting on real D1', () => {
  let runtime: Awaited<ReturnType<typeof createD1Runtime>>;
  let db: D1Database; let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  let live: Set<string>; let deleted: string[]; let notifications: Record<string, unknown>[];
  let pending: Promise<unknown>[]; let decodes: number;
  let queryHook: undefined | ((query: string, execute: () => Promise<unknown>) => Promise<unknown>);
  let batchHook: undefined | (() => Promise<void>);

  // Wrap the real driver only at scheduling/failure boundaries. All successful
  // SQL results, including CAS zero rows and RETURNING keys, come from workerd.
  function databaseBoundary(): D1Database {
    const originalStatements = new WeakMap<object, D1PreparedStatement>();
    function statement(actual: D1PreparedStatement, query: string): D1PreparedStatement {
      const wrapped = new Proxy(actual, { get(target, property) {
        if (property === 'bind') return (...args: unknown[]) => statement(target.bind(...args), query);
        const value = Reflect.get(target, property);
        if (typeof value !== 'function') return value;
        if (['first', 'run', 'all', 'raw'].includes(String(property))) return (...args: unknown[]) => {
          const execute = () => Reflect.apply(value, target, args) as Promise<unknown>;
          return queryHook ? queryHook(query, execute) : execute();
        };
        return value.bind(target);
      } });
      originalStatements.set(wrapped, actual);
      return wrapped;
    }
    return new Proxy(db, { get(target, property) {
      if (property === 'prepare') return (query: string) => statement(target.prepare(query), query);
      if (property === 'batch') return async (statements: D1PreparedStatement[]) => {
        await batchHook?.();
        return target.batch(statements.map(s => originalStatements.get(s) ?? s));
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  beforeAll(async () => { runtime = await createD1Runtime(); db = runtime.db; }, 30000);
  afterAll(async () => { await runtime?.dispose(); });
  beforeEach(async () => {
    queryHook = undefined; batchHook = undefined; decodes = 0;
    await db.batch(['votes', 'moderation_log', 'failed_notifications', 'presets', 'submission_events', 'banned_users'].map(t => db.prepare(`DELETE FROM ${t}`)));
    await db.prepare("INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,preview_image_key,preview_image_status) VALUES ('p','Palette','Description','jobs','[1,2,3]','[]','approved','owner','p/old.webp','pending')").run();
    live = new Set(['p/old.webp']); deleted = []; notifications = []; pending = [];
    env = createMockEnv({ DB: databaseBoundary(), INTERNAL_WEBHOOK_SECRET: 'local-test-only',
      IMAGE_WORKER: { fetch: async () => { decodes++; return new Response(png); } } as unknown as Fetcher,
      THUMBNAILS: { put: async (key: string) => { live.add(key); }, delete: async (key: string) => { deleted.push(key); live.delete(key); } } as unknown as R2Bucket,
      DISCORD_WORKER: { fetch: async (request: Request) => { notifications.push(await request.json()); return new Response('{}'); } } as unknown as Fetcher,
    });
    app = new Hono();
    app.onError(() => new Response('Internal Server Error', { status: 500 }));
    app.use('*', async (c, next) => {
      const moderator = c.req.header('X-Test-Moderator') === 'true';
      c.set('auth', { isAuthenticated: true, isModerator: moderator, userDiscordId: moderator ? 'moderator' : 'owner', userName: 'Author', authSource: 'bot' });
      await next();
    });
    app.route('/presets', presetsRouter);
    app.route('/moderation', moderationRouter);
  });
  function request(method = 'POST', path = '/presets/p/preview-image', body: BodyInit = png) {
    return app.request(path, { method, ...(method === 'POST' ? { body } : {}) }, env,
      { waitUntil: (p: Promise<unknown>) => { pending.push(p); }, passThroughOnException() {} } as ExecutionContext);
  }
  async function row() { return db.prepare("SELECT * FROM presets WHERE id='p'").first<{ preview_image_key: string | null; preview_image_status: string; author_discord_id: string }>(); }
  async function events() { return (await db.prepare("SELECT COUNT(*) n FROM submission_events WHERE kind='preview_upload'").first<{ n: number }>())!.n; }
  async function sent() { await Promise.all(pending); return notifications; }
  function review(action: 'approve' | 'reject', key = 'p/old.webp') {
    return app.request('/moderation/p/preview-image', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Test-Moderator': 'true' }, body: JSON.stringify({ action, preview_image_key: key }) }, env);
  }
  function pauseDecode(count = 1) {
    const entered = barrier(); const resume = barrier(); let enteredCount = 0;
    env.IMAGE_WORKER = { fetch: async () => { decodes++; if (++enteredCount === count) entered.release(); await resume.promise; return new Response(png); } } as unknown as Fetcher;
    return { entered: entered.promise, release: resume.release };
  }
  function pauseWrite(match: RegExp) {
    const entered = barrier(); const resume = barrier(); let paused = false;
    queryHook = async (query, execute) => { if (match.test(query) && !paused) { paused = true; entered.release(); await resume.promise; } return execute(); };
    return { entered: entered.promise, release: resume.release };
  }
  it.each(['existing', 'empty'])('admits exactly one simultaneous upload from %s captured state, cleans loser, refunds and notifies only winner', async initial => {
    if (initial === 'empty') { await db.prepare("UPDATE presets SET preview_image_key=NULL,preview_image_status='none' WHERE id='p'").run(); live.clear(); }
    const gate = pauseDecode(2); const a = request(); const b = request(); await gate.entered; gate.release();
    expect([(await a).status, (await b).status].sort()).toEqual([200, 409]);
    const current = await row(); expect(current!.preview_image_status).toBe('pending');
    expect([...live]).toEqual([current!.preview_image_key]); expect(deleted).toHaveLength(initial === 'empty' ? 1 : 2);
    expect(await events()).toBe(1); expect(await sent()).toHaveLength(1);
  });
  it.each(['approve', 'reject'] as const)('production moderator %s while decoding defeats the captured upload', async action => {
    const gate = pauseDecode(); const upload = request(); await gate.entered;
    expect((await review(action)).status).toBe(200); const moderated = await row(); gate.release();
    expect((await upload).status).toBe(409); expect(await row()).toEqual(moderated);
    expect([...live]).toEqual(action === 'approve' ? ['p/old.webp'] : []);
    expect(await events()).toBe(0); expect(await sent()).toHaveLength(0);
    expect((await db.prepare('SELECT action FROM moderation_log').all()).results).toEqual([{ action: action === 'approve' ? 'image_approve' : 'image_reject' }]);
  });
  it.each(['approved', 'none'])('status-only moderation to %s defeats captured upload even with identical key', async status => {
    const gate = pauseDecode(); const upload = request(); await gate.entered;
    await db.prepare("UPDATE presets SET preview_image_status=? WHERE id='p'").bind(status).run(); gate.release();
    expect((await upload).status).toBe(409); expect(await row()).toMatchObject({ preview_image_key: 'p/old.webp', preview_image_status: status });
    expect([...live]).toEqual(['p/old.webp']); expect(await events()).toBe(0); expect(await sent()).toHaveLength(0);
  });
  it('rejecting the old image while decoding prevents attachment and preserves the rejected state', async () => {
    const gate = pauseDecode(); const upload = request(); await gate.entered;
    await db.prepare("UPDATE presets SET preview_image_key=NULL,preview_image_status='none' WHERE id='p'").run(); live.delete('p/old.webp'); gate.release();
    expect((await upload).status).toBe(409); expect(await row()).toMatchObject({ preview_image_key: null, preview_image_status: 'none' });
    expect(live.size).toBe(0); expect(await events()).toBe(0); expect(await sent()).toHaveLength(0);
  });
  it('owner rekey during decode prevents old-owner attachment', async () => {
    const gate = pauseDecode(); const upload = request(); await gate.entered;
    await db.prepare("UPDATE presets SET author_discord_id='new-owner' WHERE id='p'").run(); gate.release();
    expect((await upload).status).toBe(409); expect(await row()).toMatchObject({ author_discord_id: 'new-owner', preview_image_key: 'p/old.webp' });
    expect([...live]).toEqual(['p/old.webp']); expect(await events()).toBe(0); expect(await sent()).toHaveLength(0);
  });
  it.each(['whole', 'image'])('%s delete winning during decode defeats upload without resurrecting an image', async kind => {
    const gate = pauseDecode(); const upload = request(); await gate.entered;
    expect((await request('DELETE', kind === 'whole' ? '/presets/p' : undefined)).status).toBe(200); gate.release();
    expect((await upload).status).toBe(kind === 'whole' ? 404 : 409);
    if (kind === 'whole') expect(await row()).toBeNull(); else expect(await row()).toMatchObject({ preview_image_key: null, preview_image_status: 'none' });
    expect(live.size).toBe(0); expect(await events()).toBe(0); expect(await sent()).toHaveLength(0);
  });
  it('whole delete atomically captures the actual key from a concurrent winning upload', async () => {
    const entered = barrier(); const resume = barrier();
    batchHook = async () => { entered.release(); await resume.promise; };
    const deletion = request('DELETE', '/presets/p'); await entered.promise;
    expect((await request()).status).toBe(200); const uploadedKey = (await row())!.preview_image_key!;
    resume.release(); expect((await deletion).status).toBe(200);
    expect(await row()).toBeNull(); expect(live.size).toBe(0); expect(deleted).toContain(uploadedKey); expect(await events()).toBe(1);
  });
  it('image-only delete CAS cannot clear a newer winning upload', async () => {
    const gate = pauseWrite(/UPDATE presets SET preview_image_key = NULL/);
    const deletion = request('DELETE'); await gate.entered;
    expect((await request()).status).toBe(200); const current = await row(); gate.release();
    expect((await deletion).status).toBe(409); expect(await row()).toEqual(current);
    expect([...live]).toEqual([current!.preview_image_key]); expect(await events()).toBe(1); expect(await sent()).toHaveLength(1);
  });
  it.each(['whole', 'image'])('successful upload followed by %s delete removes its actual new key and retains charge', async kind => {
    expect((await request()).status).toBe(200); const key = (await row())!.preview_image_key!;
    expect((await request('DELETE', kind === 'whole' ? '/presets/p' : undefined)).status).toBe(200);
    expect(live.size).toBe(0); expect(deleted).toContain(key); expect(await events()).toBe(1); expect(await sent()).toHaveLength(1);
  });
  it.each(['status', 'owner'])('image-only delete refuses a changed %s before its SQL', async changed => {
    const gate = pauseWrite(/UPDATE presets SET preview_image_key = NULL/);
    const deletion = request('DELETE'); await gate.entered;
    await db.prepare(changed === 'status' ? "UPDATE presets SET preview_image_status='approved' WHERE id='p'" : "UPDATE presets SET author_discord_id='new-owner' WHERE id='p'").run();
    const current = await row(); gate.release(); expect((await deletion).status).toBe(409);
    expect(await row()).toEqual(current); expect([...live]).toEqual(['p/old.webp']);
  });
  it('image-only delete reports missing after a whole delete wins, without cleaning stale state', async () => {
    const gate = pauseWrite(/UPDATE presets SET preview_image_key = NULL/);
    const deletion = request('DELETE'); await gate.entered;
    expect((await request('DELETE', '/presets/p')).status).toBe(200); gate.release();
    expect((await deletion).status).toBe(404); expect(await row()).toBeNull(); expect(deleted).toEqual(['p/old.webp']);
  });
  it('an already empty image stays idempotent without altering text moderation or quota', async () => {
    await db.prepare("UPDATE presets SET preview_image_key=NULL,preview_image_status='none',status='pending' WHERE id='p'").run(); live.clear();
    expect((await request('DELETE')).status).toBe(200); expect((await request('DELETE')).status).toBe(200);
    expect(await row()).toMatchObject({ preview_image_key: null, preview_image_status: 'none', status: 'pending' });
    expect(await events()).toBe(0); expect(deleted).toEqual([]); expect(await sent()).toHaveLength(0);
  });
  it('whole-delete authorization guards every dependent table after ownership rekey', async () => {
    await db.prepare("INSERT INTO votes (preset_id,user_discord_id) VALUES ('p','voter')").run();
    await db.prepare("INSERT INTO moderation_log (id,preset_id,moderator_discord_id,action) VALUES ('audit','p','moderator','approve')").run();
    await db.prepare("INSERT INTO failed_notifications (payload,error) VALUES (?, 'failed')").bind(JSON.stringify({ preset_id: 'p' })).run();
    await db.prepare("INSERT INTO submission_events (user_discord_id,kind,preset_id) VALUES ('owner','preview_upload','p')").run();
    const tables = ['votes', 'moderation_log', 'failed_notifications', 'submission_events'];
    const snapshot = () => Promise.all(tables.map(table => db.prepare(`SELECT * FROM ${table}`).all()));
    const before = await snapshot();
    batchHook = async () => { await db.prepare("UPDATE presets SET author_discord_id='new-owner' WHERE id='p'").run(); };
    expect((await request('DELETE', '/presets/p')).status).toBe(409);
    expect((await snapshot()).map(r => r.results)).toEqual(before.map(r => r.results));
    expect(await row()).toMatchObject({ author_discord_id: 'new-owner', preview_image_key: 'p/old.webp' }); expect([...live]).toEqual(['p/old.webp']);
  });
  it.each(['commit', 'moderated'])('reconciles lost DB response after %s without deleting the live new key', async outcome => {
    queryHook = async (query, execute) => {
      const result = await execute();
      if (/UPDATE presets SET preview_image_key = \?/.test(query)) {
        if (outcome === 'moderated') await db.prepare("UPDATE presets SET preview_image_status='approved' WHERE id='p'").run();
        throw new Error('lost response');
      } return result;
    };
    expect((await request()).status).toBe(200); const current = await row();
    expect([...live]).toEqual([current!.preview_image_key]); expect(await events()).toBe(1);
    expect(await sent()).toHaveLength(outcome === 'commit' ? 1 : 0);
  });
  it.each(['rollback', 'unreadable', 'superseded', 'deleted'])('ambiguous %s outcome retains charge and only cleans a proven-unreferenced key', async outcome => {
    let failed = false;
    queryHook = async (query, execute) => {
      if (/UPDATE presets SET preview_image_key = \?/.test(query)) {
        if (outcome === 'superseded' || outcome === 'deleted') {
          await execute();
          if (outcome === 'superseded') {
            live.add('p/newer.webp'); await db.prepare("UPDATE presets SET preview_image_key='p/newer.webp' WHERE id='p'").run();
          } else await db.prepare("DELETE FROM presets WHERE id='p'").run();
        }
        failed = true; throw new Error('lost response');
      }
      if (failed && outcome === 'unreadable' && /SELECT author_discord_id/.test(query)) throw new Error('DB unavailable');
      return execute();
    };
    const response = await request(); expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'SERVICE_UNAVAILABLE', message: 'The upload result could not be confirmed. Please refresh the preset before retrying.' });
    expect(await events()).toBe(1); expect(await sent()).toHaveLength(0);
    if (outcome === 'unreadable') expect(live.size).toBe(2);
    else { expect([...live]).not.toContainEqual(expect.stringMatching(/^p\/[a-f0-9-]{36}\.webp$/)); }
  });
  it.each(['upload', 'whole', 'image'])('commits then production %s supersedes it before lost response: never refunds the committed attempt', async operation => {
    let intercepted = false;
    queryHook = async (query, execute) => {
      const result = await execute();
      if (!intercepted && /UPDATE presets SET preview_image_key = \?/.test(query)) {
        intercepted = true;
        const response = operation === 'upload' ? await request() : await request('DELETE', operation === 'whole' ? '/presets/p' : undefined);
        expect(response.status).toBe(200);
        throw new Error('first committed response lost');
      }
      return result;
    };
    expect((await request()).status).toBe(503); expect(await events()).toBe(operation === 'upload' ? 2 : 1);
    expect(await sent()).toHaveLength(operation === 'upload' ? 1 : 0);
    // The first request lost its commit receipt before old-object cleanup.
    // Its old object may remain orphaned: unknown outcomes confer no authority
    // to treat the captured old object as a successfully replaced image.
    if (operation === 'upload') expect([...live]).toEqual(['p/old.webp', (await row())!.preview_image_key]);
    else expect([...live]).toEqual(['p/old.webp']);
  });
  it('commits then production moderation suppresses an outdated notification on response loss', async () => {
    queryHook = async (query, execute) => {
      const result = await execute();
      if (/UPDATE presets SET preview_image_key = \?/.test(query)) {
        expect((await review('approve', (await row())!.preview_image_key!)).status).toBe(200);
        throw new Error('committed response lost');
      }
      return result;
    };
    expect((await request()).status).toBe(200); expect(await events()).toBe(1); expect(await sent()).toHaveLength(0);
    expect((await row())!.preview_image_status).toBe('approved'); expect([...live]).toEqual([(await row())!.preview_image_key]);
  });
  describe.each(['ordinary', 'reconciled'])('%s confirmed attachment awaiting old-object cleanup', receipt => {
    it.each(['approve', 'reject', 'upload', 'whole', 'image'] as const)('suppresses its stale notification after production %s during cleanup', async operation => {
      let intercepted = false;
      queryHook = async (query, execute) => {
        const result = await execute();
        if (receipt === 'reconciled' && !intercepted && /UPDATE presets SET preview_image_key = \?/.test(query)) {
          intercepted = true; throw new Error('committed response lost');
        }
        return result;
      };
      const entered = barrier(); const resume = barrier();
      const remove = env.THUMBNAILS.delete.bind(env.THUMBNAILS);
      env.THUMBNAILS.delete = (async (key: string) => {
        if (key === 'p/old.webp') { entered.release(); await resume.promise; }
        await remove(key);
      }) as R2Bucket['delete'];
      const upload = request(); await entered.promise;
      const attached = await row(); const attachedKey = attached!.preview_image_key!;
      expect(attached).toMatchObject({ preview_image_status: 'pending' });
      expect(attachedKey).not.toBe('p/old.webp'); expect(await events()).toBe(1);
      const next = operation === 'approve' || operation === 'reject' ? await review(operation, attachedKey)
        : operation === 'upload' ? await request() : await request('DELETE', operation === 'whole' ? '/presets/p' : undefined);
      expect(next.status).toBe(200); const final = await row();
      resume.release(); const response = await upload;
      expect(response.status).toBe(200); expect(await response.json()).toEqual({ success: true, status: 'pending' });
      expect(await row()).toEqual(final); expect(await events()).toBe(operation === 'upload' ? 2 : 1);
      expect([...live]).toEqual(operation === 'approve' || operation === 'upload' ? [final!.preview_image_key] : []);
      expect(deleted).toContain('p/old.webp');
      const messages = await sent(); expect(messages).toHaveLength(operation === 'upload' ? 1 : 0);
      expect(messages.map(message => message.preview_image_key)).not.toContain(attachedKey);
      if (operation === 'upload') expect(messages[0].preview_image_key).toBe(final!.preview_image_key);
    });
    it('skips notification when the final authoritative read fails while preserving confirmed success and charge', async () => {
      let cleaned = false; let intercepted = false;
      const remove = env.THUMBNAILS.delete.bind(env.THUMBNAILS);
      env.THUMBNAILS.delete = (async (key: string) => { await remove(key); if (key === 'p/old.webp') cleaned = true; }) as R2Bucket['delete'];
      queryHook = async (query, execute) => {
        if (cleaned && /SELECT author_discord_id/.test(query)) throw new Error('unreadable final state');
        const result = await execute();
        if (receipt === 'reconciled' && !intercepted && /UPDATE presets SET preview_image_key = \?/.test(query)) {
          intercepted = true; throw new Error('committed response lost');
        }
        return result;
      };
      const response = await request(); expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true, status: 'pending' });
      const current = await row(); expect(current!.preview_image_status).toBe('pending');
      expect([...live]).toEqual([current!.preview_image_key]); expect(await events()).toBe(1); expect(await sent()).toHaveLength(0);
    });
  });
  it.each(['empty', 'sniff', 'oversize', 'read'])('cheap %s failure refunds without decoding', async kind => {
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1); oversized.set(png);
    const body = kind === 'empty' ? new Uint8Array() : kind === 'sniff' ? new Uint8Array([1]) : kind === 'oversize' ? oversized : new ReadableStream({ start(c) { c.error(new Error('disconnect')); } });
    const response = kind === 'read' ? await app.request(new Request('http://local/presets/p/preview-image', { method: 'POST', body, duplex: 'half' } as RequestInit), undefined, env) : await request('POST', undefined, body);
    expect(response.status).toBe(kind === 'read' ? 500 : 400); expect(await events()).toBe(0); expect(decodes).toBe(0); expect([...live]).toEqual(['p/old.webp']);
  });
  it.each(['status', 'busy', 'input', 'fetch', 'timeout', 'read'])('processing %s failure retains its reservation and leaks no provider details', async kind => {
    env.IMAGE_WORKER = { fetch: async () => {
      decodes++;
      if (kind === 'status') return new Response('provider secret', { status: 500 });
      if (kind === 'busy') return new Response('provider secret', { status: 503 });
      if (kind === 'input') return new Response('provider secret', { status: 400 });
      if (kind === 'read') return new Response(new ReadableStream({ start(c) { c.error(new Error('provider secret')); } }));
      throw kind === 'timeout' ? new DOMException('provider secret', 'TimeoutError') : new Error('provider secret');
    } } as unknown as Fetcher;
    const response = await request(); expect(response.status).toBe(kind === 'input' ? 400 : 503);
    expect(await response.json()).toEqual({ success: false, error: kind === 'input' ? 'VALIDATION_ERROR' : 'SERVICE_UNAVAILABLE', message: 'Image could not be processed' });
    expect(await events()).toBe(1); expect([...live]).toEqual(['p/old.webp']); expect(await sent()).toHaveLength(0);
    expect(await row()).toMatchObject({ preview_image_key: 'p/old.webp' });
  });
  it('partial R2 put failure refunds and removes its unreferenced key', async () => {
    env.THUMBNAILS.put = vi.fn(async (key: string) => { live.add(key); throw new Error('private provider detail'); }) as unknown as R2Bucket['put'];
    const response = await request(); expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: 'Image could not be processed' });
    expect(await events()).toBe(0); expect([...live]).toEqual(['p/old.webp']); expect(deleted).toHaveLength(1); expect(await sent()).toHaveLength(0);
  });
  it('storage cleanup and refund failures cannot mask the original public storage result', async () => {
    env.THUMBNAILS.put = (async (key: string) => { live.add(key); throw new Error('private provider detail'); }) as unknown as R2Bucket['put'];
    env.THUMBNAILS.delete = async () => { throw new Error('cleanup failed'); };
    queryHook = async (query, execute) => { if (/DELETE FROM submission_events WHERE id/.test(query)) throw new Error('refund failed'); return execute(); };
    const response = await request(); expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'VALIDATION_ERROR', message: 'Image could not be processed' });
    expect(await events()).toBe(1); expect(live.size).toBe(2); expect(await sent()).toHaveLength(0);
    expect(await row()).toMatchObject({ preview_image_key: 'p/old.webp' });
  });
  it('failed loser cleanup and failed refund preserve conflict result and the winning object', async () => {
    const gate = pauseDecode(); const upload = request(); await gate.entered;
    await db.prepare("UPDATE presets SET preview_image_status='approved' WHERE id='p'").run();
    env.THUMBNAILS.delete = async () => { throw new Error('cleanup failed'); };
    queryHook = async (query, execute) => { if (/DELETE FROM submission_events WHERE id/.test(query)) throw new Error('refund failed'); return execute(); };
    gate.release(); expect((await upload).status).toBe(409); expect(live.has('p/old.webp')).toBe(true);
    expect(await events()).toBe(1); expect(await sent()).toHaveLength(0);
  });
  it.each(['upload', 'whole', 'image'])('cleanup failure leaves successful %s DB result intact', async kind => {
    env.THUMBNAILS.delete = async () => { throw new Error('cleanup failed'); };
    const response = kind === 'upload' ? await request() : await request('DELETE', kind === 'whole' ? '/presets/p' : undefined);
    expect(response.status).toBe(200);
    if (kind === 'whole') expect(await row()).toBeNull();
    else expect(await row()).toMatchObject({ preview_image_status: kind === 'upload' ? 'pending' : 'none' });
    expect(live.has('p/old.webp')).toBe(true);
  });
});
