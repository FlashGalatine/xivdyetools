/**
 * XIV Dye Tools - ImageZoomController Unit Tests
 *
 * The extractor's image surface: zoom, pan, and the 3C sampling contract
 * (plain click samples; drag past the threshold drives the loupe and commits
 * the sample on release).
 *
 * This file exists because the component was on the coverage EXCLUDE list on
 * the belief that jsdom could not run it — "it does not accept a fake 2D
 * context". That was measured and is false: the controller only ever calls
 * `getContext('2d')`, so a stub satisfies it completely, and `getCanvas()`
 * returns the canvas normally. Excluding it hid 422 statements that the
 * extractor's own suite was already executing 38% of by accident, which
 * shrank the denominator and read as coverage the suite never had.
 *
 * The one genuine jsdom limit is layout: every `getBoundingClientRect()` is
 * 0×0 and `clientWidth`/`offsetWidth` are 0, so the fit/zoom maths falls
 * through to its `window.innerWidth - 32` fallback. Tests that care about
 * fitting stub the rect rather than pretending the default is meaningful.
 *
 * @module components/__tests__/image-zoom-controller.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageZoomController } from '../image-zoom-controller';

// The controller imports LanguageService from `@services/language-service`,
// but BaseComponent imports it from the `@services/index` BARREL — and
// loading that barrel pulls in the whole service graph, which cycles back and
// leaves BaseComponent undefined at class-extends time ("Class extends value
// undefined"). Both paths are stubbed so neither drags the barrel in.
// Both factories are inlined rather than sharing a const: vi.mock is hoisted
// above every top-level binding, so a shared object is still in its temporal
// dead zone when the factory runs.
vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string) => key,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));
vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string) => key,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

/** 2×2: red, green, blue, white. */
const PIXELS = new Uint8ClampedArray([
  255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
]);

describe('ImageZoomController', () => {
  let container: HTMLElement;
  let controller: ImageZoomController;
  let image: HTMLImageElement;
  let ctx: Record<string, ReturnType<typeof vi.fn>>;
  let originalGetContext: HTMLCanvasElement['getContext'];

  /**
   * Return the pixel at (x, y) of the 2×2 fixture for any 1×1 read, and the
   * whole buffer for larger ones — enough for both readPixelHex (1×1) and
   * sampleColorAtArea (NxN averaging).
   */
  const imageDataFor = (x: number, y: number, w: number, h: number) => {
    if (w === 1 && h === 1) {
      const i = (y * 2 + x) * 4;
      return { data: PIXELS.slice(i, i + 4), width: 1, height: 1 };
    }
    return { data: PIXELS, width: w, height: h };
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    originalGetContext = HTMLCanvasElement.prototype.getContext;
    ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn((x: number, y: number, w: number, h: number) => imageDataFor(x, y, w, h)),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx
    ) as unknown as HTMLCanvasElement['getContext'];

    image = document.createElement('img');
    Object.defineProperty(image, 'width', { value: 2, configurable: true });
    Object.defineProperty(image, 'height', { value: 2, configurable: true });
    Object.defineProperty(image, 'naturalWidth', { value: 2, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 2, configurable: true });
  });

  afterEach(() => {
    controller?.destroy();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    container.remove();
    vi.restoreAllMocks();
  });

  const mount = (options = {}): ImageZoomController => {
    controller = new ImageZoomController(container, options);
    controller.init();
    return controller;
  };

  const canvas = (): HTMLCanvasElement => container.querySelector('canvas')!;

  /** jsdom gives every element a 0×0 rect; give the canvas a real one. */
  const sizeCanvas = (rect: Partial<DOMRect> = {}): void => {
    vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 2,
      height: 2,
      right: 2,
      bottom: 2,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...rect,
    } as DOMRect);
  };

  const mouse = (type: string, clientX: number, clientY: number, init: MouseEventInit = {}) =>
    canvas().dispatchEvent(
      new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true, ...init })
    );

  describe('before an image arrives', () => {
    it('renders nothing but marks the container as its own', () => {
      mount();

      expect(container.classList.contains('space-y-4')).toBe(true);
      expect(container.querySelector('canvas')).toBeNull();
    });

    it('has no canvas to hand out', () => {
      mount();

      expect(controller.getCanvas()).toBeNull();
      expect(controller.getCanvasContainer()).toBeNull();
    });

    it('ignores fit requests rather than throwing', () => {
      mount();

      expect(() => {
        controller.autoFit();
        controller.fitToScreen();
        controller.fitToWidth();
      }).not.toThrow();
    });
  });

  describe('setImage', () => {
    it('builds a canvas at the natural image size and draws into it', () => {
      mount();

      controller.setImage(image);

      expect(canvas().width).toBe(2);
      expect(canvas().height).toBe(2);
      expect(ctx.drawImage).toHaveBeenCalledWith(image, 0, 0);
    });

    it('exposes the canvas and its scroll container', () => {
      mount();

      controller.setImage(image);

      expect(controller.getCanvas()).toBe(canvas());
      expect(controller.getCanvasContainer()).toBe(canvas().parentElement);
    });

    it('renders the zoom strip at 100%', () => {
      mount();

      controller.setImage(image);

      expect(container.querySelector('.zoom-level')!.textContent).toBe('100.00%');
      expect(container.querySelectorAll('button.zoom-btn').length).toBeGreaterThanOrEqual(5);
    });

    it('replaces the previous canvas instead of stacking a second one', () => {
      mount();
      controller.setImage(image);

      controller.setImage(image);

      expect(container.querySelectorAll('canvas')).toHaveLength(1);
    });

    /**
     * BUG-077: the canvas count above cannot see this. Every listener the
     * controller owns is registered inside setImage(), and BaseComponent.on()
     * keys its map by an incrementing counter — so a second setImage() added a
     * second document keydown/keyup pair instead of replacing the first. The
     * element-scoped listeners died with the cleared DOM; the document ones did
     * not, so one key press ran the handler twice and zoom stepped 20 % after
     * two images, 30 % after three.
     */
    it('does not stack document listeners across images', () => {
      const added = vi.spyOn(document, 'addEventListener');
      const removed = vi.spyOn(document, 'removeEventListener');
      mount();

      controller.setImage(image);
      const afterFirst = added.mock.calls.length - removed.mock.calls.length;
      controller.setImage(image);
      const afterSecond = added.mock.calls.length - removed.mock.calls.length;

      expect(afterSecond).toBe(afterFirst);

      added.mockRestore();
      removed.mockRestore();
    });
  });

  describe('zoom controls', () => {
    const btn = (title: string): HTMLButtonElement =>
      container.querySelector(`button[title="${title}"]`)!;
    const level = (): string => container.querySelector('.zoom-level')!.textContent!;

    beforeEach(() => {
      mount();
      controller.setImage(image);
    });

    it('steps in and out by ten points', () => {
      btn('matcher.zoomIn').click();
      expect(level()).toBe('110.00%');

      btn('matcher.zoomOut').click();
      btn('matcher.zoomOut').click();
      expect(level()).toBe('90.00%');
    });

    it('scales the canvas from its top-left rather than its centre', () => {
      btn('matcher.zoomIn').click();

      expect(canvas().style.transform).toBe('scale(1.1)');
      expect(canvas().style.transformOrigin).toBe('top left');
    });

    it('switches the cursor to move once the image overflows', () => {
      btn('matcher.zoomIn').click();
      expect(canvas().style.cursor).toBe('move');

      btn('matcher.zoomOut').click();
      expect(canvas().style.cursor).toBe('crosshair');
    });

    it('clamps at 400% and disables the in button there', () => {
      for (let i = 0; i < 40; i++) btn('matcher.zoomIn').click();

      expect(level()).toBe('400.00%');
      expect(btn('matcher.zoomIn').disabled).toBe(true);
      expect(btn('matcher.zoomIn').classList.contains('opacity-50')).toBe(true);
    });

    it('clamps at 10% and disables the out button there', () => {
      for (let i = 0; i < 20; i++) btn('matcher.zoomOut').click();

      expect(level()).toBe('10.00%');
      expect(btn('matcher.zoomOut').disabled).toBe(true);
      expect(btn('matcher.zoomOut').classList.contains('cursor-not-allowed')).toBe(true);
    });

    it('returns to 100% on reset', () => {
      btn('matcher.zoomIn').click();
      btn('matcher.zoomIn').click();

      btn('matcher.zoomReset').click();

      expect(level()).toBe('100.00%');
    });

    it('zooms on shift+wheel only', () => {
      const wheel = (deltaY: number, shiftKey: boolean) =>
        controller
          .getCanvasContainer()!
          .dispatchEvent(new WheelEvent('wheel', { deltaY, shiftKey, bubbles: true }));

      wheel(-100, false);
      expect(level()).toBe('100.00%');

      wheel(-100, true);
      expect(level()).toBe('110.00%');

      wheel(100, true);
      expect(level()).toBe('100.00%');
    });

    it.each([
      ['+', '110.00%'],
      ['=', '110.00%'],
      ['-', '90.00%'],
    ])('responds to the %s key', (key, expected) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

      expect(level()).toBe(expected);
    });

    it('returns to 100% on the 0 key', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

      document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', bubbles: true }));

      expect(level()).toBe('100.00%');
    });

    it('hints that Ctrl enables panning, and takes the hint back', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
      expect(canvas().style.cursor).toBe('grab');

      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
      expect(canvas().style.cursor).toBe('pointer');
    });
  });

  describe('sampling', () => {
    beforeEach(() => {
      mount();
      controller.setImage(image);
      sizeCanvas();
    });

    it('emits the pixel under a plain click', () => {
      const onSampled = vi.fn();
      container.addEventListener('image-sampled', onSampled);

      mouse('mousedown', 0, 0);
      mouse('mouseup', 0, 0);

      expect(onSampled).toHaveBeenCalledTimes(1);
      const detail = (onSampled.mock.calls[0][0] as CustomEvent).detail;
      expect(detail).toMatchObject({ hex: '#FF0000', isPixelSample: true });
    });

    it('also invokes the onColorSampled option', () => {
      controller.destroy();
      const onColorSampled = vi.fn();
      mount({ onColorSampled });
      controller.setImage(image);
      sizeCanvas();

      mouse('mousedown', 0, 0);
      mouse('mouseup', 0, 0);

      expect(onColorSampled).toHaveBeenCalledWith('#FF0000', 0, 0);
    });

    it('redraws the image before reading, so an overlay is never sampled', () => {
      ctx.drawImage.mockClear();

      mouse('mousedown', 0, 0);
      mouse('mouseup', 0, 0);

      // Without this the crosshair drawn by the PREVIOUS sample is still on
      // the canvas and gets read back as the colour
      expect(ctx.drawImage).toHaveBeenCalledWith(image, 0, 0);
    });

    it('marks a single-pixel sample with a crosshair', () => {
      mouse('mousedown', 0, 0);
      mouse('mouseup', 0, 0);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
      expect(ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('marks a multi-pixel sample with a rectangle and averages the area', () => {
      const onSampled = vi.fn();
      container.addEventListener('image-sampled', onSampled);
      controller.setSampleAreaSize(2);

      mouse('mousedown', 0, 0);
      mouse('mouseup', 0, 0);

      expect(ctx.strokeRect).toHaveBeenCalled();
      // Mean of red, green, blue and white across the 2×2 fixture is 127.5 in
      // every channel, rounded to 128 = 0x80. Asserting the emitted hex is
      // the point — a computed expectation would only restate the arithmetic
      const detail = (onSampled.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.hex).toBe('#808080');
      expect(detail.hex).not.toBe('#FF0000'); // not the single top-left pixel
    });
  });

  describe('sample area size', () => {
    /**
     * Needs a canvas big enough for the clamp to be observable: on the 2×2
     * fixture every size above 1 is capped by the canvas itself, so 4 and 16
     * would be indistinguishable and the upper bound would go untested.
     */
    beforeEach(() => {
      const big = document.createElement('img');
      Object.defineProperty(big, 'width', { value: 64, configurable: true });
      Object.defineProperty(big, 'height', { value: 64, configurable: true });
      Object.defineProperty(big, 'naturalWidth', { value: 64, configurable: true });
      Object.defineProperty(big, 'naturalHeight', { value: 64, configurable: true });
      ctx.getImageData = vi.fn((_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(255),
        width: w,
        height: h,
      }));
      mount();
      controller.setImage(big);
      vi.spyOn(canvas(), 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 64,
        height: 64,
        right: 64,
        bottom: 64,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    });

    it.each([
      [0, 1],
      [1, 1],
      [4, 4],
      [16, 16],
      [99, 16],
    ])('clamps a requested size of %i to %i', (given, effective) => {
      controller.setSampleAreaSize(given);

      mouse('mousedown', 32, 32);
      mouse('mouseup', 32, 32);

      const [, , width, height] = ctx.getImageData.mock.calls.at(-1)!;
      expect([width, height]).toEqual([effective, effective]);
    });
  });

  describe('the loupe drag', () => {
    beforeEach(() => {
      mount();
      controller.setImage(image);
      sizeCanvas({ width: 100, height: 100, right: 100, bottom: 100 });
    });

    it('stays quiet inside the drag threshold', () => {
      const onMove = vi.fn();
      container.addEventListener('loupe-move', onMove);

      mouse('mousedown', 0, 0);
      mouse('mousemove', 2, 2);

      // A 2px wobble is a click, not a drag — firing here would flash the
      // loupe on every tap
      expect(onMove).not.toHaveBeenCalled();
    });

    it('reads the pixel under the pointer once past it', () => {
      const onMove = vi.fn();
      container.addEventListener('loupe-move', onMove);

      mouse('mousedown', 0, 0);
      mouse('mousemove', 60, 60);

      expect(onMove).toHaveBeenCalled();
      const detail = (onMove.mock.calls[0][0] as CustomEvent).detail;
      expect(detail.hex).toMatch(/^#[0-9A-F]{6}$/);
      expect(detail).toMatchObject({ clientX: 60, clientY: 60 });
    });

    it('honours a raised drag threshold', () => {
      const onMove = vi.fn();
      container.addEventListener('loupe-move', onMove);
      controller.setDragThreshold(15);

      mouse('mousedown', 0, 0);
      mouse('mousemove', 10, 0);
      expect(onMove).not.toHaveBeenCalled();

      mouse('mousemove', 20, 0);
      expect(onMove).toHaveBeenCalled();
    });

    it.each([
      [1, 3],
      [3, 3],
      [7, 7],
      [15, 15],
      [50, 15],
    ])('clamps a drag threshold of %i to %i', (given, effective) => {
      const onMove = vi.fn();
      container.addEventListener('loupe-move', onMove);
      controller.setDragThreshold(given);

      mouse('mousedown', 0, 0);
      mouse('mousemove', effective, 0);
      expect(onMove).not.toHaveBeenCalled();

      mouse('mousemove', effective + 1, 0);
      expect(onMove).toHaveBeenCalled();
    });

    it('ends the loupe and commits a sample on release', () => {
      const order: string[] = [];
      container.addEventListener('loupe-end', () => order.push('end'));
      container.addEventListener('image-sampled', () => order.push('sample'));

      mouse('mousedown', 0, 0);
      mouse('mousemove', 60, 60);
      mouse('mouseup', 60, 60);

      // loupe-end must precede the sample, or the loupe is still covering the
      // pixel the user is trying to commit
      expect(order).toEqual(['end', 'sample']);
    });

    it('ends the loupe when the pointer leaves the canvas', () => {
      const onEnd = vi.fn();
      container.addEventListener('loupe-end', onEnd);

      mouse('mousedown', 0, 0);
      mouse('mousemove', 60, 60);
      mouse('mouseleave', 60, 60);

      expect(onEnd).toHaveBeenCalledTimes(1);
    });

    it('does not sample when the pointer leaves mid-drag', () => {
      const onSampled = vi.fn();
      container.addEventListener('image-sampled', onSampled);

      mouse('mousedown', 0, 0);
      mouse('mousemove', 60, 60);
      mouse('mouseleave', 60, 60);

      // Leaving is an abandonment; only a release commits
      expect(onSampled).not.toHaveBeenCalled();
    });
  });

  describe('ctrl-drag panning', () => {
    beforeEach(() => {
      mount();
      controller.setImage(image);
      sizeCanvas({ width: 100, height: 100 });
    });

    it('offsets the canvas and shows a grabbing cursor', () => {
      mouse('mousedown', 50, 50, { ctrlKey: true });
      expect(canvas().style.cursor).toBe('grabbing');

      mouse('mousemove', 70, 90, { ctrlKey: true });

      expect(canvas().style.marginLeft).toBe('20px');
      expect(canvas().style.marginTop).toBe('40px');
    });

    it('accumulates across successive drags rather than resetting', () => {
      mouse('mousedown', 0, 0, { ctrlKey: true });
      mouse('mousemove', 10, 10, { ctrlKey: true });
      mouse('mouseup', 10, 10, { ctrlKey: true });

      mouse('mousedown', 0, 0, { ctrlKey: true });
      mouse('mousemove', 10, 10, { ctrlKey: true });

      expect(canvas().style.marginLeft).toBe('20px');
    });

    it('commits the offset when the pointer leaves mid-pan', () => {
      mouse('mousedown', 0, 0, { ctrlKey: true });
      mouse('mousemove', 30, 0, { ctrlKey: true });
      mouse('mouseleave', 30, 0, { ctrlKey: true });

      // Panning has ended, so a plain move must no longer drag the canvas
      mouse('mousemove', 90, 0);
      expect(canvas().style.marginLeft).toBe('30px');
    });

    it('does not sample the pixel the pan finished on', () => {
      const onSampled = vi.fn();
      container.addEventListener('image-sampled', onSampled);

      mouse('mousedown', 0, 0, { ctrlKey: true });
      mouse('mousemove', 30, 30, { ctrlKey: true });
      mouse('mouseup', 30, 30, { ctrlKey: true });

      expect(onSampled).not.toHaveBeenCalled();
    });

    it('is cleared by a reset', () => {
      mouse('mousedown', 0, 0, { ctrlKey: true });
      mouse('mousemove', 40, 40, { ctrlKey: true });
      mouse('mouseup', 40, 40, { ctrlKey: true });

      container.querySelector<HTMLButtonElement>('button[title="matcher.zoomReset"]')!.click();

      expect(canvas().style.marginLeft).toBe('0px');
      expect(canvas().style.marginTop).toBe('0px');
    });
  });

  describe('fitting', () => {
    /** All three fit paths defer a frame, so tests must let it run. */
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

    const level = (): number =>
      parseFloat(container.querySelector('.zoom-level')!.textContent!.replace('%', ''));

    beforeEach(() => {
      mount();
      controller.setImage(image);
    });

    /** Give the canvas container's PARENT a size — that is what it measures. */
    const sizeContainer = (width: number, height: number) => {
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    };

    it('fits the whole 2px image into a 200px box at the smaller ratio', async () => {
      sizeContainer(200, 100);

      controller.fitToScreen();
      await nextFrame();
      await nextFrame();

      // min(200/2, 100/2) × 100 = 5000%, clamped to the 400% ceiling
      expect(level()).toBe(400);
    });

    it('fits to width using only the horizontal ratio', async () => {
      sizeContainer(60, 1000);

      controller.fitToWidth();
      await nextFrame();
      await nextFrame();

      // 60/2 × 100 = 3000%, clamped to 400
      expect(level()).toBe(400);
    });

    it('never zooms below the 10% floor when the box is tiny', async () => {
      Object.defineProperty(image, 'naturalWidth', { value: 4000, configurable: true });
      Object.defineProperty(image, 'naturalHeight', { value: 4000, configurable: true });
      sizeContainer(100, 100);

      controller.fitToScreen();
      await nextFrame();
      await nextFrame();

      expect(level()).toBeGreaterThanOrEqual(10);
    });

    it('centres a fitted image rather than pinning it to the corner', async () => {
      sizeContainer(200, 200);

      controller.fitToScreen();
      await nextFrame();
      await nextFrame();

      expect(canvas().style.marginLeft).not.toBe('');
    });

    it('autoFit picks fit-to-width for an image wider than the box', async () => {
      Object.defineProperty(image, 'naturalWidth', { value: 4000, configurable: true });
      sizeContainer(100, 100);

      controller.autoFit();
      for (let i = 0; i < 3; i++) await nextFrame();

      // 100/4000 × 100 = 2.5%, floored at 10 — fit-to-SCREEN on a 4000×2
      // image would have used the height ratio and produced 400 instead
      expect(level()).toBe(10);
    });

    it('autoFit picks fit-to-screen for an image that already fits', async () => {
      sizeContainer(200, 200);

      controller.autoFit();
      for (let i = 0; i < 3; i++) await nextFrame();

      expect(level()).toBe(400);
    });
  });

  describe('teardown', () => {
    it('stops responding to document keys after destroy', () => {
      mount();
      controller.setImage(image);
      // Hold the ELEMENT, not its text. destroy() empties the container, so
      // re-querying afterwards finds nothing and any assertion on the result
      // passes without testing anything; a live listener would still mutate
      // this detached node.
      const display = container.querySelector('.zoom-level')!;
      expect(display.textContent).toBe('100.00%');

      controller.destroy();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true }));

      // The keydown listener lives on `document`, so it outlives the
      // container unless destroy() removes it — a leak that stacks one extra
      // handler per image the user loads
      expect(display.textContent).toBe('100.00%');
    });

    it('survives a second destroy', () => {
      mount();
      controller.setImage(image);

      controller.destroy();

      expect(() => controller.destroy()).not.toThrow();
    });

    it('tolerates being destroyed before any image arrives', () => {
      mount();

      expect(() => controller.destroy()).not.toThrow();
    });
  });
});
