/**
 * Tests for ResizeObserver mock utilities
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockResizeObserver,
  setupResizeObserverMock,
  createMockResizeObserver,
} from '../../src/dom/resizeObserver.js';

// Store original DOMRect for cleanup
const originalDOMRect = globalThis.DOMRect;

// Mock DOMRect for Node.js test environment
class MockDOMRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.top = y;
    this.right = x + width;
    this.bottom = y + height;
    this.left = x;
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      top: this.top,
      right: this.right,
      bottom: this.bottom,
      left: this.left,
    };
  }

  static fromRect(rect?: DOMRectInit): MockDOMRect {
    return new MockDOMRect(rect?.x, rect?.y, rect?.width, rect?.height);
  }
}

// Setup DOMRect mock before all tests
globalThis.DOMRect = MockDOMRect as unknown as typeof DOMRect;

describe('MockResizeObserver', () => {
  beforeEach(() => {
    MockResizeObserver.clearInstances();
  });

  afterEach(() => {
    MockResizeObserver.clearInstances();
  });

  it('can be instantiated with a callback', () => {
    const callback = vi.fn();
    const observer = new MockResizeObserver(callback);

    expect(observer).toBeInstanceOf(MockResizeObserver);
  });

  it('registers itself in static instances', () => {
    const callback = vi.fn();
    new MockResizeObserver(callback);

    expect(MockResizeObserver.instances).toHaveLength(1);
  });

  describe('observe', () => {
    it('adds element to observed elements', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;

      observer.observe(mockElement);

      expect(observer.getObservedElements()).toContain(mockElement);
    });

    it('can observe multiple elements', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement1 = { tagName: 'DIV' } as unknown as Element;
      const mockElement2 = { tagName: 'SPAN' } as unknown as Element;

      observer.observe(mockElement1);
      observer.observe(mockElement2);

      expect(observer.getObservedElements()).toHaveLength(2);
    });
  });

  describe('unobserve', () => {
    it('removes element from observed elements', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;

      observer.observe(mockElement);
      observer.unobserve(mockElement);

      expect(observer.getObservedElements()).not.toContain(mockElement);
    });
  });

  describe('disconnect', () => {
    it('clears all observed elements', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;

      observer.observe(mockElement);
      observer.disconnect();

      expect(observer.getObservedElements()).toHaveLength(0);
    });

    it('removes from static instances', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);

      observer.disconnect();

      expect(MockResizeObserver.instances).not.toContain(observer);
    });

    it('handles disconnect being called twice without error', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;
      observer.observe(mockElement);

      // First disconnect should work normally
      observer.disconnect();
      expect(MockResizeObserver.instances).not.toContain(observer);
      expect(observer.getObservedElements()).toHaveLength(0);

      // Second disconnect should not throw (index will be -1)
      expect(() => observer.disconnect()).not.toThrow();
    });
  });

  describe('trigger', () => {
    // Note: DOMRect is now mocked at the top of this file, enabling these tests
    it('calls callback with mock entries', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;
      observer.observe(mockElement);

      observer.trigger([{ width: 100, height: 200, target: mockElement }]);

      expect(callback).toHaveBeenCalledOnce();
      const entries = callback.mock.calls[0][0];
      expect(entries).toHaveLength(1);
      expect(entries[0].contentRect.width).toBe(100);
      expect(entries[0].contentRect.height).toBe(200);
      expect(entries[0].target).toBe(mockElement);
    });

    it('uses first observed element if target not specified', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;
      observer.observe(mockElement);

      observer.trigger([{ width: 100, height: 100 }]);

      const entries = callback.mock.calls[0][0];
      expect(entries[0].target).toBe(mockElement);
    });

    it('uses default dimensions if not specified', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;
      observer.observe(mockElement);

      observer.trigger([{}]);

      const entries = callback.mock.calls[0][0];
      expect(entries[0].contentRect.width).toBe(100);
      expect(entries[0].contentRect.height).toBe(100);
    });

    it('includes borderBoxSize, contentBoxSize, and devicePixelContentBoxSize', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;
      observer.observe(mockElement);

      observer.trigger([{ width: 50, height: 75 }]);

      const entries = callback.mock.calls[0][0];
      expect(entries[0].borderBoxSize[0]).toEqual({ inlineSize: 50, blockSize: 75 });
      expect(entries[0].contentBoxSize[0]).toEqual({ inlineSize: 50, blockSize: 75 });
      expect(entries[0].devicePixelContentBoxSize[0]).toEqual({ inlineSize: 50, blockSize: 75 });
    });

    it('passes observer as second argument', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement = { tagName: 'DIV' } as unknown as Element;
      observer.observe(mockElement);

      observer.trigger([{ width: 100 }]);

      expect(callback.mock.calls[0][1]).toBe(observer);
    });

    it('uses document.body as fallback when no element is observed', () => {
      // Mock document.body for Node.js environment
      const originalBody = globalThis.document?.body;
      const mockBody = { tagName: 'BODY' } as unknown as Element;
      if (!globalThis.document) {
        // @ts-expect-error - creating minimal document mock
        globalThis.document = { body: mockBody };
      } else {
        Object.defineProperty(globalThis.document, 'body', {
          value: mockBody,
          configurable: true,
        });
      }

      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      // Note: no elements observed

      observer.trigger([{ width: 200, height: 300 }]);

      const entries = callback.mock.calls[0][0];
      expect(entries[0].target).toBe(mockBody);

      // Restore
      if (originalBody !== undefined) {
        Object.defineProperty(globalThis.document, 'body', {
          value: originalBody,
          configurable: true,
        });
      }
    });

    it('can trigger multiple entries at once', () => {
      const callback = vi.fn();
      const observer = new MockResizeObserver(callback);
      const mockElement1 = { tagName: 'DIV' } as unknown as Element;
      const mockElement2 = { tagName: 'SPAN' } as unknown as Element;
      observer.observe(mockElement1);
      observer.observe(mockElement2);

      observer.trigger([
        { width: 100, height: 100, target: mockElement1 },
        { width: 200, height: 200, target: mockElement2 },
      ]);

      expect(callback).toHaveBeenCalledOnce();
      const entries = callback.mock.calls[0][0];
      expect(entries).toHaveLength(2);
      expect(entries[0].target).toBe(mockElement1);
      expect(entries[1].target).toBe(mockElement2);
    });
  });

  describe('triggerAll', () => {
    it('triggers all active observers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const observer1 = new MockResizeObserver(callback1);
      const observer2 = new MockResizeObserver(callback2);
      const mockElement1 = { tagName: 'DIV' } as unknown as Element;
      const mockElement2 = { tagName: 'SPAN' } as unknown as Element;
      observer1.observe(mockElement1);
      observer2.observe(mockElement2);

      MockResizeObserver.triggerAll([{ width: 150, height: 250 }]);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('triggers with same dimensions for all observers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const observer1 = new MockResizeObserver(callback1);
      const observer2 = new MockResizeObserver(callback2);
      const mockElement1 = { tagName: 'DIV' } as unknown as Element;
      const mockElement2 = { tagName: 'SPAN' } as unknown as Element;
      observer1.observe(mockElement1);
      observer2.observe(mockElement2);

      MockResizeObserver.triggerAll([{ width: 300, height: 400 }]);

      const entries1 = callback1.mock.calls[0][0];
      const entries2 = callback2.mock.calls[0][0];
      expect(entries1[0].contentRect.width).toBe(300);
      expect(entries1[0].contentRect.height).toBe(400);
      expect(entries2[0].contentRect.width).toBe(300);
      expect(entries2[0].contentRect.height).toBe(400);
    });

    it('does nothing when no observers exist', () => {
      // Just ensure no errors are thrown
      expect(() => MockResizeObserver.triggerAll([{ width: 100 }])).not.toThrow();
    });
  });

  describe('clearInstances', () => {
    it('clears all instances', () => {
      new MockResizeObserver(vi.fn());
      new MockResizeObserver(vi.fn());

      MockResizeObserver.clearInstances();

      expect(MockResizeObserver.instances).toHaveLength(0);
    });
  });
});

describe('setupResizeObserverMock', () => {
  afterEach(() => {
    MockResizeObserver.clearInstances();
  });

  it('sets globalThis.ResizeObserver', () => {
    setupResizeObserverMock();

    expect(globalThis.ResizeObserver).toBeDefined();
  });

  it('clears existing instances', () => {
    new MockResizeObserver(vi.fn());

    setupResizeObserverMock();

    expect(MockResizeObserver.instances).toHaveLength(0);
  });

  it('allows creating ResizeObserver instances', () => {
    setupResizeObserverMock();

    const observer = new globalThis.ResizeObserver(vi.fn());
    const mockElement = { tagName: 'DIV' } as unknown as Element;

    expect(() => observer.observe(mockElement)).not.toThrow();
  });
});

describe('createMockResizeObserver', () => {
  afterEach(() => {
    MockResizeObserver.clearInstances();
  });

  it('returns a MockResizeObserver instance', () => {
    const observer = createMockResizeObserver(vi.fn());

    expect(observer).toBeInstanceOf(MockResizeObserver);
  });

  it('registers in instances', () => {
    createMockResizeObserver(vi.fn());

    expect(MockResizeObserver.instances).toHaveLength(1);
  });
});
