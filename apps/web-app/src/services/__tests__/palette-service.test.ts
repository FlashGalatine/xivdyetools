/**
 * XIV Dye Tools - PaletteService Unit Tests
 * Tests for saving, loading, and exporting favorite color palettes
 */

import { PaletteService, type SavedPalette, type PaletteExportData } from '../palette-service';
import { StorageService } from '../storage-service';
import { STORAGE_KEYS } from '@shared/constants';

// Mock StorageService
vi.mock('../storage-service', () => ({
  StorageService: {
    getItem: vi.fn(),
    setItem: vi.fn(() => true),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-1234-5678-9abc';
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => mockUUID),
});

describe('PaletteService', () => {
  const mockPalette: SavedPalette = {
    id: 'palette-1',
    name: 'Test Palette',
    baseColor: '#FF0000',
    baseDyeName: 'Dalamud Red',
    harmonyType: 'complementary',
    companions: ['Snow White', 'Jet Black'],
    dateCreated: '2024-01-01T00:00:00.000Z',
  };

  const mockPalettes: SavedPalette[] = [
    mockPalette,
    {
      id: 'palette-2',
      name: 'Second Palette',
      baseColor: '#00FF00',
      baseDyeName: 'Apple Green',
      harmonyType: 'triadic',
      companions: ['Coral Pink'],
      dateCreated: '2024-01-02T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (StorageService.setItem as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  // ============================================================================
  // getPalettes Tests
  // ============================================================================

  describe('getPalettes', () => {
    it('should return empty array when no palettes stored', () => {
      const palettes = PaletteService.getPalettes();
      expect(palettes).toEqual([]);
    });

    it('should return stored palettes', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const palettes = PaletteService.getPalettes();
      expect(palettes).toEqual(mockPalettes);
    });

    it('should handle storage error gracefully', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const palettes = PaletteService.getPalettes();
      expect(palettes).toEqual([]);
    });
  });

  // ============================================================================
  // getPaletteById Tests
  // ============================================================================

  describe('getPaletteById', () => {
    it('should return palette by ID', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const palette = PaletteService.getPaletteById('palette-1');
      expect(palette).toEqual(mockPalette);
    });

    it('should return null for non-existent ID', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const palette = PaletteService.getPaletteById('non-existent');
      expect(palette).toBeNull();
    });
  });

  // ============================================================================
  // savePalette Tests
  // ============================================================================

  describe('savePalette', () => {
    it('should save a new palette', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = PaletteService.savePalette(
        'New Palette',
        '#FF0000',
        'Dalamud Red',
        'complementary',
        ['Snow White']
      );

      expect(result).not.toBeNull();
      expect(result?.name).toBe('New Palette');
      expect(result?.baseColor).toBe('#FF0000');
      expect(StorageService.setItem).toHaveBeenCalled();
    });

    it('should trim palette name', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = PaletteService.savePalette(
        '  Trimmed Name  ',
        '#FF0000',
        'Dalamud Red',
        'complementary',
        []
      );

      expect(result?.name).toBe('Trimmed Name');
    });

    it('should use default name if empty', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = PaletteService.savePalette('', '#FF0000', 'Dalamud Red', 'complementary', []);

      expect(result?.name).toContain('Palette');
    });

    it('should evict oldest palette when limit reached', () => {
      // Create 100 palettes
      const fullPalettes = Array.from({ length: 100 }, (_, i) => ({
        ...mockPalette,
        id: `palette-${i}`,
        dateCreated: new Date(2024, 0, i + 1).toISOString(),
      }));

      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(fullPalettes);

      PaletteService.savePalette('New Palette', '#FF0000', 'Dalamud Red', 'complementary', []);

      // Should have removed oldest and added new one
      const savedArg = (StorageService.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedArg.length).toBe(100);
      expect(savedArg[0].id).not.toBe('palette-0'); // Oldest should be removed
    });

    it('should return null on storage error', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (StorageService.setItem as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const result = PaletteService.savePalette(
        'Test',
        '#FF0000',
        'Dalamud Red',
        'complementary',
        []
      );

      expect(result).toBeNull();
    });

    it('should handle save error gracefully', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (StorageService.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = PaletteService.savePalette(
        'Test',
        '#FF0000',
        'Dalamud Red',
        'complementary',
        []
      );

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // updatePalette Tests
  // ============================================================================

  describe('updatePalette', () => {
    it('should update an existing palette', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const result = PaletteService.updatePalette('palette-1', { name: 'Updated Name' });

      expect(result).toBe(true);
      const savedArg = (StorageService.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedArg[0].name).toBe('Updated Name');
    });

    it('should return false for non-existent palette', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const result = PaletteService.updatePalette('non-existent', { name: 'Updated' });

      expect(result).toBe(false);
    });

    it('should handle update error gracefully', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = PaletteService.updatePalette('palette-1', { name: 'Updated' });

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // deletePalette Tests
  // ============================================================================

  describe('deletePalette', () => {
    it('should delete a palette', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const result = PaletteService.deletePalette('palette-1');

      expect(result).toBe(true);
      const savedArg = (StorageService.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedArg.length).toBe(1);
      expect(savedArg[0].id).toBe('palette-2');
    });

    it('should return false for non-existent palette', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const result = PaletteService.deletePalette('non-existent');

      expect(result).toBe(false);
    });

    it('should handle delete error gracefully', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = PaletteService.deletePalette('palette-1');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // deleteAllPalettes Tests
  // ============================================================================

  describe('deleteAllPalettes', () => {
    it('should delete all palettes', () => {
      const result = PaletteService.deleteAllPalettes();

      expect(result).toBe(true);
      expect(StorageService.setItem).toHaveBeenCalledWith(STORAGE_KEYS.SAVED_PALETTES, []);
    });

    it('should handle error gracefully', () => {
      (StorageService.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const result = PaletteService.deleteAllPalettes();

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // getPaletteCount Tests
  // ============================================================================

  describe('getPaletteCount', () => {
    it('should return count of palettes', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const count = PaletteService.getPaletteCount();

      expect(count).toBe(2);
    });

    it('should return 0 when no palettes', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const count = PaletteService.getPaletteCount();

      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // isLimitReached Tests
  // ============================================================================

  describe('isLimitReached', () => {
    it('should return false when under limit', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      expect(PaletteService.isLimitReached()).toBe(false);
    });

    it('should return true when at limit', () => {
      const fullPalettes = Array.from({ length: 100 }, (_, i) => ({
        ...mockPalette,
        id: `palette-${i}`,
      }));
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(fullPalettes);

      expect(PaletteService.isLimitReached()).toBe(true);
    });
  });

  // ============================================================================
  // getMaxPalettes Tests
  // ============================================================================

  describe('getMaxPalettes', () => {
    it('should return max palettes constant', () => {
      expect(PaletteService.getMaxPalettes()).toBe(100);
    });
  });

  // ============================================================================
  // exportPalettes Tests
  // ============================================================================

  describe('exportPalettes', () => {
    it('should export palettes with version and timestamp', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const exportData = PaletteService.exportPalettes();

      expect(exportData.version).toBe('1.0.0');
      expect(exportData.exportedAt).toBeDefined();
      expect(exportData.palettes).toEqual(mockPalettes);
    });
  });

  // ============================================================================
  // downloadPalettes Tests
  // ============================================================================

  describe('downloadPalettes', () => {
    it('should trigger download', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      // Mock URL APIs
      const mockUrl = 'blob:test-url';
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      // Mock link click
      const clickSpy = vi.fn();
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return { click: clickSpy, href: '', download: '' } as unknown as HTMLAnchorElement;
        }
        return document.createElement(tagName);
      });

      PaletteService.downloadPalettes();

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  // ============================================================================
  // importPalettes Tests
  // ============================================================================

  describe('importPalettes', () => {
    const validExportData: PaletteExportData = {
      version: '1.0.0',
      exportedAt: '2024-01-01T00:00:00.000Z',
      palettes: mockPalettes,
    };

    it('should import palettes (merge mode)', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const count = PaletteService.importPalettes(validExportData, true);

      expect(count).toBe(2);
      expect(StorageService.setItem).toHaveBeenCalled();
    });

    it('should import palettes (replace mode)', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const count = PaletteService.importPalettes(validExportData, false);

      expect(count).toBe(2);
    });

    it('should skip duplicate IDs in merge mode', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([mockPalette]);

      const count = PaletteService.importPalettes(validExportData, true);

      // Only palette-2 should be added (palette-1 already exists)
      expect(count).toBe(1);
    });

    it('should return 0 for invalid export format', () => {
      const invalidData = { invalid: true } as unknown as PaletteExportData;

      const count = PaletteService.importPalettes(invalidData, true);

      expect(count).toBe(0);
    });

    it('should return 0 for empty palettes array', () => {
      const emptyData: PaletteExportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        palettes: [],
      };

      const count = PaletteService.importPalettes(emptyData, true);

      expect(count).toBe(0);
    });

    it('should filter invalid palettes', () => {
      const dataWithInvalid: PaletteExportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        palettes: [mockPalette, { invalid: true } as unknown as SavedPalette],
      };
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const count = PaletteService.importPalettes(dataWithInvalid, true);

      expect(count).toBe(1);
    });

    it('should enforce limit when importing', () => {
      const largePalettes = Array.from({ length: 150 }, (_, i) => ({
        ...mockPalette,
        id: `imported-${i}`,
      }));
      const largeExport: PaletteExportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        palettes: largePalettes,
      };
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      PaletteService.importPalettes(largeExport, false);

      const savedArg = (StorageService.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(savedArg.length).toBe(100);
    });

    it('should handle import error gracefully', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);
      (StorageService.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const count = PaletteService.importPalettes(validExportData, true);

      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // generateDefaultName Tests
  // ============================================================================

  describe('generateDefaultName', () => {
    it('should generate default name with date', () => {
      const name = PaletteService.generateDefaultName();

      expect(name).toContain('Palette');
      expect(name).toContain('-');
    });
  });

  // ============================================================================
  // searchPalettes Tests
  // ============================================================================

  describe('searchPalettes', () => {
    const searchMockPalettes: SavedPalette[] = [
      {
        id: 'palette-1',
        name: 'Test Palette',
        baseColor: '#FF0000',
        baseDyeName: 'Dalamud Red',
        harmonyType: 'complementary',
        companions: ['Snow White', 'Jet Black'],
        dateCreated: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'palette-2',
        name: 'Second Palette',
        baseColor: '#00FF00',
        baseDyeName: 'Apple Green',
        harmonyType: 'triadic',
        companions: ['Coral Pink'],
        dateCreated: '2024-01-02T00:00:00.000Z',
      },
    ];

    beforeEach(() => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(searchMockPalettes);
    });

    it('should return all palettes for empty query', () => {
      const results = PaletteService.searchPalettes('');
      expect(results.length).toBe(2);
    });

    it('should search by name', () => {
      const results = PaletteService.searchPalettes('Second');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Second Palette');
    });

    it('should search by base dye name', () => {
      const results = PaletteService.searchPalettes('Apple');
      expect(results.length).toBe(1);
      expect(results[0].baseDyeName).toBe('Apple Green');
    });

    it('should search by harmony type', () => {
      const results = PaletteService.searchPalettes('triadic');
      expect(results.length).toBe(1);
      expect(results[0].harmonyType).toBe('triadic');
    });

    it('should be case-insensitive', () => {
      const results = PaletteService.searchPalettes('APPLE');
      expect(results.length).toBe(1);
    });

    it('should trim search query', () => {
      const results = PaletteService.searchPalettes('  triadic  ');
      expect(results.length).toBe(1);
    });
  });

  // ============================================================================
  // getPalettesSortedByDate Tests
  // ============================================================================

  describe('getPalettesSortedByDate', () => {
    it('should return palettes sorted by date (newest first)', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(mockPalettes);

      const sorted = PaletteService.getPalettesSortedByDate();

      expect(sorted[0].id).toBe('palette-2'); // Newer
      expect(sorted[1].id).toBe('palette-1'); // Older
    });
  });

  // ============================================================================
  // Palette Validation Tests
  // ============================================================================

  describe('Palette Validation', () => {
    it('should validate required fields', () => {
      const invalidPalettes = [
        { id: 'test' }, // Missing fields
        { id: 'test', name: 'Test' }, // Still missing fields
        null,
        undefined,
        'string',
        123,
      ];

      const validExport: PaletteExportData = {
        version: '1.0.0',
        exportedAt: '2024-01-01T00:00:00.000Z',
        palettes: invalidPalettes as unknown as SavedPalette[],
      };

      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const count = PaletteService.importPalettes(validExport, true);

      expect(count).toBe(0); // No valid palettes
    });
  });
});
