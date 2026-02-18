/**
 * XIV Dye Tools v2.0.0 - Camera Service
 *
 * Phase 4: Advanced Features (T7)
 * Handles webcam detection, stream management, and frame capture
 *
 * @module services/camera-service
 */

import { logger } from '@shared/logger';

/**
 * Camera device information
 */
export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

/**
 * Camera capture result
 */
export interface CaptureResult {
  image: HTMLImageElement;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Camera Service
 * Manages webcam detection, video streams, and frame capture
 */
export class CameraService {
  private static instance: CameraService | null = null;
  private availableCameras: CameraDevice[] = [];
  private currentStream: MediaStream | null = null;
  private hasEnumerated: boolean = false;
  private isSupported: boolean = false;
  private listeners: Set<(available: boolean) => void> = new Set();
  private deviceChangeHandler: (() => Promise<void>) | null = null;

  private constructor() {
    // Check for basic support
    this.isSupported = !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.enumerateDevices === 'function' &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): CameraService {
    if (!CameraService.instance) {
      CameraService.instance = new CameraService();
    }
    return CameraService.instance;
  }

  /**
   * Initialize and detect available cameras
   * Call this on app startup or when needed
   * BUG-010 FIX: Added forceRetry parameter for explicit retry after failure
   */
  async initialize(forceRetry: boolean = false): Promise<void> {
    if ((this.hasEnumerated && !forceRetry) || !this.isSupported) return;

    try {
      await this.enumerateCameras();
      this.hasEnumerated = true;
      logger.info(
        `📷 Camera service initialized: ${this.availableCameras.length} camera(s) detected`
      );
    } catch (error) {
      // BUG-010: Ensure hasEnumerated stays false on failure so retry is possible
      this.hasEnumerated = false;
      logger.warn('Camera enumeration failed:', error);
      throw error; // Re-throw to let callers know about the failure
    }
  }

  /**
   * Enumerate available video input devices
   */
  private async enumerateCameras(): Promise<void> {
    if (!this.isSupported) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableCameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${this.availableCameras.length + 1}`,
          groupId: device.groupId,
        }));

      // Notify listeners
      const hasCamera = this.availableCameras.length > 0;
      this.listeners.forEach((listener) => listener(hasCamera));
    } catch (error) {
      logger.error('Failed to enumerate cameras:', error);
      this.availableCameras = [];
    }
  }

  /**
   * Check if camera API is supported
   */
  isCameraSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Check if at least one camera is available
   */
  hasCameraAvailable(): boolean {
    return this.isSupported && this.availableCameras.length > 0;
  }

  /**
   * Get list of available cameras
   */
  getAvailableCameras(): CameraDevice[] {
    return [...this.availableCameras];
  }

  /**
   * Subscribe to camera availability changes
   */
  onCameraAvailabilityChange(listener: (available: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Request camera permissions and refresh device list
   * This is needed because device labels are only available after permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      // Request permission by getting a temporary stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      // Stop the temporary stream
      stream.getTracks().forEach((track) => track.stop());

      // Re-enumerate to get proper labels
      await this.enumerateCameras();

      return true;
    } catch (error) {
      logger.warn('Camera permission denied or failed:', error);
      return false;
    }
  }

  /**
   * Start camera stream with specified device or default
   */
  async startStream(deviceId?: string): Promise<MediaStream> {
    if (!this.isSupported) {
      throw new Error('Camera API is not supported in this browser');
    }

    // Stop any existing stream
    this.stopStream();

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: 'environment', // Prefer back camera on mobile
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      };

      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Re-enumerate after getting permission (labels become available)
      if (!this.hasEnumerated || this.availableCameras.some((c) => !c.label)) {
        await this.enumerateCameras();
      }

      logger.info('📷 Camera stream started');
      return this.currentStream;
    } catch (error) {
      logger.error('Failed to start camera stream:', error);
      throw error;
    }
  }

  /**
   * Get the current active stream
   */
  getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  /**
   * Stop the current camera stream
   */
  stopStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => {
        track.stop();
        logger.debug('📷 Camera track stopped:', track.label);
      });
      this.currentStream = null;
      logger.info('📷 Camera stream stopped');
    }
  }

  /**
   * Check if a stream is currently active
   */
  isStreamActive(): boolean {
    return this.currentStream !== null && this.currentStream.active;
  }

  /**
   * Capture a frame from a video element
   */
  captureFrame(video: HTMLVideoElement): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      if (!video.videoWidth || !video.videoHeight) {
        reject(new Error('Video not ready for capture'));
        return;
      }

      // Create canvas at video resolution
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      // Create image element
      const image = new Image();

      image.onload = () => {
        resolve({
          image,
          dataUrl,
          width: canvas.width,
          height: canvas.height,
        });
      };

      image.onerror = () => {
        reject(new Error('Failed to create image from capture'));
      };

      image.src = dataUrl;
    });
  }

  /**
   * Create a video element configured for camera preview
   */
  createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true; // Required for iOS
    video.muted = true; // Required for autoplay
    video.setAttribute('playsinline', ''); // iOS Safari
    return video;
  }

  /**
   * Attach stream to video element
   */
  attachStreamToVideo(video: HTMLVideoElement, stream: MediaStream): void {
    video.srcObject = stream;
  }

  /**
   * Detach stream from video element
   */
  detachStreamFromVideo(video: HTMLVideoElement): void {
    video.srcObject = null;
  }

  /**
   * Get camera stream video track settings
   */
  getTrackSettings(): MediaTrackSettings | null {
    if (!this.currentStream) return null;

    const videoTrack = this.currentStream.getVideoTracks()[0];
    if (!videoTrack) return null;

    return videoTrack.getSettings();
  }

  /**
   * Listen for device changes (camera connected/disconnected)
   */
  startDeviceChangeListener(): void {
    if (!this.isSupported) return;

    // Prevent duplicate listeners
    if (this.deviceChangeHandler) return;

    this.deviceChangeHandler = async () => {
      logger.info('📷 Device change detected, re-enumerating cameras');
      await this.enumerateCameras();
    };

    navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
  }

  /**
   * Stop listening for device changes
   */
  stopDeviceChangeListener(): void {
    if (this.deviceChangeHandler) {
      navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
      this.deviceChangeHandler = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopStream();
    this.stopDeviceChangeListener();
    this.listeners.clear();
  }
}

// Export singleton instance
export const cameraService = CameraService.getInstance();
