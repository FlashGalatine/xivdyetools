/**
 * Per-(slot column, model key) row cache on the Cloudflare Cache API.
 *
 * Model keys are tiny and immutable within a game version — twenty users
 * importing the same glamour is one upstream call. Entries are namespaced by
 * normalized upstream base, canonical game key and canonical schema captured
 * once per request by XivapiClient.resolveContext(). Row shape stays a
 * separate component. A game/schema change starts a cold cache.
 * An empty row list ("no item row") is cached too — NPC/prop models would
 * otherwise hit upstream on every import.
 *
 * Same CacheService as the Universalis proxy (fixed synthetic origin), a separate cache name so the two never collide.
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
/**
 * Bump when the cached row shape changes. 2: rows carry the in-game rules, so
 * a week-old v1 row must not replay without them. 3: the rules carry the
 * Grand Company lock and no longer the job list. 4: equipment level permits
 * filtering unobtainable Dated rows at level 50 and below. 5: rows carry the
 * ItemUICategory row, which decides whether the main hand takes an off-hand in
 * the GPOSERS list.
 */
const SHAPE_VERSION = 5;

export class CharaRowCache {
  private readonly service: CacheService;
  private readonly prefix: string;

  constructor(ctx: ExecutionContext, namespace: string) {
    this.service = new CacheService(ctx, CACHE_NAME);
    this.prefix = `${CHARA_CACHE_CONFIG.keyPrefix}:${SHAPE_VERSION}:${namespace}`;
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
