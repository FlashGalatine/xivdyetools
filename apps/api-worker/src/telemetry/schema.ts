/**
 * Telemetry batch validation — the allowlist between the browser and
 * Analytics Engine (spec: docs/superpowers/specs/2026-08-29-web-analytics-design.md).
 *
 * Every event is checked against EVENT_SCHEMAS; anything unknown or malformed
 * is dropped, never written. Invalid ENVELOPE fields become 'invalid' rather
 * than rejecting the batch, so a client/server version skew degrades a
 * dimension instead of losing the data. Nothing here touches Hono or a
 * binding — it is a pure function so the router test can stay small.
 *
 * Fixed column layout (queries depend on it — see docs/operations/ANALYTICS_QUERIES.md):
 *   index1 = event
 *   blob1  = event
 *   blob2  = tool ('' when the event has none)
 *   blob3  = dim A: entry | via | ok | to
 *   blob4  = dim B: stainID | producer | ''
 *   blob5  = locale, blob6 = theme, blob7 = vp, blob8 = ver, blob9 = env
 *   double1 = active_s for tool_leave, 0 otherwise
 */

import { SUPPORTED_LOCALES } from '@xivdyetools/core';
import { dyeService } from '../lib/services.js';

/** Analytics Engine allows 25 writeDataPoint calls per invocation. */
export const MAX_EVENTS = 25;
/** 25 small events plus the envelope is ~3 KB; 16 KB is a generous ceiling. */
export const MAX_BODY_BYTES = 16 * 1024;

export interface TelemetryDataPoint {
  indexes: [string];
  blobs: string[];
  doubles: [number];
}

export interface ParsedBatch {
  points: TelemetryDataPoint[];
  dropped: number;
}

const TOOL_IDS = [
  'harmony',
  'extractor',
  'accessibility',
  'comparison',
  'gradient',
  'mixer',
  'presets',
  'budget',
  'swatch',
] as const;
const ENTRIES = ['initial', 'share', 'nav'] as const;
const VIAS = ['drawer', 'grid'] as const;
const PRODUCERS = ['anamnesis', 'ktisis', 'brio', 'other', 'none'] as const;
const THEMES = ['standard-light', 'standard-dark'] as const;
const ENVS = ['production', 'beta'] as const;
const VIEWPORTS = ['m', 't', 'd'] as const;
const DWELL_CAP_S = 1800;
const VER_MAX_LENGTH = 16;
const VER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const INVALID = 'invalid';

type Props = Record<string, unknown>;

/**
 * Each schema maps a validated event onto [tool, dimA, dimB, double1] or
 * returns null to drop it.
 */
type EventMapper = (p: Props, d: unknown) => [string, string, string, number] | null;

function oneOf(value: unknown, allowed: readonly string[]): string | null {
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

function toolOf(p: Props): string | null {
  return oneOf(p['tool'], TOOL_IDS);
}

function dwell(d: unknown): number | null {
  return typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= DWELL_CAP_S ? d : null;
}

function stainId(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return dyeService.getByStainId(value) ? String(value) : null;
}

/**
 * A Map, not an object literal: the event name is client-controlled, and an
 * object lookup would resolve inherited members (`constructor`, `__proto__`,
 * `toString`, …) as mappers and throw inside parseTelemetryBatch — a 500 on a
 * route that promises 204 once the batch parses.
 */
const EVENT_SCHEMAS: ReadonlyMap<string, EventMapper> = new Map<string, EventMapper>([
  ['tool_view', (p) => {
    const tool = toolOf(p);
    const entry = oneOf(p['entry'], ENTRIES);
    return tool && entry ? [tool, entry, '', 0] : null;
  }],
  ['tool_leave', (p, d) => {
    const tool = toolOf(p);
    const entry = oneOf(p['entry'], ENTRIES);
    const seconds = dwell(d);
    return tool && entry && seconds !== null ? [tool, entry, '', seconds] : null;
  }],
  ['dye_pick', (p) => {
    const tool = toolOf(p);
    const via = oneOf(p['via'], VIAS);
    const id = stainId(p['stainID']);
    return tool && via && id ? [tool, via, id, 0] : null;
  }],
  ['chara_parse', (p) => {
    const ok = p['ok'];
    const producer = oneOf(p['producer'], PRODUCERS);
    return typeof ok === 'boolean' && producer ? ['', String(ok), producer, 0] : null;
  }],
  ['theme_change', (p) => {
    const to = oneOf(p['to'], THEMES);
    return to ? ['', to, '', 0] : null;
  }],
]);

function envelopeField(value: unknown, allowed: readonly string[]): string {
  return oneOf(value, allowed) ?? INVALID;
}

function version(value: unknown): string {
  return typeof value === 'string' && VER_PATTERN.test(value)
    ? value.slice(0, VER_MAX_LENGTH)
    : INVALID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate a batch. `null` means "not a v1 batch at all" (the router answers
 * 400); otherwise every event that passed its schema, in order, plus how
 * many were dropped.
 */
export function parseTelemetryBatch(body: unknown): ParsedBatch | null {
  if (!isRecord(body) || body['v'] !== 1 || !Array.isArray(body['events'])) return null;

  const envelope = [
    envelopeField(body['locale'], SUPPORTED_LOCALES),
    envelopeField(body['theme'], THEMES),
    envelopeField(body['vp'], VIEWPORTS),
    version(body['ver']),
    envelopeField(body['env'], ENVS),
  ];

  const events = body['events'] as unknown[];
  const points: TelemetryDataPoint[] = [];
  let dropped = Math.max(0, events.length - MAX_EVENTS);

  for (const raw of events.slice(0, MAX_EVENTS)) {
    const mapped = mapEvent(raw);
    if (!mapped) {
      dropped += 1;
      continue;
    }
    const [name, tool, dimA, dimB, value] = mapped;
    points.push({
      indexes: [name],
      blobs: [name, tool, dimA, dimB, ...envelope],
      doubles: [value],
    });
  }

  return { points, dropped };
}

function mapEvent(raw: unknown): [string, string, string, string, number] | null {
  if (!isRecord(raw) || typeof raw['n'] !== 'string') return null;
  const mapper = EVENT_SCHEMAS.get(raw['n']);
  if (!mapper) return null;
  const props = isRecord(raw['p']) ? raw['p'] : null;
  if (!props) return null;
  const mapped = mapper(props, raw['d']);
  return mapped ? [raw['n'], ...mapped] : null;
}
