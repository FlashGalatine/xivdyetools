/**
 * Tests for the shared clipboard helper — the mechanics every "Copy" action
 * shares: the async Clipboard API first, the textarea + execCommand path when
 * that is unavailable or policy-blocked, and an honest boolean either way so
 * the caller can pick its own toast.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyTextToClipboard } from '../clipboard';

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
