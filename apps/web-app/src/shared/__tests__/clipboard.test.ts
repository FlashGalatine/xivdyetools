/**
 * Tests for the shared clipboard helper — the mechanics every "Copy" action
 * shares: the async Clipboard API first, the textarea + execCommand path when
 * that is unavailable or policy-blocked, and an honest boolean either way so
 * the caller can pick its own toast.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyRichTextToClipboard, copyTextToClipboard } from '../clipboard';

/** jsdom has no ClipboardItem; this stand-in just keeps what it was given. */
class FakeClipboardItem {
  constructor(public readonly items: Record<string, Blob>) {}
}

const RICH = { html: '<p><strong>Glamour Items:</strong></p>', text: 'Glamour Items:' };

describe('copyTextToClipboard', () => {
  let writeText: ReturnType<typeof vi.fn>;
  let execCommand: ReturnType<typeof vi.fn>;
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalExec = Object.getOwnPropertyDescriptor(document, 'execCommand');

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execCommand,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete (navigator as unknown as Record<string, unknown>).clipboard;
    if (originalExec) Object.defineProperty(document, 'execCommand', originalExec);
    else delete (document as unknown as Record<string, unknown>).execCommand;
  });

  it('writes through the Clipboard API and reports success', async () => {
    await expect(copyTextToClipboard('**Glamour Items:**')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('**Glamour Items:**');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a selected read-only textarea when the Clipboard API rejects, and cleans it up', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    // Observed from inside the copy command, the only moment the textarea is
    // in the document: it must hold the text, be selected, and be read-only
    // (iOS zooms and shows the keyboard for an editable one).
    let seen: { text: string; readonly: boolean; selected: boolean } | null = null;
    execCommand.mockImplementation(() => {
      const textarea = document.querySelector('textarea')!;
      seen = {
        text: textarea.value,
        readonly: textarea.hasAttribute('readonly'),
        selected: textarea.selectionStart === 0 && textarea.selectionEnd === textarea.value.length,
      };
      return true;
    });

    await expect(copyTextToClipboard('fallback text')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(seen).toEqual({ text: 'fallback text', readonly: true, selected: true });
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('removes the textarea even when selecting it throws', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    vi.spyOn(HTMLTextAreaElement.prototype, 'select').mockImplementation(() => {
      throw new Error('select blocked');
    });
    await expect(copyTextToClipboard('x')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports failure when neither path works', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    execCommand.mockImplementation(() => {
      throw new Error('blocked');
    });
    await expect(copyTextToClipboard('x')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('treats an execCommand that returns false as a failure', async () => {
    writeText.mockRejectedValue(new Error('NotAllowedError'));
    execCommand.mockReturnValue(false);
    await expect(copyTextToClipboard('x')).resolves.toBe(false);
  });
});

describe('copyRichTextToClipboard', () => {
  let write: ReturnType<typeof vi.fn>;
  let execCommand: ReturnType<typeof vi.fn>;
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalExec = Object.getOwnPropertyDescriptor(document, 'execCommand');
  const originalItem = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem');

  beforeEach(() => {
    write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write, writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(globalThis, 'ClipboardItem', {
      configurable: true,
      writable: true,
      value: FakeClipboardItem,
    });
    execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execCommand,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete (navigator as unknown as Record<string, unknown>).clipboard;
    if (originalExec) Object.defineProperty(document, 'execCommand', originalExec);
    else delete (document as unknown as Record<string, unknown>).execCommand;
    if (originalItem) Object.defineProperty(globalThis, 'ClipboardItem', originalItem);
    else delete (globalThis as unknown as Record<string, unknown>).ClipboardItem;
  });

  it('writes one item carrying both an HTML and a plain-text flavour', async () => {
    await expect(copyRichTextToClipboard(RICH)).resolves.toBe(true);

    expect(write).toHaveBeenCalledTimes(1);
    const [items] = write.mock.calls[0] as [FakeClipboardItem[]];
    expect(items).toHaveLength(1);
    const { items: flavours } = items[0];
    expect(Object.keys(flavours).sort()).toEqual(['text/html', 'text/plain']);
    expect(flavours['text/html'].type).toBe('text/html');
    expect(flavours['text/plain'].type).toBe('text/plain');
    await expect(flavours['text/html'].text()).resolves.toBe(RICH.html);
    await expect(flavours['text/plain'].text()).resolves.toBe(RICH.text);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a copy command whose event carries both flavours when the async write is refused', async () => {
    write.mockRejectedValue(new Error('NotAllowedError'));
    const setData = vi.fn();
    execCommand.mockImplementation(() => {
      // What a browser does for execCommand('copy'): fire `copy` at the
      // selection; the helper's listener fills both flavours in.
      const event = new Event('copy', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { setData } });
      document.activeElement!.dispatchEvent(event);
      return true;
    });

    await expect(copyRichTextToClipboard(RICH)).resolves.toBe(true);
    expect(setData).toHaveBeenCalledWith('text/html', RICH.html);
    expect(setData).toHaveBeenCalledWith('text/plain', RICH.text);
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('stops listening for copy events once the command has run', async () => {
    write.mockRejectedValue(new Error('NotAllowedError'));
    await copyRichTextToClipboard(RICH);

    const setData = vi.fn();
    const later = new Event('copy', { bubbles: true, cancelable: true });
    Object.defineProperty(later, 'clipboardData', { value: { setData } });
    document.body.dispatchEvent(later);
    expect(setData).not.toHaveBeenCalled();
  });

  it('goes straight to the copy command when the browser has no ClipboardItem', async () => {
    delete (globalThis as unknown as Record<string, unknown>).ClipboardItem;
    await expect(copyRichTextToClipboard(RICH)).resolves.toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('reports failure when neither path works', async () => {
    write.mockRejectedValue(new Error('NotAllowedError'));
    execCommand.mockReturnValue(false);
    await expect(copyRichTextToClipboard(RICH)).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
