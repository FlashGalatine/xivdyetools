/**
 * The twin picker (design 1a popover, 1b sheet): "SAME LOOK · N ITEMS", one
 * radio row per twin with its facts, a why line for a twin that fails, and
 * the promise that Copy list / Save .md write the one picked.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { charaTwinsOf, defaultCharaTwin, type CharaTwinRules } from '@xivdyetools/core';
import { closeTwinPicker, showTwinPicker } from '../glamour-twin-picker';
import { createTestContainer, cleanupTestContainer } from '../../__tests__/component-utils';
import { ModalService } from '@services/modal-service';
import { KeyboardService } from '@services/keyboard-service';
import { RouterService } from '@services/router-service';

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

let outside: HTMLButtonElement | null = null;
/** Tab out of the picker: focus lands on a control in the page. */
function focusOutside(): HTMLButtonElement {
  outside = document.createElement('button');
  document.body.appendChild(outside);
  outside.focus();
  return outside;
}

afterEach(() => {
  closeTwinPicker();
  cleanupTestContainer(anchor);
  outside?.remove();
  outside = null;
  vi.unstubAllGlobals();
});

describe('twin picker', () => {
  it('lists every twin with its facts, the pick checked', () => {
    open();
    expect(picker()!.textContent).toContain('SAME LOOK · 3 ITEMS');
    expect(picker()!.textContent).toContain('Copy list and Save .md write the one you pick.');
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

/**
 * BUG-091: the picker is a role=dialog over the reader, but it never told the
 * page so. KeyboardService stands down only while `hasOpenModals()` is true,
 * so with a radio focused, "2" navigated away (tearing the picker's block
 * down) and Shift+T flipped the theme underneath it. A radio is not a text
 * field, so the typing guard did not help.
 */
describe('twin picker and the page-wide shortcuts (BUG-091)', () => {
  it('holds the global shortcuts off while open, a digit included', () => {
    const navigate = vi.spyOn(RouterService, 'navigateTo').mockImplementation(() => {});
    KeyboardService.initialize();
    try {
      open();
      const radio = document.activeElement as HTMLElement;
      expect(radio.dataset.role).toBe('twin-option');

      radio.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));

      expect(navigate).not.toHaveBeenCalled();
      expect(picker()).not.toBeNull();
      expect(ModalService.hasOpenModals()).toBe(true);
    } finally {
      KeyboardService.destroy();
      navigate.mockRestore();
    }
  });

  // A leaked registration would switch every shortcut off until a reload, so
  // each way the picker closes must hand it back.
  it.each([
    ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))],
    ['a pick', () => options()[2]!.click()],
    ['closeTwinPicker (its block re-rendering or going away)', () => closeTwinPicker()],
    [
      'a click outside',
      async () => {
        // The outside-click listener is installed a tick after opening
        await new Promise((resolve) => setTimeout(resolve, 0));
        document.body.click();
      },
    ],
    ['focus leaving it (Tab out)', () => focusOutside()],
  ])('lets the shortcuts back on when closed by %s', async (_how, close) => {
    open();
    expect(ModalService.hasOpenModals()).toBe(true);

    await close();

    expect(picker()).toBeNull();
    expect(ModalService.hasOpenModals()).toBe(false);
  });

  it('does not keep the first registration when another piece opens it again', () => {
    open();
    cleanupTestContainer(anchor);
    open();
    expect(document.querySelectorAll('[data-role="twin-picker"]')).toHaveLength(1);

    closeTwinPicker();

    expect(ModalService.hasOpenModals()).toBe(false);
  });

  /*
   * The picker has no focus trap, so Tab walks out of it into the page. Its
   * registration must not outlive that: the shortcuts and the DyeSelector "/"
   * would stay dead with the user's focus back on the page, until an Escape
   * or a click. Focus leaving closes it, as it does the item-links menu.
   */
  it('closes when focus moves out of it, and lets a digit navigate again', () => {
    const navigate = vi.spyOn(RouterService, 'navigateTo').mockImplementation(() => {});
    KeyboardService.initialize();
    try {
      open();
      const outside = focusOutside();

      expect(picker()).toBeNull();
      expect(ModalService.hasOpenModals()).toBe(false);
      outside.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      expect(navigate).toHaveBeenCalledWith('extractor');
    } finally {
      KeyboardService.destroy();
      navigate.mockRestore();
    }
  });

  it('stays open while focus moves between its own twins', () => {
    open();
    const [, , coif2] = options();

    coif2!.focus();

    expect(picker()).not.toBeNull();
    expect(document.activeElement).toBe(coif2);
  });

  it('stays open when focus goes back to the chip that opened it', () => {
    open();
    anchor.tabIndex = 0;

    anchor.focus();

    expect(picker()).not.toBeNull();
    expect(ModalService.hasOpenModals()).toBe(true);
  });

  // The real chip lives inside the layout shell's shadow root, where a
  // document listener's `event.target` is the shell host, not the chip
  it('stays open when focus goes back to a chip inside a shadow root', () => {
    const host = createTestContainer('picker-shadow-host');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const chip = document.createElement('button');
    shadowRoot.appendChild(chip);
    try {
      showTwinPicker({
        anchor: chip,
        slotLabel: 'Head',
        twins: TWINS,
        pickedId: BEST.itemId,
        best: BEST,
        lang: 'en',
        onPick: vi.fn(),
      });

      chip.focus();

      expect(picker()).not.toBeNull();
    } finally {
      closeTwinPicker();
      cleanupTestContainer(host);
    }
  });

  // One Escape closes one layer: the picker marks the key handled, so a
  // listener that runs after it (the toast container) leaves its toast alone.
  it('marks the Escape that closed it as handled', () => {
    open();
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

    document.dispatchEvent(event);

    expect(picker()).toBeNull();
    expect(event.defaultPrevented).toBe(true);
  });
});
