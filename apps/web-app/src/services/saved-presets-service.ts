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
      dyes: [...preset.dyes],
      tags: [...preset.tags],
      author: preset.author,
      isCurated: preset.isCurated,
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

  static __reloadForTesting(): void {
    this.loaded = false;
    this.saved = [];
  }
}
