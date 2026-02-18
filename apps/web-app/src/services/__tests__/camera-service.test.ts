/**
 * Camera Service Tests
 *
 * Tests for camera detection, stream management, and frame capture
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CameraService, cameraService as defaultCameraService } from '../camera-service';

describe('CameraService', () => {
  let cameraService: CameraService;
  let mockStream: any;
  let mockTrack: any;
  let mockMediaDevices: any;
  let originalMediaDevices: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Save original
    originalMediaDevices = navigator.mediaDevices;

    // Create mock track
    mockTrack = {
      id: 'track-1',
      kind: 'video',
      label: 'Camera Track',
      enabled: true,
      muted: false,
      readyState: 'live',
      stop: vi.fn(),
      getSettings: vi.fn().mockReturnValue({
        width: 1280,
        height: 720,
        frameRate: 30,
        deviceId: 'camera-1',
      }),
    };

    // Create mock stream
    mockStream = {
      id: 'stream-1',
      active: true,
      getTracks: vi.fn().mockReturnValue([mockTrack]),
      getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      getAudioTracks: vi.fn().mockReturnValue([]),
    };

    // Create mock MediaDevices
    mockMediaDevices = {
      enumerateDevices: vi.fn().mockResolvedValue([
        { deviceId: 'camera-1', kind: 'videoinput', label: 'Front Camera', groupId: 'group-1' },
        { deviceId: 'camera-2', kind: 'videoinput', label: 'Back Camera', groupId: 'group-2' },
        { deviceId: 'mic-1', kind: 'audioinput', label: 'Microphone', groupId: 'group-3' },
      ]),
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Set up navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mockMediaDevices,
      writable: true,
      configurable: true,
    });

    // Get a fresh instance (reset the singleton)
    // @ts-ignore - accessing private static for testing
    CameraService.instance = null;
    cameraService = CameraService.getInstance();
  });

  afterEach(() => {
    cameraService.destroy();
    // Restore original
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = CameraService.getInstance();
      const instance2 = CameraService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export default singleton instance', () => {
      expect(defaultCameraService).toBeDefined();
    });
  });

  describe('isCameraSupported', () => {
    it('should return true when mediaDevices is available', () => {
      expect(cameraService.isCameraSupported()).toBe(true);
    });

    it('should return false when mediaDevices is not available', () => {
      // @ts-ignore - reset singleton
      CameraService.instance = null;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const service = CameraService.getInstance();
      expect(service.isCameraSupported()).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should detect available cameras', async () => {
      await cameraService.initialize();

      const cameras = cameraService.getAvailableCameras();
      expect(cameras.length).toBe(2);
      expect(cameras[0].deviceId).toBe('camera-1');
      expect(cameras[1].deviceId).toBe('camera-2');
    });

    it('should not re-enumerate if already initialized', async () => {
      await cameraService.initialize();
      await cameraService.initialize();

      expect(mockMediaDevices.enumerateDevices).toHaveBeenCalledTimes(1);
    });

    it('should not enumerate when not supported', async () => {
      // @ts-ignore - reset singleton
      CameraService.instance = null;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const service = CameraService.getInstance();
      await service.initialize();

      expect(service.getAvailableCameras()).toEqual([]);
    });
  });

  describe('hasCameraAvailable', () => {
    it('should return false before initialization', () => {
      expect(cameraService.hasCameraAvailable()).toBe(false);
    });

    it('should return true when cameras are detected', async () => {
      await cameraService.initialize();
      expect(cameraService.hasCameraAvailable()).toBe(true);
    });

    it('should return false when no cameras', async () => {
      mockMediaDevices.enumerateDevices.mockResolvedValue([]);
      await cameraService.initialize();
      expect(cameraService.hasCameraAvailable()).toBe(false);
    });
  });

  describe('getAvailableCameras', () => {
    it('should return empty array before initialization', () => {
      expect(cameraService.getAvailableCameras()).toEqual([]);
    });

    it('should return a copy of available cameras', async () => {
      await cameraService.initialize();

      const cameras = cameraService.getAvailableCameras();
      expect(cameras.length).toBe(2);
      expect(cameras[0].deviceId).toBe('camera-1');
      expect(cameras[0].label).toBe('Front Camera');
    });
  });

  describe('onCameraAvailabilityChange', () => {
    it('should subscribe to camera availability changes', async () => {
      const listener = vi.fn();
      cameraService.onCameraAvailabilityChange(listener);

      await cameraService.initialize();

      expect(listener).toHaveBeenCalledWith(true);
    });

    it('should unsubscribe correctly', async () => {
      const listener = vi.fn();
      const unsubscribe = cameraService.onCameraAvailabilityChange(listener);
      unsubscribe();

      await cameraService.initialize();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('requestPermission', () => {
    it('should return false when not supported', async () => {
      // @ts-ignore - reset singleton
      CameraService.instance = null;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const service = CameraService.getInstance();
      const result = await service.requestPermission();
      expect(result).toBe(false);
    });

    it('should request camera permission', async () => {
      const result = await cameraService.requestPermission();

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { facingMode: 'environment' },
      });
      expect(result).toBe(true);
    });

    it('should stop the temporary stream after permission', async () => {
      await cameraService.requestPermission();

      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('should return false when permission denied', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

      const result = await cameraService.requestPermission();
      expect(result).toBe(false);
    });
  });

  describe('startStream', () => {
    it('should throw when camera not supported', async () => {
      // @ts-ignore - reset singleton
      CameraService.instance = null;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const service = CameraService.getInstance();

      await expect(service.startStream()).rejects.toThrow(
        'Camera API is not supported in this browser'
      );
    });

    it('should start a camera stream with default settings', async () => {
      const stream = await cameraService.startStream();

      expect(stream).toBeDefined();
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should start stream with specific device ID', async () => {
      await cameraService.startStream('camera-2');

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { deviceId: { exact: 'camera-2' } },
        audio: false,
      });
    });

    it('should stop previous stream when starting new one', async () => {
      await cameraService.startStream();
      mockTrack.stop.mockClear();
      await cameraService.startStream();

      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('should throw when getUserMedia fails', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Camera in use'));

      await expect(cameraService.startStream()).rejects.toThrow('Camera in use');
    });
  });

  describe('getCurrentStream', () => {
    it('should return null when no stream is active', () => {
      expect(cameraService.getCurrentStream()).toBeNull();
    });

    it('should return current stream when active', async () => {
      await cameraService.startStream();
      expect(cameraService.getCurrentStream()).toBe(mockStream);
    });
  });

  describe('stopStream', () => {
    it('should stop all tracks in the stream', async () => {
      await cameraService.startStream();
      cameraService.stopStream();

      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('should set current stream to null', async () => {
      await cameraService.startStream();
      cameraService.stopStream();

      expect(cameraService.getCurrentStream()).toBeNull();
    });

    it('should do nothing when no stream', () => {
      cameraService.stopStream();
      expect(cameraService.getCurrentStream()).toBeNull();
    });
  });

  describe('isStreamActive', () => {
    it('should return false when no stream', () => {
      expect(cameraService.isStreamActive()).toBe(false);
    });

    it('should return true when stream is active', async () => {
      await cameraService.startStream();
      expect(cameraService.isStreamActive()).toBe(true);
    });

    it('should return false when stream is not active', async () => {
      mockStream.active = false;
      await cameraService.startStream();
      expect(cameraService.isStreamActive()).toBe(false);
    });
  });

  describe('captureFrame', () => {
    it('should reject when video is not ready', async () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { value: 0 });
      Object.defineProperty(video, 'videoHeight', { value: 0 });

      await expect(cameraService.captureFrame(video)).rejects.toThrow(
        'Video not ready for capture'
      );
    });

    it('should reject when canvas context fails', async () => {
      const video = document.createElement('video');
      Object.defineProperty(video, 'videoWidth', { value: 640 });
      Object.defineProperty(video, 'videoHeight', { value: 480 });

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: vi.fn().mockReturnValue(null),
          } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
      });

      await expect(cameraService.captureFrame(video)).rejects.toThrow(
        'Failed to get canvas context'
      );
    });
  });

  describe('createVideoElement', () => {
    it('should create video element with correct attributes', () => {
      const video = cameraService.createVideoElement();

      expect(video.tagName).toBe('VIDEO');
      expect(video.autoplay).toBe(true);
      expect(video.playsInline).toBe(true);
      expect(video.muted).toBe(true);
    });
  });

  describe('attachStreamToVideo', () => {
    it('should set video srcObject to stream', async () => {
      const video = document.createElement('video');
      await cameraService.startStream();

      cameraService.attachStreamToVideo(video, mockStream);

      expect(video.srcObject).toBe(mockStream);
    });
  });

  describe('detachStreamFromVideo', () => {
    it('should set video srcObject to null', () => {
      const video = document.createElement('video');
      video.srcObject = mockStream;

      cameraService.detachStreamFromVideo(video);

      expect(video.srcObject).toBeNull();
    });
  });

  describe('getTrackSettings', () => {
    it('should return null when no stream', () => {
      expect(cameraService.getTrackSettings()).toBeNull();
    });

    it('should return track settings when stream is active', async () => {
      await cameraService.startStream();

      const settings = cameraService.getTrackSettings();
      expect(settings).toEqual({
        width: 1280,
        height: 720,
        frameRate: 30,
        deviceId: 'camera-1',
      });
    });

    it('should return null when stream has no video tracks', async () => {
      mockStream.getVideoTracks.mockReturnValue([]);
      await cameraService.startStream();

      expect(cameraService.getTrackSettings()).toBeNull();
    });
  });

  describe('startDeviceChangeListener', () => {
    it('should add device change event listener', () => {
      cameraService.startDeviceChangeListener();

      expect(mockMediaDevices.addEventListener).toHaveBeenCalledWith(
        'devicechange',
        expect.any(Function)
      );
    });

    it('should not add listener when not supported', () => {
      // @ts-ignore - reset singleton
      CameraService.instance = null;

      Object.defineProperty(navigator, 'mediaDevices', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const service = CameraService.getInstance();
      // Should not throw
      expect(() => service.startDeviceChangeListener()).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('should stop stream and clear listeners', async () => {
      const listener = vi.fn();
      cameraService.onCameraAvailabilityChange(listener);
      await cameraService.startStream();

      cameraService.destroy();

      expect(cameraService.getCurrentStream()).toBeNull();
    });
  });
});
