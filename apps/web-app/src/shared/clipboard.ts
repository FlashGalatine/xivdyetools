/**
 * Clipboard — the mechanics behind every "Copy" action.
 *
 * The async Clipboard API needs a secure context and can be policy-blocked, so
 * a selected off-screen textarea + `execCommand('copy')` stays as the second
 * path. The result is a plain boolean: the caller owns the toast, because the
 * right wording differs by what was copied (a snippet, a link, a list).
 *
 * Two entry points: plain text, and rich text — an HTML flavour so a paste
 * into Word or Google Docs keeps its bold, with a plain flavour alongside for
 * editors that take only text. The rich path uses `ClipboardItem` where the
 * browser has it and otherwise fills both flavours into the `copy` event the
 * command fires, which is how rich copy worked before the async API existed.
 *
 * The rich entry point also takes its content as a promise. WebKit (Safari,
 * and every browser on iOS) only honours `clipboard.write` while the click's
 * user activation is live, and lets a `ClipboardItem` carry promises for
 * exactly this case: the item is built and the write started inside the
 * click, and the content may land later — after a chunk has loaded, say.
 * Handing over content the caller still has to compute is the only way a
 * lazily loaded copy action works there.
 *
 * No services, so it is usable from a pure component without pulling the
 * toast and language layers into its tests.
 *
 * @module shared/clipboard
 */

import { logger } from '@shared/logger';

/** Two flavours of the same content. Every editor takes at least one. */
export interface RichText {
  html: string;
  text: string;
}

/** Copy `text`, trying the Clipboard API first. Resolves true on success. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    logger.warn('[Clipboard] Clipboard API unavailable, using fallback', error);
  }
  return execCommandCopy(text);
}

/**
 * Copy HTML with a plain-text alternative. Resolves true on success — which
 * may be the plain fallback alone if the browser refuses both rich paths;
 * a copy with the bold lost still beats no copy.
 *
 * Call it synchronously from the click handler. The `ClipboardItem` is built
 * and the write started before anything is awaited, with each flavour as a
 * promise, so a still-pending `rich` costs no user activation (see the module
 * note). A payload that rejects rejects the write and then this call, so the
 * caller's catch sees it; the command fallback needs the content in hand and
 * so runs only once it has landed, which on WebKit is too late — that path is
 * for browsers without `ClipboardItem`, or ones that refused the write.
 */
export async function copyRichTextToClipboard(
  rich: RichText | Promise<RichText>
): Promise<boolean> {
  const pending = Promise.resolve(rich);
  if (typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function') {
    try {
      const flavour = (key: keyof RichText, type: string): Promise<Blob> =>
        pending.then((content) => new Blob([content[key]], { type }));
      await Promise.all([
        navigator.clipboard.write([
          new ClipboardItem({
            'text/html': flavour('html', 'text/html'),
            'text/plain': flavour('text', 'text/plain'),
          }),
        ]),
        pending,
      ]);
      return true;
    } catch (error) {
      logger.warn('[Clipboard] Rich write unavailable, using fallback', error);
    }
  }
  const { html, text } = await pending;
  return execCommandCopy(text, html);
}

/**
 * The command path. `readonly` keeps iOS from zooming in and raising the
 * keyboard for the off-screen field; the select and the copy sit inside the
 * same try so a throw at any step still removes the textarea. With `html`
 * given, a one-shot capture listener rewrites the event's payload with both
 * flavours — without it the browser copies the textarea's selection as text.
 */
function execCommandCopy(text: string, html?: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  const onCopy = (event: ClipboardEvent): void => {
    const data = event.clipboardData;
    if (!data || html === undefined) return;
    data.setData('text/html', html);
    data.setData('text/plain', text);
    event.preventDefault();
  };
  document.addEventListener('copy', onCopy, true);
  try {
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand('copy');
  } catch (error) {
    logger.error('[Clipboard] Copy failed', error);
    return false;
  } finally {
    document.removeEventListener('copy', onCopy, true);
    textarea.remove();
  }
}
