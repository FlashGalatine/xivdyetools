/**
 * Canvas mock utilities for testing
 *
 * Provides mock implementations of Canvas 2D context
 * for testing chart and graphics code.
 *
 * @example
 * ```typescript
 * // Setup canvas mocks before tests
 * setupCanvasMocks();
 *
 * // Now canvas operations won't throw
 * const canvas = document.createElement('canvas');
 * const ctx = canvas.getContext('2d');
 * ctx.fillRect(0, 0, 100, 100); // Works in jsdom
 * ```
 */

/**
 * Mock Canvas 2D rendering context
 */
export interface MockCanvasContext {
  fillRect: () => void;
  clearRect: () => void;
  strokeRect: () => void;
  fillText: () => void;
  strokeText: () => void;
  measureText: (text: string) => { width: number };
  beginPath: () => void;
  closePath: () => void;
  moveTo: () => void;
  lineTo: () => void;
  arc: () => void;
  arcTo: () => void;
  bezierCurveTo: () => void;
  quadraticCurveTo: () => void;
  rect: () => void;
  fill: () => void;
  stroke: () => void;
  clip: () => void;
  save: () => void;
  restore: () => void;
  scale: () => void;
  rotate: () => void;
  translate: () => void;
  transform: () => void;
  setTransform: () => void;
  resetTransform: () => void;
  drawImage: () => void;
  createImageData: () => { data: Uint8ClampedArray; width: number; height: number };
  getImageData: () => { data: Uint8ClampedArray; width: number; height: number };
  putImageData: () => void;
  createLinearGradient: () => { addColorStop: () => void };
  createRadialGradient: () => { addColorStop: () => void };
  createPattern: () => null;
  isPointInPath: () => boolean;
  isPointInStroke: () => boolean;
  getLineDash: () => number[];
  setLineDash: () => void;

  // Properties
  canvas: { width: number; height: number };
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  miterLimit: number;
  lineDashOffset: number;
  font: string;
  textAlign: string;
  textBaseline: string;
  globalAlpha: number;
  globalCompositeOperation: string;
  shadowBlur: number;
  shadowColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  imageSmoothingEnabled: boolean;
}

/**
 * Creates a mock Canvas 2D context
 *
 * @returns A mock context object
 */
export function createMockCanvasContext(): MockCanvasContext {
  return {
    fillRect: () => {},
    clearRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    rect: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    save: () => {},
    restore: () => {},
    scale: () => {},
    rotate: () => {},
    translate: () => {},
    transform: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    drawImage: () => {},
    createImageData: () => ({
      data: new Uint8ClampedArray(400),
      width: 10,
      height: 10,
    }),
    getImageData: () => ({
      data: new Uint8ClampedArray(400),
      width: 10,
      height: 10,
    }),
    putImageData: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    isPointInPath: () => false,
    isPointInStroke: () => false,
    getLineDash: () => [],
    setLineDash: () => {},

    // Default property values
    canvas: { width: 300, height: 150 },
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashOffset: 0,
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
  };
}

/**
 * Sets up canvas mocks on HTMLCanvasElement prototype
 *
 * Call this in your test setup (beforeAll/beforeEach) to enable
 * canvas operations in jsdom environment.
 */
export function setupCanvasMocks(): void {
  // Check if we're in a browser-like environment
  if (typeof HTMLCanvasElement === 'undefined') {
    return;
  }

  const mockContext = createMockCanvasContext();

  // Mock getContext - cast to any to satisfy TypeScript's strict overload signatures
  // This is intentional for testing purposes where we don't need the full context API
  HTMLCanvasElement.prototype.getContext = function (
    contextId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    if (contextId === '2d') {
      return {
        ...mockContext,
        canvas: { width: this.width || 300, height: this.height || 150 },
      };
    }
    return null;
  };

  // Mock toDataURL
  HTMLCanvasElement.prototype.toDataURL = function (): string {
    return 'data:image/png;base64,mock';
  };

  // Mock toBlob
  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback
  ): void {
    callback(new Blob(['mock'], { type: 'image/png' }));
  };
}
