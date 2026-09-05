import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';
import {
  COLOR_WHEEL_IDS,
  COLOR_WHEEL_TAGS,
  DEFAULT_COLOR_WHEEL,
  LocalizationService,
  getColorWheel,
} from '@xivdyetools/core';
import { dyeService } from '../../src/lib/services.js';

const env = createMockEnv();

async function getJson(path: string) {
  const res = await app.request(path, { method: 'GET' }, env);
  const body = (await res.json()) as any;
  return { res, body };
}

describe('GET /v1/wheels', () => {
  it('lists the five wheels in core display order with rgb as the default', async () => {
    const { res, body } = await getJson('/v1/wheels');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.map((w: any) => w.id)).toEqual([...COLOR_WHEEL_IDS]);
    for (const wheel of body.data) {
      expect(wheel.tag).toBe(COLOR_WHEEL_TAGS[wheel.id as keyof typeof COLOR_WHEEL_TAGS]);
      expect(wheel.name).toBe(LocalizationService.getColorWheelName(wheel.id, 'en'));
      expect(wheel.isDefault).toBe(wheel.id === DEFAULT_COLOR_WHEEL);
    }
  });

  it('localizes the wheel names', async () => {
    const { body } = await getJson('/v1/wheels?locale=ja');

    expect(body.meta.locale).toBe('ja');
    const ryb = body.data.find((w: any) => w.id === 'ryb');
    expect(ryb.name).toBe(LocalizationService.getColorWheelName('ryb', 'ja'));
    expect(ryb.name).not.toBe(LocalizationService.getColorWheelName('ryb', 'en'));
  });

  it('is edge-cacheable like the dye routes', async () => {
    const res = await app.request('/v1/wheels', { method: 'GET' }, env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
  });
});

describe('GET /v1/wheels/:id', () => {
  it('returns 72 ring stops and every dye’s position on the wheel by default', async () => {
    const { res, body } = await getJson('/v1/wheels/ryb');

    expect(res.status).toBe(200);
    expect(body.data.id).toBe('ryb');
    expect(body.data.tag).toBe('RYB');
    expect(body.data.ringStops).toHaveLength(72);
    for (const stop of body.data.ringStops) expect(stop).toMatch(/^#[0-9A-Fa-f]{6}$/);

    expect(body.data.dyes).toHaveLength(dyeService.getDyeCount());
    const wheel = getColorWheel('ryb');
    for (const entry of body.data.dyes) {
      expect(entry.wheelHue).toBeGreaterThanOrEqual(0);
      expect(entry.wheelHue).toBeLessThan(360);
      expect(entry.wheelHue).toBeCloseTo(wheel.hueOf(entry.hex), 2);
      expect(typeof entry.stainID).toBe('number');
      expect(typeof entry.name).toBe('string');
    }
  });

  it('honours the stops parameter', async () => {
    const { body } = await getJson('/v1/wheels/munsell?stops=12');
    expect(body.data.ringStops).toHaveLength(12);
  });

  it('rejects a stop count outside 3–360', async () => {
    const { res, body } = await getJson('/v1/wheels/rgb?stops=2');
    expect(res.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details.parameter).toBe('stops');
  });

  it('rejects an unknown wheel and names the valid ids', async () => {
    const { res, body } = await getJson('/v1/wheels/hsl');
    expect(res.status).toBe(400);
    expect(body.error).toBe('INVALID_COLOR_WHEEL');
    expect(body.details.expected).toEqual([...COLOR_WHEEL_IDS]);
  });

  it('localizes the dye names in the position table', async () => {
    const { body } = await getJson('/v1/wheels/rgb?locale=de');
    const snowWhite = body.data.dyes.find((d: any) => d.stainID === 1);
    expect(snowWhite.name).toBe('Snow White');
    expect(typeof snowWhite.localizedName).toBe('string');
    expect(snowWhite.localizedName).not.toBe('Snow White');
  });
});
