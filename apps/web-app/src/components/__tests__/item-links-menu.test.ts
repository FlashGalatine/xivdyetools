import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeItemLinksMenu, showItemLinksMenu } from '../item-links-menu';
import type { CharaResolveResult } from '@services/chara-resolve-service';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('@services/chara-resolve-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@services/chara-resolve-service')>()),
  resolveCharaEquipment: resolveMock,
}));

const names = {
  en: 'Oval Spectacles',
  ja: 'オーバルグラス',
  de: 'Ovale Brille',
  fr: 'Lunettes ovales',
};
const result: CharaResolveResult = {
  items: {},
  glasses: { id: 1, names, iconId: 51000 },
  version: 'test',
};
const menu = () => document.querySelector<HTMLElement>('[data-role="item-links-menu"]');
const submenu = () => document.querySelector<HTMLElement>('[data-role="item-links-lodestone"]');
const link = (id: string) => document.querySelector<HTMLButtonElement>(`[data-link="${id}"]`)!;
const region = (id: string) => document.querySelector<HTMLButtonElement>(`[data-region="${id}"]`)!;

function press(key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    shiftKey,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  document.activeElement!.dispatchEvent(event);
  return event;
}

describe('item link menu focus and keyboard navigation', () => {
  let host: HTMLElement;
  let anchor: HTMLButtonElement;
  let outside: HTMLButtonElement;

  beforeEach(() => {
    resolveMock.mockReset();
    host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    anchor = document.createElement('button');
    shadow.appendChild(anchor);
    outside = document.createElement('button');
    document.body.append(host, outside);
    anchor.focus();
  });

  afterEach(() => {
    closeItemLinksMenu();
    host.remove();
    outside.remove();
  });

  function openGear(): void {
    showItemLinksMenu({
      anchorElement: anchor,
      title: names.en,
      target: { kind: 'gear', itemId: 18085, names },
    });
  }

  function openTint(): {
    resolve: (value: CharaResolveResult) => void;
    reject: (error: Error) => void;
  } {
    let resolve!: (value: CharaResolveResult) => void;
    let reject!: (error: Error) => void;
    resolveMock.mockReturnValue(
      new Promise<CharaResolveResult>((res, rej) => {
        resolve = res;
        reject = rej;
      })
    );
    showItemLinksMenu({
      anchorElement: anchor,
      title: 'White Oval Spectacles',
      target: { kind: 'facewear', glassesRowId: 5, names },
    });
    return { resolve, reject };
  }

  it('keeps focus in the loading menu and transfers it when the links arrive', async () => {
    const pending = openTint();
    expect(document.activeElement).toBe(menu());
    expect(menu()?.getAttribute('aria-busy')).toBe('true');
    pending.resolve(result);
    await vi.waitFor(() => expect(document.activeElement).toBe(link('mirapri')));
    expect(menu()?.getAttribute('aria-busy')).toBe('false');
    press('Escape');
    expect(menu()).toBeNull();
    expect(host.shadowRoot?.activeElement).toBe(anchor);
  });

  it('does not steal focus when the user leaves during the lookup', async () => {
    const pending = openTint();
    outside.focus();
    pending.resolve(result);
    await vi.waitFor(() => expect(menu()).toBeNull());
    expect(document.activeElement).toBe(outside);
  });

  it('ignores a lookup after a newer gear menu opens', async () => {
    const pending = openTint();
    openGear();
    press('ArrowDown');
    pending.resolve(result);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(link('garlandTools'));
    expect(link('teamcraft')).not.toBeNull();
  });

  it('keeps failure feedback focused and lets Escape return to the trigger', async () => {
    const pending = openTint();
    pending.reject(new Error('unavailable'));
    await vi.waitFor(() =>
      expect(menu()?.querySelector('[data-role="item-links-unavailable"]')).not.toBeNull()
    );
    expect(document.activeElement).toBe(menu());
    expect(menu()?.getAttribute('aria-busy')).toBe('false');
    press('Escape');
    expect(host.shadowRoot?.activeElement).toBe(anchor);
  });

  it('wraps up/down and handles Home/End without scrolling the page', () => {
    openGear();
    expect(document.activeElement).toBe(link('mirapri'));
    expect(press('ArrowDown').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(link('garlandTools'));
    expect(press('Home').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(link('mirapri'));
    press('ArrowUp');
    expect(document.activeElement).toBe(link('lodestone'));
    press('ArrowDown');
    expect(document.activeElement).toBe(link('mirapri'));
    expect(press('End').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(link('lodestone'));
  });

  it.each(['ArrowLeft', 'Escape'])('navigates regions, then %s returns to Lodestone', (key) => {
    openGear();
    press('End');
    expect(press('ArrowRight').defaultPrevented).toBe(true);
    expect(submenu()).not.toBeNull();
    expect(document.activeElement).toBe(region('na'));
    expect(link('lodestone').getAttribute('aria-expanded')).toBe('true');
    press('ArrowUp');
    expect(document.activeElement).toBe(region('fr'));
    press('ArrowDown');
    expect(document.activeElement).toBe(region('na'));
    press('End');
    expect(document.activeElement).toBe(region('fr'));
    press('Home');
    expect(document.activeElement).toBe(region('na'));
    expect(press(key).defaultPrevented).toBe(true);
    expect(submenu()).toBeNull();
    expect(menu()).not.toBeNull();
    expect(document.activeElement).toBe(link('lodestone'));
    expect(link('lodestone').getAttribute('aria-expanded')).toBe('false');
    press('Escape');
    expect(menu()).toBeNull();
    expect(host.shadowRoot?.activeElement).toBe(anchor);
  });

  it.each([false, true])(
    'Tab dismisses both menus and resumes from the trigger (shift=%s)',
    (shift) => {
      openGear();
      link('lodestone').click();
      expect(submenu()).not.toBeNull();
      expect(press('Tab', shift).defaultPrevented).toBe(false);
      expect(submenu()).toBeNull();
      expect(menu()).toBeNull();
      expect(host.shadowRoot?.activeElement).toBe(anchor);
    }
  );

  it('closing a clicked submenu returns focus to its parent', () => {
    openGear();
    link('lodestone').click();
    link('lodestone').click();
    expect(submenu()).toBeNull();
    expect(document.activeElement).toBe(link('lodestone'));
  });

  it('restores trigger focus after opening an external link', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openGear();
    link('garlandTools').click();
    expect(open).toHaveBeenCalledWith(
      'https://www.garlandtools.org/db/#item/18085',
      '_blank',
      'noopener,noreferrer'
    );
    expect(menu()).toBeNull();
    expect(host.shadowRoot?.activeElement).toBe(anchor);
    open.mockRestore();
  });
});
