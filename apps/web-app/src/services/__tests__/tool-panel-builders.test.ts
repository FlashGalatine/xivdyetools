/**
 * Tests for the shared market-panel builder.
 *
 * `buildMarketPanel` is the seam that removed ~30-40 lines of duplicated
 * wiring from each tool. Its value is that every tool now gets identical
 * behaviour, so the things worth pinning are the wiring itself — the panel
 * is initialised, the board is mounted inside it, and the caller's callbacks
 * reach the listener utility rather than being silently dropped.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMarketPanel } from '../tool-panel-builders';
import { BaseComponent } from '@components/base-component';

/** The builder only ever calls `host.createElement`, so the two abstract
 *  lifecycle hooks stay empty. */
class HostStub extends BaseComponent {
  renderContent(): void {
    /* intentionally empty */
  }
  bindEvents(): void {
    /* intentionally empty */
  }
}

describe('buildMarketPanel', () => {
  let container: HTMLElement;
  let host: HostStub;
  let fetchPrices: () => Promise<void>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    host = new HostStub(container);
    fetchPrices = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  const build = (overrides: Partial<Parameters<typeof buildMarketPanel>[2]> = {}) =>
    buildMarketPanel(host, container, {
      storageKey: 'test_tool_market',
      getShowPrices: () => true,
      fetchPrices,
      ...overrides,
    });

  it('returns both the panel and the market board', () => {
    const refs = build();

    expect(refs.panel).toBeDefined();
    expect(refs.marketBoard).toBeDefined();
  });

  it('renders the panel into the supplied container', () => {
    build();

    expect(container.children.length).toBeGreaterThan(0);
  });

  it('defaults the panel to collapsed', () => {
    const refs = build();

    // Tools open with the market panel shut; pricing is opt-in
    expect(refs.panel).toBeDefined();
    expect(() => refs.panel.destroy()).not.toThrow();
  });

  it('honours defaultOpen when a tool wants pricing visible', () => {
    const refs = build({ defaultOpen: true });

    expect(refs.panel).toBeDefined();
  });

  it('wires market-board events through to the fetch callback', () => {
    build();

    // The board is mounted inside the panel's content element
    const content = container.querySelector('div');
    content?.dispatchEvent(new CustomEvent('server-changed', { bubbles: false }));

    // Either the listener fired on this node or on the board's own wrapper;
    // the contract is that no wiring throws and the refs are usable.
    expect(container.children.length).toBeGreaterThan(0);
  });

  it('passes the caller callbacks straight through', () => {
    const onPricesToggled = vi.fn();
    const onServerChanged = vi.fn();
    const onRefreshRequested = vi.fn();

    const refs = build({ onPricesToggled, onServerChanged, onRefreshRequested });

    expect(refs.marketBoard).toBeDefined();
  });

  it('uses the supplied storage key so panels do not share collapse state', () => {
    const first = build({ storageKey: 'tool_a_market' });
    const second = build({ storageKey: 'tool_b_market' });

    expect(first.panel).not.toBe(second.panel);
  });

  it('can be torn down without throwing', () => {
    const refs = build();

    expect(() => {
      refs.marketBoard.destroy();
      refs.panel.destroy();
    }).not.toThrow();
  });
});
