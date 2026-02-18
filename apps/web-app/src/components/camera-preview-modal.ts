/**
 * XIV Dye Tools v2.0.0 - Camera Preview Modal Component
 *
 * Phase 4: Advanced Features (T7)
 * Modal for live webcam preview and frame capture
 *
 * @module components/camera-preview-modal
 */

import { ModalService, LanguageService, cameraService, ToastService } from '@services/index';
import type { CaptureResult } from '@services/camera-service';
import { logger } from '@shared/logger';
import { ICON_CAMERA } from '@shared/ui-icons';

/**
 * Callback when a frame is captured
 */
export type OnCaptureCallback = (result: CaptureResult) => void;

/**
 * Show the camera preview modal with live webcam feed
 */
export async function showCameraPreviewModal(onCapture: OnCaptureCallback): Promise<void> {
  // Check if camera is available
  if (!cameraService.hasCameraAvailable()) {
    ToastService.warning(LanguageService.t('camera.notAvailable'));
    return;
  }

  const content = document.createElement('div');
  content.className = 'camera-preview-modal space-y-4';

  // Status indicator
  const statusBar = document.createElement('div');
  statusBar.className =
    'flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-lg';

  const statusText = document.createElement('span');
  statusText.className = 'text-sm text-gray-600 dark:text-gray-400';
  statusText.textContent = LanguageService.t('camera.initializing');
  statusBar.appendChild(statusText);

  // Camera selector (if multiple cameras)
  const cameras = cameraService.getAvailableCameras();
  if (cameras.length > 1) {
    const selector = document.createElement('select');
    selector.className =
      'text-sm px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white';
    selector.id = 'camera-selector';

    cameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label || `Camera ${index + 1}`;
      selector.appendChild(option);
    });

    statusBar.appendChild(selector);
  }

  content.appendChild(statusBar);

  // Video preview container
  const previewContainer = document.createElement('div');
  previewContainer.className =
    'relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden';

  // Video element
  const video = cameraService.createVideoElement();
  video.className = 'w-full h-full object-contain';
  video.id = 'camera-preview-video';
  previewContainer.appendChild(video);

  // Loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'absolute inset-0 flex items-center justify-center bg-gray-900';
  loadingOverlay.id = 'camera-loading-overlay';

  const loadingSpinner = document.createElement('div');
  loadingSpinner.className =
    'w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin';
  loadingOverlay.appendChild(loadingSpinner);

  previewContainer.appendChild(loadingOverlay);

  content.appendChild(previewContainer);

  // Instructions
  const instructions = document.createElement('p');
  instructions.className = 'text-sm text-gray-600 dark:text-gray-400 text-center';
  instructions.textContent =
    LanguageService.t('camera.instructions');
  content.appendChild(instructions);

  // Privacy notice
  const privacyNotice = document.createElement('p');
  privacyNotice.className = 'text-xs text-center opacity-60 mt-1';
  privacyNotice.textContent =
    LanguageService.t('camera.privacyNotice');
  content.appendChild(privacyNotice);

  // Action buttons
  const buttons = document.createElement('div');
  buttons.className = 'flex justify-center gap-3';

  // Capture button - inline SVG for theme color inheritance
  const captureBtn = document.createElement('button');
  captureBtn.className =
    'px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2';
  captureBtn.innerHTML = `<span class="w-5 h-5" aria-hidden="true">${ICON_CAMERA}</span> ${LanguageService.t('camera.capture')}`;
  captureBtn.disabled = true;
  captureBtn.id = 'camera-capture-btn';
  buttons.appendChild(captureBtn);

  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className =
    'px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium';
  cancelBtn.textContent = LanguageService.t('common.cancel');
  buttons.appendChild(cancelBtn);

  content.appendChild(buttons);

  // Track if modal is still open
  let isModalOpen = true;

  // Store event handler references for cleanup
  let videoLoadedHandler: (() => void) | null = null;
  let videoPlayingHandler: (() => void) | null = null;
  let captureClickHandler: (() => Promise<void>) | null = null;
  let cancelClickHandler: (() => void) | null = null;
  let selectorChangeHandler: (() => void) | null = null;
  let startCameraTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Cleanup function to remove all event listeners and timers
  const cleanup = (): void => {
    // Clear pending camera start timeout
    if (startCameraTimeoutId !== null) {
      clearTimeout(startCameraTimeoutId);
      startCameraTimeoutId = null;
    }
    if (videoLoadedHandler) {
      video.removeEventListener('loadedmetadata', videoLoadedHandler);
      videoLoadedHandler = null;
    }
    if (videoPlayingHandler) {
      video.removeEventListener('playing', videoPlayingHandler);
      videoPlayingHandler = null;
    }
    if (captureClickHandler) {
      captureBtn.removeEventListener('click', captureClickHandler as EventListener);
      captureClickHandler = null;
    }
    if (cancelClickHandler) {
      cancelBtn.removeEventListener('click', cancelClickHandler);
      cancelClickHandler = null;
    }
    if (selectorChangeHandler && selector) {
      selector.removeEventListener('change', selectorChangeHandler);
      selectorChangeHandler = null;
    }
  };

  // Start the camera
  const startCamera = async (deviceId?: string): Promise<void> => {
    try {
      const stream = await cameraService.startStream(deviceId);

      if (!isModalOpen) {
        // Modal was closed while waiting
        cameraService.stopStream();
        return;
      }

      cameraService.attachStreamToVideo(video, stream);

      // Clean up existing handlers before adding new ones
      if (videoLoadedHandler) {
        video.removeEventListener('loadedmetadata', videoLoadedHandler);
      }
      if (videoPlayingHandler) {
        video.removeEventListener('playing', videoPlayingHandler);
      }

      // Wait for video to be ready
      videoLoadedHandler = () => {
        video.play().catch((err) => {
          logger.warn('Video play failed:', err);
        });
      };
      video.addEventListener('loadedmetadata', videoLoadedHandler);

      videoPlayingHandler = () => {
        // Hide loading overlay
        loadingOverlay.style.display = 'none';

        // Enable capture button
        captureBtn.disabled = false;

        // Update status
        const settings = cameraService.getTrackSettings();
        if (settings) {
          statusText.textContent = `${settings.width}×${settings.height}`;
        } else {
          statusText.textContent = LanguageService.t('camera.ready');
        }
      };
      video.addEventListener('playing', videoPlayingHandler);
    } catch (error) {
      logger.error('Failed to start camera:', error);

      // Show error in modal
      loadingOverlay.innerHTML = `
        <div class="text-center text-white">
          <div class="text-4xl mb-2">📷</div>
          <div class="text-sm">${LanguageService.t('camera.permissionDenied')}</div>
          <div class="text-xs text-gray-400 mt-1">${LanguageService.t('camera.checkPermissions')}</div>
        </div>
      `;

      statusText.textContent = LanguageService.t('camera.error');
    }
  };

  // Handle capture
  captureClickHandler = async () => {
    try {
      captureBtn.disabled = true;
      captureBtn.textContent = LanguageService.t('camera.capturing');

      const result = await cameraService.captureFrame(video);

      // Stop stream and close modal
      cameraService.stopStream();
      cleanup();
      ModalService.dismissTop();
      isModalOpen = false;

      // Callback with result
      onCapture(result);

      ToastService.success(LanguageService.t('camera.captured'));
    } catch (error) {
      logger.error('Capture failed:', error);
      ToastService.error(LanguageService.t('camera.captureFailed'));
      captureBtn.disabled = false;
      captureBtn.innerHTML = `<span class="w-5 h-5" aria-hidden="true">${ICON_CAMERA}</span> ${LanguageService.t('camera.capture')}`;
    }
  };
  captureBtn.addEventListener('click', captureClickHandler as EventListener);

  // Handle cancel
  cancelClickHandler = () => {
    cameraService.stopStream();
    cleanup();
    ModalService.dismissTop();
    isModalOpen = false;
  };
  cancelBtn.addEventListener('click', cancelClickHandler);

  // BUG-006 FIX: Serialize camera operations to prevent race conditions
  let cameraOperationPromise: Promise<void> = Promise.resolve();

  // Handle camera selector change
  const selector = content.querySelector('#camera-selector') as HTMLSelectElement | null;
  if (selector) {
    selectorChangeHandler = () => {
      // Reset UI
      loadingOverlay.style.display = 'flex';
      loadingOverlay.innerHTML = '';
      const spinner = document.createElement('div');
      spinner.className =
        'w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin';
      loadingOverlay.appendChild(spinner);

      captureBtn.disabled = true;
      statusText.textContent = LanguageService.t('camera.switching');

      // BUG-006: Serialize camera operations with promise queue
      cameraOperationPromise = cameraOperationPromise
        .then(() => {
          cameraService.stopStream();
          return startCamera(selector.value);
        })
        .catch((error) => {
          logger.error('Camera switch error:', error);
        });
    };
    selector.addEventListener('change', selectorChangeHandler);
  }

  // Show modal
  ModalService.show({
    type: 'custom',
    title: LanguageService.t('camera.title'),
    content,
    size: 'lg',
    onClose: () => {
      // Cleanup on modal close
      cleanup();
      cameraService.stopStream();
      isModalOpen = false;
    },
  });

  // Start camera after modal is displayed (with cancellable timeout)
  startCameraTimeoutId = setTimeout(() => {
    if (isModalOpen) {
      void startCamera();
    }
    startCameraTimeoutId = null;
  }, 100);
}
