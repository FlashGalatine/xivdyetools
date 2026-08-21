/**
 * XIV Dye Tools - Fatal-error fallback tests
 *
 * The fallback main.ts paints when `initializeServices()` throws used to be
 * an innerHTML template with an inline `onclick="location.reload()"`. The
 * production CSP is `script-src 'self'` with no 'unsafe-inline', so the
 * handler was blocked and the Reload button did nothing (2026-08-21 security
 * audit, WEB-9). The fallback is now built with DOM APIs and a real listener.
 *
 * @module shared/__tests__/fatal-error.test
 */

import { describe, it, expect, vi } from 'vitest';
import { renderFatalError } from '../fatal-error';

describe('renderFatalError', () => {
  it('replaces the container content with the heading, explanation and message', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p id="old">stale</p>';

    renderFatalError(container, 'Dye data failed to load', () => {});

    expect(container.querySelector('#old')).toBeNull();
    expect(container.querySelector('h1')!.textContent).toContain('Application Error');
    expect(container.textContent).toContain('Failed to initialize XIV Dye Tools');
    expect(container.textContent).toContain('Dye data failed to load');
  });

  it('renders the message as text, never as markup', () => {
    const container = document.createElement('div');
    const message = '<img src=x onerror=alert(1)><b>bold</b>';

    renderFatalError(container, message, () => {});

    expect(container.querySelector('img, b')).toBeNull();
    expect(container.textContent).toContain(message);
  });

  it('wires the Reload button through a listener, not an inline handler', () => {
    const container = document.createElement('div');
    const onReload = vi.fn();

    renderFatalError(container, 'boom', onReload);

    const button = container.querySelector('button')!;
    expect(button).not.toBeNull();
    expect(button.getAttribute('onclick')).toBeNull();
    expect(button.textContent).toContain('Reload Page');

    button.click();
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders the caller-supplied copy (main.ts passes a navigator.language translation)', () => {
    const container = document.createElement('div');

    renderFatalError(container, 'boom', () => {}, {
      title: 'アプリケーションエラー',
      body: 'XIV Dye Tools の初期化に失敗しました',
      button: 'ページを再読み込み',
    });

    expect(container.querySelector('h1')!.textContent).toBe('アプリケーションエラー');
    expect(container.textContent).toContain('XIV Dye Tools の初期化に失敗しました');
    expect(container.querySelector('button')!.textContent).toBe('ページを再読み込み');
    expect(container.textContent).not.toContain('Application Error');
  });
});
