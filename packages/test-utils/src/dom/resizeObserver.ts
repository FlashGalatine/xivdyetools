/**
 * ResizeObserver mock for testing
 *
 * Provides a mock implementation of ResizeObserver
 * for testing responsive components.
 *
 * @example
 * ```typescript
 * // Setup mock before tests
 * setupResizeObserverMock();
 *
 * // Now ResizeObserver won't throw
 * const observer = new ResizeObserver(entries => {
 *   console.log('Resized:', entries);
 * });
 * observer.observe(element);
 *
 * // Trigger resize callbacks manually
 * MockResizeObserver.triggerAll([{ width: 100, height: 200 }]);
 * ```
 */

type ResizeObserverCallback = (
  entries: ResizeObserverEntry[],
  observer: ResizeObserver
) => void;

interface MockResizeObserverEntry {
  target: Element;
  contentRect: DOMRectReadOnly;
  borderBoxSize: ReadonlyArray<ResizeObserverSize>;
  contentBoxSize: ReadonlyArray<ResizeObserverSize>;
  devicePixelContentBoxSize: ReadonlyArray<ResizeObserverSize>;
}

/**
 * Mock ResizeObserver class
 */
export class MockResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback;
  private observedElements: Set<Element> = new Set();

  /** All active MockResizeObserver instances */
  static instances: MockResizeObserver[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observedElements.add(target);
  }

  unobserve(target: Element): void {
    this.observedElements.delete(target);
  }

  disconnect(): void {
    this.observedElements.clear();
    const index = MockResizeObserver.instances.indexOf(this);
    if (index > -1) {
      MockResizeObserver.instances.splice(index, 1);
    }
  }

  /**
   * Get observed elements
   */
  getObservedElements(): Element[] {
    return Array.from(this.observedElements);
  }

  /**
   * Manually trigger the callback with mock entries
   */
  trigger(entries: Array<{ width?: number; height?: number; target?: Element }>): void {
    const mockEntries: MockResizeObserverEntry[] = entries.map((entry) => {
      const target = entry.target ?? this.observedElements.values().next().value ?? document.body;
      const width = entry.width ?? 100;
      const height = entry.height ?? 100;

      const size = { inlineSize: width, blockSize: height };

      return {
        target,
        contentRect: new DOMRect(0, 0, width, height),
        borderBoxSize: [size],
        contentBoxSize: [size],
        devicePixelContentBoxSize: [size],
      };
    });

    this.callback(mockEntries as ResizeObserverEntry[], this);
  }

  /**
   * Trigger all active observers
   */
  static triggerAll(entries: Array<{ width?: number; height?: number }>): void {
    for (const instance of MockResizeObserver.instances) {
      instance.trigger(entries);
    }
  }

  /**
   * Clear all instances
   */
  static clearInstances(): void {
    MockResizeObserver.instances = [];
  }
}

/**
 * Sets up ResizeObserver mock on globalThis
 */
export function setupResizeObserverMock(): void {
  MockResizeObserver.clearInstances();
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

/**
 * Creates a standalone mock ResizeObserver (without global setup)
 */
export function createMockResizeObserver(
  callback: ResizeObserverCallback
): MockResizeObserver {
  return new MockResizeObserver(callback);
}
