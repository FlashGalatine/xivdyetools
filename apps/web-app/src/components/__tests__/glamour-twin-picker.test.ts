/**
 * The twin picker (design 1a popover, 1b sheet): "SAME LOOK · N ITEMS", one
 * radio row per twin with its facts, a why line for a twin that fails, and
 * the promise that Copy list / Export .md write the one picked.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { charaTwinsOf, defaultCharaTwin, type CharaTwinRules } from '@xivdyetools/core';
import { closeTwinPicker, showTwinPicker } from '../glamour-twin-picker';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';

const names = (en: string) => ({ en, ja: en, de: en, fr: en });
const group = (itemIds: number[], dyeCount: number): CharaTwinRules => ({
  itemIds,
  dyeCount,
  glamourable: true,
  wearMask: 0xffff,
  grandCompany: 0,
});
const TWINS = charaTwinsOf(
  {
    itemId: 372,
    names: names('Dated Hempen Coif'),
    alternates: [
      { itemId: 2629, names: names('Hempen Coif') },
      { itemId: 2630, names: names('Hempen Coif') },
    ],
    rules: [group([372], 0), group([2629, 2630], 1)],
  },
  1,
  { race: 'Hyur', gender: 'Female' }
);
const BEST = defaultCharaTwin(TWINS);

let anchor: HTMLElement;

function open(onPick = vi.fn()) {
  anchor = createTestContainer('picker-anchor');
  showTwinPicker({
    anchor,
    slotLabel: 'Head',
    twins: TWINS,
    pickedId: BEST.itemId,
    best: BEST,
    lang: 'en',
    onPick,
  });
  return onPick;
}
const picker = () => document.querySelector<HTMLElement>('[data-role="twin-picker"]');
const options = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-role="twin-option"]'));

afterEach(() => {
  closeTwinPicker();
  cleanupTestContainer(anchor);
  vi.unstubAllGlobals();
});

describe('twin picker', () => {
  it('lists every twin with its facts, the pick checked', () => {
    open();
    expect(picker()!.textContent).toContain('SAME LOOK · 3 ITEMS');
    expect(picker()!.textContent).toContain('Copy list and Export .md write the one you pick.');
    expect(options()).toHaveLength(3);
    const checked = options().filter((o) => o.getAttribute('aria-checked') === 'true');
    expect(checked.map((o) => o.dataset.itemId)).toEqual(['2629']);
    expect(options()[1]!.textContent).toContain('BEST FIT');
    expect(options()[1]!.textContent).toContain('ITEM 2629');
    // The Dated coif can't take the file's dye: a warn fact and a why line
    expect(options()[0]!.textContent).toContain('DYE ×0');
    expect(options()[0]!.textContent).toContain('DATED');
    expect(options()[0]!.querySelector('[data-role="twin-why"]')?.textContent).toBe(
      "It can't take the dyes the file puts on it"
    );
  });

  it('picks a twin and closes', () => {
    const onPick = open();
    options()[2]!.click();
    expect(onPick).toHaveBeenCalledWith(2630);
    expect(picker()).toBeNull();
  });

  it('closes on Escape without picking', () => {
    const onPick = open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(picker()).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('moves between twins with the arrow keys, only the pick in the tab order', () => {
    open();
    const [dated, coif, coif2] = options();
    expect(document.activeElement).toBe(coif);
    expect([dated!.tabIndex, coif!.tabIndex, coif2!.tabIndex]).toEqual([-1, 0, -1]);

    const key = (k: string) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true })
      );
    key('ArrowDown');
    expect(document.activeElement).toBe(coif2);
    key('ArrowDown');
    expect(document.activeElement).toBe(dated);
    key('ArrowUp');
    expect(document.activeElement).toBe(coif2);
    key('Home');
    expect(document.activeElement).toBe(dated);
    key('End');
    expect(document.activeElement).toBe(coif2);
  });

  it('gives focus back to the chip that opened it', () => {
    open();
    anchor.tabIndex = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.activeElement).toBe(anchor);
  });

  it('opens above the chip when there is no room below it', () => {
    const tall = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
    anchor = createTestContainer('picker-anchor');
    vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
      top: window.innerHeight - 40,
      bottom: window.innerHeight - 20,
      left: 100,
      right: 130,
      width: 30,
      height: 20,
      x: 100,
      y: window.innerHeight - 40,
      toJSON: () => ({}),
    });
    showTwinPicker({
      anchor,
      slotLabel: 'Head',
      twins: TWINS,
      pickedId: BEST.itemId,
      best: BEST,
      lang: 'en',
      onPick: vi.fn(),
    });
    expect(picker()!.style.top).toBe(`${window.innerHeight - 40 - 6 - 300}px`);
    tall.mockRestore();
  });

  it('is a bottom sheet on a phone (design 1b)', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('max-width'), media: q }));
    open();
    expect(picker()!.dataset.variant).toBe('sheet');
    expect(picker()!.textContent).toContain('HEAD · SAME LOOK · 3 ITEMS');
  });
});
