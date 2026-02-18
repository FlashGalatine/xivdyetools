/**
 * XIV Dye Tools - Palette Service
 *
 * Phase 4: Advanced Features (T6)
 * Manages saving, loading, and exporting favorite color palettes
 *
 * @module services/palette-service
 */

import { StorageService } from './storage-service';
import { STORAGE_KEYS } from '@shared/constants';
import { logger } from '@shared/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Saved palette data structure
 */
export interface SavedPalette {
  /** Unique identifier */
  id: string;
  /** User-defined palette name */
  name: string;
  /** Base color hex value */
  baseColor: string;
  /** Base dye name (localized) */
  baseDyeName: string;
  /** Harmony type used to generate this palette */
  harmonyType: string;
  /** Companion dye names */
  companions: string[];
  /** ISO timestamp when palette was created */
  dateCreated: string;
}

/**
 * Palette export format
 */
export interface PaletteExportData {
  version: string;
  exportedAt: string;
  palettes: SavedPalette[];
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of palettes to store */
const MAX_PALETTES = 100;

/** Export format version for compatibility */
const EXPORT_VERSION = '1.0.0';

// ============================================================================
// Palette Service
// ============================================================================

/**
 * Service for managing saved palettes
 * Provides CRUD operations and export/import functionality
 */
export class PaletteService {
  /**
   * Get all saved palettes
   */
  static getPalettes(): SavedPalette[] {
    try {
      const palettes = StorageService.getItem<SavedPalette[]>(STORAGE_KEYS.SAVED_PALETTES);
      return palettes || [];
    } catch (error) {
      logger.error('Failed to get palettes', error);
      return [];
    }
  }

  /**
   * Get a single palette by ID
   */
  static getPaletteById(id: string): SavedPalette | null {
    const palettes = this.getPalettes();
    return palettes.find((p) => p.id === id) || null;
  }

  /**
   * Save a new palette
   * @returns The saved palette with generated ID, or null on failure
   */
  static savePalette(
    name: string,
    baseColor: string,
    baseDyeName: string,
    harmonyType: string,
    companions: string[]
  ): SavedPalette | null {
    try {
      const palettes = this.getPalettes();

      // Enforce maximum limit with LRU eviction
      if (palettes.length >= MAX_PALETTES) {
        // Remove oldest palette
        palettes.sort(
          (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
        );
        palettes.shift();
        logger.info('Palette limit reached, removed oldest palette');
      }

      const newPalette: SavedPalette = {
        id: crypto.randomUUID(),
        name: name.trim() || this.generateDefaultName(),
        baseColor,
        baseDyeName,
        harmonyType,
        companions,
        dateCreated: new Date().toISOString(),
      };

      palettes.push(newPalette);

      const success = StorageService.setItem(STORAGE_KEYS.SAVED_PALETTES, palettes);

      if (success) {
        logger.info(`Palette saved: ${newPalette.name}`);
        return newPalette;
      }

      return null;
    } catch (error) {
      logger.error('Failed to save palette', error);
      return null;
    }
  }

  /**
   * Update an existing palette
   */
  static updatePalette(
    id: string,
    updates: Partial<Omit<SavedPalette, 'id' | 'dateCreated'>>
  ): boolean {
    try {
      const palettes = this.getPalettes();
      const index = palettes.findIndex((p) => p.id === id);

      if (index === -1) {
        logger.warn(`Palette not found for update: ${id}`);
        return false;
      }

      palettes[index] = {
        ...palettes[index],
        ...updates,
      };

      return StorageService.setItem(STORAGE_KEYS.SAVED_PALETTES, palettes);
    } catch (error) {
      logger.error('Failed to update palette', error);
      return false;
    }
  }

  /**
   * Delete a palette by ID
   */
  static deletePalette(id: string): boolean {
    try {
      const palettes = this.getPalettes();
      const filtered = palettes.filter((p) => p.id !== id);

      if (filtered.length === palettes.length) {
        logger.warn(`Palette not found for deletion: ${id}`);
        return false;
      }

      const success = StorageService.setItem(STORAGE_KEYS.SAVED_PALETTES, filtered);

      if (success) {
        logger.info(`Palette deleted: ${id}`);
      }

      return success;
    } catch (error) {
      logger.error('Failed to delete palette', error);
      return false;
    }
  }

  /**
   * Delete all palettes
   */
  static deleteAllPalettes(): boolean {
    try {
      return StorageService.setItem(STORAGE_KEYS.SAVED_PALETTES, []);
    } catch (error) {
      logger.error('Failed to delete all palettes', error);
      return false;
    }
  }

  /**
   * Get palette count
   */
  static getPaletteCount(): number {
    return this.getPalettes().length;
  }

  /**
   * Check if palette limit is reached
   */
  static isLimitReached(): boolean {
    return this.getPaletteCount() >= MAX_PALETTES;
  }

  /**
   * Get maximum palette limit
   */
  static getMaxPalettes(): number {
    return MAX_PALETTES;
  }

  /**
   * Export all palettes as JSON
   */
  static exportPalettes(): PaletteExportData {
    const palettes = this.getPalettes();

    return {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      palettes,
    };
  }

  /**
   * Export palettes and trigger download
   */
  static downloadPalettes(): void {
    const exportData = this.exportPalettes();
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `xivdyetools-palettes-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
    logger.info('Palettes exported');
  }

  /**
   * Import palettes from JSON data
   * @param merge If true, merge with existing palettes; if false, replace all
   * @returns Number of palettes imported
   */
  static importPalettes(data: PaletteExportData, merge: boolean = true): number {
    try {
      // Validate export format
      if (!data.version || !Array.isArray(data.palettes)) {
        logger.error('Invalid palette export format');
        return 0;
      }

      const importedPalettes = data.palettes.filter((p) => this.isValidPalette(p));

      if (importedPalettes.length === 0) {
        logger.warn('No valid palettes found in import data');
        return 0;
      }

      // WEB-BUG-003 FIX: Read existing palettes ONCE to prevent race conditions
      // between multiple reads (e.g., another tab modifying storage)
      const existing = this.getPalettes();
      const existingCount = existing.length;

      let palettes: SavedPalette[];

      if (merge) {
        const existingIds = new Set(existing.map((p) => p.id));

        // Add only new palettes (by ID)
        const newPalettes = importedPalettes.filter((p) => !existingIds.has(p.id));
        palettes = [...existing, ...newPalettes];

        // Enforce limit
        if (palettes.length > MAX_PALETTES) {
          palettes = palettes.slice(-MAX_PALETTES);
        }
      } else {
        palettes = importedPalettes.slice(0, MAX_PALETTES);
      }

      const success = StorageService.setItem(STORAGE_KEYS.SAVED_PALETTES, palettes);

      if (success) {
        // Use stored existingCount, not fresh read from storage
        const count = merge ? palettes.length - existingCount : importedPalettes.length;
        logger.info(`Imported ${count} palettes`);
        return count;
      }

      return 0;
    } catch (error) {
      logger.error('Failed to import palettes', error);
      return 0;
    }
  }

  /**
   * Generate default palette name with date
   */
  static generateDefaultName(): string {
    const now = new Date();
    return `Palette - ${now.toLocaleDateString()}`;
  }

  /**
   * Validate palette structure
   */
  private static isValidPalette(palette: unknown): palette is SavedPalette {
    if (!palette || typeof palette !== 'object') {
      return false;
    }

    const p = palette as Record<string, unknown>;

    return (
      typeof p.id === 'string' &&
      typeof p.name === 'string' &&
      typeof p.baseColor === 'string' &&
      typeof p.baseDyeName === 'string' &&
      typeof p.harmonyType === 'string' &&
      Array.isArray(p.companions) &&
      typeof p.dateCreated === 'string'
    );
  }

  /**
   * Search palettes by name
   */
  static searchPalettes(query: string): SavedPalette[] {
    if (!query.trim()) {
      return this.getPalettes();
    }

    const normalizedQuery = query.toLowerCase().trim();
    return this.getPalettes().filter(
      (p) =>
        p.name.toLowerCase().includes(normalizedQuery) ||
        p.baseDyeName.toLowerCase().includes(normalizedQuery) ||
        p.harmonyType.toLowerCase().includes(normalizedQuery)
    );
  }

  /**
   * Get palettes sorted by date (newest first)
   */
  static getPalettesSortedByDate(): SavedPalette[] {
    return this.getPalettes().sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    );
  }
}
