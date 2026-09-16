/**
 * Clipboard — the mechanics behind every "Copy" action.
 *
 * The async Clipboard API needs a secure context and can be policy-blocked, so
 * a selected off-screen textarea + `execCommand('copy')` stays as the second
 * path. The result is a plain boolean: the caller owns the toast, because the
 * right wording differs by what was copied (a snippet, a link, a list).
 *
 * No services, so it is usable from a pure component without pulling the
 * toast and language layers into its tests.
 *
 * @module shared/clipboard
 */

import { logger } from '@shared/logger';

/** Copy `text`, trying the Clipboard API first. Resolves true on success. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    logger.warn('[Clipboard] Clipboard API unavailable, using fallback', error);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch (error) {
    logger.error('[Clipboard] Copy failed', error);
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
