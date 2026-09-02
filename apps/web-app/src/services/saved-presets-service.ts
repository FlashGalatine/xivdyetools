/**
 * XIV Dye Tools 5.0 — Saved presets (8A Gallery).
 *
 * The dead `showFavorites` toggle became a real store: local snapshots that
 * work signed out and with the presets worker down. A saved preset stores a
 * SNAPSHOT, not a reference — a community preset its author later deletes
 * survives here with a tombstone mark instead of vanishing.
 *
 * Deliberately a dedicated store rather than a CollectionService kind:
 * collection records are dye lists; a preset snapshot carries author,
 * category, tags and source identity.
 *
 * @module services/saved-presets-service
 */

import { StorageService } from './storage-service';
import { logger } from '@shared/logger';
import { dyeService, toStainId } from './dye-service-wrapper';
import type { PresetCategory } from '@xivdyetools/types';
import type { UnifiedPreset } from './hybrid-preset-service';

const STORAGE_KEY = 'v5_saved_presets';
const MAX_SAVED = 200;

/** Local snapshot of a saved preset. */
export interface SavedPreset {
  /** UnifiedPreset id ('community-…' or the curated id) */
  id: string;
  name: string;
  description: string;
  category: PresetCategory;
  /** Snapshotted so the offline shelf filters the same way the live rail does */
  secondaryCategories?: PresetCategory[];
  dyes: number[];
  tags: string[];
  author?: string;
  isCurated: boolean;
  exampleLink?: string;
  savedAt: string;
  /** The author removed the live preset; the local copy stays, marked. */
  deletedByAuthor?: boolean;
}

type Listener = (saved: SavedPreset[]) => void;

export class SavedPresetsService {
  private static saved: SavedPreset[] = [];
  private static loaded = false;
  private static listeners = new Set<Listener>();

  private static load(): void {
    if (this.loaded) return;
    this.loaded = true;
    const raw = StorageService.getItem<SavedPreset[]>(STORAGE_KEY);
    this.saved = Array.isArray(raw) ? raw.filter((p) => p && typeof p.id === 'string') : [];
    if (this.migrateLegacyDyeIds()) {
      StorageService.setItem(STORAGE_KEY, this.saved);
    }
  }

  /**
   * Convert 4.x legacy itemIDs in stored snapshots to stainIDs, in place.
   *
   * A snapshot is a copy, not a reference, so one taken before the 2026-08-28
   * stainID rewrite still holds whatever ID space the API served that day.
   * `resolvePresetDye` is stainID-only, so without this pass those snapshots
   * render as an empty palette on every path that falls back to the local copy
   * (author-deleted preset, offline, live row outside the fetched page).
   *
   * Deliberately conservative in two ways. It does nothing while the dye
   * database is still cold, because every lookup would miss and the pass would
   * look like a snapshot full of unresolvable dyes. And an ID it cannot place
   * is left exactly as it was rather than dropped — a snapshot is user data,
   * and silently shortening someone's palette is worse than leaving one swatch
   * unresolved, which is what already happens today.
   *
   * @returns true when anything changed and the store needs rewriting.
   */
  private static migrateLegacyDyeIds(): boolean {
    let changed = false;
    try {
      if (!dyeService.isLoadedStatus()) return false;
      for (const preset of this.saved) {
        if (!Array.isArray(preset.dyes)) continue;
        preset.dyes = preset.dyes.map((stored) => {
          const stainId = toStainId(stored);
          if (stainId === null || stainId === stored) return stored;
          changed = true;
          return stainId;
        });
      }
    } catch (error) {
      // Repairing old snapshots is a bonus; returning them is the job. A dye
      // database that is missing or half-built must not empty the shelf.
      logger.error('[SavedPresets] Legacy dye migration failed; snapshots left as stored:', error);
      return false;
    }
    if (changed) {
      logger.info('[SavedPresets] Migrated legacy dye references in saved snapshots');
    }
    return changed;
  }

  private static persist(): void {
    StorageService.setItem(STORAGE_KEY, this.saved);
    const snapshot = this.getAll();
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (error) {
        logger.error('[SavedPresets] Listener failed:', error);
      }
    });
  }

  static getAll(): SavedPreset[] {
    this.load();
    return [...this.saved];
  }

  static isSaved(id: string): boolean {
    this.load();
    return this.saved.some((p) => p.id === id);
  }

  static snapshotOf(preset: UnifiedPreset): SavedPreset {
    return {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      category: preset.category,
      secondaryCategories: [...preset.secondaryCategories],
      dyes: [...preset.dyes],
      tags: [...preset.tags],
      author: preset.author,
      isCurated: preset.isCurated,
      exampleLink: preset.exampleLink ?? undefined,
      savedAt: new Date().toISOString(),
    };
  }

  /** Save or unsave; returns the new saved-state. */
  static toggle(preset: UnifiedPreset): boolean {
    this.load();
    const index = this.saved.findIndex((p) => p.id === preset.id);
    if (index >= 0) {
      this.saved.splice(index, 1);
      this.persist();
      return false;
    }
    if (this.saved.length >= MAX_SAVED) {
      this.saved.shift();
    }
    this.saved.push(this.snapshotOf(preset));
    this.persist();
    return true;
  }

  /** Mark a saved community preset whose live copy no longer exists. */
  static markDeleted(id: string, deleted: boolean = true): void {
    this.load();
    const entry = this.saved.find((p) => p.id === id);
    if (entry && entry.deletedByAuthor !== deleted) {
      entry.deletedByAuthor = deleted;
      this.persist();
    }
  }

  static subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
