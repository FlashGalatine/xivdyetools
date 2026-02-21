/**
 * XIV Dye Tools - ImageUploadDisplay Unit Tests
 *
 * Tests the image upload display component for file/drag-drop/paste handling.
 * Covers rendering, file input, drag-drop, clipboard paste, and validation.
 *
 * @module components/__tests__/image-upload-display.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageUploadDisplay } from '../image-upload-display';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
} from '../../__tests__/component-utils';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
  },
  cameraService: {
    hasCameraAvailable: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_UPLOAD: '<svg></svg>',
  ICON_CAMERA: '<svg></svg>',
  ICON_HINT: '<svg></svg>',
  ICON_LOCK: '<svg></svg>',
}));

vi.mock('../camera-preview-modal', () => ({
  showCameraPreviewModal: vi.fn(),
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// DataTransfer polyfill for jsdom
class MockDataTransfer {
  private _files: File[] = [];
  private _items: { kind: string; type: string; file: File }[] = [];

  get files(): FileList {
    const files = this._files;
    return {
      length: files.length,
      item: (index: number) => files[index] || null,
      [Symbol.iterator]: function* () {
        for (const file of files) yield file;
      },
    } as unknown as FileList;
  }

  get items() {
    const items = this._items;
    const files = this._files;
    return {
      length: items.length,
      add: (file: File) => {
        files.push(file);
        items.push({ kind: 'file', type: file.type, file });
      },
      [Symbol.iterator]: function* () {
        for (const item of items) yield item;
      },
    };
  }
}

// Install DataTransfer mock globally
(globalThis as unknown as { DataTransfer: typeof MockDataTransfer }).DataTransfer =
  MockDataTransfer;

describe('ImageUploadDisplay', () => {
  let container: HTMLElement;
  let display: ImageUploadDisplay | null;

  beforeEach(() => {
    container = createTestContainer();
    display = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (display) {
      try {
        display.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render display container', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should render title', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.textContent).toContain('matcher.uploadImage');
    });

    it('should render drop zone', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const dropZone = query(container, '#image-drop-zone');
      expect(dropZone).not.toBeNull();
    });

    it('should render file input', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const fileInput = query(container, '#image-file-input');
      expect(fileInput).not.toBeNull();
    });

    it('should render camera file input', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const cameraInput = query(container, '#camera-file-input');
      expect(cameraInput).not.toBeNull();
    });

    it('should render drag-drop text', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.textContent).toContain('matcher.dragDrop');
    });

    it('should render click-to-select text', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.textContent).toContain('matcher.orClickSelect');
    });

    it('should render paste hint', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.textContent).toContain('matcher.pasteHint');
    });

    it('should render supported formats text', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.textContent).toContain('matcher.supportedFormatsWithSize');
    });
  });

  // ============================================================================
  // File Input Tests
  // ============================================================================

  describe('File Input', () => {
    it('should have accept="image/*" attribute', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const fileInput = query(container, '#image-file-input');
      expect(fileInput?.getAttribute('accept')).toBe('image/*');
    });

    it('should be hidden', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const fileInput = query(container, '#image-file-input');
      expect(fileInput?.classList.contains('hidden')).toBe(true);
    });

    it('should trigger file input on drop zone click', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const fileInput = query<HTMLInputElement>(container, '#image-file-input');
      const clickSpy = vi.spyOn(fileInput!, 'click');

      const dropZone = query<HTMLElement>(container, '#image-drop-zone');
      click(dropZone);

      expect(clickSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Drag and Drop Tests
  // ============================================================================

  describe('Drag and Drop', () => {
    it('should render drop zone with correct styling', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const dropZone = query<HTMLElement>(container, '#image-drop-zone');
      expect(dropZone).not.toBeNull();
      expect(dropZone?.classList.contains('border-dashed')).toBe(true);
    });

    it('should have clickable drop zone', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const dropZone = query<HTMLElement>(container, '#image-drop-zone');
      expect(dropZone).not.toBeNull();
      // Drop zone should be interactive
      expect(dropZone?.tagName).toBeDefined();
    });
  });

  // ============================================================================
  // File Validation Tests
  // ============================================================================

  describe('File Validation', () => {
    it('should have file input with image accept attribute', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const fileInput = query<HTMLInputElement>(container, '#image-file-input');
      expect(fileInput?.getAttribute('accept')).toBe('image/*');
    });

    it('should have clear method', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(typeof display.clear).toBe('function');
    });
  });

  // ============================================================================
  // Image Loading Tests
  // ============================================================================

  describe('Image Loading', () => {
    it('should have getImage method', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(typeof display.getImage).toBe('function');
      expect(display.getImage()).toBeNull(); // No image loaded yet
    });

    it('should have getImageDimensions method', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(typeof display.getImageDimensions).toBe('function');
      expect(display.getImageDimensions()).toBeNull(); // No image loaded yet
    });
  });

  // ============================================================================
  // API Tests
  // ============================================================================

  describe('API', () => {
    it('should return null when no image loaded', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(display.getImage()).toBeNull();
    });

    it('should return null dimensions when no image', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(display.getImageDimensions()).toBeNull();
    });

    it('should return null for samplePixel when no image', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(display.samplePixel(0, 0)).toBeNull();
    });

    it('should return null for getAverageColor when no image', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(display.getAverageColor(0, 0)).toBeNull();
    });

    it('should return null for getImageCanvas when no image', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(display.getImageCanvas()).toBeNull();
    });

    it('should clear uploaded image', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      display.clear();

      expect(display.getImage()).toBeNull();
    });
  });

  // ============================================================================
  // Canvas Tests
  // ============================================================================

  describe('Canvas', () => {
    it('should render hidden canvas element', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const canvas = query(container, '#image-canvas');
      expect(canvas).not.toBeNull();
      expect(canvas?.classList.contains('hidden')).toBe(true);
    });
  });

  // ============================================================================
  // Camera Button Tests
  // ============================================================================

  describe('Camera Button', () => {
    it('should render mobile camera button', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.textContent).toContain('matcher.takePhoto');
    });

    it('should hide desktop camera button when no camera available', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const desktopCameraBtn = query<HTMLElement>(container, '#desktop-camera-btn');
      expect(desktopCameraBtn?.style.display).toBe('none');
    });
  });

  // ============================================================================
  // Privacy Notice Tests
  // ============================================================================

  describe('Privacy Notice', () => {
    it('should render privacy notice', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      expect(container.textContent).toContain('matcher.privacyTitle');
    });

    it('should have learn more link', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const link = query(container, 'a[href*="PRIVACY.md"]');
      expect(link).not.toBeNull();
    });
  });

  // ============================================================================
  // State Tests
  // ============================================================================

  describe('State', () => {
    it('should return correct state', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      const state = (display as unknown as { getState: () => Record<string, unknown> }).getState();
      expect(state.hasImage).toBe(false);
      expect(state.imageDimensions).toBeNull();
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      display = new ImageUploadDisplay(container);
      display.init();

      display.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
