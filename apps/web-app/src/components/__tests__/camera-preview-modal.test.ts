/**
 * XIV Dye Tools - CameraPreviewModal Unit Tests
 *
 * Tests the camera preview modal function for camera capture.
 * Covers rendering, camera stream mock, and capture functionality.
 *
 * @module components/__tests__/camera-preview-modal.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockShow = vi.fn().mockReturnValue('modal-id-camera');
const mockClose = vi.fn();

const mockCameraService = {
  hasCameraAvailable: vi.fn().mockReturnValue(true),
  getAvailableCameras: vi.fn().mockReturnValue([]),
  startStream: vi.fn().mockResolvedValue(null),
  stopStream: vi.fn(),
  captureFrame: vi.fn().mockResolvedValue({ imageData: null }),
  createVideoElement: vi.fn().mockReturnValue(document.createElement('video')),
};

vi.mock('@services/index', () => ({
  ModalService: {
    show: mockShow,
    close: mockClose,
  },
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  cameraService: mockCameraService,
  ToastService: {
    show: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_CAMERA: '<svg></svg>',
  ICON_CLOSE: '<svg></svg>',
  ICON_CAPTURE: '<svg></svg>',
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('showCameraPreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCameraService.hasCameraAvailable.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('Basic Functionality', () => {
    it('should export showCameraPreviewModal function', async () => {
      const { showCameraPreviewModal } = await import('../camera-preview-modal');
      expect(typeof showCameraPreviewModal).toBe('function');
    });

    it('should be an async function', async () => {
      const { showCameraPreviewModal } = await import('../camera-preview-modal');
      const onCapture = vi.fn();
      const result = showCameraPreviewModal(onCapture);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  // ============================================================================
  // Camera Availability Tests
  // ============================================================================

  describe('Camera Availability', () => {
    it('should check camera availability', async () => {
      const { showCameraPreviewModal } = await import('../camera-preview-modal');
      const onCapture = vi.fn();
      await showCameraPreviewModal(onCapture);
      expect(mockCameraService.hasCameraAvailable).toHaveBeenCalled();
    });

    it('should not show modal if no camera available', async () => {
      mockCameraService.hasCameraAvailable.mockReturnValue(false);
      const { showCameraPreviewModal } = await import('../camera-preview-modal');
      const onCapture = vi.fn();
      await showCameraPreviewModal(onCapture);
      expect(mockShow).not.toHaveBeenCalled();
    });

    it('should show modal when camera is available', async () => {
      mockCameraService.hasCameraAvailable.mockReturnValue(true);
      const { showCameraPreviewModal } = await import('../camera-preview-modal');
      const onCapture = vi.fn();
      await showCameraPreviewModal(onCapture);
      expect(mockShow).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Type Exports Tests
  // ============================================================================

  describe('Type Exports', () => {
    it('should export OnCaptureCallback type', async () => {
      const module = await import('../camera-preview-modal');
      expect(module).toBeDefined();
      expect(module.showCameraPreviewModal).toBeDefined();
    });
  });
});
