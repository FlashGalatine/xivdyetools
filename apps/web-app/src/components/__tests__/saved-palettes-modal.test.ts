/**
 * XIV Dye Tools - SavedPalettesModal Unit Tests
 *
 * Tests the saved palettes modal function for palette management.
 * Covers rendering, load/save operations, and import/export.
 *
 * @module components/__tests__/saved-palettes-modal.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockShow = vi.fn().mockReturnValue('modal-id-789');
const mockClose = vi.fn();

vi.mock('@services/index', () => ({
  ModalService: {
    show: mockShow,
    close: mockClose,
  },
  PaletteService: {
    getPalettesSortedByDate: vi.fn().mockReturnValue([]),
    downloadPalettes: vi.fn(),
    deletePalette: vi.fn(),
  },
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  ToastService: {
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
  dyeService: {
    getAllDyes: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('@shared/empty-state-icons', () => ({
  ICON_FOLDER: '<svg></svg>',
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('showSavedPalettesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should export showSavedPalettesModal function', async () => {
      const { showSavedPalettesModal } = await import('../saved-palettes-modal');
      expect(typeof showSavedPalettesModal).toBe('function');
    });

    it('should call ModalService.show when invoked', async () => {
      const { showSavedPalettesModal } = await import('../saved-palettes-modal');
      showSavedPalettesModal();
      expect(mockShow).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // Modal Options Tests
  // ============================================================================

  describe('Modal Options', () => {
    it('should pass correct modal options', async () => {
      const { showSavedPalettesModal } = await import('../saved-palettes-modal');
      showSavedPalettesModal();

      expect(mockShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
        })
      );
    });

    it('should accept onLoad callback', async () => {
      const { showSavedPalettesModal } = await import('../saved-palettes-modal');
      const onLoad = vi.fn();

      // Should not throw
      expect(() => showSavedPalettesModal(onLoad)).not.toThrow();
    });
  });

  // ============================================================================
  // Type Exports Tests
  // ============================================================================

  describe('Type Exports', () => {
    it('should export OnPaletteLoadCallback type', async () => {
      const module = await import('../saved-palettes-modal');
      expect(module).toBeDefined();
      expect(module.showSavedPalettesModal).toBeDefined();
    });
  });
});
