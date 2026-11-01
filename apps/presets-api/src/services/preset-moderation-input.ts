import type { PresetPreviousValues, CommunityPreset, Env } from '../types.js';

/** App-local extension; historic snapshots can omit the link. */
export type PresetSnapshot = PresetPreviousValues & { example_link?: string | null };

/** Temporary release control: only the exact configured string enables F016. */
export function metadataModerationEnabled(env: Pick<Env, 'PRESET_METADATA_MODERATION_ENABLED'>): boolean {
  return env.PRESET_METADATA_MODERATION_ENABLED === 'true';
}

/** Enrich only an enabled outward view; raw persisted JSON remains untouched. */
export function presetSnapshotView(preset: CommunityPreset, enabled: boolean): CommunityPreset {
  const parsed: unknown = preset.previous_values;
  if (!enabled || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return preset;
  const snapshot = parsed as Record<string, unknown>;
  if (
    typeof snapshot.name === 'string' && typeof snapshot.description === 'string' &&
    Array.isArray(snapshot.dyes) && snapshot.dyes.every((dye: unknown) => typeof dye === 'number' && Number.isInteger(dye)) &&
    Array.isArray(snapshot.tags) && snapshot.tags.every((tag: unknown) => typeof tag === 'string') &&
    !Object.hasOwn(snapshot, 'example_link')
  ) {
    return { ...preset, previous_values: { ...snapshot, example_link: null } as PresetSnapshot };
  }
  return preset;
}

/** Project validated effective fields onto the existing moderation boundary. */
export function presetModerationInput(preset: {
  name: string;
  description: string;
  tags: string[];
  example_link?: string | null;
}): { name: string; description: string } {
  let path = '';
  if (preset.example_link) {
    try {
      const pathname = new URL(preset.example_link).pathname;
      // Decode valid UTF-8, preserving other text even when a percent escape
      // is malformed. Replacement characters cannot hide later valid words.
      path = pathname.replace(/(?:%[0-9a-f]{2})+/gi, encoded => {
        const bytes = Uint8Array.from(encoded.match(/%[0-9a-f]{2}/gi)!, hex =>
          Number.parseInt(hex.slice(1), 16));
        return new TextDecoder().decode(bytes);
      });
    } catch {
      // Validators reject invalid URLs. Defensive fallback still scores the
      // remaining fields, never a raw URL containing credentials or queries.
    }
  }
  return { name: preset.name, description: [preset.description, preset.tags.join(' '), path].filter(Boolean).join(' ') };
}
