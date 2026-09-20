/**
 * The Mixer's "Mixing Mode" select labels every model "<id> - <name>".
 *
 * The ids are identifiers and live in the template; only the name is translated.
 * Spectral's id used to sit inside its locale value, and en shipped
 * "Spectral -Realistic Paint" — a dropped space no gate could see, because no
 * test read the labels. This one reads them as the browser shows them
 * (whitespace collapsed), so a missing space on either side of the dash fails.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@components/v4/config-sidebar';
import { ConfigController } from '@services/config-controller';

describe('config-sidebar mixing mode select', () => {
  let el: HTMLElement & { activeTool: string; updateComplete: Promise<unknown> };

  beforeEach(async () => {
    ConfigController.resetInstance();
    el = document.createElement('v4-config-sidebar') as typeof el;
    el.activeTool = 'mixer';
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
    ConfigController.resetInstance();
  });

  const labels = (): Record<string, string> => {
    const option = el.shadowRoot!.querySelector<HTMLOptionElement>('option[value="spectral"]')!;
    const select = option.closest('select')!;
    return Object.fromEntries(
      [...select.options].map((o) => [o.value, (o.textContent ?? '').replace(/\s+/g, ' ').trim()])
    );
  };

  it('labels all six models "<id> - <name>"', () => {
    expect(labels()).toEqual({
      spectral: 'Spectral - Realistic Paint',
      ryb: 'RYB - Paint',
      oklab: 'OKLAB - Modern Perceptual',
      lab: 'LAB - Perceptual',
      hsl: 'HSL - Hue-based',
      rgb: 'RGB - Light',
    });
  });
});
