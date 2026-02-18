/**
 * MSW Server Setup for Node.js Testing Environment
 *
 * This file configures MSW to intercept network requests during tests.
 * Import and use in test setup files.
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create server with default handlers
export const server = setupServer(...handlers);

/**
 * Helper to reset handlers to defaults
 */
export function resetHandlers() {
  server.resetHandlers();
}

/**
 * Helper to add custom handlers for specific tests
 */
export function useHandler(...customHandlers: Parameters<typeof server.use>) {
  server.use(...customHandlers);
}
