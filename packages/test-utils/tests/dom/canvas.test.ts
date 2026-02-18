/**
 * Tests for Canvas mock utilities
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockCanvasContext,
  setupCanvasMocks,
} from '../../src/dom/canvas.js';

// Store original values for cleanup
const originalHTMLCanvasElement = globalThis.HTMLCanvasElement;

describe('createMockCanvasContext', () => {
  it('creates a mock context with all drawing methods', () => {
    const ctx = createMockCanvasContext();

    expect(ctx.fillRect).toBeDefined();
    expect(ctx.clearRect).toBeDefined();
    expect(ctx.strokeRect).toBeDefined();
    expect(ctx.fillText).toBeDefined();
    expect(ctx.strokeText).toBeDefined();
    expect(ctx.beginPath).toBeDefined();
    expect(ctx.closePath).toBeDefined();
    expect(ctx.moveTo).toBeDefined();
    expect(ctx.lineTo).toBeDefined();
    expect(ctx.arc).toBeDefined();
    expect(ctx.arcTo).toBeDefined();
    expect(ctx.bezierCurveTo).toBeDefined();
    expect(ctx.quadraticCurveTo).toBeDefined();
    expect(ctx.rect).toBeDefined();
    expect(ctx.fill).toBeDefined();
    expect(ctx.stroke).toBeDefined();
    expect(ctx.clip).toBeDefined();
  });

  it('creates a mock context with transform methods', () => {
    const ctx = createMockCanvasContext();

    expect(ctx.save).toBeDefined();
    expect(ctx.restore).toBeDefined();
    expect(ctx.scale).toBeDefined();
    expect(ctx.rotate).toBeDefined();
    expect(ctx.translate).toBeDefined();
    expect(ctx.transform).toBeDefined();
    expect(ctx.setTransform).toBeDefined();
    expect(ctx.resetTransform).toBeDefined();
  });

  it('creates a mock context with image methods', () => {
    const ctx = createMockCanvasContext();

    expect(ctx.drawImage).toBeDefined();
    expect(ctx.createImageData).toBeDefined();
    expect(ctx.getImageData).toBeDefined();
    expect(ctx.putImageData).toBeDefined();
  });

  it('creates a mock context with gradient/pattern methods', () => {
    const ctx = createMockCanvasContext();

    expect(ctx.createLinearGradient).toBeDefined();
    expect(ctx.createRadialGradient).toBeDefined();
    expect(ctx.createPattern).toBeDefined();
  });

  it('creates a mock context with path methods', () => {
    const ctx = createMockCanvasContext();

    expect(ctx.isPointInPath).toBeDefined();
    expect(ctx.isPointInStroke).toBeDefined();
    expect(ctx.getLineDash).toBeDefined();
    expect(ctx.setLineDash).toBeDefined();
  });

  describe('measureText', () => {
    it('returns width based on text length', () => {
      const ctx = createMockCanvasContext();

      const result = ctx.measureText('Hello');

      expect(result.width).toBe(5 * 8); // 5 chars * 8px
    });

    it('returns different widths for different texts', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.measureText('Hi').width).toBe(16);
      expect(ctx.measureText('Hello World').width).toBe(88);
    });
  });

  describe('createImageData and getImageData', () => {
    it('returns mock ImageData', () => {
      const ctx = createMockCanvasContext();

      const imageData = ctx.createImageData();

      expect(imageData.data).toBeInstanceOf(Uint8ClampedArray);
      expect(imageData.width).toBe(10);
      expect(imageData.height).toBe(10);
    });

    it('getImageData returns mock data', () => {
      const ctx = createMockCanvasContext();

      const imageData = ctx.getImageData();

      expect(imageData.data).toBeInstanceOf(Uint8ClampedArray);
      expect(imageData.data.length).toBe(400); // 10 * 10 * 4
    });
  });

  describe('gradient methods', () => {
    it('createLinearGradient returns gradient with addColorStop', () => {
      const ctx = createMockCanvasContext();

      const gradient = ctx.createLinearGradient();

      expect(gradient.addColorStop).toBeDefined();
      expect(() => gradient.addColorStop()).not.toThrow();
    });

    it('createRadialGradient returns gradient with addColorStop', () => {
      const ctx = createMockCanvasContext();

      const gradient = ctx.createRadialGradient();

      expect(gradient.addColorStop).toBeDefined();
    });

    it('createPattern returns null', () => {
      const ctx = createMockCanvasContext();

      const pattern = ctx.createPattern();

      expect(pattern).toBeNull();
    });
  });

  describe('point checking methods', () => {
    it('isPointInPath returns false', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.isPointInPath()).toBe(false);
    });

    it('isPointInStroke returns false', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.isPointInStroke()).toBe(false);
    });
  });

  describe('line dash methods', () => {
    it('getLineDash returns empty array', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.getLineDash()).toEqual([]);
    });
  });

  describe('default properties', () => {
    it('has default canvas dimensions', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.canvas.width).toBe(300);
      expect(ctx.canvas.height).toBe(150);
    });

    it('has default fill and stroke styles', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.fillStyle).toBe('#000000');
      expect(ctx.strokeStyle).toBe('#000000');
    });

    it('has default line properties', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.lineWidth).toBe(1);
      expect(ctx.lineCap).toBe('butt');
      expect(ctx.lineJoin).toBe('miter');
      expect(ctx.miterLimit).toBe(10);
      expect(ctx.lineDashOffset).toBe(0);
    });

    it('has default text properties', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.font).toBe('10px sans-serif');
      expect(ctx.textAlign).toBe('start');
      expect(ctx.textBaseline).toBe('alphabetic');
    });

    it('has default compositing properties', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.globalAlpha).toBe(1);
      expect(ctx.globalCompositeOperation).toBe('source-over');
    });

    it('has default shadow properties', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.shadowBlur).toBe(0);
      expect(ctx.shadowColor).toBe('rgba(0, 0, 0, 0)');
      expect(ctx.shadowOffsetX).toBe(0);
      expect(ctx.shadowOffsetY).toBe(0);
    });

    it('has image smoothing enabled by default', () => {
      const ctx = createMockCanvasContext();

      expect(ctx.imageSmoothingEnabled).toBe(true);
    });
  });

  describe('all methods are callable', () => {
    it('does not throw when calling drawing methods', () => {
      const ctx = createMockCanvasContext();

      expect(() => {
        ctx.fillRect();
        ctx.clearRect();
        ctx.strokeRect();
        ctx.fillText();
        ctx.strokeText();
        ctx.beginPath();
        ctx.closePath();
        ctx.moveTo();
        ctx.lineTo();
        ctx.arc();
        ctx.arcTo();
        ctx.bezierCurveTo();
        ctx.quadraticCurveTo();
        ctx.rect();
        ctx.fill();
        ctx.stroke();
        ctx.clip();
      }).not.toThrow();
    });

    it('does not throw when calling transform methods', () => {
      const ctx = createMockCanvasContext();

      expect(() => {
        ctx.save();
        ctx.restore();
        ctx.scale();
        ctx.rotate();
        ctx.translate();
        ctx.transform();
        ctx.setTransform();
        ctx.resetTransform();
      }).not.toThrow();
    });

    it('does not throw when calling image methods', () => {
      const ctx = createMockCanvasContext();

      expect(() => {
        ctx.drawImage();
        ctx.putImageData();
      }).not.toThrow();
    });
  });
});

describe('setupCanvasMocks', () => {
  // Note: These tests require a DOM environment (jsdom)
  // They will be skipped if HTMLCanvasElement is not available

  it('does not throw in any environment', () => {
    expect(() => setupCanvasMocks()).not.toThrow();
  });

  it('returns early when HTMLCanvasElement is undefined', () => {
    // Ensure HTMLCanvasElement is undefined
    const original = globalThis.HTMLCanvasElement;
    // @ts-expect-error - intentionally setting to undefined for testing
    globalThis.HTMLCanvasElement = undefined;

    // Should not throw, just return early
    expect(() => setupCanvasMocks()).not.toThrow();

    // Restore
    globalThis.HTMLCanvasElement = original;
  });
});

describe('setupCanvasMocks with DOM environment', () => {
  // Mock HTMLCanvasElement for testing
  let mockPrototype: Record<string, unknown>;

  beforeEach(() => {
    // Create a mock HTMLCanvasElement class
    mockPrototype = {};

    class MockHTMLCanvasElement {
      width = 300;
      height = 150;

      getContext(_contextId: string): unknown {
        return null;
      }

      toDataURL(): string {
        return '';
      }

      toBlob(_callback: BlobCallback): void {
        // Default implementation
      }
    }

    // Set prototype reference for mutation
    mockPrototype.getContext = MockHTMLCanvasElement.prototype.getContext;
    mockPrototype.toDataURL = MockHTMLCanvasElement.prototype.toDataURL;
    mockPrototype.toBlob = MockHTMLCanvasElement.prototype.toBlob;

    // Assign methods to prototype so setupCanvasMocks can override them
    Object.defineProperty(MockHTMLCanvasElement.prototype, 'getContext', {
      writable: true,
      configurable: true,
      value: mockPrototype.getContext,
    });
    Object.defineProperty(MockHTMLCanvasElement.prototype, 'toDataURL', {
      writable: true,
      configurable: true,
      value: mockPrototype.toDataURL,
    });
    Object.defineProperty(MockHTMLCanvasElement.prototype, 'toBlob', {
      writable: true,
      configurable: true,
      value: mockPrototype.toBlob,
    });

    // @ts-expect-error - setting up mock for testing
    globalThis.HTMLCanvasElement = MockHTMLCanvasElement;
  });

  afterEach(() => {
    // Restore original HTMLCanvasElement
    if (originalHTMLCanvasElement) {
      globalThis.HTMLCanvasElement = originalHTMLCanvasElement;
    } else {
      // @ts-expect-error - cleanup for Node environment
      delete globalThis.HTMLCanvasElement;
    }
  });

  it('mocks getContext to return 2d context', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    const ctx = canvas.getContext('2d');

    expect(ctx).not.toBeNull();
    expect(ctx.fillRect).toBeDefined();
    expect(ctx.strokeRect).toBeDefined();
    expect(ctx.clearRect).toBeDefined();
  });

  it('getContext returns null for non-2d contexts', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();

    expect(canvas.getContext('webgl')).toBeNull();
    expect(canvas.getContext('webgl2')).toBeNull();
    expect(canvas.getContext('bitmaprenderer')).toBeNull();
  });

  it('mocked context uses canvas dimensions', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    canvas.width = 500;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');

    expect(ctx.canvas.width).toBe(500);
    expect(ctx.canvas.height).toBe(400);
  });

  it('mocked context uses default dimensions for unset canvas', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    // width and height are 0 or undefined when not set, mock uses defaults
    canvas.width = 0;
    canvas.height = 0;

    const ctx = canvas.getContext('2d');

    expect(ctx.canvas.width).toBe(300);
    expect(ctx.canvas.height).toBe(150);
  });

  it('mocks toDataURL to return mock data URL', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    const dataUrl = canvas.toDataURL();

    expect(dataUrl).toBe('data:image/png;base64,mock');
  });

  it('mocks toBlob to call callback with mock blob', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    const callback = vi.fn();

    canvas.toBlob(callback);

    expect(callback).toHaveBeenCalledOnce();
    const blob = callback.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('mocked context has all expected methods callable', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    const ctx = canvas.getContext('2d');

    // Test all methods don't throw
    expect(() => {
      ctx.fillRect(0, 0, 100, 100);
      ctx.strokeRect(0, 0, 100, 100);
      ctx.clearRect(0, 0, 100, 100);
      ctx.fillText('test', 0, 0);
      ctx.strokeText('test', 0, 0);
      ctx.beginPath();
      ctx.closePath();
      ctx.moveTo(0, 0);
      ctx.lineTo(100, 100);
      ctx.arc(50, 50, 25, 0, Math.PI * 2);
      ctx.arcTo(0, 0, 100, 100, 50);
      ctx.bezierCurveTo(0, 0, 50, 50, 100, 100);
      ctx.quadraticCurveTo(50, 50, 100, 100);
      ctx.rect(0, 0, 100, 100);
      ctx.fill();
      ctx.stroke();
      ctx.clip();
      ctx.save();
      ctx.restore();
      ctx.scale(2, 2);
      ctx.rotate(Math.PI);
      ctx.translate(10, 10);
      ctx.transform(1, 0, 0, 1, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.resetTransform();
      ctx.drawImage(canvas, 0, 0);
      ctx.putImageData({} as ImageData, 0, 0);
      ctx.setLineDash([5, 5]);
    }).not.toThrow();
  });

  it('mocked context measureText works', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    const ctx = canvas.getContext('2d');

    const measurement = ctx.measureText('Hello');

    expect(measurement.width).toBe(5 * 8);
  });

  it('mocked context gradient methods work', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    const ctx = canvas.getContext('2d');

    const linearGradient = ctx.createLinearGradient(0, 0, 100, 100);
    expect(linearGradient.addColorStop).toBeDefined();
    expect(() => linearGradient.addColorStop(0, 'red')).not.toThrow();

    const radialGradient = ctx.createRadialGradient(50, 50, 0, 50, 50, 50);
    expect(radialGradient.addColorStop).toBeDefined();

    const pattern = ctx.createPattern(canvas, 'repeat');
    expect(pattern).toBeNull();
  });

  it('mocked context image data methods work', () => {
    setupCanvasMocks();

    const canvas = new globalThis.HTMLCanvasElement();
    const ctx = canvas.getContext('2d');

    const createdData = ctx.createImageData(10, 10);
    expect(createdData.data).toBeInstanceOf(Uint8ClampedArray);
    expect(createdData.width).toBe(10);
    expect(createdData.height).toBe(10);

    const retrievedData = ctx.getImageData(0, 0, 10, 10);
    expect(retrievedData.data).toBeInstanceOf(Uint8ClampedArray);
    expect(retrievedData.data.length).toBe(400);
  });
});
