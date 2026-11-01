import type { PresetRow } from '../types.js';
import type { PublicPreset } from './preset-service.js';
import { rowToPreset, toPublicPreset } from './preset-service.js';

/** Fetch approved public rows once, preserving first-occurrence input order. */
export async function getApprovedPresetBatch(
  db: D1Database,
  ids: string[],
): Promise<{ presets: PublicPreset[]; missing_ids: string[] }> {
  const uniqueIds = [...new Set(ids)];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const result = await db
    .prepare(`SELECT * FROM presets WHERE status = 'approved' AND id IN (${placeholders})`)
    .bind(...uniqueIds)
    .all<PresetRow>();
  if (!result.success) throw new Error('Preset batch lookup failed');

  const byId = new Map(
    result.results.map((row) => {
      const preset = { ...rowToPreset(row) };
      delete preset.previous_values;
      // This logical read exposes the public gallery view, even to bot owners
      // and moderators. Their auth context only controls admission and limits.
      return [
        row.id,
        toPublicPreset(preset, {
          isAuthenticated: false,
          isModerator: false,
          authSource: 'none',
        }),
      ] as const;
    }),
  );
  return {
    presets: uniqueIds.flatMap((id) => {
      const preset = byId.get(id);
      return preset ? [preset] : [];
    }),
    missing_ids: uniqueIds.filter((id) => !byId.has(id)),
  };
}
