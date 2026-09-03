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
const mockDismissTop = vi.fn();
/** Captures the route listener so a test can drive a navigation. */
const mockRouteUnsubscribe = vi.fn();
const mockRouteSubscribe = vi.fn().mockReturnValue(mockRouteUnsubscribe);
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastWarning = vi.fn();
const mockLoggerWarn = vi.fn();

const mockCameraService = {
  hasCameraAvailable: vi.fn().mockReturnValue(true),
  getAvailableCameras: vi.fn().mockReturnValue([]),
  startStream: vi.fn().mockResolvedValue(null),
  stopStream: vi.fn(),
  captureFrame: vi.fn().mockResolvedValue({ imageData: null }),
  // A fresh element per call: the modal attaches listeners to it, and a shared
  // one would accumulate them across tests.
  createVideoElement: vi.fn(() => makeVideo()),
  // Called by startCamera() once the stream resolves — absent from the mock
  // until the stream tests below needed it.
  attachStreamToVideo: vi.fn(),
  getTrackSettings: vi.fn().mockReturnValue(null),
};

/** jsdom has no media pipeline, so `play()` is stubbed rather than real. */
function makeVideo(): HTMLVideoElement {
  const video = document.createElement('video');
  video.play = vi.fn().mockResolvedValue(undefined);
  return video;
}

vi.mock('@services/index', () => ({
  ModalService: {
    show: mockShow,
    close: mockClose,
    dismissTop: mockDismissTop,
  },
  // BUG-080: the modal subscribes to route changes so navigating away stops
  // the camera. The unsubscribe it returns is released in cleanup().
  RouterService: {
    subscribe: mockRouteSubscribe,
  },
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}: ${Object.values(params).join('/')}`,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  cameraService: mockCameraService,
  ToastService: {
    show: vi.fn(),
    error: mockToastError,
    success: mockToastSuccess,
    warning: mockToastWarning,
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
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('showCameraPreviewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` drops recorded calls but keeps implementations, so every
    // per-test `mockReturnValue` below has to be put back or it leaks forward.
    mockCameraService.hasCameraAvailable.mockReturnValue(true);
    mockCameraService.getAvailableCameras.mockReturnValue([]);
    mockCameraService.startStream.mockResolvedValue(null);
    mockCameraService.captureFrame.mockResolvedValue({ imageData: null });
    mockCameraService.getTrackSettings.mockReturnValue(null);
    mockCameraService.createVideoElement.mockImplementation(() => makeVideo());
    mockShow.mockReturnValue('modal-id-camera');
    mockRouteSubscribe.mockReturnValue(mockRouteUnsubscribe);
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
  // Navigation teardown (BUG-080)
  // ============================================================================

  describe('navigating away', () => {
    /**
     * BUG-080: closing the modal stops the stream, but in-app navigation never
     * closed the modal — the router swapped the tool underneath it and the
     * camera stayed live, recording indicator and all, over the new tool.
     */
    it('dismisses the modal when the route changes', async () => {
      const { showCameraPreviewModal } = await import('../camera-preview-modal');
      await showCameraPreviewModal(vi.fn());

      expect(mockRouteSubscribe).toHaveBeenCalled();
      const onRouteChange = mockRouteSubscribe.mock.calls[0][0] as () => void;
      onRouteChange();

      expect(mockDismissTop).toHaveBeenCalled();
    });

    it('releases the route subscription when the modal closes', async () => {
      const { showCameraPreviewModal } = await import('../camera-preview-modal');
      await showCameraPreviewModal(vi.fn());

      const onClose = mockShow.mock.calls.at(-1)?.[0]?.onClose as (() => void) | undefined;
      onClose?.();

      expect(mockRouteUnsubscribe).toHaveBeenCalled();
      expect(mockCameraService.stopStream).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Modal shell, controls and the camera picker
  // ============================================================================

  /** The content element handed to ModalService.show. */
  function content(): HTMLElement {
    return mockShow.mock.calls.at(-1)![0].content as HTMLElement;
  }
  const q = <T extends HTMLElement>(sel: string): T => content().querySelector<T>(sel)!;
  const captureBtn = (): HTMLButtonElement => q<HTMLButtonElement>('#camera-capture-btn');
  const cancelBtn = (): HTMLButtonElement =>
    [...content().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.id !== 'camera-capture-btn'
    )!;
  const overlay = (): HTMLElement => q('#camera-loading-overlay');
  const statusText = (): HTMLElement => q('span.text-sm');
  const video = (): HTMLVideoElement =>
    mockCameraService.createVideoElement.mock.results.at(-1)!.value as HTMLVideoElement;

  async function open(onCapture = vi.fn()): Promise<void> {
    const { showCameraPreviewModal } = await import('../camera-preview-modal');
    await showCameraPreviewModal(onCapture);
  }

  describe('modal shell', () => {
    it('opens full-height and refuses to close on a backdrop tap', async () => {
      // A live MediaStream is the one thing an accidental backdrop tap must
      // not leave running, so this modal opts out of closeOnBackdrop.
      await open();

      const cfg = mockShow.mock.calls.at(-1)![0];
      expect(cfg.type).toBe('custom');
      expect(cfg.title).toBe('camera.title');
      expect(cfg.sheetHeight).toBe('full');
      expect(cfg.closable).toBe(true);
      expect(cfg.closeOnEscape).toBe(true);
      expect(cfg.closeOnBackdrop).toBe(false);
    });

    it('warns instead of opening when there is no camera', async () => {
      mockCameraService.hasCameraAvailable.mockReturnValue(false);

      await open();

      expect(mockToastWarning).toHaveBeenCalledWith('camera.notAvailable');
    });

    it('starts with capture disabled and the spinner up', async () => {
      await open();

      expect(captureBtn().disabled).toBe(true);
      expect(overlay()).not.toBeNull();
      expect(statusText().textContent).toBe('camera.initializing');
    });

    it('shows the instructions and the privacy notice', async () => {
      await open();

      const text = content().textContent!;
      expect(text).toContain('camera.instructions');
      expect(text).toContain('camera.privacyNotice');
    });
  });

  describe('camera picker', () => {
    it('is absent with a single camera', async () => {
      mockCameraService.getAvailableCameras.mockReturnValue([{ deviceId: 'a', label: 'Front' }]);

      await open();

      expect(content().querySelector('#camera-selector')).toBeNull();
    });

    it('lists every camera when there is more than one', async () => {
      mockCameraService.getAvailableCameras.mockReturnValue([
        { deviceId: 'a', label: 'Front' },
        { deviceId: 'b', label: 'Rear' },
      ]);

      await open();

      const options = [...q<HTMLSelectElement>('#camera-selector').options];
      expect(options.map((o) => o.value)).toEqual(['a', 'b']);
      expect(options.map((o) => o.textContent)).toEqual(['Front', 'Rear']);
    });

    it('numbers a camera the browser refuses to name', async () => {
      mockCameraService.getAvailableCameras.mockReturnValue([
        { deviceId: 'a', label: '' },
        { deviceId: 'b', label: '' },
      ]);

      await open();

      const options = [...q<HTMLSelectElement>('#camera-selector').options];
      expect(options.map((o) => o.textContent)).toEqual([
        'camera.deviceFallback: 1',
        'camera.deviceFallback: 2',
      ]);
    });

    it('restarts the stream on the newly picked device', async () => {
      mockCameraService.getAvailableCameras.mockReturnValue([
        { deviceId: 'a', label: 'Front' },
        { deviceId: 'b', label: 'Rear' },
      ]);
      await open();
      const selector = q<HTMLSelectElement>('#camera-selector');
      selector.value = 'b';

      selector.dispatchEvent(new Event('change'));

      expect(statusText().textContent).toBe('camera.switching');
      expect(captureBtn().disabled).toBe(true);
      await vi.waitFor(() => expect(mockCameraService.startStream).toHaveBeenCalledWith('b'));
      // The old stream is released before the new one opens.
      expect(mockCameraService.stopStream).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Starting the stream
  // ============================================================================

  describe('starting the stream', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockCameraService.startStream.mockResolvedValue({ id: 'stream' });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Open, then let the 100ms post-show start timer fire. */
    async function openAndStart(): Promise<void> {
      await open();
      await vi.advanceTimersByTimeAsync(100);
    }

    it('waits for the modal to be on screen before opening the camera', async () => {
      await open();
      expect(mockCameraService.startStream).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);

      expect(mockCameraService.startStream).toHaveBeenCalled();
    });

    it('attaches the stream to the video element', async () => {
      await openAndStart();

      expect(mockCameraService.attachStreamToVideo).toHaveBeenCalledWith(video(), {
        id: 'stream',
      });
    });

    it('plays the feed once the metadata lands', async () => {
      await openAndStart();

      video().dispatchEvent(new Event('loadedmetadata'));

      expect(video().play).toHaveBeenCalled();
    });

    it('logs, rather than throws, when playback is refused', async () => {
      await openAndStart();
      (video().play as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('autoplay blocked'));

      video().dispatchEvent(new Event('loadedmetadata'));

      await vi.waitFor(() => expect(mockLoggerWarn).toHaveBeenCalled());
    });

    it('reveals the feed and enables capture once it is playing', async () => {
      mockCameraService.getTrackSettings.mockReturnValue({ width: 1280, height: 720 });
      await openAndStart();

      video().dispatchEvent(new Event('playing'));

      expect(overlay().style.display).toBe('none');
      expect(captureBtn().disabled).toBe(false);
      expect(statusText().textContent).toBe('1280×720');
    });

    it('falls back to a generic ready status when the track reports no size', async () => {
      mockCameraService.getTrackSettings.mockReturnValue(null);
      await openAndStart();

      video().dispatchEvent(new Event('playing'));

      expect(statusText().textContent).toBe('camera.ready');
    });

    it('explains a denied permission in place of the feed', async () => {
      mockCameraService.startStream.mockRejectedValue(new Error('NotAllowedError'));
      await openAndStart();

      expect(overlay().textContent).toContain('camera.permissionDenied');
      expect(overlay().textContent).toContain('camera.checkPermissions');
      expect(statusText().textContent).toBe('camera.error');
      expect(captureBtn().disabled).toBe(true);
    });

    it('releases a stream that arrives after the modal was closed', async () => {
      let resolveStream: (v: unknown) => void = () => {};
      mockCameraService.startStream.mockReturnValue(
        new Promise((resolve) => {
          resolveStream = resolve;
        })
      );
      await open();
      await vi.advanceTimersByTimeAsync(100);

      // User closes while permission is still being negotiated.
      (mockShow.mock.calls.at(-1)![0].onClose as () => void)();
      resolveStream({ id: 'late' });
      await vi.waitFor(() => expect(mockCameraService.stopStream).toHaveBeenCalled());

      expect(mockCameraService.attachStreamToVideo).not.toHaveBeenCalled();
    });

    it('cancels the pending start when the modal closes first', async () => {
      await open();

      (mockShow.mock.calls.at(-1)![0].onClose as () => void)();
      await vi.advanceTimersByTimeAsync(500);

      expect(mockCameraService.startStream).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Capture and cancel
  // ============================================================================

  describe('capturing', () => {
    /**
     * Open, run the stream up to the point the feed is playing, and return the
     * now-enabled capture button. Clicking it while still disabled is a no-op,
     * which is the behaviour asserted in `modal shell` — here we want the
     * armed state, reached the same way the real flow reaches it.
     */
    async function openReady(onCapture = vi.fn()): Promise<void> {
      mockCameraService.startStream.mockResolvedValue({ id: 'stream' });
      vi.useFakeTimers();
      await open(onCapture);
      await vi.advanceTimersByTimeAsync(100);
      video().dispatchEvent(new Event('playing'));
      vi.useRealTimers();
      expect(captureBtn().disabled).toBe(false);
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('hands the frame to the caller, then tears the camera down', async () => {
      const frame = { imageData: 'DATA' };
      mockCameraService.captureFrame.mockResolvedValue(frame);
      const onCapture = vi.fn();
      await openReady(onCapture);
      mockCameraService.stopStream.mockClear();

      captureBtn().click();
      await vi.waitFor(() => expect(onCapture).toHaveBeenCalled());

      expect(mockCameraService.captureFrame).toHaveBeenCalledWith(video());
      expect(onCapture).toHaveBeenCalledWith(frame);
      expect(mockCameraService.stopStream).toHaveBeenCalled();
      expect(mockDismissTop).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith('camera.captured');
    });

    it('re-arms the button when the capture fails', async () => {
      mockCameraService.captureFrame.mockRejectedValue(new Error('no frame'));
      const onCapture = vi.fn();
      await openReady(onCapture);

      captureBtn().click();
      await vi.waitFor(() => expect(mockToastError).toHaveBeenCalled());

      expect(mockToastError).toHaveBeenCalledWith('camera.captureFailed');
      expect(onCapture).not.toHaveBeenCalled();
      expect(captureBtn().disabled).toBe(false);
      expect(captureBtn().textContent).toContain('camera.capture');
      // A failed capture must not close the modal — the user gets another go.
      expect(mockDismissTop).not.toHaveBeenCalled();
    });

    it('stops the camera and closes on cancel, without capturing', async () => {
      const onCapture = vi.fn();
      await open(onCapture);

      cancelBtn().click();

      expect(mockCameraService.stopStream).toHaveBeenCalled();
      expect(mockDismissTop).toHaveBeenCalled();
      expect(mockCameraService.captureFrame).not.toHaveBeenCalled();
      expect(onCapture).not.toHaveBeenCalled();
    });

    it('stops responding to navigation once cancelled', async () => {
      await open();
      cancelBtn().click();
      mockDismissTop.mockClear();

      // cleanup() released the route subscription, so a later route change is
      // no longer this modal's business.
      const onRouteChange = mockRouteSubscribe.mock.calls.at(-1)![0] as () => void;
      onRouteChange();

      expect(mockDismissTop).not.toHaveBeenCalled();
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
