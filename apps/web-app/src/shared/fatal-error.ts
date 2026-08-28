/**
 * XIV Dye Tools - Fatal-error fallback
 *
 * What main.ts paints into `#app` when `initializeServices()` throws before
 * the shell exists. Built with DOM APIs rather than an innerHTML template:
 * the old template wired its Reload button through an inline
 * `onclick="location.reload()"`, which the production CSP
 * (`script-src 'self'`, no 'unsafe-inline') blocks — so the one control on
 * the screen did nothing and logged a CSP violation (2026-08-21 security
 * audit, WEB-9). The default copy is plain English because LanguageService
 * may be the very thing that failed to initialise; main.ts passes a
 * `navigator.language`-picked translation (its own table, no service
 * dependency) through `copy`.
 *
 * @module shared/fatal-error
 */

/** The three user-facing strings on the fatal screen. */
export interface FatalErrorCopy {
  title: string;
  body: string;
  button: string;
}

const DEFAULT_COPY: FatalErrorCopy = {
  title: 'Application Error',
  body: 'Failed to initialize XIV Dye Tools',
  button: 'Reload Page',
};

/**
 * Replace `container`'s content with the fatal-error screen.
 *
 * @param container - The app root (`#app`)
 * @param message - User-facing detail (from ErrorHandler.createUserMessage); rendered as text
 * @param onReload - What the Reload button does; defaults to a full page reload
 * @param copy - Heading / explanation / button text; defaults to English
 */
export function renderFatalError(
  container: HTMLElement,
  message: string,
  onReload: () => void = () => window.location.reload(),
  copy: FatalErrorCopy = DEFAULT_COPY
): void {
  const screen = document.createElement('div');
  screen.className = 'min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900';

  const card = document.createElement('div');
  card.className = 'text-center';

  const heading = document.createElement('h1');
  heading.className = 'text-2xl font-bold text-red-900 dark:text-red-100 mb-4';
  heading.textContent = copy.title;

  const lead = document.createElement('p');
  lead.className = 'text-red-700 dark:text-red-200 mb-4';
  lead.textContent = copy.body;

  const detail = document.createElement('p');
  detail.className = 'text-sm text-red-600 dark:text-red-300';
  detail.textContent = message;

  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700';
  reload.textContent = copy.button;
  reload.addEventListener('click', onReload);

  card.append(heading, lead, detail, reload);
  screen.appendChild(card);
  container.replaceChildren(screen);
}
