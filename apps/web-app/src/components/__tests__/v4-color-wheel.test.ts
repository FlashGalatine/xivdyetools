/**
 * The ring and the nodes come from core: `ringStops` paints the conic
 * gradient, `nodeAngles` places the base and each slot at its wheel angle.
 * With neither set (the empty state) the component falls back to
 * HARMONY_OFFSETS — the RGB geometry at base 0° — so the placeholder still
 * shows the right formation.
 */
import { describe, it, expect } from 'vitest';
import { HARMONY_OFFSETS } from '@xivdyetools/core';
import '@components/v4/v4-color-wheel';
import type { V4ColorWheel } from '@components/v4/v4-color-wheel';

type Exposed = V4ColorWheel & { angles(): number[]; ringStyle(): string };

function make(props: Partial<V4ColorWheel> = {}): Exposed {
  const el = document.createElement('v4-color-wheel') as Exposed;
  Object.assign(el, props);
  return el;
}

describe('V4ColorWheel angles', () => {
  it.each(Object.entries(HARMONY_OFFSETS))(
    'falls back to core offsets for %s when no node angles are given',
    (type, offsets) => {
      const el = make({ harmonyType: type as V4ColorWheel['harmonyType'] });
      expect(el.angles()).toEqual([0, ...offsets.map((o) => ((o % 360) + 360) % 360)]);
    }
  );

  it('shifts the fallback by the base hue when a base colour is set but no angles are', () => {
    const el = make({ harmonyType: 'complementary', baseColor: '#00FFFF' }); // HSV 180
    expect(el.angles()).toEqual([180, 0]);
  });

  it('uses the given node angles verbatim when present (a warped wheel)', () => {
    const el = make({ harmonyType: 'complementary', baseColor: '#FF0000', nodeAngles: [0, 180] });
    expect(el.angles()).toEqual([0, 180]);
  });

  it('tetradic, inverted-tetradic and square remain distinct formations', () => {
    const a = make({ harmonyType: 'tetradic' }).angles();
    const b = make({ harmonyType: 'inverted-tetradic' }).angles();
    const c = make({ harmonyType: 'square' }).angles();
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(a).not.toEqual(c);
  });
});

describe('V4ColorWheel ring', () => {
  it('paints the class default (no inline background) when no stops are given', () => {
    expect(make().ringStyle()).toBe('');
  });

  it('builds a conic gradient from the stops, closing the circle with the first stop', () => {
    const el = make({ ringStops: ['#FF0000', '#00FF00', '#0000FF', '#FF00FF'] });
    expect(el.ringStyle()).toBe(
      'background: conic-gradient(from 0deg, #FF0000 0.00deg, #00FF00 90.00deg, #0000FF 180.00deg, #FF00FF 270.00deg, #FF0000 360deg)'
    );
  });

  it('places the complementary node where the ring is green on an RYB-shaped wheel', async () => {
    // A 4-stop "RYB-ish" ring: green at 180°, not cyan.
    const el = make({
      harmonyType: 'complementary',
      baseColor: '#FF0000',
      harmonyColors: ['#00FF9C'],
      ringStops: ['#FF0000', '#FFFF00', '#00FF9C', '#0000FF'],
      nodeAngles: [0, 180],
    });
    document.body.appendChild(el);
    await el.updateComplete;
    const nodes = el.shadowRoot!.querySelectorAll<HTMLElement>('.harmony-node:not(.main)');
    expect(nodes).toHaveLength(1);
    // hueToPosition(180): top = 50 + 42·sin(90°) = 92%
    expect(nodes[0].style.top).toBe('92%');
    el.remove();
  });
});
