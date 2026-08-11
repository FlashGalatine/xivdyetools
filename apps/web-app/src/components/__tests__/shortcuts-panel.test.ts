/**
 * Tests for the keyboard shortcuts panel (O4).
 *
 * The panel is built imperatively rather than from an HTML string, which is
 * the point: shortcut descriptions come from LanguageService, so they are
 * user-facing translated text and must land in `textContent`, never in
 * `innerHTML`. The one `innerHTML` here is the static platform hint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showShortcutsPanel } from '../shortcuts-panel';
import { ModalService } from '@services/index';

describe('showShortcutsPanel', () => {
  let showSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    showSpy = vi.spyOn(ModalService, 'show').mockReturnValue('modal-1' as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const config = () =>
    showSpy.mock.calls[0][0] as {
      type: string;
      title: string;
      content: HTMLElement;
      size: string;
      closable: boolean;
      closeOnBackdrop: boolean;
      closeOnEscape: boolean;
    };

  it('returns the modal id so callers can dismiss it programmatically', () => {
    expect(showShortcutsPanel()).toBe('modal-1');
  });

  it('opens a small, fully dismissible custom modal', () => {
    showShortcutsPanel();

    const cfg = config();
    expect(cfg.type).toBe('custom');
    expect(cfg.size).toBe('sm');
    // A help panel must never be able to trap the user
    expect(cfg.closable).toBe(true);
    expect(cfg.closeOnBackdrop).toBe(true);
    expect(cfg.closeOnEscape).toBe(true);
  });

  it('gives the modal a non-empty title', () => {
    showShortcutsPanel();

    expect(config().title).toBeTruthy();
  });

  it('renders three shortcut groups', () => {
    showShortcutsPanel();

    expect(config().content.querySelectorAll('.shortcut-group')).toHaveLength(3);
  });

  it('gives every group a heading and at least one row', () => {
    showShortcutsPanel();

    const groups = config().content.querySelectorAll('.shortcut-group');
    for (const group of groups) {
      expect(group.querySelector('h4')?.textContent).toBeTruthy();
      expect(group.querySelectorAll('kbd').length).toBeGreaterThan(0);
    }
  });

  it('lists every documented shortcut key exactly once', () => {
    showShortcutsPanel();

    const keys = [...config().content.querySelectorAll('kbd')].map((k) => k.textContent);
    expect(keys).toEqual([
      '1-9',
      'Esc',
      'Shift + T',
      'Shift + L',
      'Shift + S',
      '?',
      'Tab',
      '↑↓←→',
      'Enter',
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('pairs each key badge with a description in the same row', () => {
    showShortcutsPanel();

    const rows = config().content.querySelectorAll('.shortcut-group .space-y-2 > div');
    expect(rows.length).toBe(9);
    for (const row of rows) {
      expect(row.querySelector('kbd')).not.toBeNull();
      expect(row.querySelector('span')?.textContent).toBeTruthy();
    }
  });

  it('writes translated text as textContent, never as markup', () => {
    showShortcutsPanel();

    const content = config().content;
    for (const el of content.querySelectorAll('h4, kbd, .shortcut-group span')) {
      // If a translation were interpolated as HTML, it would have children
      expect(el.children.length).toBe(0);
    }
  });

  it('appends the platform hint after the groups', () => {
    showShortcutsPanel();

    const content = config().content;
    const last = content.lastElementChild;
    expect(last?.tagName).toBe('P');
    expect(last?.textContent?.trim()).toBeTruthy();
  });

  it('themes through CSS variables rather than hardcoded colours', () => {
    showShortcutsPanel();

    const title = config().content.querySelector('h4') as HTMLElement;
    expect(title.style.cssText).toContain('var(--theme-text)');
    expect(title.style.cssText).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it('builds a fresh element each time it is opened', () => {
    showShortcutsPanel();
    const first = config().content;
    showShortcutsPanel();
    const second = (showSpy.mock.calls[1][0] as { content: HTMLElement }).content;

    // Re-showing must not re-parent the previous modal's DOM
    expect(first).not.toBe(second);
  });
});
