/**
 * Telemetry batch validation — the allowlist between the browser and
 * Analytics Engine. Anything not in the schema is dropped, never written.
 */
import { describe, it, expect } from 'vitest';
import { parseTelemetryBatch, MAX_EVENTS } from './schema';

const envelope = {
  v: 1,
  ver: '5.0.3',
  env: 'production',
  locale: 'en',
  theme: 'standard-dark',
  vp: 'd',
};

function batch(events: unknown[], overrides: Record<string, unknown> = {}) {
  return { ...envelope, ...overrides, events };
}

describe('parseTelemetryBatch', () => {
  it('returns null for anything that is not a v1 batch object', () => {
    expect(parseTelemetryBatch(null)).toBeNull();
    expect(parseTelemetryBatch('x')).toBeNull();
    expect(parseTelemetryBatch([])).toBeNull();
    expect(parseTelemetryBatch({ ...envelope, v: 2, events: [] })).toBeNull();
    expect(parseTelemetryBatch({ ...envelope, events: 'nope' })).toBeNull();
  });

  it('maps tool_view onto the fixed column layout', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_view', p: { tool: 'harmony', entry: 'initial' } }]),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.dropped).toBe(0);
    expect(parsed!.points).toEqual([
      {
        indexes: ['tool_view'],
        blobs: ['tool_view', 'harmony', 'initial', '', 'en', 'standard-dark', 'd', '5.0.3', 'production'],
        doubles: [0],
      },
    ]);
  });

  it('carries tool_leave dwell seconds in double1', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: 42 }]),
    );
    expect(parsed!.points[0].doubles).toEqual([42]);
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['tool_leave', 'mixer', 'nav', '']);
  });

  it('drops tool_leave when active_s is missing, negative, fractional or over the cap', () => {
    const bad = [
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' } },
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: -1 },
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: 1.5 },
      { n: 'tool_leave', p: { tool: 'mixer', entry: 'nav' }, d: 1801 },
    ];
    const parsed = parseTelemetryBatch(batch(bad));
    expect(parsed!.points).toEqual([]);
    expect(parsed!.dropped).toBe(4);
  });

  it('maps dye_pick with the stainID as blob4 and via as blob3', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'dye_pick', p: { tool: 'comparison', stainID: 102, via: 'grid' } }]),
    );
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['dye_pick', 'comparison', 'grid', '102']);
  });

  it('drops dye_pick for a stainID that is not a dye', () => {
    const parsed = parseTelemetryBatch(
      batch([
        { n: 'dye_pick', p: { tool: 'comparison', stainID: 9999, via: 'grid' } },
        { n: 'dye_pick', p: { tool: 'comparison', stainID: '102', via: 'grid' } },
        { n: 'dye_pick', p: { tool: 'comparison', stainID: 102, via: 'random' } },
      ]),
    );
    expect(parsed!.points).toEqual([]);
    expect(parsed!.dropped).toBe(3);
  });

  it('maps chara_parse with ok as blob3 and producer as blob4, no tool', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'chara_parse', p: { ok: true, producer: 'anamnesis' } }]),
    );
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['chara_parse', '', 'true', 'anamnesis']);
  });

  it('drops chara_parse with an unknown producer or a non-boolean ok', () => {
    const parsed = parseTelemetryBatch(
      batch([
        { n: 'chara_parse', p: { ok: true, producer: 'Anamnesis 2024' } },
        { n: 'chara_parse', p: { ok: 'yes', producer: 'other' } },
      ]),
    );
    expect(parsed!.points).toEqual([]);
    expect(parsed!.dropped).toBe(2);
  });

  it('maps theme_change with the target theme as blob3', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'theme_change', p: { to: 'standard-light' } }]),
    );
    expect(parsed!.points[0].blobs.slice(0, 4)).toEqual(['theme_change', '', 'standard-light', '']);
  });

  it('drops unknown events, unknown tools and malformed entries without failing the batch', () => {
    const parsed = parseTelemetryBatch(
      batch([
        { n: 'page_view', p: {} },
        { n: 'tool_view', p: { tool: 'matcher', entry: 'nav' } },
        { n: 'tool_view', p: { tool: 'harmony', entry: 'bookmark' } },
        { n: 'tool_view' },
        'garbage',
        { n: 'tool_view', p: { tool: 'harmony', entry: 'nav' } },
      ]),
    );
    expect(parsed!.points).toHaveLength(1);
    expect(parsed!.dropped).toBe(5);
  });

  it('keeps only the first MAX_EVENTS events', () => {
    const events = Array.from({ length: MAX_EVENTS + 5 }, () => ({
      n: 'tool_view',
      p: { tool: 'harmony', entry: 'nav' },
    }));
    const parsed = parseTelemetryBatch(batch(events));
    expect(parsed!.points).toHaveLength(MAX_EVENTS);
    expect(parsed!.dropped).toBe(5);
  });

  it("replaces invalid envelope fields with 'invalid' instead of rejecting", () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_view', p: { tool: 'harmony', entry: 'nav' } }], {
        ver: 'abc',
        env: 'staging',
        locale: 'pt',
        theme: 'premium-dark',
        vp: 'xl',
      }),
    );
    expect(parsed!.points[0].blobs.slice(4)).toEqual([
      'invalid',
      'invalid',
      'invalid',
      'invalid',
      'invalid',
    ]);
  });

  it('accepts beta as an env and clamps ver to 16 characters', () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_view', p: { tool: 'harmony', entry: 'nav' } }], {
        env: 'beta',
        ver: '5.0.3-beta.20260829.1234',
      }),
    );
    expect(parsed!.points[0].blobs[8]).toBe('beta');
    expect(parsed!.points[0].blobs[7]).toBe('5.0.3-beta.20260');
  });

  it("rejects a ver with trailing free text as 'invalid'", () => {
    const parsed = parseTelemetryBatch(
      batch([{ n: 'tool_view', p: { tool: 'harmony', entry: 'nav' } }], {
        ver: '5.0.3 free text',
      }),
    );
    expect(parsed!.points[0].blobs[7]).toBe('invalid');
  });
});
