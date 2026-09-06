/**
 * XIV Dye Tools - ExtractorTool Unit Tests
 *
 * The 4A workspace: a persistent loupe reads the image, the dominance bar
 * under it indexes extracted colours (proportional) and committed picks
 * (fixed-width, slot-numbered), and the card sheet shows one card per bar
 * segment. Covers rendering, the drop-zone contract, the sidebar config
 * surface, extraction, the loupe, picks, resolution (dedupe + filters),
 * export, prices, image privacy, clipboard and teardown.
 *
 * @module components/__tests__/extractor-tool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExtractorTool } from '../extractor-tool';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';
import { DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
//
// `findClosestDye` (SINGULAR) and `findDyesWithinDistance` are given real
// nearest-neighbour behaviour rather than a fixed return. A constant would
// make "the extractor matched the right dye" untestable — every input would
// produce the same answer, so the assertions could not tell a working match
// from a broken one. `findClosestDye` is also called by the REAL
// `PaletteService` — which this file does not mock — from inside
// `extractAndMatchPalette`.
const {
  mockGetAllDyes,
  mockGetDyeById,
  mockFindClosestDyes,
  mockFindClosestDye,
  mockFindDyesWithinDistance,
} = vi.hoisted(() => {
  const parse = (hex: string) => ({
    r: parseInt(hex.slice(1, 3), 16) || 0,
    g: parseInt(hex.slice(3, 5), 16) || 0,
    b: parseInt(hex.slice(5, 7), 16) || 0,
  });
  /** Plain RGB euclidean — enough to be deterministic and order-correct. */
  const dist = (a: string, b: string) => {
    const x = parse(a);
    const y = parse(b);
    return Math.sqrt((x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2);
  };
  const mockGetAllDyes = vi.fn();
  /** The dye pool both matchers search — whatever getAllDyes is seeded with. */
  const pool = (): { id: number; hex: string }[] =>
    (mockGetAllDyes() as { id: number; hex: string }[]) ?? [];
  return {
    mockGetAllDyes,
    mockGetDyeById: vi.fn(),
    mockFindClosestDyes: vi.fn(),
    /**
     * Honours `excludeIds` (by `dye.id`) exactly as core's DyeSearch does —
     * the tool's whole resolution path (filters + Prevent duplicates) now
     * rides on it, so a mock that ignored it could not tell a working
     * dedupe from a broken one.
     */
    mockFindClosestDye: vi.fn((hex: string, opts?: { excludeIds?: number[] }) => {
      const excluded = new Set(opts?.excludeIds ?? []);
      const dyes = pool().filter((d) => !excluded.has(d.id));
      if (dyes.length === 0) return null;
      return dyes.reduce((best, d) => (dist(hex, d.hex) < dist(hex, best.hex) ? d : best));
    }),
    mockFindDyesWithinDistance: vi.fn((hex: string, opts?: { limit?: number }) => {
      const dyes = pool();
      return [...dyes]
        .sort((a, b) => dist(hex, a.hex) - dist(hex, b.hex))
        .slice(0, opts?.limit ?? dyes.length);
    }),
  };
});

// Icon modules are NOT mocked. They are compile-time string constants with
// no dependencies, and a hand-written stub only has to miss one export for
// the render to throw into BaseComponent.safeRender()'s catch — which
// swallows it into an error state, so the panel silently renders nothing
// and every assertion downstream sees an empty DOM instead of a failure.

vi.mock('@services/dye-service-wrapper', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
      findClosestDye: mockFindClosestDye,
      findDyesWithinDistance: mockFindDyesWithinDistance,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
}));

vi.mock('@services/index', () => ({
  /** Picks readable text ink for a swatch background. */
  getContrastColor: vi.fn(() => '#FFFFFF'),
  ToastService: {
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
  ThemeService: {
    getCurrentTheme: vi.fn().mockReturnValue('standard-dark'),
    getAllThemes: vi.fn().mockReturnValue([]),
    isDarkMode: vi.fn().mockReturnValue(true),
    setTheme: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      findClosestDyes: mockFindClosestDyes,
      findClosestDye: mockFindClosestDye,
      findDyesWithinDistance: mockFindDyesWithinDistance,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  dyeService: {
    getAllDyes: mockGetAllDyes,
    getDyeById: mockGetDyeById,
    findClosestDyes: mockFindClosestDyes,
    findClosestDye: mockFindClosestDye,
    findDyesWithinDistance: mockFindDyesWithinDistance,
    getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
  },
  /** Complete against every LanguageService method the tool calls. */
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}: ${Object.values(params).join('/')}`,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    getRace: (key: string) => `race:${key}`,
    getClan: (key: string) => `clan:${key}`,
    getAcquisition: (key: string) => `acq:${key}`,
    getCurrency: (key: string) => `cur:${key}`,
    getVisionType: (key: string) => `vision:${key}`,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  StorageService: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  /**
   * Complete against every ColorService method the tool calls. A missing one
   * throws inside renderContent, which BaseComponent's safeRender() swallows
   * into an error state — so the panel renders nothing and the tests see an
   * empty DOM instead of a failure.
   */
  ColorService: {
    hexToRgb: vi.fn((hex: string) => ({
      r: parseInt(hex.slice(1, 3), 16) || 0,
      g: parseInt(hex.slice(3, 5), 16) || 0,
      b: parseInt(hex.slice(5, 7), 16) || 0,
    })),
    rgbToHex: vi.fn((r: number, g: number, b: number) =>
      `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase()
    ),
    rgbToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    hexToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    rgbToLab: vi.fn(() => ({ l: 50, a: 0, b: 0 })),
    hexToLab: vi.fn(() => ({ l: 50, a: 0, b: 0 })),
    getColorDistance: vi.fn(() => 15),
    getDeltaE: vi.fn(() => 15),
    getDistanceForMethod: vi.fn(() => 15),
    calculateDistanceWithMethod: vi.fn(() => 15),
    calculateColorDistance: vi.fn(() => 15),
    getContrastRatio: vi.fn(() => 4.5),
    findClosestDyes: vi.fn(() => []),
  },
  MarketBoardService: {
    getInstance: vi.fn().mockReturnValue({
      getShowPrices: vi.fn().mockReturnValue(false),
      setShowPrices: vi.fn(),
      // Kept in step with the real MarketBoardService. A missing method
      // throws inside renderContent, which safeRender() swallows into an
      // error state — the panel then renders nothing, silently.
      getPriceForDye: vi.fn().mockReturnValue(null),
      getAllPrices: vi.fn().mockReturnValue(new Map()),
      getPricesView: vi.fn().mockReturnValue(new Map()),
      getSelectedServer: vi.fn().mockReturnValue('Crystal'),
      setServer: vi.fn(),
      clearCache: vi.fn(),
      getIsFetching: vi.fn().mockReturnValue(false),
      getWorldNameForPrice: vi.fn().mockReturnValue(null),
      subscribe: vi.fn().mockReturnValue(() => {}),
      getWorldId: vi.fn().mockReturnValue(null),
      setWorldId: vi.fn(),
      getPriceForItem: vi.fn().mockReturnValue(null),
      fetchPricesForDyes: vi.fn().mockResolvedValue(new Map()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  },
  ConfigController: {
    getInstance: vi.fn().mockReturnValue({
      getConfig: vi.fn().mockReturnValue({}),
      subscribe: vi.fn().mockReturnValue(() => {}),
    }),
  },
  CollectionService: {
    getFavorites: vi.fn().mockReturnValue([]),
    subscribeFavorites: vi.fn().mockReturnValue(() => {}),
    isFavorite: vi.fn().mockReturnValue(false),
  },
  RouterService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
    getCurrentToolId: vi.fn().mockReturnValue('extractor'),
    navigateTo: vi.fn(),
  },
  WorldService: {
    getWorlds: vi.fn().mockReturnValue([]),
    getSelectedWorld: vi.fn().mockReturnValue(null),
    setSelectedWorld: vi.fn(),
  },
}));

/**
 * FINDING-009: the extractor does not import this module at all. The mock
 * stays as the sentinel for that — the image-privacy tests below assert these
 * spies are never touched, which is what "images are session-only" means in
 * practice. STORES mirrors the real module, which has no image store.
 */
vi.mock('@services/indexeddb-service', () => ({
  indexedDBService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(true),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  STORES: { PRICE_CACHE: 'price_cache', PALETTES: 'palettes', SETTINGS: 'settings' },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@components/export-sheet', () => ({
  openExportSheet: vi.fn(),
}));

describe('ExtractorTool', () => {
  let container: HTMLElement;
  let leftPanel: HTMLElement;
  let rightPanel: HTMLElement;
  let drawerContent: HTMLElement;
  let tool: ExtractorTool | null;

  beforeEach(() => {
    container = createTestContainer();
    leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel';
    rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel';
    drawerContent = document.createElement('div');
    drawerContent.id = 'drawer-content';
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);
    container.appendChild(drawerContent);
    tool = null;
    vi.clearAllMocks();
    mockGetAllDyes.mockReturnValue(mockDyes);
    mockGetDyeById.mockImplementation((id: number) => mockDyes.find((d) => d.id === id));
    mockFindClosestDyes.mockReturnValue(mockDyes.slice(0, 5));
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    if (tool) {
      try {
        tool.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const mount = (opts: { drawer?: boolean } = {}): ExtractorTool => {
    const t = new ExtractorTool(
      container,
      opts.drawer === false ? { leftPanel, rightPanel } : { leftPanel, rightPanel, drawerContent }
    );
    t.init();
    return t;
  };

  const flush = async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  };

  const workspace = (): HTMLElement => rightPanel.querySelector('.x4a-workspace') as HTMLElement;

  /**
   * Block until the tool is not mid-extraction. extractPalette() awaits a
   * real requestAnimationFrame and flags the workspace `data-busy` across
   * it, so a fixed count of setTimeout(0) flushes is a wall-clock bet on
   * that frame. The flag is the tool's own quiescence signal — wait on it.
   */
  const waitForIdle = (): Promise<void> =>
    vi.waitFor(() => {
      expect(workspace().dataset.busy, 'extraction still running').toBeUndefined();
    });

  const dropZone = (): HTMLElement =>
    rightPanel.querySelector('#extractor-drop-zone') as HTMLElement;

  /** A DragEvent carrying files, which jsdom does not construct for us. */
  const dropEvent = (files: File[]): Event => {
    const ev = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'dataTransfer', { value: { files } });
    return ev;
  };

  const resultCards = () => rightPanel.querySelectorAll('v4-result-card');
  const cardData = (i: number) =>
    (resultCards()[i] as unknown as { data: { originalColor: string; dye: (typeof mockDyes)[0] } })
      .data;
  const cardSelected = (i: number) =>
    (resultCards()[i] as unknown as { selected: boolean }).selected;

  const bar = (): HTMLElement => rightPanel.querySelector('#extractor-bar') as HTMLElement;
  const segments = () => Array.from(bar().querySelectorAll<HTMLButtonElement>('.x4a-seg'));
  const pickSegments = () => Array.from(bar().querySelectorAll<HTMLButtonElement>('.x4a-seg-pick'));
  const extractedSegments = () => segments().filter((s) => !s.classList.contains('x4a-seg-pick'));
  const addTile = (): HTMLButtonElement =>
    rightPanel.querySelector('#extractor-add-pick') as HTMLButtonElement;
  const legend = (): HTMLElement => rightPanel.querySelector('#extractor-legend') as HTMLElement;
  const countLabel = (): HTMLElement => rightPanel.querySelector('#extractor-count') as HTMLElement;
  const clearPicksBtn = (): HTMLButtonElement =>
    rightPanel.querySelector('#extractor-clear-picks') as HTMLButtonElement;
  const loupe = (): HTMLElement => rightPanel.querySelector('#extractor-loupe') as HTMLElement;
  const hintRead = (): HTMLElement => rightPanel.querySelector('.x4a-hint-read') as HTMLElement;
  const exportButton = (): HTMLButtonElement =>
    Array.from(rightPanel.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('common.export')
    ) as HTMLButtonElement;

  // ==========================================================================
  // Basic Rendering
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('renders the one-column workspace into the main panel', () => {
      tool = mount();

      expect(workspace()).not.toBeNull();
      expect(dropZone()).not.toBeNull();
    });

    it('owns no option panel — the left panel is left untouched', () => {
      tool = mount();

      // The v4 shell passes the SAME element as both panels; anything the
      // tool wrote to a "left panel" was cleared by its own workspace render.
      // Advanced lives behind the app-bar gear (the config sidebar) only.
      expect(leftPanel.children.length).toBe(0);
    });

    it('works with and without drawer content', () => {
      tool = mount();
      expect(rightPanel.children.length).toBeGreaterThan(0);
      tool.destroy();

      tool = mount({ drawer: false });
      expect(rightPanel.children.length).toBeGreaterThan(0);
    });

    it('starts on the empty flow with the loaded flow hidden', () => {
      tool = mount();

      expect(dropZone().parentElement!.style.display).toBe('flex');
      expect(bar().closest<HTMLElement>('[style*="display: none"]')).not.toBeNull();
    });
  });

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      tool = mount();
      expect(() => tool!.destroy()).not.toThrow();
    });

    it('should handle double destroy gracefully', () => {
      tool = mount();
      tool.destroy();
      expect(() => tool!.destroy()).not.toThrow();
    });
  });

  // ==========================================================================
  // The sidebar surface — ConfigController is the only settings store
  // ==========================================================================

  describe('setConfig — the sidebar surface', () => {
    it('never persists a setting itself — the sidebar owns the store', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      vi.mocked(StorageService.setItem).mockClear();

      tool.setConfig({ vibrancyBoost: false, maxColors: 9, preventDuplicates: false });
      await flush();

      expect(StorageService.setItem).not.toHaveBeenCalled();
    });

    it('purges every key the v3/3C builds wrote, on mount', async () => {
      const { StorageService } = await import('@services/index');
      tool = mount();
      await flush();

      for (const key of [
        'v3_matcher_sample_size',
        'v3_matcher_palette_mode',
        'v3_matcher_palette_count',
        'v3_matcher_vibrancy_boost',
        'v3_matcher_image',
        'v3_matcher_color',
        'v3_matcher_extracted_colors',
      ]) {
        expect(StorageService.removeItem).toHaveBeenCalledWith(key);
      }
    });

    it('accepts an empty config without touching state', async () => {
      tool = mount();

      expect(() => tool!.setConfig({})).not.toThrow();
      await flush();
      expect(dropZone()).not.toBeNull();
    });

    it('merges displayOptions rather than replacing them', () => {
      tool = mount();

      expect(() => tool!.setConfig({ displayOptions: { showHex: false } as never })).not.toThrow();
    });

    it('applies several keys in one call', async () => {
      tool = mount();

      expect(() =>
        tool!.setConfig({
          vibrancyBoost: false,
          maxColors: 6,
          matchingMethod: 'oklab',
          preventDuplicates: false,
          dragThreshold: 8,
          sampleAreaSize: 4,
        })
      ).not.toThrow();
      await flush();
    });
  });

  // ==========================================================================
  // The drop zone
  // ==========================================================================

  describe('the drop zone', () => {
    it('renders a drop zone while no image is loaded', () => {
      tool = mount();

      expect(dropZone()).not.toBeNull();
    });

    it('highlights on dragover and clears on dragleave', () => {
      tool = mount();

      rightPanel.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
      expect(dropZone().style.borderColor).toBe('var(--theme-primary)');

      rightPanel.dispatchEvent(new Event('dragleave', { bubbles: true }));
      expect(dropZone().style.borderColor).toBe('');
    });

    it('clears the highlight after a drop', () => {
      tool = mount();
      rightPanel.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));

      rightPanel.dispatchEvent(dropEvent([]));

      expect(dropZone().style.borderColor).toBe('');
    });

    it('ignores a dropped non-image file', () => {
      const readSpy = vi.spyOn(FileReader.prototype, 'readAsDataURL');
      tool = mount();

      rightPanel.dispatchEvent(dropEvent([new File(['x'], 'notes.txt', { type: 'text/plain' })]));

      expect(readSpy).not.toHaveBeenCalled();
      readSpy.mockRestore();
    });

    it('reads a dropped image file', () => {
      const readSpy = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(() => undefined);
      tool = mount();

      rightPanel.dispatchEvent(dropEvent([new File(['x'], 'shot.png', { type: 'image/png' })]));

      expect(readSpy).toHaveBeenCalledTimes(1);
      readSpy.mockRestore();
    });

    it('refuses a dropped image over the size cap before reading it', async () => {
      const { ToastService } = await import('@services/index');
      const { MAX_USER_FILE_BYTES } = await import('@shared/constants');
      const readSpy = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(() => undefined);
      tool = mount();
      const big = new File(['x'], 'huge.png', { type: 'image/png' });
      Object.defineProperty(big, 'size', { value: MAX_USER_FILE_BYTES + 1 });

      rightPanel.dispatchEvent(dropEvent([big]));

      expect(readSpy).not.toHaveBeenCalled();
      expect(ToastService.error).toHaveBeenCalledWith('errors.imageTooLarge');
      readSpy.mockRestore();
    });

    it('takes only the first file when several are dropped', () => {
      const readSpy = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(() => undefined);
      tool = mount();

      rightPanel.dispatchEvent(
        dropEvent([
          new File(['a'], 'one.png', { type: 'image/png' }),
          new File(['b'], 'two.png', { type: 'image/png' }),
        ])
      );

      expect(readSpy).toHaveBeenCalledTimes(1);
      readSpy.mockRestore();
    });

    it('survives a drop carrying no dataTransfer at all', () => {
      tool = mount();

      expect(() =>
        rightPanel.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))
      ).not.toThrow();
    });

    it('opens the file dialog when the empty card is clicked', () => {
      tool = mount();
      const input = rightPanel.querySelector<HTMLInputElement>('input[type="file"]')!;
      const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);

      dropZone().click();

      expect(clickSpy).toHaveBeenCalled();
    });

    it('accepts only image types on the file input', () => {
      tool = mount();

      const inputs = rightPanel.querySelectorAll<HTMLInputElement>('input[type="file"]');
      expect(inputs.length).toBeGreaterThan(0);
      inputs.forEach((input) => expect(input.accept).toBe('image/*'));
    });
  });

  // ==========================================================================
  // With a decoded image
  // ==========================================================================

  describe('with a decoded image', () => {
    /** 2×2 image: red, green, blue, white. */
    const PIXELS = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
    ]);

    let originalImage: typeof Image;
    let originalGetContext: HTMLCanvasElement['getContext'];
    let ctx: Record<string, ReturnType<typeof vi.fn>>;

    beforeEach(() => {
      originalImage = globalThis.Image;
      originalGetContext = HTMLCanvasElement.prototype.getContext;

      class FakeImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 2;
        height = 2;
        naturalWidth = 2;
        naturalHeight = 2;
        crossOrigin: string | null = null;
        private value = '';
        get src(): string {
          return this.value;
        }
        set src(next: string) {
          this.value = next;
          // Decoding is async in a browser; keep that shape
          queueMicrotask(() => this.onload?.());
        }
      }
      globalThis.Image = FakeImage as unknown as typeof Image;

      // Complete against every 2D-context member extractor-tool.ts and
      // image-zoom-controller.ts touch. A single missing method throws inside
      // `extractPalette`'s try block, which catches it, toasts and moves on —
      // so the suite stays green while the entire palette path is dead.
      ctx = {
        drawImage: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        putImageData: vi.fn(),
        getImageData: vi.fn(() => ({ data: PIXELS, width: 2, height: 2 })),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        setTransform: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
      };
      HTMLCanvasElement.prototype.getContext = vi.fn(
        () => ctx
      ) as unknown as HTMLCanvasElement['getContext'];
    });

    afterEach(() => {
      globalThis.Image = originalImage;
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    /** Drop a PNG and wait until the bar has been built from its extraction. */
    const loadImage = async (): Promise<void> => {
      // renderBar creates a fresh `+` tile on every roll, so "a tile that is
      // not the one from before" is the signal that THIS image's extraction
      // landed — a bare existence check passes early on a replace
      const previousTile = rightPanel.querySelector('#extractor-add-pick');
      rightPanel.dispatchEvent(dropEvent([new File(['x'], 'shot.png', { type: 'image/png' })]));
      await vi.waitFor(() => {
        expect(addTile()).not.toBeNull();
        expect(addTile()).not.toBe(previousTile);
      });
      await waitForIdle();
    };

    /** The element ImageZoomController emits its events on. */
    const canvasWrapper = (): HTMLElement => {
      const canvas = rightPanel.querySelector('canvas');
      // wrapper > canvas-container > canvas
      return canvas!.parentElement!.parentElement as HTMLElement;
    };

    /** A click/tap or drag-release, exactly as the controller reports it. */
    const sample = (hex: string, isPixelSample = true): void => {
      canvasWrapper().dispatchEvent(
        new CustomEvent('image-sampled', {
          bubbles: true,
          detail: { hex, x: 1, y: 1, isPixelSample },
        })
      );
    };

    /** A pointer drag past the threshold. */
    const drag = (hex: string, clientX = 40, clientY = 25): void => {
      canvasWrapper().dispatchEvent(
        new CustomEvent('loupe-move', { bubbles: true, detail: { hex, clientX, clientY } })
      );
    };

    const release = (): void => {
      canvasWrapper().dispatchEvent(new CustomEvent('loupe-end', { bubbles: true }));
    };

    /** Read a colour into the loupe and commit it as a pick. */
    const commit = (hex: string): void => {
      sample(hex);
      addTile().click();
    };

    it('renders a canvas once an image is loaded', async () => {
      tool = mount();

      await loadImage();

      expect(rightPanel.querySelector('canvas')).not.toBeNull();
    });

    it('replaces the drop zone flow with the loaded flow', async () => {
      tool = mount();
      expect(dropZone().parentElement!.style.display).toBe('flex');

      await loadImage();

      expect(dropZone().parentElement!.style.display).toBe('none');
      expect(rightPanel.querySelector('canvas')).not.toBeNull();
    });

    it('draws the image onto the canvas', async () => {
      tool = mount();

      await loadImage();

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it('extracts on load and announces the count once', async () => {
      const { ToastService } = await import('@services/index');
      tool = mount();

      await loadImage();

      expect(resultCards().length).toBeGreaterThan(0);
      expect(ToastService.success).toHaveBeenCalledWith(
        expect.stringContaining('matcher.paletteExtracted')
      );
    });

    it('draws nothing onto the image — the bar is the index now', async () => {
      tool = mount();

      await loadImage();

      // 3C numbered the extracted colours onto the canvas; 4A keeps the
      // pixels uncovered
      expect(ctx.strokeText).not.toHaveBeenCalled();
      expect(ctx.arc).not.toHaveBeenCalled();
    });

    it('re-samples the image when the colour count changes, silently', async () => {
      const { ToastService } = await import('@services/index');
      tool = mount();
      await loadImage();
      ctx.getImageData.mockClear();
      vi.mocked(ToastService.success).mockClear();

      tool.setConfig({ maxColors: 3 });

      // Waited on, not estimated: extractPalette() yields a real
      // requestAnimationFrame before it touches the canvas
      await vi.waitFor(() => expect(ctx.getImageData).toHaveBeenCalled());
      await waitForIdle();
      // A slider drag must not be a toast storm
      expect(ToastService.success).not.toHaveBeenCalled();
    });

    it('uses the singular key when the image yields one colour', async () => {
      const { ToastService } = await import('@services/index');
      const { ConfigController } = await import('@services/index');
      const getConfig = vi.mocked(ConfigController.getInstance().getConfig);
      getConfig.mockImplementation(((key: string) =>
        key === 'extractor' ? { maxColors: 1 } : {}) as never);
      try {
        tool = mount();
        await loadImage();

        // "1 colors" is the bug this pair exists to prevent
        expect(ToastService.success).toHaveBeenCalledWith(
          expect.stringContaining('matcher.paletteExtractedOne:')
        );
      } finally {
        getConfig.mockReset();
        getConfig.mockReturnValue({} as never);
      }
    });

    it('survives a decode failure without leaving the tool broken', async () => {
      class FailingImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_next: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }
      globalThis.Image = FailingImage as unknown as typeof Image;
      tool = mount();

      const { ToastService } = await import('@services/index');
      rightPanel.dispatchEvent(dropEvent([new File(['x'], 'shot.png', { type: 'image/png' })]));
      for (let i = 0; i < 6; i++) await flush();

      // The drop zone is still there to try again with — and the failure is
      // said out loud rather than swallowed (a truncated PNG, a desktop HEIC)
      expect(dropZone().parentElement!.style.display).toBe('flex');
      expect(ToastService.error).toHaveBeenCalledWith('errors.failedToReadImage');
    });

    it('tears down cleanly with an image loaded', async () => {
      tool = mount();
      await loadImage();

      expect(() => tool!.destroy()).not.toThrow();
    });

    // ------------------------------------------------------------------------
    // Stage 2 — the bar
    // ------------------------------------------------------------------------

    describe('the bar', () => {
      it('renders one proportional segment per extracted colour, labelled with its share', async () => {
        tool = mount();
        await loadImage();

        const segs = extractedSegments();
        expect(segs.length).toBeGreaterThan(0);
        expect(segs.length).toBe(resultCards().length);
        for (const seg of segs) {
          const label = seg.textContent?.trim() ?? '';
          expect(label).toMatch(/^\d+%$/);
          // The width IS the share — flex-grow equals the percentage printed
          expect(seg.style.flexGrow).toBe(label.replace('%', ''));
        }
      });

      it('carries no picks and no break before anything is committed', async () => {
        tool = mount();
        await loadImage();

        expect(pickSegments()).toHaveLength(0);
        expect(legend().textContent).toBe('matcher.imageShare');
        expect(clearPicksBtn().style.display).toBe('none');
      });

      it('counts the extracted run against the configured maximum', async () => {
        tool = mount();
        await loadImage();

        expect(countLabel().textContent).toBe(
          `matcher.rollCountOf: ${extractedSegments().length}/4`
        );
      });

      it('focuses a card when its segment is clicked', async () => {
        tool = mount();
        await loadImage();
        const segs = extractedSegments();
        expect(segs.length).toBeGreaterThan(1);

        segs[1].click();

        expect(cardSelected(1)).toBe(true);
        expect(cardSelected(0)).toBe(false);
        expect(segs[1].style.borderTopColor).toBe('var(--theme-primary)');
        expect(segs[1].getAttribute('aria-pressed')).toBe('true');
        expect(segs[0].style.borderTopColor).toBe('transparent');
      });

      it('names the hex, the share and the dye on each segment', async () => {
        tool = mount();
        await loadImage();

        const seg = extractedSegments()[0];
        expect(seg.title).toMatch(/^#[0-9A-F]{6} · \d+% · Dye-\d+$/);
      });
    });

    // ------------------------------------------------------------------------
    // Stage 1 — the loupe
    // ------------------------------------------------------------------------

    describe('the loupe', () => {
      it('is hidden until it has read a colour', async () => {
        tool = mount();
        await loadImage();

        expect(loupe().style.transform).toContain('scale(0)');
        expect(hintRead().style.display).toBe('none');
      });

      it('settles where the pointer read and holds that colour', async () => {
        tool = mount();
        await loadImage();

        sample('#00FF00');

        expect(loupe().style.background).toBe('rgb(0, 255, 0)');
        expect(loupe().style.transform).toContain('scale(1)');
        expect(loupe().textContent).toContain('#00FF00');
      });

      it('follows a drag at drag scale and settles on release without hiding', async () => {
        tool = mount();
        await loadImage();

        drag('#00FF00');
        expect(loupe().style.background).toBe('rgb(0, 255, 0)');
        expect(loupe().style.transform).toContain('scale(1.16)');

        release();

        // 3C hid the loupe here; 4A keeps it where it last read
        expect(loupe().style.transform).toContain('scale(1)');
        expect(loupe().style.transform).not.toContain('scale(0)');
      });

      it('names the nearest dye in the hint once it has read a colour', async () => {
        tool = mount();
        await loadImage();
        const snowWhite = mockDyes.find((d) => d.name === 'Snow White')!;

        // Near-white must resolve to Snow White (#FFFFFF), not to Ash Grey
        // (#888888) — the assertion a fixed-return mock cannot make
        sample('#FEFEFE');

        expect(hintRead().style.display).toBe('');
        expect(hintRead().textContent).toBe(`#FEFEFE · Dye-${snowWhite.itemID}`);
        // The instruction yields to the reading
        const rest = rightPanel.querySelector<HTMLElement>('.x4a-dt-text[style*="display: none"]');
        expect(rest).not.toBeNull();
      });

      it('commits nothing by itself — reading is not picking', async () => {
        tool = mount();
        await loadImage();
        const before = resultCards().length;

        sample('#FF0000');
        drag('#00FF00');
        release();

        expect(resultCards().length).toBe(before);
        expect(pickSegments()).toHaveLength(0);
      });

      it('ignores an event that is not a pixel sample', async () => {
        tool = mount();
        await loadImage();

        sample('#FF0000', false);

        expect(loupe().style.transform).toContain('scale(0)');
      });

      it('fills the + tile with the colour it holds', async () => {
        tool = mount();
        await loadImage();

        sample('#123456');

        const chip = addTile().querySelector<HTMLElement>('span[aria-hidden]')!;
        expect(chip.style.background).toBe('rgb(18, 52, 86)');
      });
    });

    // ------------------------------------------------------------------------
    // Picks — the `+` tile, the fixed-width run, the cap
    // ------------------------------------------------------------------------

    describe('picks', () => {
      it('commits the loupe colour as a fixed-width pick numbered after the extracted run', async () => {
        tool = mount();
        await loadImage();
        const extracted = extractedSegments().length;

        commit('#123456');

        const picks = pickSegments();
        expect(picks).toHaveLength(1);
        // A pick has no share, so it is a slot number — never a percentage
        expect(picks[0].textContent?.trim()).toBe(String(extracted + 1));
        expect(picks[0].style.flexGrow).not.toBe(String(extracted + 1));
        expect(resultCards().length).toBe(extracted + 1);
        expect(cardData(extracted).originalColor).toBe('#123456');
        // The new pick takes the focus
        expect(cardSelected(extracted)).toBe(true);
      });

      it('separates the picks from the extracted run with a 3px break', async () => {
        tool = mount();
        await loadImage();

        commit('#123456');
        commit('#654321');

        const picks = pickSegments();
        expect(picks[0].style.marginLeft).toBe('3px');
        expect(picks[1].style.marginLeft).toBe('');
      });

      it('does nothing before the loupe has read a colour', async () => {
        tool = mount();
        await loadImage();
        const before = resultCards().length;

        addTile().click();

        expect(pickSegments()).toHaveLength(0);
        expect(resultCards().length).toBe(before);
      });

      it('counts "n + m" and legends "IMAGE SHARE · m picks" once picks exist', async () => {
        tool = mount();
        await loadImage();
        const extracted = extractedSegments().length;

        commit('#123456');
        expect(legend().textContent).toBe('matcher.imageShare · matcher.picksCountOne');
        expect(countLabel().textContent).toBe(`matcher.rollCount: ${extracted}/1`);

        commit('#654321');
        expect(legend().textContent).toBe('matcher.imageShare · matcher.picksCount: 2');
        // Never "8 of 6"
        expect(countLabel().textContent).toBe(`matcher.rollCount: ${extracted}/2`);
        expect(clearPicksBtn().style.display).toBe('');
      });

      it('clears every pick and keeps the extracted run', async () => {
        tool = mount();
        await loadImage();
        const extracted = extractedSegments().length;
        commit('#123456');
        commit('#654321');

        clearPicksBtn().click();

        expect(pickSegments()).toHaveLength(0);
        expect(resultCards().length).toBe(extracted);
        expect(legend().textContent).toBe('matcher.imageShare');
        expect(clearPicksBtn().style.display).toBe('none');
      });

      it('caps the picks at six and says so instead of dropping one', async () => {
        const { ToastService } = await import('@services/index');
        tool = mount();
        await loadImage();

        for (let i = 0; i < 7; i++) {
          commit(`#${(i + 1).toString(16).padStart(6, '0')}`);
        }

        expect(pickSegments()).toHaveLength(6);
        expect(ToastService.info).toHaveBeenCalledWith('matcher.pickCapReached: 6');
        expect(addTile().getAttribute('aria-disabled')).toBe('true');
      });

      it('survives a re-extraction', async () => {
        tool = mount();
        await loadImage();
        commit('#123456');

        tool.setConfig({ maxColors: 3 });
        await vi.waitFor(() => expect(ctx.getImageData).toHaveBeenCalled());
        await waitForIdle();

        expect(pickSegments()).toHaveLength(1);
        expect(cardData(resultCards().length - 1).originalColor).toBe('#123456');
      });

      it('goes with the image it was read from', async () => {
        tool = mount();
        await loadImage();
        commit('#123456');

        // Replace = a new drop
        await loadImage();

        expect(pickSegments()).toHaveLength(0);
        expect(loupe().style.transform).toContain('scale(0)');
      });
    });

    // ------------------------------------------------------------------------
    // Review round — the cases the first cut got wrong
    // ------------------------------------------------------------------------

    describe('review round', () => {
      it('a double-tap of + focuses the existing pick instead of committing it twice', async () => {
        tool = mount();
        await loadImage();
        const extracted = extractedSegments().length;

        sample('#7A4B2C');
        addTile().click();
        addTile().click();

        expect(pickSegments()).toHaveLength(1);
        expect(resultCards().length).toBe(extracted + 1);
        expect(cardSelected(extracted)).toBe(true);
      });

      it('keeps every colour as a repeat once Prevent duplicates has used up the eligible dyes', async () => {
        tool = mount();
        await loadImage();
        // Pastel + dark excluded leaves the fixture pool one dye (Snow White):
        // every extracted colour must still be on the sheet, sharing it
        tool.setConfig({
          dyeFilters: { ...DEFAULT_DYE_FILTERS, excludePastel: true, excludeDark: true },
        });

        expect(resultCards().length).toBe(extractedSegments().length);
        expect(resultCards().length).toBeGreaterThan(1);
        for (let i = 0; i < resultCards().length; i++) {
          expect(cardData(i).dye.isPastel).toBe(false);
          expect(cardData(i).dye.isDark).toBe(false);
        }

        // A pick lands on the sheet under the same rule — it never vanishes
        // while the legend still counts it
        commit('#123456');
        expect(pickSegments()).toHaveLength(1);
        expect(legend().textContent).toBe('matcher.imageShare · matcher.picksCountOne');
      });

      it('says so when no dye is left for any colour', async () => {
        mockGetAllDyes.mockReturnValue([]);
        tool = mount();
        await loadImage();

        expect(resultCards().length).toBe(0);
        expect(rightPanel.textContent).toContain('matcher.noMatchingDyes');
        expect(countLabel().textContent).toBe('');
        expect(exportButton().disabled).toBe(true);
      });

      it('clears the previous palette when a replacement image yields no pixels', async () => {
        const { ToastService } = await import('@services/index');
        tool = mount();
        await loadImage();
        commit('#123456');
        expect(resultCards().length).toBeGreaterThan(1);

        // The replacement is fully transparent: every pixel is dropped
        ctx.getImageData.mockImplementation(() => ({
          data: new Uint8ClampedArray(16),
          width: 2,
          height: 2,
        }));
        rightPanel.dispatchEvent(dropEvent([new File(['x'], 'blank.png', { type: 'image/png' })]));
        await vi.waitFor(() =>
          expect(ToastService.error).toHaveBeenCalledWith('errors.noPixelsToAnalyze')
        );

        // Nothing of image A survives under image B
        expect(resultCards().length).toBe(0);
        expect(pickSegments()).toHaveLength(0);
        expect(countLabel().textContent).toBe('');
        expect(clearPicksBtn().style.display).toBe('none');
        expect(exportButton().disabled).toBe(true);
      });

      it('re-resolves instead of re-clustering when the matching method changes', async () => {
        const { ColorService } = await import('@services/index');
        tool = mount();
        await loadImage();
        ctx.getImageData.mockClear();

        tool.setConfig({ matchingMethod: 'oklab' });
        await flush();

        // K-means++ is seeded at random: a re-run would re-cluster and the
        // user would read that as an effect of the metric
        expect(ctx.getImageData).not.toHaveBeenCalled();
        const last = vi.mocked(ColorService.getDistanceForMethod).mock.calls.at(-1);
        expect(last?.[2]).toBe('oklab');
        const lastLookup = mockFindClosestDye.mock.calls.at(-1) as
          [string, { matchingMethod?: string }?] | undefined;
        expect(lastLookup?.[1]?.matchingMethod).toBe('oklab');
      });

      it('orders a saturated colour ahead of white while the vibrancy boost is on', async () => {
        const { ColorService } = await import('@services/index');
        vi.mocked(ColorService.rgbToHsv).mockImplementation((r: number, g: number, b: number) => {
          const mx = Math.max(r, g, b);
          const mn = Math.min(r, g, b);
          return { h: 0, s: mx ? ((mx - mn) / mx) * 100 : 0, v: (mx / 255) * 100 };
        });
        tool = mount();
        await loadImage();

        // Four equal 25% clusters: the drawn score (0.55 × saturation + share)
        // puts white (saturation 0) last
        const segs = extractedSegments();
        expect(segs.length).toBe(4);
        expect(segs[segs.length - 1].style.background).toBe('rgb(255, 255, 255)');
        expect(segs[0].style.background).not.toBe('rgb(255, 255, 255)');
      });

      it('keeps the focus on the colour, not the index, when the run re-orders', async () => {
        const { ColorService } = await import('@services/index');
        vi.mocked(ColorService.rgbToHsv).mockImplementation((r: number, g: number, b: number) => {
          const mx = Math.max(r, g, b);
          const mn = Math.min(r, g, b);
          return { h: 0, s: mx ? ((mx - mn) / mx) * 100 : 0, v: (mx / 255) * 100 };
        });
        tool = mount();
        await loadImage();
        const segs = extractedSegments();
        const chosen = segs[segs.length - 1];
        const chosenKey = chosen.dataset.key;
        chosen.click();
        expect(chosen.getAttribute('aria-pressed')).toBe('true');

        tool.setConfig({ vibrancyBoost: false });

        const focused = extractedSegments().find((s) => s.getAttribute('aria-pressed') === 'true');
        expect(focused?.dataset.key).toBe(chosenKey);
        const focusedCards = Array.from(resultCards()).filter(
          (c) => (c as unknown as { selected: boolean }).selected
        );
        expect(focusedCards).toHaveLength(1);
        expect((focusedCards[0] as HTMLElement).dataset.key).toBe(chosenKey);
      });

      it('keeps the loupe where it settled across a language switch', async () => {
        const { LanguageService } = await import('@services/index');
        tool = mount();
        await loadImage();
        sample('#00FF00');
        const onLanguage = vi.mocked(LanguageService.subscribe).mock.calls[0][0] as () => void;

        onLanguage();

        expect(loupe().style.transform).toContain('scale(1)');
        expect(loupe().style.background).toBe('rgb(0, 255, 0)');
        expect(loupe().textContent).toContain('#00FF00');
        expect(hintRead().style.display).toBe('');
      });

      it('keeps a market error badge through a sheet rebuild', async () => {
        const { MarketBoardService, ConfigController } = await import('@services/index');
        const svc = MarketBoardService.getInstance();
        vi.mocked(svc.getShowPrices).mockReturnValue(true);
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockRejectedValueOnce(
          new Error('Request failed with status: 429')
        );
        const market = vi
          .mocked(ConfigController.getInstance().subscribe)
          .mock.calls.find((c) => c[0] === 'market')!;
        (market[1] as (config: { showPrices: boolean }) => void)({ showPrices: true });
        for (let i = 0; i < 4; i++) await flush();
        expect(
          (resultCards()[0] as unknown as { data: { marketError?: string } }).data.marketError
        ).toBe('H429');

        // A display-option change rebuilds every card; the badge must survive
        tool.setConfig({ displayOptions: { showHex: false } as never });

        expect(
          (resultCards()[0] as unknown as { data: { marketError?: string } }).data.marketError
        ).toBe('H429');
        expect((resultCards()[0] as unknown as { showHex: boolean }).showHex).toBe(false);
      });

      it('leaves a paste aimed at a text field alone, and takes one image from a paste elsewhere', () => {
        tool = mount();
        const readSpy = vi
          .spyOn(FileReader.prototype, 'readAsDataURL')
          .mockImplementation(() => undefined);
        const item = {
          type: 'image/png',
          getAsFile: () => new File(['x'], 'c.png', { type: 'image/png' }),
        };
        const pasteWith = (items: unknown[]): Event => {
          const ev = new Event('paste', { bubbles: true, cancelable: true });
          Object.defineProperty(ev, 'clipboardData', { value: { items } });
          return ev;
        };

        const input = document.createElement('input');
        container.appendChild(input);
        const onInput = pasteWith([item]);
        input.dispatchEvent(onInput);
        expect(readSpy).not.toHaveBeenCalled();
        expect(onInput.defaultPrevented).toBe(false);

        document.body.dispatchEvent(pasteWith([item, item]));
        expect(readSpy).toHaveBeenCalledTimes(1);
        readSpy.mockRestore();
      });

      it('does not accumulate listeners across load → clear cycles', async () => {
        tool = mount();
        const listeners = (tool as unknown as { listeners: Map<string, unknown> }).listeners;
        await loadImage();
        const clearBtn = () =>
          rightPanel.querySelector<HTMLButtonElement>('button[aria-label="matcher.clearImage"]')!;
        clearBtn().click();
        await flush();
        const afterFirstCycle = listeners.size;

        await loadImage();
        clearBtn().click();
        await flush();

        // The canvas wrapper's listeners are unbound when the canvas is
        // rebuilt, so a detached full-resolution canvas is never pinned
        expect(listeners.size).toBe(afterFirstCycle);
      });
    });

    // ------------------------------------------------------------------------
    // Resolution — one path for extracted colours and picks
    // ------------------------------------------------------------------------

    describe('resolving the roll', () => {
      it('assigns a distinct dye per segment while preventDuplicates is on', async () => {
        tool = mount();
        await loadImage();

        const ids = Array.from(resultCards()).map(
          (c) => cardData(Array.from(resultCards()).indexOf(c)).dye.itemID
        );
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('gives a pick a dye no extracted slot holds while preventDuplicates is on', async () => {
        tool = mount();
        await loadImage();

        // Pure red's nearest dye is already taken by the red pixel's slot
        commit('#FF0000');

        const ids = Array.from(resultCards()).map((_, i) => cardData(i).dye.itemID);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('may repeat a dye once deduplication is switched off', async () => {
        tool = mount();
        await loadImage();
        tool.setConfig({ preventDuplicates: false });
        const nearest = mockFindClosestDye('#FF0000') as unknown as { itemID: number };

        commit('#FF0000');

        expect(cardData(resultCards().length - 1).dye.itemID).toBe(nearest.itemID);
      });

      it('re-resolves a pick away from a dye the filters exclude', async () => {
        tool = mount();
        await loadImage();
        // Rose Pink exactly — a pastel
        commit('#FF9999');
        expect(cardData(resultCards().length - 1).dye.isPastel).toBe(true);

        tool.setConfig({ dyeFilters: { ...DEFAULT_DYE_FILTERS, excludePastel: true } });

        expect(cardData(resultCards().length - 1).dye.isPastel).toBe(false);
        // The pick itself is untouched — only its answer changed
        expect(pickSegments()).toHaveLength(1);
      });

      it('applies a dyeFilters change once and skips an identical repeat', async () => {
        const { ColorService } = await import('@services/index');
        tool = mount();
        await loadImage();
        const forMethod = vi.mocked(ColorService.getDistanceForMethod);
        const filters = { ...DEFAULT_DYE_FILTERS, excludePastel: true };

        tool.setConfig({ dyeFilters: filters });
        const after = forMethod.mock.calls.length;
        tool.setConfig({ dyeFilters: { ...filters } });

        expect(forMethod.mock.calls.length).toBe(after);
      });
    });

    describe('the matching method', () => {
      /**
       * Every sibling tool seeds its own field from
       * `ConfigController.getConfig(<tool>).matchingMethod ?? 'ciede2000'`.
       * The loupe hint's nearest-dye lookup is the observation point.
       */
      const methodPassedToMatcher = (): string | undefined => {
        const last = mockFindClosestDye.mock.calls.at(-1) as
          [string, { matchingMethod?: string }?] | undefined;
        return last?.[1]?.matchingMethod;
      };

      it('matches with the suite default ΔE2000 when nothing is stored', async () => {
        tool = mount();
        await loadImage();

        sample('#FF0000');

        expect(methodPassedToMatcher()).toBe('ciede2000');
      });

      it('honours a matchingMethod persisted in the extractor config', async () => {
        const { ConfigController } = await import('@services/index');
        const getConfig = vi.mocked(ConfigController.getInstance().getConfig);
        getConfig.mockImplementation(((key: string) =>
          key === 'extractor' ? { matchingMethod: 'oklab' } : {}) as never);
        try {
          tool = mount();
          await loadImage();

          sample('#FF0000');

          expect(methodPassedToMatcher()).toBe('oklab');
        } finally {
          getConfig.mockReset();
          getConfig.mockReturnValue({} as never);
        }
      });

      it('normalizes a retired 4.x method name from storage to a supported one', async () => {
        const { ConfigController } = await import('@services/index');
        const getConfig = vi.mocked(ConfigController.getInstance().getConfig);
        getConfig.mockImplementation(((key: string) =>
          key === 'extractor' ? { matchingMethod: 'hyab' } : {}) as never);
        try {
          tool = mount();
          await loadImage();

          sample('#FF0000');

          expect(methodPassedToMatcher()).toBe('ciede2000');
        } finally {
          getConfig.mockReset();
          getConfig.mockReturnValue({} as never);
        }
      });

      it('seeds the colour count from the extractor config, not a v3 key', async () => {
        const { ConfigController, StorageService } = await import('@services/index');
        const getConfig = vi.mocked(ConfigController.getInstance().getConfig);
        getConfig.mockImplementation(((key: string) =>
          key === 'extractor' ? { maxColors: 7 } : {}) as never);
        try {
          tool = mount();
          await loadImage();

          expect(countLabel().textContent).toMatch(/\/7$/);
          expect(StorageService.getItem).not.toHaveBeenCalledWith('v3_matcher_palette_count');
          // Seven clusters over four distinct pixels: K-means returns empty
          // clusters for the surplus, and an empty cluster is not a colour the
          // image contains — no "0%" segment, no ghost card
          expect(extractedSegments().length).toBeLessThanOrEqual(4);
          expect(extractedSegments().some((s) => s.textContent?.trim() === '0%')).toBe(false);
          expect(resultCards().length).toBe(extractedSegments().length);
        } finally {
          getConfig.mockReset();
          getConfig.mockReturnValue({} as never);
        }
      });

      /**
       * BUG-007: the distance shown on a card must be measured with the method
       * the card labels it as. Both ColorService mocks return the same
       * constant, so asserting *which* function ran, and with what method, is
       * what discriminates.
       */
      it('measures the displayed distance with the selected method, not raw RGB', async () => {
        const { ColorService } = await import('@services/index');
        const forMethod = vi.mocked(ColorService.getDistanceForMethod);
        const rawRgb = vi.mocked(ColorService.getColorDistance);
        tool = mount();
        forMethod.mockClear();
        rawRgb.mockClear();

        await loadImage();
        commit('#FF0000');

        expect(forMethod).toHaveBeenCalled();
        expect(forMethod.mock.calls.every((c) => c[2] === 'ciede2000')).toBe(true);
        expect(rawRgb).not.toHaveBeenCalled();
      });
    });

    // ------------------------------------------------------------------------
    // Hand-offs
    // ------------------------------------------------------------------------

    it('enables the export button, which ships disabled', async () => {
      tool = mount();
      expect(exportButton().disabled).toBe(true);

      await loadImage();

      expect(exportButton().disabled).toBe(false);
    });

    it('exports the whole roll — extracted colours and picks — as source/dye pairs', async () => {
      const { openExportSheet } = await import('@components/export-sheet');
      tool = mount();
      await loadImage();
      commit('#123456');

      exportButton().click();

      const arg = vi.mocked(openExportSheet).mock.calls[0][0];
      expect(arg.tool).toBe('extractor');
      expect(arg.entries.length).toBe(resultCards().length);
      // The pair is the point: the pixel read AND the dye it resolved to
      expect(arg.entries[0]).toMatchObject({
        key: 'pick-1',
        source: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        dye: expect.objectContaining({ name: expect.any(String) }),
        delta: expect.any(Number),
      });
      expect(arg.entries.at(-1)).toMatchObject({
        key: `pick-${resultCards().length}`,
        source: '#123456',
      });
    });

    it('rebuilds the workspace on a language change and keeps the image and picks', async () => {
      const { LanguageService } = await import('@services/index');
      tool = mount();
      await loadImage();
      commit('#123456');
      const onLanguage = vi.mocked(LanguageService.subscribe).mock.calls[0][0] as () => void;

      onLanguage();

      expect(rightPanel.querySelector('canvas')).not.toBeNull();
      expect(dropZone().parentElement!.style.display).toBe('none');
      expect(pickSegments()).toHaveLength(1);
      expect(resultCards().length).toBeGreaterThan(1);
    });

    // ------------------------------------------------------------------------
    // Image privacy
    // ------------------------------------------------------------------------

    /**
     * FINDING-009: every image the tool saw used to be written to IndexedDB
     * and restored — and re-extracted — the next time the Palette Extractor
     * was opened. Images are session-only: nothing is written, nothing is
     * read back, and the pre-OPT-012 localStorage copy is cleaned up on mount.
     */
    describe('image privacy (FINDING-009)', () => {
      it('does not restore an image an earlier version left in IndexedDB', async () => {
        const { indexedDBService } = await import('@services/indexeddb-service');
        vi.mocked(indexedDBService.get).mockResolvedValue('data:image/png;base64,AAAA');

        tool = mount();
        for (let i = 0; i < 8; i++) await flush();

        expect(indexedDBService.get).not.toHaveBeenCalled();
        expect(resultCards().length).toBe(0);
      });

      it('never writes a loaded image, a colour or a pick to storage', async () => {
        const { indexedDBService } = await import('@services/indexeddb-service');
        const { StorageService } = await import('@services/index');
        tool = mount();
        vi.mocked(StorageService.setItem).mockClear();

        await loadImage();
        commit('#123456');

        expect(indexedDBService.set).not.toHaveBeenCalled();
        expect(StorageService.setItem).not.toHaveBeenCalled();
      });

      it('drops a legacy localStorage image instead of restoring it', async () => {
        const { indexedDBService } = await import('@services/indexeddb-service');
        const { StorageService } = await import('@services/index');
        vi.mocked(indexedDBService.get).mockResolvedValue(null);
        vi.mocked(StorageService.getItem).mockImplementation((key: string) =>
          key === 'v3_matcher_image' ? ('data:image/png;base64,AAAA' as never) : (null as never)
        );

        tool = mount();
        for (let i = 0; i < 8; i++) await flush();

        expect(indexedDBService.set).not.toHaveBeenCalled();
        expect(StorageService.removeItem).toHaveBeenCalledWith('v3_matcher_image');
        expect(resultCards().length).toBe(0);
      });
    });

    // ------------------------------------------------------------------------
    // Market prices — driven by the sidebar's market config
    // ------------------------------------------------------------------------

    describe('market prices', () => {
      /**
       * `showPrices` is not a field — it reads through to
       * `MarketBoardService.getShowPrices()`, so the toggle is flipped on the
       * service, not on the tool.
       */
      const withPricesOn = async () => {
        const { MarketBoardService } = await import('@services/index');
        const svc = MarketBoardService.getInstance();
        vi.mocked(svc.getShowPrices).mockReturnValue(true);
        return svc;
      };

      /** The sidebar's market-config push, as the tool subscribed to it. */
      const marketChanged = async (config: { showPrices: boolean }) => {
        const { ConfigController } = await import('@services/index');
        const call = vi
          .mocked(ConfigController.getInstance().subscribe)
          .mock.calls.find((c) => c[0] === 'market');
        expect(call, 'the tool subscribes to the market config').toBeDefined();
        (call![1] as (config: { showPrices: boolean }) => void)(config);
      };

      it('fetches prices for every distinct dye on the sheet when prices are on', async () => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockClear();

        await marketChanged({ showPrices: true });
        await flush();

        expect(svc.fetchPricesForDyes).toHaveBeenCalled();
        const fetched = vi.mocked(svc.fetchPricesForDyes).mock.calls[0][0] as { itemID: number }[];
        expect(new Set(fetched.map((d) => d.itemID)).size).toBe(fetched.length);
      });

      it('re-fetches when the market config changes again (server change)', async () => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockClear();

        await marketChanged({ showPrices: true });
        await marketChanged({ showPrices: true });
        await flush();

        expect(vi.mocked(svc.fetchPricesForDyes).mock.calls.length).toBe(2);
      });

      it('re-renders without fetching when prices are switched off', async () => {
        const { MarketBoardService } = await import('@services/index');
        const svc = MarketBoardService.getInstance();
        vi.mocked(svc.getShowPrices).mockReturnValue(false);
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockClear();

        await marketChanged({ showPrices: false });
        await flush();

        expect(svc.fetchPricesForDyes).not.toHaveBeenCalled();
        expect(resultCards().length).toBeGreaterThan(0);
      });

      /**
       * A failed fetch must reach the cards as a short code rather than an
       * empty price — "no data" and "the request failed" are different states
       * and the card renders them differently.
       */
      it.each([
        ['a 429', new Error('Request failed with status: 429'), 'H429'],
        ['a 503', new Error('Request failed with status: 503'), 'H503'],
        ['a rate-limit message', new Error('Rate limit exceeded'), 'H429'],
        ['a timeout', new Error('Request timed out'), 'TOUT'],
        ['a network failure', new Error('Failed to fetch'), 'NCON'],
        ['an abort', new Error('The operation was aborted'), 'CANC'],
        ['a bare Response-like object', { status: 404 }, 'H404'],
        ['something unrecognised', new Error('kaboom'), 'EUNK'],
      ])('maps %s onto a display code', async (_label, thrown, code) => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockRejectedValueOnce(thrown);

        await marketChanged({ showPrices: true });
        for (let i = 0; i < 4; i++) await flush();

        const errors = Array.from(resultCards()).map(
          (c) => (c as unknown as { data: { marketError?: string } }).data.marketError
        );
        expect(errors).toContain(code);
      });

      it('reports offline ahead of whatever the error says', async () => {
        const svc = await withPricesOn();
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        tool = mount();
        await loadImage();
        vi.mocked(svc.fetchPricesForDyes).mockRejectedValueOnce(new Error('status: 500'));

        await marketChanged({ showPrices: true });
        for (let i = 0; i < 4; i++) await flush();

        const errors = Array.from(resultCards()).map(
          (c) => (c as unknown as { data: { marketError?: string } }).data.marketError
        );
        expect(errors).toContain('NOFF');
        onLine.mockRestore();
      });

      it('puts a fetched price onto the card', async () => {
        const svc = await withPricesOn();
        tool = mount();
        await loadImage();
        vi.mocked(svc.getPricesView).mockReturnValue(
          new Map(mockDyes.map((d) => [d.itemID, { currentMinPrice: 1234, worldId: 40 }])) as never
        );
        vi.mocked(svc.getWorldNameForPrice).mockReturnValue('Jenova' as never);

        await marketChanged({ showPrices: true });
        for (let i = 0; i < 4; i++) await flush();

        const first = resultCards()[0] as unknown as {
          data: { price?: number; marketServer?: string };
        };
        expect(first.data.price).toBe(1234);
        expect(first.data.marketServer).toBe('Jenova');
      });
    });

    it('clears the image and everything read from it, and offers the drop zone again', async () => {
      tool = mount();
      await loadImage();
      commit('#123456');
      expect(resultCards().length).toBeGreaterThan(0);
      expect(dropZone().parentElement!.style.display).toBe('none');

      const clearBtn = rightPanel.querySelector<HTMLButtonElement>(
        'button[aria-label="matcher.clearImage"]'
      );
      expect(clearBtn).not.toBeNull();
      clearBtn!.click();
      await flush();

      // FINDING-009: nothing was persisted, so dropping the reference IS the
      // clear — the empty flow comes back and the roll goes with it
      expect(dropZone().parentElement!.style.display).toBe('flex');
      expect(resultCards().length).toBe(0);
      expect(bar().children.length).toBe(0);
      expect(exportButton().disabled).toBe(true);
    });
  });

  // ==========================================================================
  // Paste from clipboard
  // ==========================================================================

  describe('paste from clipboard', () => {
    let originalClipboard: PropertyDescriptor | undefined;

    const withClipboard = (read: () => Promise<unknown>) => {
      originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { read },
      });
    };

    afterEach(() => {
      if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
      originalClipboard = undefined;
    });

    /** The paste button only renders where navigator.clipboard.read exists. */
    const pasteButton = (): HTMLButtonElement | undefined =>
      [...rightPanel.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('matcher.pasteClipboard')
      );

    it('is hidden entirely where the Clipboard API is unavailable', () => {
      // jsdom has no navigator.clipboard.read, which is the unsupported case
      tool = mount();

      expect(pasteButton()).toBeUndefined();
    });

    it('appears when the Clipboard API is available', () => {
      withClipboard(async () => []);
      tool = mount();

      expect(pasteButton()).toBeDefined();
    });

    it('reads an image item off the clipboard', async () => {
      const blob = new Blob(['x'], { type: 'image/png' });
      withClipboard(async () => [{ types: ['image/png'], getType: async () => blob }]);
      const readSpy = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(() => undefined);
      tool = mount();

      pasteButton()!.click();
      await flush();
      await flush();

      expect(readSpy).toHaveBeenCalled();
      readSpy.mockRestore();
    });

    it('warns when the clipboard holds no image', async () => {
      const { ToastService } = await import('@services/index');
      withClipboard(async () => [{ types: ['text/plain'], getType: async () => new Blob() }]);
      tool = mount();
      vi.mocked(ToastService.error).mockClear();

      pasteButton()!.click();
      await flush();
      await flush();

      expect(ToastService.error).toHaveBeenCalled();
    });

    it('warns rather than throwing when permission is denied', async () => {
      const { ToastService } = await import('@services/index');
      withClipboard(async () => {
        throw new Error('NotAllowedError');
      });
      tool = mount();
      vi.mocked(ToastService.error).mockClear();

      pasteButton()!.click();
      await flush();
      await flush();

      expect(ToastService.error).toHaveBeenCalled();
    });
  });

  describe('lifecycle under interaction', () => {
    it('tears down cleanly after configuration', async () => {
      tool = mount();
      tool.setConfig({ maxColors: 5, vibrancyBoost: true });
      await flush();

      expect(() => tool!.destroy()).not.toThrow();
    });

    it('ignores configuration arriving after destroy', () => {
      tool = mount();
      tool.destroy();

      // The sidebar can emit one last config-change during teardown
      expect(() => tool!.setConfig({ maxColors: 4 })).not.toThrow();
    });

    it('works with no drawer panel supplied', async () => {
      tool = mount({ drawer: false });
      tool.setConfig({ maxColors: 5 });
      await flush();

      expect(rightPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });
});
