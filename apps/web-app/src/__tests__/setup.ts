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

  const mockPerf = {
    start: vi.fn(),
    end: vi.fn(() => 0),
    measure: vi.fn(async (_label, fn) => await fn()),
    measureSync: vi.fn((_label, fn) => fn()),
    getMetrics: vi.fn(() => null),
    getAllMetrics: vi.fn(() => ({})),
    logMetrics: vi.fn(),
    clearMetrics: vi.fn(),
  };

  return {
    logger: mockLogger,
    perf: mockPerf,
    __setTestEnvironment: vi.fn(),
    initErrorTracking: vi.fn(),
  };
});

// Initialize services and MSW server before all tests
beforeAll(async () => {
  // Start MSW server for API mocking
  server.listen({ onUnhandledRequest: 'bypass' });

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
