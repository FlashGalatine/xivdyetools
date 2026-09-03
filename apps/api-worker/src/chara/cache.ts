/**
 * Per-(slot column, model key) row cache on the Cloudflare Cache API.
 *
 * Model keys are tiny and immutable within a game version — twenty users
 * importing the same glamour is one upstream call. Entries are namespaced by
 * the XIVAPI version key the worker is pinned to (`XIVAPI_VERSION`), so
 * rolling the pin forward after a patch is a cold cache, not a stale one.
 * An empty row list ("no item row") is cached too — NPC/prop models would
 * otherwise hit upstream on every import.
 *
 * Same CacheService as the Universalis proxy (synthetic URLs under the
 * request origin), a separate cache name so the two never collide.
 */

import { CacheService } from '../universalis/services/cache-service.js';
import type { CacheConfig } from '../universalis/types.js';
import type { GlassesRow, ItemRow, SlotLookup } from './types.js';
import { lookupKey } from './types.js';

/** ~7 days fresh, one day of stale-while-revalidate headroom. */
export const CHARA_CACHE_CONFIG: CacheConfig = {
  cacheTtl: 7 * 24 * 60 * 60,
  swrWindow: 24 * 60 * 60,
  keyPrefix: 'chara',
};

const CACHE_NAME = 'chara-resolve';
/** Bump when the cached row shape changes. */
const SHAPE_VERSION = 1;

export class CharaRowCache {
  private readonly service: CacheService;
  private readonly prefix: string;

  constructor(ctx: ExecutionContext, gameVersion: string) {
    this.service = new CacheService(ctx, CACHE_NAME);
    this.prefix = `${CHARA_CACHE_CONFIG.keyPrefix}:${SHAPE_VERSION}:${gameVersion}`;
  }

  private rowKey(lookup: SlotLookup): string {
    return `${this.prefix}:rows:${lookupKey(lookup)}`;
  }

  private glassesKey(id: number): string {
    return `${this.prefix}:glasses:${id}`;
  }

  /** Rows for each lookup that is cached (fresh or stale); absent = miss. */
  async getRows(lookups: readonly SlotLookup[]): Promise<Map<string, ItemRow[]>> {
    const hits = new Map<string, ItemRow[]>();
    await Promise.all(
      lookups.map(async (lookup) => {
        const cached = await this.service.get(this.rowKey(lookup));
        if (!cached) return;
        try {
          const rows = await cached.response.json<ItemRow[]>();
          if (Array.isArray(rows)) hits.set(lookupKey(lookup), rows);
        } catch {
          // A corrupt entry reads as a miss; the upstream answer overwrites it.
        }
      }),
    );
    return hits;
  }

  storeRows(lookup: SlotLookup, rows: readonly ItemRow[]): void {
    this.service.storeAsync(this.rowKey(lookup), rows, CHARA_CACHE_CONFIG);
  }

  /** `undefined` = miss; `null` = cached "no such row". */
  async getGlasses(id: number): Promise<GlassesRow | null | undefined> {
    const cached = await this.service.get(this.glassesKey(id));
    if (!cached) return undefined;
    try {
      return await cached.response.json<GlassesRow | null>();
    } catch {
      return undefined;
    }
  }

  storeGlasses(id: number, row: GlassesRow | null): void {
    this.service.storeAsync(this.glassesKey(id), row, CHARA_CACHE_CONFIG);
  }
}
