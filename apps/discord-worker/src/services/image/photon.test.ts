/**
 * Tests for Photon image processing service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock PhotonImage instances
const createMockPhotonImage = (width = 100, height = 100) => ({
    get_width: () => width,
    get_height: () => height,
    get_raw_pixels: () => new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
    get_bytes: () => new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
    free: vi.fn(),
});

const mockPhotonImage = createMockPhotonImage();
const mockResizedImage = createMockPhotonImage(50, 50);

vi.mock('@cf-wasm/photon', () => ({
    PhotonImage: {
        new_from_byteslice: vi.fn(() => mockPhotonImage),
    },
    SamplingFilter: {
        Lanczos3: 0,
        Nearest: 1,
        Triangle: 2,
        CatmullRom: 3,
        Gaussian: 4,
        Mitchell: 5,
    },
    resize: vi.fn(() => mockResizedImage),
}));

// Import after mocks
import {
    loadImage,
    resizeImage,
    extractPixels,
    processImageForExtraction,
    getImageDimensions,
} from './photon.js';
import { PhotonImage, resize, SamplingFilter } from '@cf-wasm/photon';

describe('photon image processing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPhotonImage.free.mockClear();
        mockResizedImage.free.mockClear();
    });

    describe('loadImage', () => {
        it('loads image from buffer', () => {
            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
            const result = loadImage(buffer);

            expect(PhotonImage.new_from_byteslice).toHaveBeenCalledWith(buffer);
            expect(result).toBe(mockPhotonImage);
        });

        it('throws error for invalid image', () => {
            vi.mocked(PhotonImage.new_from_byteslice).mockImplementationOnce(() => {
                throw new Error('Invalid image format');
            });

            const buffer = new Uint8Array([0, 0, 0, 0]);
            expect(() => loadImage(buffer)).toThrow('Failed to load image');
        });

        it('wraps unknown errors', () => {
            vi.mocked(PhotonImage.new_from_byteslice).mockImplementationOnce(() => {
                // eslint-disable-next-line @typescript-eslint/only-throw-error -- testing unknown error wrapping
                throw 'string error';
            });

            const buffer = new Uint8Array([0, 0, 0, 0]);
            expect(() => loadImage(buffer)).toThrow('Failed to load image: Unknown error');
        });
    });

    describe('resizeImage', () => {
        it('resizes image when larger than max dimension', () => {
            const largeImage = createMockPhotonImage(500, 300);

            const result = resizeImage(largeImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>, 256);

            expect(resize).toHaveBeenCalled();
            expect(result).toBe(mockResizedImage);
        });

        it('returns copy when image is already smaller', () => {
            const smallImage = createMockPhotonImage(100, 100);

            resizeImage(smallImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>, 256);

            // Should create a new image from bytes (copy)
            expect(PhotonImage.new_from_byteslice).toHaveBeenCalled();
        });

        it('maintains aspect ratio for landscape images', () => {
            const landscapeImage = createMockPhotonImage(400, 200);

            resizeImage(landscapeImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>, 256);

            // Width should be 256, height should be 128 (ratio maintained)
            expect(resize).toHaveBeenCalledWith(
                expect.anything(),
                256,
                128,
                expect.anything()
            );
        });

        it('maintains aspect ratio for portrait images', () => {
            const portraitImage = createMockPhotonImage(200, 400);

            resizeImage(portraitImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>, 256);

            // Height should be 256, width should be 128 (ratio maintained)
            expect(resize).toHaveBeenCalledWith(
                expect.anything(),
                128,
                256,
                expect.anything()
            );
        });

        it('uses default max dimension of 256', () => {
            const largeImage = createMockPhotonImage(500, 500);

            resizeImage(largeImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>);

            expect(resize).toHaveBeenCalledWith(
                expect.anything(),
                256,
                256,
                expect.anything()
            );
        });

        it('uses custom sampling filter', () => {
            const largeImage = createMockPhotonImage(500, 500);

            resizeImage(
                largeImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>,
                256,
                SamplingFilter.Nearest
            );

            expect(resize).toHaveBeenCalledWith(
                expect.anything(),
                256,
                256,
                SamplingFilter.Nearest
            );
        });
    });

    describe('extractPixels', () => {
        it('extracts RGBA pixel data from image', () => {
            const result = extractPixels(mockPhotonImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>);

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('processImageForExtraction', () => {
        it('processes image and returns dimensions and pixels', async () => {
            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);

            const result = await processImageForExtraction(buffer);

            expect(result).toHaveProperty('pixels');
            expect(result).toHaveProperty('width');
            expect(result).toHaveProperty('height');
            expect(result.pixels).toBeInstanceOf(Uint8Array);
        });

        it('uses custom max dimension', async () => {
            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);

            await processImageForExtraction(buffer, { maxDimension: 128 });

            // Verify resize was called (if needed based on mock image size)
            expect(PhotonImage.new_from_byteslice).toHaveBeenCalled();
        });

        it('frees WASM memory after processing', async () => {
            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);

            await processImageForExtraction(buffer);

            // Should have freed the processed image (mockPhotonImage since size is 100x100 < 256)
            expect(mockPhotonImage.free).toHaveBeenCalled();
        });

        it('frees memory even on error', async () => {
            vi.mocked(PhotonImage.new_from_byteslice)
                .mockReturnValueOnce(mockPhotonImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>)
                .mockImplementationOnce(() => { throw new Error('Resize failed'); });

            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);

            try {
                await processImageForExtraction(buffer);
            } catch {
                // Expected to throw
            }

            // Should still have freed the original image
            expect(mockPhotonImage.free).toHaveBeenCalled();
        });
    });

    describe('getImageDimensions', () => {
        it('returns width and height', () => {
            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);

            const result = getImageDimensions(buffer);

            expect(result).toEqual({ width: 100, height: 100 });
        });

        it('frees image after getting dimensions', () => {
            const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);

            getImageDimensions(buffer);

            expect(mockPhotonImage.free).toHaveBeenCalled();
        });

        it('handles errors gracefully', () => {
            vi.mocked(PhotonImage.new_from_byteslice).mockImplementationOnce(() => {
                throw new Error('Invalid image');
            });

            const buffer = new Uint8Array([0, 0, 0, 0]);

            expect(() => getImageDimensions(buffer)).toThrow();
        });
    });
});
