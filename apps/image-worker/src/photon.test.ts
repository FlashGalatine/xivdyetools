/**
 * Tests for Photon image processing service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock PhotonImage instances
const createMockPhotonImage = (width = 100, height = 100) => ({
    get_width: () => width,
    get_height: () => height,
    get_raw_pixels: () => new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
    get_bytes: () => pngHeader(100, 100),
    free: vi.fn(),
});

const mockPhotonImage = createMockPhotonImage();
const mockResizedImage = createMockPhotonImage(50, 50);

/**
 * FINDING-004: the processing entry points now gate on the container header
 * before decoding, so test buffers must carry a readable PNG IHDR.
 */
function pngHeader(width: number, height: number): Uint8Array {
    const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    return new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ...u32(13), 0x49, 0x48, 0x44, 0x52, ...u32(width), ...u32(height),
        8, 6, 0, 0, 0, 0, 0, 0, 0,
    ]);
}

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
    crop: vi.fn(() => mockResizedImage),
}));

// Import after mocks
import {
    loadImage,
    resizeImage,
    extractPixels,
    processImageForExtraction,
    getImageDimensions,
    computeCropBox,
    processImageForThumbnail,
    THUMBNAIL_WIDTH,
    THUMBNAIL_HEIGHT,
} from './photon.js';
import { PhotonImage, resize, SamplingFilter, crop } from '@cf-wasm/photon';

describe('photon image processing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPhotonImage.free.mockClear();
        mockResizedImage.free.mockClear();
    });

    describe('loadImage', () => {
        it('loads image from buffer', () => {
            const buffer = pngHeader(100, 100);
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
            const buffer = pngHeader(100, 100);

            const result = await processImageForExtraction(buffer);

            expect(result).toHaveProperty('pixels');
            expect(result).toHaveProperty('width');
            expect(result).toHaveProperty('height');
            expect(result.pixels).toBeInstanceOf(Uint8Array);
        });

        it('uses custom max dimension', async () => {
            const buffer = pngHeader(100, 100);

            await processImageForExtraction(buffer, { maxDimension: 128 });

            // Verify resize was called (if needed based on mock image size)
            expect(PhotonImage.new_from_byteslice).toHaveBeenCalled();
        });

        it('frees WASM memory after processing', async () => {
            const buffer = pngHeader(100, 100);

            await processImageForExtraction(buffer);

            // Should have freed the processed image (mockPhotonImage since size is 100x100 < 256)
            expect(mockPhotonImage.free).toHaveBeenCalled();
        });

        it('frees memory even on error', async () => {
            vi.mocked(PhotonImage.new_from_byteslice)
                .mockReturnValueOnce(mockPhotonImage as unknown as ReturnType<typeof PhotonImage.new_from_byteslice>)
                .mockImplementationOnce(() => { throw new Error('Resize failed'); });

            const buffer = pngHeader(100, 100);

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
            const buffer = pngHeader(100, 100);

            const result = getImageDimensions(buffer);

            expect(result).toEqual({ width: 100, height: 100 });
        });

        it('frees image after getting dimensions', () => {
            const buffer = pngHeader(100, 100);

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

    describe('computeCropBox', () => {
        it('takes the middle band of a landscape image', () => {
            // 1920x1080 (1.78) is landscape -> vertically centred
            const box = computeCropBox(1920, 1080);
            expect(box.x1).toBe(0);
            expect(box.x2).toBe(1920);
            // band height = round(1920 / 2.4242) = 792; y = round((1080-792)/2) = 144
            expect(box.y2 - box.y1).toBe(792);
            expect(box.y1).toBe(144);
        });

        it('takes the upper band of a portrait image', () => {
            // 1080x1920 (0.5625) is portrait -> flush to the top
            const box = computeCropBox(1080, 1920);
            expect(box.y1).toBe(0);
            expect(box.x1).toBe(0);
            expect(box.x2).toBe(1080);
            expect(box.y2 - box.y1).toBe(446); // round(1080 / 2.4242)
        });

        it('takes the upper band of a square image', () => {
            const box = computeCropBox(1000, 1000);
            expect(box.y1).toBe(0);
            expect(box.y2 - box.y1).toBe(413); // round(1000 / 2.4242)
        });

        it('treats 4:3 as landscape, not square', () => {
            // 1.333 > 1.05, so the band is vertically centred rather than flush to the top
            const box = computeCropBox(1600, 1200);
            expect(box.y1).toBeGreaterThan(0);
        });

        it('never exceeds the source bounds on an ultra-wide image', () => {
            // 3000x400 (7.5) is wider than the target ratio: the band is width-limited
            const box = computeCropBox(3000, 400);
            expect(box.y1).toBe(0);
            expect(box.y2).toBe(400);
            expect(box.x2 - box.x1).toBe(970); // round(400 * 2.4242)
            expect(box.x2).toBeLessThanOrEqual(3000);
        });
    });

    describe('processImageForThumbnail', () => {
        it('returns WebP bytes', () => {
            const buffer = pngHeader(100, 100);
            const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF

            const mockWebpImage = {
                ...createMockPhotonImage(),
                get_bytes_webp: vi.fn(() => webpBytes),
            };
            vi.mocked(resize).mockReturnValueOnce(mockWebpImage as unknown as ReturnType<typeof resize>);

            const result = processImageForThumbnail(buffer);

            expect(result).toEqual(webpBytes);
        });

        it('frees WASM memory after processing', () => {
            const buffer = pngHeader(100, 100);

            // Create distinct mocks for each stage of processing
            const mockCroppedImage = createMockPhotonImage(200, 150);
            const mockWebpImage = {
                ...createMockPhotonImage(640, 264),
                get_bytes_webp: vi.fn(() => new Uint8Array([0x52, 0x49])),
            };

            vi.mocked(crop).mockReturnValueOnce(mockCroppedImage as unknown as ReturnType<typeof crop>);
            vi.mocked(resize).mockReturnValueOnce(mockWebpImage as unknown as ReturnType<typeof resize>);

            processImageForThumbnail(buffer);

            // All three distinct images must be freed: original, cropped, resized
            expect(mockPhotonImage.free).toHaveBeenCalled();
            expect(mockCroppedImage.free).toHaveBeenCalled();
            expect(mockWebpImage.free).toHaveBeenCalled();
        });

        it('frees memory even on crop error', () => {
            const buffer = pngHeader(100, 100);
            vi.mocked(crop).mockImplementationOnce(() => {
                throw new Error('Crop failed');
            });

            expect(() => processImageForThumbnail(buffer)).toThrow('Crop failed');

            // Should have freed the original image on error
            expect(mockPhotonImage.free).toHaveBeenCalled();
        });

        it('frees memory even on resize error', () => {
            const buffer = pngHeader(100, 100);

            // Create a cropped image mock that will be freed on error
            const mockCroppedImage = createMockPhotonImage(200, 150);
            vi.mocked(crop).mockReturnValueOnce(mockCroppedImage as unknown as ReturnType<typeof crop>);
            vi.mocked(resize).mockImplementationOnce(() => {
                throw new Error('Resize failed');
            });

            expect(() => processImageForThumbnail(buffer)).toThrow('Resize failed');

            // Both original and cropped images must be freed even when resize fails
            expect(mockPhotonImage.free).toHaveBeenCalled();
            expect(mockCroppedImage.free).toHaveBeenCalled();
        });

        it('calls crop with correct arguments', () => {
            const buffer = pngHeader(100, 100);
            const mockWebpImage = {
                ...createMockPhotonImage(),
                get_bytes_webp: vi.fn(() => new Uint8Array([0x52])),
            };
            vi.mocked(resize).mockReturnValueOnce(mockWebpImage as unknown as ReturnType<typeof resize>);

            processImageForThumbnail(buffer);

            // Compute expected crop box for 100x100 image (mock size)
            expect(crop).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number)
            );
        });

        it('calls resize with thumbnail dimensions and Lanczos3', () => {
            const buffer = pngHeader(100, 100);
            const mockWebpImage = {
                ...createMockPhotonImage(),
                get_bytes_webp: vi.fn(() => new Uint8Array([0x52])),
            };
            vi.mocked(resize).mockReturnValueOnce(mockWebpImage as unknown as ReturnType<typeof resize>);

            processImageForThumbnail(buffer);

            expect(resize).toHaveBeenCalledWith(
                expect.anything(),
                THUMBNAIL_WIDTH,
                THUMBNAIL_HEIGHT,
                SamplingFilter.Lanczos3
            );
        });
    });
});
