/**
 * Per-request loader with isolate-local pending lookups. Only decoded data
 * crosses invocations; each owner retains its own I/O and waitUntil work.
 *
 * Quota admission belongs to the request that owns a pending lookup. If that
 * owner's admission is denied, its denial stays with it: the waiters receive
 * an internal handoff signal and claim the keys again, joining another live
 * owner or owning them as one new batch under their own admission. The
 * handoff loop terminates because every extra round needs a distinct claimant
 * that was already pending when the waiter re-claimed to be denied in turn,
 * and a denied claimant releases its entries before it settles and leaves
 * with its own error, so it never claims again.
 */
import { indexRows } from './resolver.js';
import { CHARA_ROW_SHAPE_VERSION } from './cache.js';
import type { CharaRowCache } from './cache.js';
import type { GlassesRow, ItemRow, SlotLookup } from './types.js';
import { lookupKey } from './types.js';
import type { XivapiClient, XivapiContext, XivapiResponseIdentity } from './xivapi.js';

interface RowsResult extends XivapiResponseIdentity {
  rows: Map<string, ItemRow[]>;
  truncated: boolean;
}
type RowResult = XivapiResponseIdentity & { rows: ItemRow[]; truncated: boolean };
type GlassesResult = XivapiResponseIdentity & { row: GlassesRow | null };
interface Pending<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}
const MAX_PENDING_KEYS = 256;
const pendingRows = new Map<string, Pending<RowResult>>();
const pendingGlasses = new Map<string, Pending<GlassesResult>>();

/** The owner's own admission failed; its waiters claim the work under their own admission. */
class OwnerNotAdmitted extends Error {}
const OWNER_NOT_ADMITTED = new OwnerNotAdmitted('pending owner was not admitted');

function pending<T>(): Pending<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}

function hasCapacity(): boolean {
  return pendingRows.size + pendingGlasses.size < MAX_PENDING_KEYS;
}

export class CharaLookupLoader {
  constructor(
    private readonly client: XivapiClient,
    private readonly context: XivapiContext,
    private readonly cache: CharaRowCache | null,
    private readonly executionCtx: ExecutionContext,
    private readonly admit?: () => Promise<void>,
  ) {}

  private key(operation: string, id: string | number): string {
    return JSON.stringify([this.context.cacheNamespace, CHARA_ROW_SHAPE_VERSION, operation, id]);
  }

  /** Calls admit synchronously (before the first await) so reservations precede admission I/O. */
  private async startAdmission(): Promise<void> {
    if (this.admit) await this.admit();
  }

  /** Owned work runs under this request's admission; a denial is returned only to this request. */
  private own<T>(
    release: () => void,
    fetch: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: unknown) => void,
  ): Promise<void> {
    // Release the pending entries BEFORE settling them, so a handed-off waiter
    // can never re-join the dead entry.
    const settle = (): Promise<void> =>
      fetch().then(
        (value) => {
          release();
          resolve(value);
        },
        (error: unknown) => {
          release();
          reject(error);
        },
      );
    if (!this.admit) {
      // No budget configured: start the upstream work synchronously, as before.
      this.executionCtx.waitUntil(settle());
      return Promise.resolve();
    }
    const admitted = this.startAdmission();
    this.executionCtx.waitUntil(
      admitted.then(settle, () => {
        release();
        reject(OWNER_NOT_ADMITTED);
      }),
    );
    return admitted;
  }

  private async fetchRows(misses: readonly SlotLookup[]): Promise<RowsResult> {
    if (this.admit) await this.admit();
    return this.searchRows(misses);
  }

  private async searchRows(misses: readonly SlotLookup[]): Promise<RowsResult> {
    const result = await this.client.searchItems(misses, this.context);
    const index = indexRows(result.rows);
    const rows = new Map<string, ItemRow[]>();
    for (const lookup of misses) {
      const found = index.get(lookupKey(lookup)) ?? [];
      rows.set(lookupKey(lookup), found);
      if (this.context.cacheNamespace !== null && !result.truncated)
        this.cache?.storeRows(lookup, found);
    }
    return { rows, version: result.version, schema: result.schema, truncated: result.truncated };
  }

  async loadRows(misses: readonly SlotLookup[]): Promise<RowsResult> {
    const lookups = [...new Map(misses.map((lookup) => [lookupKey(lookup), lookup])).values()];
    if (lookups.length === 0)
      return { rows: new Map(), version: null, schema: null, truncated: false };
    if (this.context.cacheNamespace === null) {
      const work = this.fetchRows(lookups);
      this.executionCtx.waitUntil(
        work.then(
          () => undefined,
          () => undefined,
        ),
      );
      return work;
    }
    const values = new Map<string, RowResult>();
    let todo = lookups;
    while (todo.length > 0) {
      const { owned, waits } = this.claimRows(todo);
      if (owned.length > 0) {
        const release = (): void => {
          for (const { key, entry } of owned)
            if (pendingRows.get(key) === entry) pendingRows.delete(key);
        };
        // Throws this request's own CharaQuotaError; never another request's.
        await this.own(
          release,
          () => this.searchRows(owned.map(({ lookup }) => lookup)),
          (result) => {
            for (const { lookup, entry } of owned)
              entry.resolve({
                rows: result.rows.get(lookupKey(lookup)) ?? [],
                version: result.version,
                schema: result.schema,
                truncated: result.truncated,
              });
          },
          (error) => {
            for (const { entry } of owned) entry.reject(error);
          },
        );
      }
      const handedOff = new Set<string>();
      await Promise.all(
        waits.map(async ({ lookup, entry }) => {
          try {
            values.set(lookupKey(lookup), structuredClone(await entry.promise));
          } catch (error) {
            if (error !== OWNER_NOT_ADMITTED) throw error;
            handedOff.add(lookupKey(lookup));
          }
        }),
      );
      // Keys whose owner was denied: claim them again (join a live owner or own them as ONE new batch).
      todo = todo.filter((lookup) => handedOff.has(lookupKey(lookup)));
    }
    const settled = (lookup: SlotLookup): RowResult => {
      const value = values.get(lookupKey(lookup));
      if (value === undefined) throw new Error('chara lookup settled without a value');
      return value;
    };
    const first = settled(lookups[0]);
    return {
      rows: new Map(lookups.map((lookup) => [lookupKey(lookup), settled(lookup).rows])),
      version: first.version,
      schema: first.schema,
      truncated: lookups.some((lookup) => settled(lookup).truncated),
    };
  }

  /** Joins live pending owners and reserves every other key for this request. */
  private claimRows(lookups: readonly SlotLookup[]): {
    owned: Array<{ lookup: SlotLookup; key: string; entry: Pending<RowResult> }>;
    waits: Array<{ lookup: SlotLookup; entry: Pending<RowResult> }>;
  } {
    const owned: Array<{ lookup: SlotLookup; key: string; entry: Pending<RowResult> }> = [];
    const waits = lookups.map((lookup) => {
      const key = this.key('rows', lookupKey(lookup));
      const existing = pendingRows.get(key);
      if (existing) return { lookup, entry: existing };
      const entry = pending<RowResult>();
      if (hasCapacity()) pendingRows.set(key, entry);
      owned.push({ lookup, key, entry });
      return { lookup, entry };
    });
    return { owned, waits };
  }

  private async fetchGlasses(id: number): Promise<GlassesResult> {
    if (this.admit) await this.admit();
    return this.getGlassesRow(id);
  }

  private async getGlassesRow(id: number): Promise<GlassesResult> {
    const result = await this.client.getGlasses(id, this.context);
    if (this.context.cacheNamespace !== null) this.cache?.storeGlasses(id, result.row);
    return result;
  }

  async loadGlasses(id: number): Promise<GlassesResult> {
    if (this.context.cacheNamespace === null) {
      const work = this.fetchGlasses(id);
      this.executionCtx.waitUntil(
        work.then(
          () => undefined,
          () => undefined,
        ),
      );
      return work;
    }
    const key = this.key('glasses', id);
    for (;;) {
      const existing = pendingGlasses.get(key);
      if (existing) {
        try {
          return structuredClone(await existing.promise);
        } catch (error) {
          // The owner was denied: claim the key again (join a live owner or own it).
          if (error === OWNER_NOT_ADMITTED) continue;
          throw error;
        }
      }
      const entry = pending<GlassesResult>();
      if (hasCapacity()) pendingGlasses.set(key, entry);
      const release = (): void => {
        if (pendingGlasses.get(key) === entry) pendingGlasses.delete(key);
      };
      // Throws this request's own CharaQuotaError; never another request's.
      await this.own(release, () => this.getGlassesRow(id), entry.resolve, entry.reject);
      return structuredClone(await entry.promise);
    }
  }
}
