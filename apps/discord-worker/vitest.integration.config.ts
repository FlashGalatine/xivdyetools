import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.integration.test.ts'],
        testTimeout: 30000,
        hookTimeout: 15000,
        server: {
            deps: {
                inline: ['@xivdyetools/core', '@xivdyetools/test-utils'],
            },
        },
        // No coverage thresholds — integration tests supplement, not replace
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
