/**
 * The "Color wheel" select renders every wheel core knows, in core's order,
 * and writes the chosen id to the harmony config. The option list comes from
 * COLOR_WHEEL_IDS, so a wheel added in core appears here with no edit.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { COLOR_WHEEL_IDS } from '@xivdyetools/core';
import '@components/v4/config-sidebar';
import { ConfigController } from '@services/config-controller';

describe('config-sidebar colour wheel select', () => {
  let el: HTMLElement & { activeTool: string; updateComplete: Promise<unknown> };

  beforeEach(async () => {
    ConfigController.resetInstance();
    ConfigController.getInstance().setConfig('harmony', { wheel: 'rgb' });
    el = document.createElement('v4-config-sidebar') as typeof el;
    el.activeTool = 'harmony';
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
    ConfigController.resetInstance();
  });

  const select = () =>
    el.shadowRoot!.querySelector<HTMLSelectElement>('select[data-config="harmony.wheel"]')!;

  it('lists the wheels in core order with rgb selected by default', () => {
    const options = [...select().options].map((o) => o.value);
    expect(options).toEqual([...COLOR_WHEEL_IDS]);
    expect(select().value).toBe('rgb');
  });

  it('writes the chosen wheel to the harmony config', async () => {
    select().value = 'ryb';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(ConfigController.getInstance().getConfig('harmony').wheel).toBe('ryb');
  });

  it('shows the trademark line only for munsell', async () => {
    const text = () => el.shadowRoot!.textContent ?? '';
    expect(text()).not.toContain('MUNSELL is a registered trademark');
    select().value = 'munsell';
    select().dispatchEvent(new Event('change', { bubbles: true }));
    await el.updateComplete;
    expect(text()).toContain('MUNSELL is a registered trademark');
  });

  it('shows a persisted non-default wheel selected on the very first render', async () => {
    ConfigController.getInstance().setConfig('harmony', { wheel: 'munsell' });
    const fresh = document.createElement('v4-config-sidebar') as typeof el;
    fresh.activeTool = 'harmony';
    document.body.appendChild(fresh);
    await fresh.updateComplete; // FIRST update only — do not await a second one
    const sel = fresh.shadowRoot!.querySelector<HTMLSelectElement>(
      'select[data-config="harmony.wheel"]'
    )!;
    expect(sel.value).toBe('munsell');
    expect(fresh.shadowRoot!.textContent).toContain('MUNSELL is a registered trademark');
    fresh.remove();
    ConfigController.getInstance().setConfig('harmony', { wheel: 'rgb' });
  });
});
