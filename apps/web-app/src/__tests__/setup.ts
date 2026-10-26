/**
 * Vitest Global Setup
 *
 * Initializes services needed for tests including MSW for API mocking
 */

import { vi } from 'vitest';
import { LanguageService } from '@services/language-service';
import { ThemeService } from '@services/theme-service';
import { server } from './mocks/server';

// Initialize ThemeService to ensure it's available for component tests
// This prevents "ThemeService.getCurrentTheme is not a function" errors
ThemeService.setTheme('standard-light');

// Mock window.matchMedia for tests that need it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the logger module to prevent SSR import issues
// Use vi.fn() so tests can spy on these methods
vi.mock('@shared/logger', () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    group: vi.fn(),
    groupEnd: vi.fn(),
    table: vi.fn(),
  };

  return {
    logger: mockLogger,
    __setTestEnvironment: vi.fn(),
  };
});

// jsdom has no Worker, so the `.chara` inspection service runs in-thread for every suite: the
// worker's own handler, the page's validation and dye attachment, the service's supersession
// (see mocks/chara-inspection-inline.ts). Both exports are vi.fn wrappers around that behavior,
// so a suite can hold or fail one call (mockImplementationOnce) and mockReset restores it.
// chara-inspection-service.test.ts unmocks it to drive the real service with a fake Worker.
// The helper is imported inside the factory, never at the top of this file (see its header).
vi.mock('@services/chara-inspection-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/chara-inspection-service')>();
  const { createInlineCharaInspection } = await import('./mocks/chara-inspection-inline');
  const inline = createInlineCharaInspection(actual.CharaInspectionError);
  return {
    ...actual,
    inspectCharaBytes: vi.fn(inline.inspectCharaBytes),
    cancelCharaInspection: vi.fn(inline.cancelCharaInspection),
    // The idle-time palette warm-up is a no-op here (the inline stand-in loads palettes on
    // demand); a suite asserts on the vi.fn that the file card calls it.
    prefetchCharaPalettes: vi.fn(async () => undefined),
  };
});

// Initialize services and MSW server before all tests
beforeAll(async () => {
  // Start MSW server for API mocking
  server.listen({ onUnhandledFrame: 'bypass' });

  // Initialize LanguageService which loads English translations by default
  await LanguageService.initialize();
});

// Reset handlers after each test to avoid test pollution
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  // Stop MSW server
  server.close();

  vi.restoreAllMocks();
});
