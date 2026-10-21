/**
 * Per-request loader with isolate-local pending lookups. Only decoded data
 * crosses invocations; each owner retains its own I/O and waitUntil work.
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
  ) {}

  private key(operation: string, id: string | number): string {
    return JSON.stringify([this.context.cacheNamespace, CHARA_ROW_SHAPE_VERSION, operation, id]);
  }

  private async fetchRows(misses: readonly SlotLookup[]): Promise<RowsResult> {
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
    if (owned.length > 0) {
      const work = this.fetchRows(owned.map(({ lookup }) => lookup))
        .then(
          (result) => {
            for (const { lookup, entry } of owned)
              entry.resolve({
                rows: result.rows.get(lookupKey(lookup)) ?? [],
                version: result.version,
                schema: result.schema,
                truncated: result.truncated,
              });
          },
          (error: unknown) => {
            for (const { entry } of owned) entry.reject(error);
          },
        )
        .finally(() => {
          for (const { key, entry } of owned)
            if (pendingRows.get(key) === entry) pendingRows.delete(key);
        });
      this.executionCtx.waitUntil(work);
    }
    const values = await Promise.all(
      waits.map(
        async ({ lookup, entry }) =>
          [lookupKey(lookup), structuredClone(await entry.promise)] as const,
      ),
    );
    return {
      rows: new Map(values.map(([key, value]) => [key, value.rows])),
      version: values[0][1].version,
      schema: values[0][1].schema,
      truncated: values.some(([, value]) => value.truncated),
    };
  }

  private async fetchGlasses(id: number): Promise<GlassesResult> {
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
    const existing = pendingGlasses.get(key);
    if (existing) return structuredClone(await existing.promise);
    const entry = pending<GlassesResult>();
    if (hasCapacity()) pendingGlasses.set(key, entry);
    const work = this.fetchGlasses(id)
      .then(entry.resolve, entry.reject)
      .finally(() => {
        if (pendingGlasses.get(key) === entry) pendingGlasses.delete(key);
      });
    this.executionCtx.waitUntil(work);
    return structuredClone(await entry.promise);
  }
}
