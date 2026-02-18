/**
 * Tests for matchMedia mock utilities
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  setupMatchMediaMock,
  setMediaQueryMatch,
  resetMediaQueries,
  MediaQueryPresets,
} from '../../src/dom/matchMedia.js';

describe('setupMatchMediaMock', () => {
  beforeEach(() => {
    resetMediaQueries();
    setupMatchMediaMock();
  });

  it('sets up matchMedia on globalThis', () => {
    expect(globalThis.matchMedia).toBeDefined();
  });

  it('returns MediaQueryList-like object', () => {
    const mql = globalThis.matchMedia('(min-width: 768px)');

    expect(mql).toHaveProperty('matches');
    expect(mql).toHaveProperty('media');
    expect(mql).toHaveProperty('addListener');
    expect(mql).toHaveProperty('removeListener');
    expect(mql).toHaveProperty('addEventListener');
    expect(mql).toHaveProperty('removeEventListener');
    expect(mql).toHaveProperty('dispatchEvent');
  });

  it('returns correct media property', () => {
    const mql = globalThis.matchMedia('(prefers-color-scheme: dark)');

    expect(mql.media).toBe('(prefers-color-scheme: dark)');
  });

  it('defaults to false for unset queries', () => {
    const mql = globalThis.matchMedia('(min-width: 1024px)');

    expect(mql.matches).toBe(false);
  });
});

describe('setMediaQueryMatch', () => {
  beforeEach(() => {
    resetMediaQueries();
    setupMatchMediaMock();
  });

  it('sets a query to match', () => {
    setMediaQueryMatch('(min-width: 768px)', true);

    const mql = globalThis.matchMedia('(min-width: 768px)');
    expect(mql.matches).toBe(true);
  });

  it('sets a query to not match', () => {
    setMediaQueryMatch('(min-width: 768px)', true);
    setMediaQueryMatch('(min-width: 768px)', false);

    const mql = globalThis.matchMedia('(min-width: 768px)');
    expect(mql.matches).toBe(false);
  });

  it('notifies listeners when match changes', () => {
    const query = '(prefers-color-scheme: dark)';
    const listener = vi.fn();

    const mql = globalThis.matchMedia(query);
    mql.addEventListener('change', listener);

    setMediaQueryMatch(query, true);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        matches: true,
        media: query,
      })
    );
  });

  it('does not notify listeners when match does not change', () => {
    const query = '(min-width: 768px)';
    const listener = vi.fn();

    setMediaQueryMatch(query, false);
    const mql = globalThis.matchMedia(query);
    mql.addEventListener('change', listener);

    setMediaQueryMatch(query, false);

    expect(listener).not.toHaveBeenCalled();
  });

  it('works with addListener (deprecated API)', () => {
    const query = '(min-width: 768px)';
    const listener = vi.fn();

    const mql = globalThis.matchMedia(query);
    mql.addListener(listener);

    setMediaQueryMatch(query, true);

    expect(listener).toHaveBeenCalled();
  });

  it('can remove listener with removeListener', () => {
    const query = '(min-width: 768px)';
    const listener = vi.fn();

    const mql = globalThis.matchMedia(query);
    mql.addListener(listener);
    mql.removeListener(listener);

    setMediaQueryMatch(query, true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('can remove listener with removeEventListener', () => {
    const query = '(min-width: 768px)';
    const listener = vi.fn();

    const mql = globalThis.matchMedia(query);
    mql.addEventListener('change', listener);
    mql.removeEventListener('change', listener);

    setMediaQueryMatch(query, true);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('resetMediaQueries', () => {
  beforeEach(() => {
    resetMediaQueries();
    setupMatchMediaMock();
  });

  it('clears all query states', () => {
    setMediaQueryMatch('(min-width: 768px)', true);
    setMediaQueryMatch('(prefers-color-scheme: dark)', true);

    resetMediaQueries();
    setupMatchMediaMock();

    expect(globalThis.matchMedia('(min-width: 768px)').matches).toBe(false);
    expect(globalThis.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
  });

  it('clears all listeners', () => {
    const query = '(min-width: 768px)';
    const listener = vi.fn();

    const mql = globalThis.matchMedia(query);
    mql.addEventListener('change', listener);

    resetMediaQueries();
    setupMatchMediaMock();

    setMediaQueryMatch(query, true);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('MediaQueryPresets', () => {
  beforeEach(() => {
    resetMediaQueries();
    setupMatchMediaMock();
  });

  it('has DARK_MODE preset', () => {
    expect(MediaQueryPresets.DARK_MODE).toBe('(prefers-color-scheme: dark)');
  });

  it('has LIGHT_MODE preset', () => {
    expect(MediaQueryPresets.LIGHT_MODE).toBe('(prefers-color-scheme: light)');
  });

  it('has REDUCED_MOTION preset', () => {
    expect(MediaQueryPresets.REDUCED_MOTION).toBe('(prefers-reduced-motion: reduce)');
  });

  it('has MOBILE preset', () => {
    expect(MediaQueryPresets.MOBILE).toBe('(max-width: 768px)');
  });

  it('has TABLET preset', () => {
    expect(MediaQueryPresets.TABLET).toBe('(min-width: 769px) and (max-width: 1024px)');
  });

  it('has DESKTOP preset', () => {
    expect(MediaQueryPresets.DESKTOP).toBe('(min-width: 1025px)');
  });

  it('presets work with setMediaQueryMatch', () => {
    setMediaQueryMatch(MediaQueryPresets.DARK_MODE, true);

    const mql = globalThis.matchMedia(MediaQueryPresets.DARK_MODE);
    expect(mql.matches).toBe(true);
  });
});

describe('dispatchEvent', () => {
  beforeEach(() => {
    resetMediaQueries();
    setupMatchMediaMock();
  });

  it('returns true', () => {
    const mql = globalThis.matchMedia('(min-width: 768px)');

    expect(mql.dispatchEvent(new Event('change'))).toBe(true);
  });
});

describe('onchange', () => {
  beforeEach(() => {
    resetMediaQueries();
    setupMatchMediaMock();
  });

  it('is initially null', () => {
    const mql = globalThis.matchMedia('(min-width: 768px)');

    expect(mql.onchange).toBeNull();
  });
});
