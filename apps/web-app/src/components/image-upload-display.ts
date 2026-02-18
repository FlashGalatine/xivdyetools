/**
 * XIV Dye Tools v2.0.0 - Image Upload Display Component
 *
 * Phase 12: Architecture Refactor
 * Handles image upload via drag-drop, file input, and clipboard paste
 *
 * @module components/image-upload-display
 */

import { BaseComponent } from './base-component';
import { LanguageService, cameraService } from '@services/index';
import { showCameraPreviewModal } from './camera-preview-modal';
import { clearContainer } from '@shared/utils';
import { ICON_UPLOAD, ICON_CAMERA, ICON_HINT, ICON_LOCK } from '@shared/ui-icons';

/**
 * Image Upload Display Component
 * Provides multiple ways to upload images for color matching
 */
export class ImageUploadDisplay extends BaseComponent {
  private uploadedImage: HTMLImageElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isDragging: boolean = false;

  constructor(container: HTMLElement) {
    super(container);
  }

  /**
   * Render the component
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    // Title
    const title = this.createElement('h3', {
      textContent: LanguageService.t('matcher.uploadImage'),
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
    });
    wrapper.appendChild(title);

    // Drop zone
    const dropZone = this.createElement('div', {
      id: 'image-drop-zone',
      className:
        'relative w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors',
    });

    const dropContent = this.createElement('div', {
      className: 'space-y-3',
    });

    // Upload icon - inline SVG for theme color inheritance
    const icon = this.createElement('span', {
      className: 'w-8 h-8 inline-block mx-auto',
      attributes: {
        'aria-hidden': 'true',
      },
    });
    icon.innerHTML = ICON_UPLOAD;

    const text = this.createElement('div', {
      className: 'space-y-1',
    });

    const mainText = this.createElement('div', {
      textContent: LanguageService.t('matcher.dragDrop'),
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
    });

    const subText = this.createElement('div', {
      textContent: LanguageService.t('matcher.orClickSelect'),
      className: 'text-sm text-gray-600 dark:text-gray-400',
    });

    text.appendChild(mainText);
    text.appendChild(subText);

    const fileInput = this.createElement('input', {
      attributes: {
        type: 'file',
        accept: 'image/*',
        id: 'image-file-input',
      },
      className: 'hidden',
    });

    const cameraInput = this.createElement('input', {
      attributes: {
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        id: 'camera-file-input',
      },
      className: 'hidden',
    });

    const cameraBtn = this.createElement('button', {
      innerHTML: `<span class="inline-block w-5 h-5 mr-1" aria-hidden="true">${ICON_CAMERA}</span> ${LanguageService.t('matcher.takePhoto')}`,
      className:
        'mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium md:hidden',
      attributes: {
        type: 'button',
        'aria-label': LanguageService.t('matcher.takePhoto'),
      },
    });

    // Stop propagation to prevent triggering the drop zone click
    cameraBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cameraInput.click();
    });

    // Desktop webcam button (T7) - visible when camera detected, hidden on mobile
    const desktopCameraBtn = this.createElement('button', {
      innerHTML: `<span class="inline-block w-5 h-5 mr-1" aria-hidden="true">${ICON_CAMERA}</span> ${LanguageService.t('camera.useWebcam')}`,
      className:
        'btn-theme-primary mt-3 px-4 py-2 rounded-lg transition-colors text-sm font-medium hidden md:inline-flex items-center',
      attributes: {
        type: 'button',
        id: 'desktop-camera-btn',
        'aria-label': LanguageService.t('camera.useWebcam'),
      },
    });

    // Only show if camera is available
    if (!cameraService.hasCameraAvailable()) {
      desktopCameraBtn.style.display = 'none';
    }

    // Stop propagation to prevent triggering the drop zone click
    desktopCameraBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openCameraPreview();
    });

    dropContent.appendChild(icon);
    dropContent.appendChild(text);
    dropContent.appendChild(cameraBtn);
    dropContent.appendChild(desktopCameraBtn);
    dropZone.appendChild(dropContent);
    dropZone.appendChild(fileInput);
    dropZone.appendChild(cameraInput);
    wrapper.appendChild(dropZone);

    // Privacy notice for camera uploads (mobile)
    // Built programmatically to avoid innerHTML with translation strings (security)
    const privacyNotice = this.createElement('div', {
      className: 'mt-3 p-3 rounded-lg border text-xs md:hidden',
      attributes: {
        style: `
          background-color: color-mix(in srgb, var(--theme-primary) 5%, var(--theme-background));
          border-color: color-mix(in srgb, var(--theme-primary) 20%, var(--theme-border));
          color: var(--theme-text);
        `,
      },
    });
    // Lock icon
    const lockIcon = this.createElement('span', {
      className: 'inline-block w-4 h-4 align-middle mr-1',
      innerHTML: ICON_LOCK,
    });
    privacyNotice.appendChild(lockIcon);
    // Strong title
    const privacyTitle = this.createElement('strong', {
      textContent: `${LanguageService.t('matcher.privacyTitle')}:`,
    });
    privacyNotice.appendChild(privacyTitle);
    // Message text
    const privacyMessage = document.createTextNode(
      ` ${LanguageService.t('matcher.privacyMessage')} `
    );
    privacyNotice.appendChild(privacyMessage);
    // Learn more link (hardcoded URL is safe, only text is translated)
    const privacyLink = this.createElement('a', {
      textContent: LanguageService.t('matcher.privacyLearnMore'),
      className: 'underline font-semibold',
      attributes: {
        href: 'https://github.com/FlashGalatine/xivdyetools-web-app/blob/main/docs/PRIVACY.md',
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    });
    privacyNotice.appendChild(privacyLink);
    wrapper.appendChild(privacyNotice);

    // Info text
    const info = this.createElement('p', {
      textContent: LanguageService.t('matcher.supportedFormatsWithSize'),
      className: 'text-xs text-gray-500 dark:text-gray-400 text-center',
    });
    wrapper.appendChild(info);

    // Keyboard shortcut hint (theme-aware)
    const shortcut = this.createElement('div', {
      innerHTML: `<span class="inline-block w-4 h-4 mr-1" aria-hidden="true">${ICON_HINT}</span> ${LanguageService.t('matcher.pasteHint')}`,
      className: 'p-2 rounded text-xs border',
      attributes: {
        style: `
          background-color: color-mix(in srgb, var(--theme-primary) 10%, var(--theme-background));
          color: var(--theme-primary);
          border-color: color-mix(in srgb, var(--theme-primary) 30%, var(--theme-border));
        `,
      },
    });
    wrapper.appendChild(shortcut);

    // Canvas for image display (hidden, used internally)
    this.canvas = this.createElement('canvas', {
      attributes: {
        id: 'image-canvas',
      },
      className: 'hidden',
    });
    wrapper.appendChild(this.canvas);

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    const dropZone = this.querySelector<HTMLElement>('#image-drop-zone');
    const fileInput = this.querySelector<HTMLInputElement>('#image-file-input');

    if (dropZone) {
      // Drag and drop
      this.on(dropZone, 'dragover', (e: Event) => {
        e.preventDefault();
        dropZone.classList.add(
          'border-blue-500',
          'dark:border-blue-400',
          'bg-blue-50',
          'dark:bg-blue-900/10'
        );
        this.isDragging = true;
      });

      this.on(dropZone, 'dragleave', () => {
        dropZone.classList.remove(
          'border-blue-500',
          'dark:border-blue-400',
          'bg-blue-50',
          'dark:bg-blue-900/10'
        );
        this.isDragging = false;
      });

      this.on(dropZone, 'drop', (e: Event) => {
        e.preventDefault();
        dropZone.classList.remove(
          'border-blue-500',
          'dark:border-blue-400',
          'bg-blue-50',
          'dark:bg-blue-900/10'
        );
        this.isDragging = false;

        const dragEvent = e as DragEvent;
        if (dragEvent.dataTransfer?.files) {
          this.handleFiles(dragEvent.dataTransfer.files);
        }
      });

      // Click to select file
      this.on(dropZone, 'click', () => {
        fileInput?.click();
      });
    }

    // File input change
    if (fileInput) {
      this.on(fileInput, 'change', () => {
        if (fileInput.files) {
          this.handleFiles(fileInput.files);
        }
      });
    }

    // Camera input change
    const cameraInput = this.querySelector<HTMLInputElement>('#camera-file-input');
    if (cameraInput) {
      this.on(cameraInput, 'change', () => {
        if (cameraInput.files) {
          this.handleFiles(cameraInput.files);
        }
      });
    }

    // Paste from clipboard
    this.on(document, 'paste', (e: Event) => {
      const pasteEvent = e as ClipboardEvent;
      const items = pasteEvent.clipboardData?.items;

      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            pasteEvent.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
              this.handleFiles([blob] as unknown as FileList);
            }
          }
        }
      }
    });
  }

  /**
   * Handle file selection
   */
  private handleFiles(files: FileList | File[]): void {
    const file = files instanceof FileList ? files[0] : files[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.emit('error', { message: LanguageService.t('errors.pleaseSelectImageFile') });
      return;
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      this.emit('error', { message: LanguageService.t('errors.imageTooLarge') });
      return;
    }

    // Read file
    const reader = new FileReader();

    reader.onload = (event: ProgressEvent<FileReader>) => {
      const dataUrl = event.target?.result as string;

      if (!dataUrl) {
        this.emit('error', { message: LanguageService.t('errors.failedToReadImage') });
        // BUG-016: Clear handler to release memory
        reader.onload = null;
        reader.onerror = null;
        return;
      }

      // Create image element
      const img = new Image();

      img.onload = () => {
        this.uploadedImage = img;
        this.emit('image-loaded', { image: img, dataUrl });
        // BUG-016: Clear handlers after successful load
        img.onload = null;
        img.onerror = null;
        reader.onload = null;
        reader.onerror = null;
      };

      img.onerror = () => {
        this.emit('error', { message: LanguageService.t('errors.imageLoadFailed') });
        // BUG-016: Clear handlers on error
        img.onload = null;
        img.onerror = null;
        reader.onload = null;
        reader.onerror = null;
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      this.emit('error', { message: LanguageService.t('errors.failedToReadFile') });
      // BUG-016: Clear handlers on error
      reader.onload = null;
      reader.onerror = null;
    };

    reader.readAsDataURL(file);
  }

  /**
   * Get uploaded image
   */
  getImage(): HTMLImageElement | null {
    return this.uploadedImage;
  }

  /**
   * Get image data as canvas
   */
  getImageCanvas(): HTMLCanvasElement | null {
    if (!this.uploadedImage || !this.canvas) return null;

    this.canvas.width = this.uploadedImage.width;
    this.canvas.height = this.uploadedImage.height;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(this.uploadedImage, 0, 0);

    return this.canvas;
  }

  /**
   * Sample pixel color from image
   * BUG-011 FIX: Added guard for zero-sized canvas edge case
   */
  samplePixel(x: number, y: number): string | null {
    const canvas = this.getImageCanvas();
    if (!canvas) return null;

    // BUG-011: Guard against zero-sized canvas
    if (canvas.width === 0 || canvas.height === 0) return null;

    // Clamp coordinates to canvas bounds
    const clampedX = Math.min(Math.max(0, Math.floor(x)), canvas.width - 1);
    const clampedY = Math.min(Math.max(0, Math.floor(y)), canvas.height - 1);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(clampedX, clampedY, 1, 1);
    const data = imageData.data;

    // Convert RGBA to hex
    const hex = `#${((data[0] << 16) | (data[1] << 8) | data[2]).toString(16).padStart(6, '0').toUpperCase()}`;

    return hex;
  }

  /**
   * Get average color of region
   * BUG-011 FIX: Added guard for zero-sized canvas edge case
   */
  getAverageColor(x: number, y: number, size: number = 1): string | null {
    const canvas = this.getImageCanvas();
    if (!canvas) return null;

    // BUG-011: Guard against zero-sized canvas
    if (canvas.width === 0 || canvas.height === 0) return null;

    // Clamp region to canvas bounds
    const startX = Math.max(0, Math.floor(x - size / 2));
    const startY = Math.max(0, Math.floor(y - size / 2));
    const width = Math.min(size, canvas.width - startX);
    const height = Math.min(size, canvas.height - startY);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.getImageData(startX, startY, width, height);
    const data = imageData.data;

    let r = 0,
      g = 0,
      b = 0,
      count = 0;

    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      // Skip alpha channel
      count++;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase()}`;

    return hex;
  }

  /**
   * Get image dimensions
   */
  getImageDimensions(): { width: number; height: number } | null {
    if (!this.uploadedImage) return null;

    return {
      width: this.uploadedImage.width,
      height: this.uploadedImage.height,
    };
  }

  /**
   * Clear uploaded image
   */
  clear(): void {
    this.uploadedImage = null;
    this.update();
  }

  /**
   * Open camera preview modal for webcam capture (T7)
   */
  private openCameraPreview(): void {
    void showCameraPreviewModal((result) => {
      // Convert capture result to same format as file upload
      this.uploadedImage = result.image;
      this.emit('image-loaded', { image: result.image, dataUrl: result.dataUrl });
    });
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      hasImage: this.uploadedImage !== null,
      imageDimensions: this.uploadedImage
        ? { width: this.uploadedImage.width, height: this.uploadedImage.height }
        : null,
    };
  }
}
