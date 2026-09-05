import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';
import { COLOR_WHEEL_IDS, HARMONY_OFFSETS, LocalizationService } from '@xivdyetools/core';

const env = createMockEnv();

async function getJson(path: string) {
  const res = await app.request(path, { method: 'GET' }, env);
  const body = (await res.json()) as any;
  return { res, body };
}

describe('GET /v1/harmony/types', () => {
  it('lists every harmony type with its hue offsets', async () => {
    const { res, body } = await getJson('/v1/harmony/types');

    expect(res.status).toBe(200);
    expect(body.data.map((t: any) => t.id)).toEqual(Object.keys(HARMONY_OFFSETS));
    for (const type of body.data) {
      expect(type.offsets).toEqual(HARMONY_OFFSETS[type.id]);
      expect(typeof type.name).toBe('string');
      expect(type.name.length).toBeGreaterThan(0);
    }
  });

  it('localizes the names through core’s camelCase locale keys', async () => {
    const { body } = await getJson('/v1/harmony/types?locale=ja');
    const split = body.data.find((t: any) => t.id === 'split-complementary');
    expect(split.name).toBe(LocalizationService.getHarmonyType('splitComplementary', 'ja'));
    expect(split.name).not.toBe('split-complementary');
  });
});

describe('GET /v1/harmony', () => {
  it('builds a complementary harmony for a dye on the rgb wheel by default', async () => {
    const { res, body } = await getJson('/v1/harmony?dye=1');

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.base.dye.stainID).toBe(1);
    expect(body.data.base.hex).toBe(body.data.base.dye.hex);
    expect(body.data.harmonyType).toBe('complementary');
    // The same summary shape /v1/wheels lists, so a client can match the two.
    expect(body.data.wheel).toEqual({
      id: 'rgb',
      tag: 'RGB',
      name: LocalizationService.getColorWheelName('rgb', 'en'),
      isDefault: true,
    });
    expect(body.data.harmonyTypeName).toBe(LocalizationService.getHarmonyType('complementary', 'en'));
    expect(body.data.method).toBe('ciede2000');
    expect(body.data.distanceUnit).toBe('ciede2000');
    expect(typeof body.data.baseWheelHue).toBe('number');
    expect(body.data.slots).toHaveLength(1);

    const slot = body.data.slots[0];
    expect(slot.index).toBe(0);
    expect(slot.offset).toBe(180);
    expect(slot.dye).not.toBeNull();
    expect(slot.dye.stainID).not.toBe(1);
    expect(typeof slot.distance).toBe('number');
    expect(slot.targetHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(slot.companions).toEqual([]);
  });

  it('accepts an arbitrary hex as the base', async () => {
    const { res, body } = await getJson('/v1/harmony?hex=FF0000&type=triadic');

    expect(res.status).toBe(200);
    expect(body.data.base).toEqual({ hex: '#FF0000', dye: null });
    expect(body.data.slots).toHaveLength(2);
    expect(body.data.slots.map((s: any) => s.offset)).toEqual([120, 240]);
  });

  it('measures the slot angle on the selected wheel', async () => {
    const { body } = await getJson('/v1/harmony?hex=FF0000&wheel=munsell&type=square');
    for (const slot of body.data.slots) {
      expect(slot.wheelHue).toBeCloseTo((body.data.baseWheelHue + slot.offset) % 360, 6);
    }
  });

  it('moves the ideal partner colour when the wheel changes', async () => {
    const rgb = (await getJson('/v1/harmony?hex=FF0000')).body.data;
    const ryb = (await getJson('/v1/harmony?hex=FF0000&wheel=ryb')).body.data;

    expect(rgb.wheel.id).toBe('rgb');
    expect(ryb.wheel.id).toBe('ryb');
    // On the screen wheel red's complement is cyan (180°); on the artist's
    // wheel it is green — the research's headline "material, not cosmetic".
    expect(rgb.slots[0].targetHue).toBe(180);
    expect(ryb.slots[0].targetHue).toBeGreaterThan(90);
    expect(ryb.slots[0].targetHue).toBeLessThan(150);
  });

  it('ranks by hue angle instead of ΔE when strict=false', async () => {
    const { body } = await getJson('/v1/harmony?dye=1&strict=false');
    expect(body.data.distanceUnit).toBe('degrees');
    expect(body.data.slots[0].distance).toBeLessThanOrEqual(180);
  });

  it('returns runner-up companions when asked', async () => {
    const { body } = await getJson('/v1/harmony?dye=1&type=triadic&companions=2');
    for (const slot of body.data.slots) {
      expect(slot.companions.length).toBeGreaterThan(0);
      expect(slot.companions.length).toBeLessThanOrEqual(2);
      for (const c of slot.companions) expect(c.stainID).not.toBe(slot.dye.stainID);
    }
  });

  it('narrows the candidate dyes with the dye filters', async () => {
    const { body } = await getJson('/v1/harmony?dye=1&type=square&metallic=true');
    expect(body.data.slots.length).toBe(3);
    for (const slot of body.data.slots) expect(slot.dye.isMetallic).toBe(true);
  });

  it('returns empty slots, not an error, when the filters leave no candidate', async () => {
    // No dye is both pastel and dark, so the pool is empty.
    const { res, body } = await getJson('/v1/harmony?dye=1&pastel=true&dark=true');
    expect(res.status).toBe(200);
    expect(body.data.slots).toHaveLength(1);
    expect(body.data.slots[0].dye).toBeNull();
    expect(body.data.slots[0].distance).toBeNull();
    expect(body.data.slots[0].companions).toEqual([]);
  });

  it('rejects a malformed dye id', async () => {
    const { res, body } = await getJson('/v1/harmony?dye=abc');
    expect(res.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details.parameter).toBe('dye');
  });

  it('normalises a retired matching method', async () => {
    const { body } = await getJson('/v1/harmony?dye=1&method=hyab');
    expect(body.data.method).toBe('ciede2000');
  });

  it('rejects an unknown wheel and names the valid ids', async () => {
    const { res, body } = await getJson('/v1/harmony?dye=1&wheel=cmyk');
    expect(res.status).toBe(400);
    expect(body.error).toBe('INVALID_COLOR_WHEEL');
    expect(body.details.expected).toEqual([...COLOR_WHEEL_IDS]);
  });

  it('rejects an unknown harmony type and names the valid ids', async () => {
    const { res, body } = await getJson('/v1/harmony?dye=1&type=pentadic');
    expect(res.status).toBe(400);
    expect(body.error).toBe('INVALID_HARMONY_TYPE');
    expect(body.details.expected).toEqual(Object.keys(HARMONY_OFFSETS));
  });

  it('requires a dye or a hex', async () => {
    const { res, body } = await getJson('/v1/harmony');
    expect(res.status).toBe(400);
    expect(body.error).toBe('MISSING_PARAMETER');
  });

  it('refuses a dye and a hex together', async () => {
    const { res, body } = await getJson('/v1/harmony?dye=1&hex=FF0000');
    expect(res.status).toBe(400);
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('answers 404 for an unassigned dye id', async () => {
    const { res, body } = await getJson('/v1/harmony?dye=200');
    expect(res.status).toBe(404);
    expect(body.error).toBe('NOT_FOUND');
  });

  it('localizes the dye names', async () => {
    const { body } = await getJson('/v1/harmony?dye=1&locale=ja');
    expect(body.meta.locale).toBe('ja');
    expect(typeof body.data.base.dye.localizedName).toBe('string');
    expect(typeof body.data.slots[0].dye.localizedName).toBe('string');
  });

  it('is edge-cacheable like the match routes', async () => {
    const res = await app.request('/v1/harmony?dye=1', { method: 'GET' }, env);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
  });
});
