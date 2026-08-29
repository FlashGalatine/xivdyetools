/**
 * TelemetryService — opt-in, identifier-free usage telemetry.
 * Spec: docs/superpowers/specs/2026-08-29-web-analytics-design.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetConfig, mockSubscribe, mockGetCurrentToolId } = vi.hoisted(() => ({
  mockGetConfig: vi.fn(),
  mockSubscribe: vi.fn(),
  mockGetCurrentToolId: vi.fn().mockReturnValue('harmony'),
}));

vi.mock('@services/config-controller', () => ({
  ConfigController: {
    getInstance: () => ({ getConfig: mockGetConfig, subscribe: mockSubscribe }),
  },
}));
vi.mock('@services/router-service', () => ({
  RouterService: { getCurrentToolId: mockGetCurrentToolId },
}));
vi.mock('@services/language-service', () => ({
  LanguageService: { getCurrentLocale: () => 'de' },
}));
vi.mock('@services/theme-service', () => ({
  ThemeService: { getCurrentTheme: () => 'standard-light' },
}));
vi.mock('@services/api-worker-origin', () => ({
  getApiWorkerBase: () => 'https://data.test',
}));
vi.mock('@shared/constants', () => ({ APP_VERSION: '5.0.3', APP_ENV: 'production' }));
vi.mock('@shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { TelemetryService } from '../telemetry-service';

type ConfigListener = (config: { analyticsEnabled: boolean; performanceMode: boolean }) => void;

let sendBeacon: ReturnType<typeof vi.fn>;
let configListener: ConfigListener | null;

function lastBatch(): {
  events: Array<{ n: string; p: Record<string, unknown>; d?: number }>;
} & Record<string, unknown> {
  const call = sendBeacon.mock.calls.at(-1);
  if (!call) throw new Error('sendBeacon not called');
  return JSON.parse(call[1] as string);
}

function enable(enabled = true): void {
  mockGetConfig.mockReturnValue({ analyticsEnabled: enabled, performanceMode: false });
  TelemetryService.initialize();
}

beforeEach(() => {
  vi.useFakeTimers();
  sendBeacon = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, 'sendBeacon', {
    value: sendBeacon,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'globalPrivacyControl', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  configListener = null;
  mockSubscribe.mockImplementation((_key: string, listener: ConfigListener) => {
    configListener = listener;
    return () => {
      configListener = null;
    };
  });
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true });
});

afterEach(() => {
  TelemetryService.reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
  // `vi.restoreAllMocks()` only restores spies created via `vi.spyOn` — it
  // does not clear call history on the plain `vi.fn()` mocks hoisted above
  // (mockSubscribe et al.), so `vi.clearAllMocks()` is needed too to keep
  // per-test call-count assertions (e.g. "initialize is idempotent") isolated.
  vi.clearAllMocks();
});

describe('gating', () => {
  it('is disabled by default and sends nothing', () => {
    enable(false);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'initial' });
    TelemetryService.flush();
    expect(TelemetryService.isEnabled()).toBe(false);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('sends once the toggle is on', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'initial' });
    TelemetryService.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0][0]).toBe('https://data.test/v1/telemetry');
  });

  it('honours Global Privacy Control even when the toggle is on', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
    enable(true);
    expect(TelemetryService.isEnabled()).toBe(false);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'initial' });
    TelemetryService.flush();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('starts tracking when the toggle turns on and drops the queue when it turns off', () => {
    enable(false);
    configListener!({ analyticsEnabled: true, performanceMode: false });
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    configListener!({ analyticsEnabled: false, performanceMode: false });
    TelemetryService.flush();
    expect(sendBeacon).not.toHaveBeenCalled();

    configListener!({ analyticsEnabled: true, performanceMode: false });
    TelemetryService.track('tool_view', { tool: 'mixer', entry: 'nav' });
    TelemetryService.flush();
    expect(lastBatch().events).toEqual([{ n: 'tool_view', p: { tool: 'mixer', entry: 'nav' } }]);
  });

  it('initialize is idempotent', () => {
    enable(true);
    TelemetryService.initialize();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('envelope', () => {
  it('carries version, env, locale, theme and a viewport bucket — and nothing else', () => {
    enable(true);
    TelemetryService.track('theme_change', { to: 'standard-light' });
    TelemetryService.flush();
    const batch = lastBatch();
    expect(Object.keys(batch).sort()).toEqual([
      'env',
      'events',
      'locale',
      'theme',
      'v',
      'ver',
      'vp',
    ]);
    expect(batch).toMatchObject({
      v: 1,
      ver: '5.0.3',
      env: 'production',
      locale: 'de',
      theme: 'standard-light',
      vp: 'd',
    });
  });

  it.each([
    [500, 'm'],
    [767, 'm'],
    [768, 't'],
    [1023, 't'],
    [1024, 'd'],
  ])('buckets innerWidth %i as %s', (width, bucket) => {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      configurable: true,
      writable: true,
    });
    enable(true);
    TelemetryService.track('theme_change', { to: 'standard-dark' });
    TelemetryService.flush();
    expect(lastBatch().vp).toBe(bucket);
  });
});

describe('batching and transport', () => {
  it('flushes automatically when MAX_BATCH events are queued', () => {
    enable(true);
    for (let i = 0; i < TelemetryService.MAX_BATCH - 1; i++) {
      TelemetryService.track('dye_pick', { tool: 'harmony', stainID: 1 + i, via: 'grid' });
    }
    expect(sendBeacon).not.toHaveBeenCalled();
    TelemetryService.track('dye_pick', { tool: 'harmony', stainID: 99, via: 'grid' });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(lastBatch().events).toHaveLength(TelemetryService.MAX_BATCH);
  });

  it('flushes FLUSH_DELAY_MS after the first queued event', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    vi.advanceTimersByTime(TelemetryService.FLUSH_DELAY_MS - 1);
    expect(sendBeacon).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('flushes when the tab is hidden and on pagehide', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sendBeacon).toHaveBeenCalledTimes(1);

    TelemetryService.track('tool_view', { tool: 'mixer', entry: 'nav' });
    window.dispatchEvent(new Event('pagehide'));
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });

  it('sends a string body (text/plain — no preflight) and clears the queue', () => {
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    TelemetryService.flush();
    expect(typeof sendBeacon.mock.calls[0][1]).toBe('string');
    TelemetryService.flush();
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('falls back to fetch keepalive when sendBeacon refuses', () => {
    sendBeacon.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    enable(true);
    TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
    TelemetryService.flush();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://data.test/v1/telemetry',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  });

  it('never throws out of track/flush when the transport throws', () => {
    sendBeacon.mockImplementation(() => {
      throw new Error('boom');
    });
    enable(true);
    expect(() => {
      TelemetryService.track('tool_view', { tool: 'harmony', entry: 'nav' });
      TelemetryService.flush();
    }).not.toThrow();
  });
});

describe('helpers', () => {
  it('trackDyePick adds the current tool', () => {
    mockGetCurrentToolId.mockReturnValue('comparison');
    enable(true);
    TelemetryService.trackDyePick(102, 'drawer');
    TelemetryService.flush();
    expect(lastBatch().events).toEqual([
      { n: 'dye_pick', p: { tool: 'comparison', stainID: 102, via: 'drawer' } },
    ]);
  });

  it.each([
    ['Anamnesis', 'anamnesis'],
    ['anamnesis character file', 'anamnesis'],
    ['Ktisis', 'ktisis'],
    ['Brio', 'brio'],
    ['Something Else', 'other'],
    [null, 'none'],
  ])('normalizeProducer(%j) → %s', (input, expected) => {
    expect(TelemetryService.normalizeProducer(input)).toBe(expected);
  });
});

describe('dwell', () => {
  function setVisibility(state: 'visible' | 'hidden'): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('emits tool_leave with whole visible seconds on endTool', () => {
    enable(true);
    TelemetryService.startTool('harmony', 'initial');
    vi.advanceTimersByTime(12_400);
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events).toEqual([
      { n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 12 },
    ]);
  });

  it('pauses the clock while the tab is hidden', () => {
    enable(true);
    TelemetryService.startTool('mixer', 'nav');
    vi.advanceTimersByTime(5_000);
    setVisibility('hidden'); // also flushes — nothing queued yet
    vi.advanceTimersByTime(60_000);
    setVisibility('visible');
    vi.advanceTimersByTime(3_000);
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events.at(-1)).toEqual({
      n: 'tool_leave',
      p: { tool: 'mixer', entry: 'nav' },
      d: 8,
    });
  });

  it('caps at DWELL_CAP_S', () => {
    enable(true);
    TelemetryService.startTool('presets', 'nav');
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events[0].d).toBe(TelemetryService.DWELL_CAP_S);
  });

  it('endTool without a started tool is a no-op, and a second endTool does not double-emit', () => {
    enable(true);
    TelemetryService.endTool();
    TelemetryService.startTool('budget', 'nav');
    TelemetryService.endTool();
    TelemetryService.endTool();
    TelemetryService.flush();
    expect(lastBatch().events).toHaveLength(1);
  });

  it('pagehide ends the current tool before flushing', () => {
    enable(true);
    TelemetryService.startTool('swatch', 'share');
    vi.advanceTimersByTime(2_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(lastBatch().events).toEqual([
      { n: 'tool_leave', p: { tool: 'swatch', entry: 'share' }, d: 2 },
    ]);
  });

  it('resumes the dwell clock on a bfcache pageshow without a new tool_view', () => {
    enable(true);
    TelemetryService.startTool('harmony', 'initial');
    vi.advanceTimersByTime(2_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(lastBatch().events).toEqual([
      { n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 2 },
    ]);

    let pageshowEvent: Event;
    try {
      pageshowEvent = new PageTransitionEvent('pageshow', { persisted: true });
    } catch {
      pageshowEvent = new Event('pageshow');
      Object.defineProperty(pageshowEvent, 'persisted', { value: true });
    }
    window.dispatchEvent(pageshowEvent);

    vi.advanceTimersByTime(3_000);
    TelemetryService.endTool();
    TelemetryService.flush();
    const events = lastBatch().events;
    expect(events).toEqual([{ n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 3 }]);
    expect(events.some((e) => e.n === 'tool_view')).toBe(false);
  });

  it('keeps timing even while disabled so a late opt-in does not emit a stale tool_leave', () => {
    enable(false);
    TelemetryService.startTool('harmony', 'initial');
    vi.advanceTimersByTime(30_000);
    configListener!({ analyticsEnabled: true, performanceMode: false });
    vi.advanceTimersByTime(1_000);
    TelemetryService.endTool();
    TelemetryService.flush();
    // The clock was reset at opt-in: only the second after enabling counts.
    expect(lastBatch().events).toEqual([
      { n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 1 },
    ]);
  });
});
