/**
 * Tests for Image Validators Service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    validateImageUrl,
    validateFileSize,
    validateDimensions,
    detectImageFormat,
    validateImageFormat,
    fetchImageWithTimeout,
    validateAndFetchImage,
    MAX_FILE_SIZE_BYTES,
    MAX_IMAGE_DIMENSION,
    MAX_PIXEL_COUNT,
    FETCH_TIMEOUT_MS,
} from './validators.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('validators.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Constants', () => {
        it('should have correct default values', () => {
            expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024); // 10MB
            expect(MAX_IMAGE_DIMENSION).toBe(4096);
            expect(MAX_PIXEL_COUNT).toBe(16 * 1024 * 1024); // 16MP
            expect(FETCH_TIMEOUT_MS).toBe(10000);
        });
    });

    // ==========================================================================
    // URL Validation Tests
    // ==========================================================================

    describe('validateImageUrl', () => {
        it('should reject empty or invalid URLs', () => {
            expect(validateImageUrl('')).toEqual({
                valid: false,
                error: 'No image URL provided',
            });

            expect(validateImageUrl(null as unknown as string)).toEqual({
                valid: false,
                error: 'No image URL provided',
            });

            expect(validateImageUrl(123 as unknown as string)).toEqual({
                valid: false,
                error: 'No image URL provided',
            });
        });

        it('should reject malformed URLs', () => {
            const result = validateImageUrl('not-a-url');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid URL format');
        });

        it('should reject non-HTTPS URLs', () => {
            const result = validateImageUrl('http://cdn.discordapp.com/attachments/123/456/image.png');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Only HTTPS URLs are allowed');
        });

        it('should reject non-Discord CDN URLs', () => {
            const result = validateImageUrl('https://example.com/image.png');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Only Discord CDN URLs are allowed for security');
        });

        it('should accept cdn.discordapp.com URLs', () => {
            const result = validateImageUrl('https://cdn.discordapp.com/attachments/123/456/image.png');
            expect(result.valid).toBe(true);
            expect(result.normalizedUrl).toBe('https://cdn.discordapp.com/attachments/123/456/image.png');
        });

        it('should accept media.discordapp.net URLs', () => {
            const result = validateImageUrl('https://media.discordapp.net/attachments/123/456/image.png');
            expect(result.valid).toBe(true);
        });

        it('should reject localhost URLs', () => {
            const result = validateImageUrl('https://localhost/image.png');
            expect(result.valid).toBe(false);
        });

        it('should reject private IP ranges', () => {
            expect(validateImageUrl('https://127.0.0.1/image.png').valid).toBe(false);
            expect(validateImageUrl('https://10.0.0.1/image.png').valid).toBe(false);
            expect(validateImageUrl('https://172.16.0.1/image.png').valid).toBe(false);
            expect(validateImageUrl('https://192.168.1.1/image.png').valid).toBe(false);
        });

        it('should reject IPv6 addresses', () => {
            expect(validateImageUrl('https://[::1]/image.png').valid).toBe(false);
            expect(validateImageUrl('https://[fe80::1]/image.png').valid).toBe(false);
            expect(validateImageUrl('https://[fc00::1]/image.png').valid).toBe(false);
        });

        it('should reject cloud metadata endpoints', () => {
            expect(validateImageUrl('https://169.254.169.254/image.png').valid).toBe(false);
            expect(validateImageUrl('https://metadata.google.internal/image.png').valid).toBe(false);
        });

        it('should reject 0.x.x.x IP ranges', () => {
            expect(validateImageUrl('https://0.0.0.1/image.png').valid).toBe(false);
        });

        it('should reject unique local IPv6 addresses (fd prefix)', () => {
            expect(validateImageUrl('https://[fd12::1]/image.png').valid).toBe(false);
        });

        it('should normalize URLs', () => {
            const result = validateImageUrl('https://cdn.discordapp.com/path/../attachments/image.png');
            expect(result.valid).toBe(true);
            expect(result.normalizedUrl).toBeDefined();
        });
    });

    // ==========================================================================
    // Size Validation Tests
    // ==========================================================================

    describe('validateFileSize', () => {
        it('should accept valid file sizes', () => {
            expect(validateFileSize(1024)).toBeUndefined();
            expect(validateFileSize(5 * 1024 * 1024)).toBeUndefined(); // 5MB
            expect(validateFileSize(MAX_FILE_SIZE_BYTES)).toBeUndefined(); // Exactly at limit
        });

        it('should reject empty files', () => {
            const result = validateFileSize(0);
            expect(result).toBe('Image file is empty');
        });

        it('should reject negative sizes', () => {
            const result = validateFileSize(-100);
            expect(result).toBe('Image file is empty');
        });

        it('should reject files over the size limit', () => {
            const result = validateFileSize(MAX_FILE_SIZE_BYTES + 1);
            expect(result).toContain('Image too large');
            expect(result).toContain('10MB');
        });

        it('should format size in the error message', () => {
            const result = validateFileSize(15 * 1024 * 1024); // 15MB
            expect(result).toContain('15.0MB');
        });
    });

    describe('validateDimensions', () => {
        it('should accept valid dimensions', () => {
            expect(validateDimensions(100, 100)).toBeUndefined();
            expect(validateDimensions(1920, 1080)).toBeUndefined();
            // 4000x4000 = 16MP exactly at limit
            expect(validateDimensions(4000, 4000)).toBeUndefined();
        });

        it('should reject zero or negative dimensions', () => {
            expect(validateDimensions(0, 100)).toBe('Image has invalid dimensions');
            expect(validateDimensions(100, 0)).toBe('Image has invalid dimensions');
            expect(validateDimensions(-1, 100)).toBe('Image has invalid dimensions');
            expect(validateDimensions(100, -1)).toBe('Image has invalid dimensions');
        });

        it('should reject dimensions exceeding limit', () => {
            const result = validateDimensions(MAX_IMAGE_DIMENSION + 1, 100);
            expect(result).toContain('Image too large');
            expect(result).toContain(`${MAX_IMAGE_DIMENSION}px`);
        });

        it('should reject height exceeding limit', () => {
            const result = validateDimensions(100, MAX_IMAGE_DIMENSION + 1);
            expect(result).toContain('Image too large');
        });

        it('should allow large dimensions within pixel count', () => {
            // 4096x3000 = 12.3 megapixels < 16 megapixels limit
            const result = validateDimensions(4096, 3000);
            expect(result).toBeUndefined();
        });

        // Note: With current constants (MAX_IMAGE_DIMENSION=4096, MAX_PIXEL_COUNT=16*1024*1024=16777216),
        // the max valid pixel count is 4096*4096=16777216 which exactly equals MAX_PIXEL_COUNT.
        // This makes the pixel count branch unreachable - dimension check always triggers first.
        // The tests below verify the dimension check behavior instead.

        it('should reject height exceeding dimension limit', () => {
            // 4097 > 4096, so dimension check triggers
            const result = validateDimensions(4096, 4097);
            expect(result).toContain('Image too large');
            expect(result).toContain('4096px');
        });

        it('should allow exactly at dimension limit', () => {
            // 4096x4096 is exactly at both limits
            const result = validateDimensions(4096, 4096);
            expect(result).toBeUndefined();
        });
    });

    // ==========================================================================
    // Format Detection Tests
    // ==========================================================================

    describe('detectImageFormat', () => {
        it('should detect PNG format', () => {
            const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
            expect(detectImageFormat(pngMagic)).toBe('png');
        });

        it('should detect JPEG format', () => {
            const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
            expect(detectImageFormat(jpegMagic)).toBe('jpeg');
        });

        it('should detect GIF format', () => {
            const gifMagic = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
            expect(detectImageFormat(gifMagic)).toBe('gif');
        });

        it('should detect WebP format', () => {
            // RIFF....WEBP
            const webpMagic = new Uint8Array([
                0x52, 0x49, 0x46, 0x46, // RIFF
                0, 0, 0, 0,             // size placeholder
                0x57, 0x45, 0x42, 0x50, // WEBP
            ]);
            expect(detectImageFormat(webpMagic)).toBe('webp');
        });

        it('should not detect RIFF without WEBP as WebP', () => {
            // RIFF but not WEBP (could be AVI, WAV, etc.)
            const riffNotWebp = new Uint8Array([
                0x52, 0x49, 0x46, 0x46, // RIFF
                0, 0, 0, 0,             // size placeholder
                0x41, 0x56, 0x49, 0x20, // AVI (not WEBP)
            ]);
            expect(detectImageFormat(riffNotWebp)).toBeUndefined();
        });

        it('should detect BMP format', () => {
            const bmpMagic = new Uint8Array([0x42, 0x4d, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            expect(detectImageFormat(bmpMagic)).toBe('bmp');
        });

        it('should return undefined for unknown formats', () => {
            const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0, 0, 0, 0]);
            expect(detectImageFormat(unknown)).toBeUndefined();
        });

        it('should return undefined for buffers too small', () => {
            const small = new Uint8Array([0x89, 0x50, 0x4e]);
            expect(detectImageFormat(small)).toBeUndefined();
        });
    });

    describe('validateImageFormat', () => {
        it('should return valid result for supported formats', () => {
            const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
            const result = validateImageFormat(pngMagic);

            expect(result.valid).toBe(true);
            expect(result.format).toBe('png');
        });

        it('should return invalid result for unsupported formats', () => {
            const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0, 0, 0, 0]);
            const result = validateImageFormat(unknown);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Unsupported image format');
        });
    });

    // ==========================================================================
    // Fetch Tests
    // ==========================================================================

    describe('fetchImageWithTimeout', () => {
        it('should fetch an image successfully', async () => {
            const mockBuffer = new Uint8Array([1, 2, 3, 4]);
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Headers({ 'Content-Length': '4' }),
                arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
            });

            const result = await fetchImageWithTimeout('https://cdn.discordapp.com/test.png');

            expect(result).toBeInstanceOf(Uint8Array);
            expect(result).toHaveLength(4);
        });

        it('should throw on non-OK response', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
            });

            await expect(fetchImageWithTimeout('https://cdn.discordapp.com/missing.png'))
                .rejects.toThrow('Failed to fetch image: HTTP 404');
        });

        it('should validate Content-Length header', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Headers({ 'Content-Length': `${MAX_FILE_SIZE_BYTES + 1}` }),
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            });

            await expect(fetchImageWithTimeout('https://cdn.discordapp.com/large.png'))
                .rejects.toThrow(/Image too large/);
        });

        it('should validate actual buffer size', async () => {
            // Content-Length says it's small, but actual content is large
            const largeBuffer = new ArrayBuffer(MAX_FILE_SIZE_BYTES + 1);
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Headers({ 'Content-Length': '100' }),
                arrayBuffer: () => Promise.resolve(largeBuffer),
            });

            await expect(fetchImageWithTimeout('https://cdn.discordapp.com/large.png'))
                .rejects.toThrow(/Image too large/);
        });

        it('should throw on timeout', async () => {
            // Create a promise that never resolves
            mockFetch.mockImplementation(() => {
                return new Promise((_, reject) => {
                    // This will be aborted
                    setTimeout(() => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), 100);
                });
            });

            const fetchPromise = fetchImageWithTimeout('https://cdn.discordapp.com/slow.png');

            // Advance timers to trigger timeout
            vi.advanceTimersByTime(FETCH_TIMEOUT_MS + 100);

            await expect(fetchPromise).rejects.toThrow('Image fetch timed out');
        });

        it('should include proper User-Agent header', async () => {
            const mockBuffer = new ArrayBuffer(4);
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Headers(),
                arrayBuffer: () => Promise.resolve(mockBuffer),
            });

            await fetchImageWithTimeout('https://cdn.discordapp.com/test.png');

            const calls = mockFetch.mock.calls;
            expect(calls[0][1].headers['User-Agent']).toBe('XIV Dye Tools Discord Bot/1.0');
        });

        it('should handle redirect to valid Discord CDN URL', async () => {
            const mockBuffer = new Uint8Array([1, 2, 3, 4]);

            // First call returns redirect
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 302,
                    headers: new Headers({ 'Location': 'https://cdn.discordapp.com/new-location.png' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Headers(),
                    arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
                });

            const result = await fetchImageWithTimeout('https://cdn.discordapp.com/test.png');
            expect(result).toBeInstanceOf(Uint8Array);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should reject redirect without Location header', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 302,
                headers: new Headers(), // No Location header
            });

            await expect(fetchImageWithTimeout('https://cdn.discordapp.com/test.png'))
                .rejects.toThrow('Redirect without Location header');
        });

        it('should reject redirect to unsafe URL', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 301,
                headers: new Headers({ 'Location': 'https://evil.com/malicious.png' }),
            });

            await expect(fetchImageWithTimeout('https://cdn.discordapp.com/test.png'))
                .rejects.toThrow('Unsafe redirect target');
        });

        it('should handle 304 redirect status', async () => {
            const mockBuffer = new Uint8Array([1, 2, 3, 4]);

            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 304,
                    headers: new Headers({ 'Location': 'https://media.discordapp.net/redirect.png' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    headers: new Headers(),
                    arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
                });

            const result = await fetchImageWithTimeout('https://cdn.discordapp.com/test.png');
            expect(result).toBeInstanceOf(Uint8Array);
        });

        it('should throw on redirect to private IP', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 302,
                headers: new Headers({ 'Location': 'https://192.168.1.1/image.png' }),
            });

            await expect(fetchImageWithTimeout('https://cdn.discordapp.com/test.png'))
                .rejects.toThrow('Unsafe redirect target');
        });

        it('should propagate non-abort errors', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(fetchImageWithTimeout('https://cdn.discordapp.com/test.png'))
                .rejects.toThrow('Network error');
        });

        it('should handle fetch without Content-Length header', async () => {
            const mockBuffer = new Uint8Array([1, 2, 3, 4]);
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Headers(), // No Content-Length
                arrayBuffer: () => Promise.resolve(mockBuffer.buffer),
            });

            const result = await fetchImageWithTimeout('https://cdn.discordapp.com/test.png');
            expect(result).toBeInstanceOf(Uint8Array);
        });
    });

    describe('validateAndFetchImage', () => {
        it('should validate URL and fetch image', async () => {
            const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Headers(),
                arrayBuffer: () => Promise.resolve(pngMagic.buffer),
            });

            const result = await validateAndFetchImage('https://cdn.discordapp.com/test.png');

            expect(result.buffer).toBeInstanceOf(Uint8Array);
            expect(result.format).toBe('png');
        });

        it('should reject invalid URLs', async () => {
            await expect(validateAndFetchImage('https://example.com/image.png'))
                .rejects.toThrow('Only Discord CDN URLs are allowed');
        });

        it('should reject unsupported formats', async () => {
            const unknownFormat = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0, 0, 0, 0]);
            mockFetch.mockResolvedValue({
                ok: true,
                headers: new Headers(),
                arrayBuffer: () => Promise.resolve(unknownFormat.buffer),
            });

            await expect(validateAndFetchImage('https://cdn.discordapp.com/unknown.dat'))
                .rejects.toThrow('Unsupported image format');
        });
    });
});
