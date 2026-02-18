/**
 * Tests for image services index exports
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the photon WASM module
vi.mock('@cf-wasm/photon', () => ({
    PhotonImage: {
        new_from_byteslice: vi.fn(() => ({
            get_width: () => 100,
            get_height: () => 100,
            get_raw_pixels: () => new Uint8Array([]),
            get_bytes: () => new Uint8Array([]),
            free: vi.fn(),
        })),
    },
    SamplingFilter: {
        Lanczos3: 0,
    },
    resize: vi.fn(() => ({
        get_width: () => 50,
        get_height: () => 50,
        get_raw_pixels: () => new Uint8Array([]),
        free: vi.fn(),
    })),
}));

describe('image/index exports', () => {
    it('exports photon image processing functions', async () => {
        const image = await import('./index.js');

        // Photon exports
        expect(image.loadImage).toBeDefined();
        expect(typeof image.loadImage).toBe('function');

        expect(image.resizeImage).toBeDefined();
        expect(typeof image.resizeImage).toBe('function');

        expect(image.extractPixels).toBeDefined();
        expect(typeof image.extractPixels).toBe('function');

        expect(image.processImageForExtraction).toBeDefined();
        expect(typeof image.processImageForExtraction).toBe('function');

        expect(image.getImageDimensions).toBeDefined();
        expect(typeof image.getImageDimensions).toBe('function');
    });

    it('exports image validation functions', async () => {
        const image = await import('./index.js');

        // Validator exports
        expect(image.validateImageUrl).toBeDefined();
        expect(typeof image.validateImageUrl).toBe('function');

        expect(image.validateFileSize).toBeDefined();
        expect(typeof image.validateFileSize).toBe('function');

        expect(image.validateDimensions).toBeDefined();
        expect(typeof image.validateDimensions).toBe('function');

        expect(image.detectImageFormat).toBeDefined();
        expect(typeof image.detectImageFormat).toBe('function');

        expect(image.validateImageFormat).toBeDefined();
        expect(typeof image.validateImageFormat).toBe('function');

        expect(image.fetchImageWithTimeout).toBeDefined();
        expect(typeof image.fetchImageWithTimeout).toBe('function');

        expect(image.validateAndFetchImage).toBeDefined();
        expect(typeof image.validateAndFetchImage).toBe('function');
    });

    it('exports image constants', async () => {
        const image = await import('./index.js');

        expect(image.MAX_FILE_SIZE_BYTES).toBeDefined();
        expect(typeof image.MAX_FILE_SIZE_BYTES).toBe('number');

        expect(image.MAX_IMAGE_DIMENSION).toBeDefined();
        expect(typeof image.MAX_IMAGE_DIMENSION).toBe('number');

        expect(image.MAX_PIXEL_COUNT).toBeDefined();
        expect(typeof image.MAX_PIXEL_COUNT).toBe('number');

        expect(image.FETCH_TIMEOUT_MS).toBeDefined();
        expect(typeof image.FETCH_TIMEOUT_MS).toBe('number');
    });
});
