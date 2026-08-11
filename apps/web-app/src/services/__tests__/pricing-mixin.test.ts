/**
 * Tests for the shared Market Board listener wiring.
 *
 * Three events, each with the same two-arm shape: a caller-supplied override,
 * or the default "fetch if prices are on". The default arm is the one that
 * matters — a tool that forgets to gate on `showPrices` would hammer
 * Universalis on every server change for users who never enabled pricing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupMarketBoardListeners } from '../pricing-mixin';

const EVENTS = ['showPricesChanged', 'server-changed', 'refresh-requested'] as const;

describe('setupMarketBoardListeners', () => {
  let container: HTMLElement;
  let fetchPrices: () => void;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'market-content';
    document.body.appendChild(container);
    fetchPrices = vi.fn<() => void>();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  const fire = (name: string) => container.dispatchEvent(new CustomEvent(name));

  describe('the default arm — fetch only when prices are enabled', () => {
    it.each(EVENTS)('fetches on %s when prices are on', (event) => {
      setupMarketBoardListeners(container, () => true, fetchPrices);

      fire(event);

      expect(fetchPrices).toHaveBeenCalledTimes(1);
    });

    it.each(EVENTS)('stays quiet on %s when prices are off', (event) => {
      setupMarketBoardListeners(container, () => false, fetchPrices);

      fire(event);

      expect(fetchPrices).not.toHaveBeenCalled();
    });

    it('re-reads the predicate on every event rather than capturing it once', () => {
      let enabled = false;
      setupMarketBoardListeners(container, () => enabled, fetchPrices);

      fire('server-changed');
      expect(fetchPrices).not.toHaveBeenCalled();

      enabled = true;
      fire('server-changed');
      expect(fetchPrices).toHaveBeenCalledTimes(1);
    });

    it('tolerates a fetch that returns a promise', async () => {
      const asyncFetch = vi.fn().mockResolvedValue(undefined);
      setupMarketBoardListeners(container, () => true, asyncFetch);

      fire('refresh-requested');

      await Promise.resolve();
      expect(asyncFetch).toHaveBeenCalled();
    });
  });

  describe('the override arm', () => {
    it('calls onPricesToggled instead of fetching', () => {
      const onPricesToggled = vi.fn();
      setupMarketBoardListeners(container, () => true, fetchPrices, { onPricesToggled });

      fire('showPricesChanged');

      expect(onPricesToggled).toHaveBeenCalledTimes(1);
      expect(fetchPrices).not.toHaveBeenCalled();
    });

    it('calls onServerChanged instead of fetching', () => {
      const onServerChanged = vi.fn();
      setupMarketBoardListeners(container, () => true, fetchPrices, { onServerChanged });

      fire('server-changed');

      expect(onServerChanged).toHaveBeenCalledTimes(1);
      expect(fetchPrices).not.toHaveBeenCalled();
    });

    it('calls onRefreshRequested instead of fetching', () => {
      const onRefreshRequested = vi.fn();
      setupMarketBoardListeners(container, () => true, fetchPrices, { onRefreshRequested });

      fire('refresh-requested');

      expect(onRefreshRequested).toHaveBeenCalledTimes(1);
      expect(fetchPrices).not.toHaveBeenCalled();
    });

    it('runs an override even when prices are disabled — the override owns the decision', () => {
      const onServerChanged = vi.fn();
      setupMarketBoardListeners(container, () => false, fetchPrices, { onServerChanged });

      fire('server-changed');

      expect(onServerChanged).toHaveBeenCalledTimes(1);
    });

    it('overrides one event without disturbing the others', () => {
      const onServerChanged = vi.fn();
      setupMarketBoardListeners(container, () => true, fetchPrices, { onServerChanged });

      fire('server-changed');
      fire('refresh-requested');

      expect(onServerChanged).toHaveBeenCalledTimes(1);
      expect(fetchPrices).toHaveBeenCalledTimes(1);
    });
  });

  it('listens on the container it was given, not the document', () => {
    const other = document.createElement('div');
    document.body.appendChild(other);
    setupMarketBoardListeners(container, () => true, fetchPrices);

    other.dispatchEvent(new CustomEvent('server-changed'));

    expect(fetchPrices).not.toHaveBeenCalled();
    other.remove();
  });

  it('ignores unrelated events', () => {
    setupMarketBoardListeners(container, () => true, fetchPrices);

    fire('some-other-event');

    expect(fetchPrices).not.toHaveBeenCalled();
  });
});
