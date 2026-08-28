/**
 * XIV Dye Tools - Router Service Title Regression Tests
 *
 * Split out from router-service.test.ts because these tests must be able to
 * FAIL if `document.title` reverts to a hardcoded product name at any of the
 * four sites in router-service.ts (navigateTo, replaceRoute, handlePopState,
 * handleInitialRoute). Under Vitest there is no `define` block, so the real
 * APP_NAME resolves to the literal 'XIV Dye Tools' — byte-identical to the
 * string that used to be hardcoded at all four sites. Asserting against the
 * real APP_NAME therefore cannot distinguish "reads the constant" from
 * "still hardcoded".
 *
 * Mocking `@shared/constants` with a sentinel that could never appear in a
 * hardcoded literal closes that gap. The mock is scoped to this file only
 * (vi.mock is per-module-graph-per-test-file) so router-service.test.ts is
 * unaffected and keeps exercising the real constant.
 *
 * router-service.ts imports only `APP_NAME` from `@shared/constants`, so the
 * mock factory only needs to provide that one export. `LanguageService` (which
 * resolves the route title keys) is stubbed too — it reads a great deal more of
 * `@shared/constants` than the sentinel mock provides, and the tool title is
 * not what these tests are about.
 *
 * @module services/__tests__/router-service-title.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { SENTINEL_APP_NAME } = vi.hoisted(() => ({ SENTINEL_APP_NAME: 'SENTINEL_APP_NAME' }));

vi.mock('@shared/constants', () => ({
  APP_NAME: SENTINEL_APP_NAME,
}));

vi.mock('../language-service', () => ({
  LanguageService: {
    t: (key: string) => `i18n:${key}`,
  },
}));

import { RouterService } from '../router-service';

describe('RouterService document title (APP_NAME regression guard)', () => {
  let originalPathname: string;
  let originalSearch: string;
  let originalTitle: string;

  beforeEach(() => {
    originalPathname = window.location.pathname;
    originalSearch = window.location.search;
    originalTitle = document.title;

    RouterService.destroy();

    vi.spyOn(history, 'pushState').mockImplementation(() => {});
    vi.spyOn(history, 'replaceState').mockImplementation(() => {});

    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/',
        search: '',
        href: 'http://localhost/',
      },
      writable: true,
    });
  });

  afterEach(() => {
    RouterService.destroy();
    vi.restoreAllMocks();

    Object.defineProperty(window, 'location', {
      value: {
        pathname: originalPathname,
        search: originalSearch,
        href: `http://localhost${originalPathname}${originalSearch}`,
      },
      writable: true,
    });
    document.title = originalTitle;
  });

  it('navigateTo() composes the title from the mocked APP_NAME', () => {
    RouterService.initialize();
    RouterService.navigateTo('comparison');
    expect(document.title.endsWith(` | ${SENTINEL_APP_NAME}`)).toBe(true);
  });

  it('replaceRoute() composes the title from the mocked APP_NAME', () => {
    RouterService.initialize();
    RouterService.replaceRoute('accessibility');
    expect(document.title.endsWith(` | ${SENTINEL_APP_NAME}`)).toBe(true);
  });

  it('handlePopState() composes the title from the mocked APP_NAME', () => {
    RouterService.initialize();

    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/presets',
        search: '',
        href: 'http://localhost/presets',
      },
      writable: true,
    });

    window.dispatchEvent(new PopStateEvent('popstate', { state: { toolId: 'presets' } }));

    expect(document.title.endsWith(` | ${SENTINEL_APP_NAME}`)).toBe(true);
  });

  it('handleInitialRoute() composes the title from the mocked APP_NAME on a direct deep link', () => {
    // A path that resolves to a valid tool, is not '/', and is not a legacy
    // redirect takes the branch of handleInitialRoute() that sets
    // document.title directly (rather than delegating to replaceRoute()) —
    // this is the fourth site, the one missing from the original brief.
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/swatch',
        search: '',
        href: 'http://localhost/swatch',
      },
      writable: true,
    });

    RouterService.initialize();

    expect(document.title.endsWith(` | ${SENTINEL_APP_NAME}`)).toBe(true);
  });
});
