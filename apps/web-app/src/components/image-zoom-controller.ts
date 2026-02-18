/**
 * XIV Dye Tools v2.0.0 - Image Zoom Controller
 *
 * Phase 3: Architecture Refactor
 * Handles image zooming, panning, and sampling interactions
 *
 * @module components/image-zoom-controller
 */

import { BaseComponent } from './base-component';
import { LanguageService } from '@services/language-service';
import { ICON_ZOOM_FIT, ICON_ZOOM_WIDTH } from '@shared/ui-icons';
import { clearContainer } from '@shared/utils';

export interface ImageZoomControllerOptions {
  onColorSampled?: (hex: string, x: number, y: number) => void;
}

export class ImageZoomController extends BaseComponent {
  private currentImage: HTMLImageElement | null = null;
  private zoomLevel: number = 100;
  private canvasRef: HTMLCanvasElement | null = null;
  private canvasContainerRef: HTMLElement | null = null;
  private onColorSampled?: (hex: string, x: number, y: number) => void;

  // UI Elements
  private zoomDisplay: HTMLElement | null = null;
  private zoomOutBtn: HTMLButtonElement | null = null;
  private zoomInBtn: HTMLButtonElement | null = null;

  // Track whether image should be centered (set by fit-to-screen)
  private isCentered: boolean = false;

  // Drag threshold for click vs drag differentiation (in pixels)
  private dragThreshold: number = 5;

  // Store zoom control functions for public access
  private updateZoomFn: ((newZoom: number, setCenter?: boolean) => void) | null = null;
  private getContainerDimensionsFn: (() => { width: number; height: number }) | null = null;

  constructor(container: HTMLElement, options: ImageZoomControllerOptions = {}) {
    super(container);
    this.onColorSampled = options.onColorSampled;
  }

  renderContent(): void {
    // Container is expected to be provided by parent
    // We will append our controls and canvas to it
    this.container.classList.add('space-y-4');
  }

  bindEvents(): void {
    // Events are bound when elements are created in setImage
  }

  /**
   * Set the image to display and initialize controls
   */
  setImage(image: HTMLImageElement): void {
    this.currentImage = image;
    this.zoomLevel = 100;

    clearContainer(this.container);

    // Create canvas container for scrolling
    // overflow: hidden ensures zoomed image is clipped within this container
    this.canvasContainerRef = this.createElement('div', {
      className:
        'w-full h-full overflow-hidden bg-gray-50 dark:bg-gray-900',
      attributes: {
        id: 'canvas-container',
        style: 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; overflow: hidden;',
      },
    });

    // Create canvas for image display
    this.canvasRef = this.createElement('canvas', {
      className: 'cursor-crosshair block',
      attributes: {
        width: String(image.width),
        height: String(image.height),
      },
    });

    const ctx = this.canvasRef.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0);
    }

    this.canvasContainerRef.appendChild(this.canvasRef);
    this.container.appendChild(this.canvasContainerRef);

    // Create zoom controls container (Overlay)
    // Inline styles ensure visibility even if CSS class isn't applied
    const zoomControls = this.createElement('div', {
      className: 'zoom-controls',
      attributes: {
        style: `
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          display: flex;
          align-items: center;
          padding: 4px;
          gap: 4px;
          z-index: 100;
        `.replace(/\s+/g, ' ').trim(),
      },
    });

    // Common button styles
    const btnStyle = `
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      border-radius: 4px;
      color: #a0a0a0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    `.replace(/\s+/g, ' ').trim();

    const svgStyle = 'width: 16px; height: 16px; fill: currentColor;';

    // Fit to Screen button
    const fitBtn = this.createElement('button', {
      className: 'zoom-btn',
      innerHTML: `<svg viewBox="0 0 24 24" style="${svgStyle}"><path d="M4 4h16v16H4V4zm2 2v12h12V6H6z" /></svg>`,
      attributes: {
        title: LanguageService.t('matcher.zoomFit'),
        type: 'button',
        style: btnStyle,
      },
    });
    zoomControls.appendChild(fitBtn);

    // Fit Width button
    const widthBtn = this.createElement('button', {
      className: 'zoom-btn',
      innerHTML: `<svg viewBox="0 0 24 24" style="${svgStyle}"><path d="M21 4H3v16h18V4zm-2 14H5V6h14v12z" /><path d="M12 7l-3 3h2v4H9l3 3 3-3h-2V10h2l-3-3z" /></svg>`,
      attributes: {
        title: LanguageService.t('matcher.zoomWidth'),
        type: 'button',
        style: btnStyle,
      },
    });
    zoomControls.appendChild(widthBtn);

    // Separator
    const separatorStyle = 'width: 1px; height: 20px; background: rgba(255, 255, 255, 0.2);';
    zoomControls.appendChild(this.createElement('div', {
      className: 'zoom-separator',
      attributes: { style: separatorStyle },
    }));

    // Zoom out button
    this.zoomOutBtn = this.createElement('button', {
      className: 'zoom-btn',
      innerHTML: `<svg viewBox="0 0 24 24" style="${svgStyle}"><path d="M19 13H5v-2h14v2z" /></svg>`,
      attributes: {
        title: 'Zoom Out',
        type: 'button',
        style: btnStyle,
      },
    });
    zoomControls.appendChild(this.zoomOutBtn);

    // Zoom level display - Wrapper button for styling consistency
    const zoomDisplayBtn = this.createElement('button', {
      className: 'zoom-btn',
      attributes: {
        title: 'Current Zoom',
        style: `${btnStyle} width: auto; padding: 0 8px; cursor: default;`,
      },
    });
    this.zoomDisplay = this.createElement('span', {
      className: 'zoom-level',
      textContent: '100.00%',
      attributes: {
        style: 'font-size: 12px; color: #e0e0e0;',
      },
    });
    zoomDisplayBtn.appendChild(this.zoomDisplay);
    zoomControls.appendChild(zoomDisplayBtn);

    // Zoom in button
    this.zoomInBtn = this.createElement('button', {
      className: 'zoom-btn',
      innerHTML: `<svg viewBox="0 0 24 24" style="${svgStyle}"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>`,
      attributes: {
        title: 'Zoom In',
        type: 'button',
        style: btnStyle,
      },
    });
    zoomControls.appendChild(this.zoomInBtn);

    // Separator
    zoomControls.appendChild(this.createElement('div', {
      className: 'zoom-separator',
      attributes: { style: separatorStyle },
    }));

    // Reset button
    const resetBtn = this.createElement('button', {
      className: 'zoom-btn',
      innerHTML: `<svg viewBox="0 0 24 24" style="${svgStyle}"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-8 3.58-8 8s3.58 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" /></svg>`,
      attributes: {
        title: LanguageService.t('matcher.zoomReset'),
        type: 'button',
        style: btnStyle,
      },
    });
    zoomControls.appendChild(resetBtn);

    // Separator before clear
    zoomControls.appendChild(this.createElement('div', {
      className: 'zoom-separator',
      attributes: { style: separatorStyle },
    }));

    // Clear/trash button
    const clearBtn = this.createElement('button', {
      className: 'zoom-btn',
      innerHTML: `<svg viewBox="0 0 24 24" style="${svgStyle}"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>`,
      attributes: {
        title: LanguageService.t('matcher.clearImage'),
        type: 'button',
        style: btnStyle,
      },
    });
    this.on(clearBtn, 'click', () => {
      this.emit('image-clear-requested');
    });
    zoomControls.appendChild(clearBtn);

    this.container.appendChild(zoomControls);

    // Prevent clicks on zoom controls from bubbling to parent (e.g., file input trigger)
    this.on(zoomControls, 'click', (e: Event) => {
      e.stopPropagation();
    });

    // Setup interactions
    this.setupZoomControls(fitBtn, widthBtn, resetBtn);
    this.setupImageInteraction();
  }

  getCanvasContainer(): HTMLElement | null {
    return this.canvasContainerRef;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvasRef;
  }

  private setupZoomControls(
    fitBtn: HTMLElement,
    widthBtn: HTMLElement,
    resetBtn: HTMLElement
  ): void {
    if (!this.canvasRef || !this.canvasContainerRef || !this.currentImage) return;

    const MIN_ZOOM = 10;
    const MAX_ZOOM = 400;
    const MIN_CONTAINER_DIMENSION = 50;

    // Store as instance method for public access
    this.getContainerDimensionsFn = (): { width: number; height: number } => {
      if (!this.canvasContainerRef) return { width: 0, height: 0 };

      // Try to get dimensions from parent container first (the drop zone)
      const parent = this.canvasContainerRef.parentElement;

      let width = 0;
      let height = 0;

      // First try parent's bounding rect (most reliable for absolute positioned container)
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        width = parentRect.width;
        height = parentRect.height;
      }

      // Fallback to canvas container dimensions
      if (width <= 0 || height <= 0) {
        width = this.canvasContainerRef.clientWidth;
        height = this.canvasContainerRef.clientHeight;
      }

      if (width <= 0 || height <= 0) {
        width = this.canvasContainerRef.offsetWidth;
        height = this.canvasContainerRef.offsetHeight;
      }

      if (width <= 0 || height <= 0) {
        const rect = this.canvasContainerRef.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
      }

      // Final fallback
      if (width <= 0 || height <= 0) {
        width = window.innerWidth - 32;
        height = window.innerHeight * 0.4;
      }

      width = Math.max(width, MIN_CONTAINER_DIMENSION);
      height = Math.max(height, MIN_CONTAINER_DIMENSION);

      return { width, height };
    };
    const getContainerDimensions = this.getContainerDimensionsFn;

    // Store as instance method for public access
    this.updateZoomFn = (newZoom: number, setCenter?: boolean): void => {
      if (!this.canvasRef || !this.zoomDisplay || !this.zoomOutBtn || !this.zoomInBtn) return;

      this.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      const scale = this.zoomLevel / 100;

      // If setCenter is explicitly provided, update the centering state
      if (setCenter !== undefined) {
        this.isCentered = setCenter;
      }

      this.canvasRef.style.transform = `scale(${scale})`;
      this.canvasRef.style.transformOrigin = 'top left';
      this.canvasRef.style.cursor = this.zoomLevel > 100 ? 'move' : 'crosshair';

      // Center the canvas if centering is enabled
      if (this.isCentered && this.currentImage && this.canvasContainerRef) {
        const container = getContainerDimensions();
        const scaledWidth = this.currentImage.width * scale;
        const scaledHeight = this.currentImage.height * scale;
        const marginLeft = Math.max(0, (container.width - scaledWidth) / 2);
        const marginTop = Math.max(0, (container.height - scaledHeight) / 2);
        this.canvasRef.style.marginLeft = `${marginLeft}px`;
        this.canvasRef.style.marginTop = `${marginTop}px`;
      } else {
        // Reset margins when not centering
        this.canvasRef.style.marginLeft = '0';
        this.canvasRef.style.marginTop = '0';
      }

      this.zoomDisplay.textContent = `${this.zoomLevel.toFixed(2)}%`;

      this.zoomOutBtn.disabled = this.zoomLevel <= MIN_ZOOM;
      this.zoomInBtn.disabled = this.zoomLevel >= MAX_ZOOM;

      this.toggleClass(this.zoomOutBtn, 'opacity-50', this.zoomLevel <= MIN_ZOOM);
      this.toggleClass(this.zoomOutBtn, 'cursor-not-allowed', this.zoomLevel <= MIN_ZOOM);

      this.toggleClass(this.zoomInBtn, 'opacity-50', this.zoomLevel >= MAX_ZOOM);
      this.toggleClass(this.zoomInBtn, 'cursor-not-allowed', this.zoomLevel >= MAX_ZOOM);
    };
    const updateZoom = this.updateZoomFn;

    const fitToContainer = (): void => {
      requestAnimationFrame(() => {
        if (!this.currentImage) return;
        const container = getContainerDimensions();
        const imageWidth = this.currentImage.naturalWidth || this.currentImage.width;
        const imageHeight = this.currentImage.naturalHeight || this.currentImage.height;

        if (imageWidth <= 0 || imageHeight <= 0) return;

        const zoomX = (container.width / imageWidth) * 100;
        const zoomY = (container.height / imageHeight) * 100;
        // Allow zoom > 100% if image is smaller than container
        const newZoom = Math.min(zoomX, zoomY);

        // Enable centering for fit-to-screen
        updateZoom(Math.max(newZoom, MIN_ZOOM), true);
      });
    };

    const zoomToWidth = (): void => {
      requestAnimationFrame(() => {
        if (!this.currentImage) return;
        const container = getContainerDimensions();
        const imageWidth = this.currentImage.naturalWidth || this.currentImage.width;

        if (imageWidth <= 0) return;

        const newZoom = (container.width / imageWidth) * 100;
        // Enable centering for fit-to-width
        updateZoom(Math.max(Math.min(newZoom, MAX_ZOOM), MIN_ZOOM), true);
      });
    };

    // Listeners
    this.on(fitBtn, 'click', fitToContainer);
    this.on(widthBtn, 'click', zoomToWidth);

    if (this.zoomOutBtn) {
      this.on(this.zoomOutBtn, 'click', () => {
        if (this.zoomLevel > MIN_ZOOM) updateZoom(this.zoomLevel - 10);
      });
    }

    if (this.zoomInBtn) {
      this.on(this.zoomInBtn, 'click', () => {
        if (this.zoomLevel < MAX_ZOOM) updateZoom(this.zoomLevel + 10);
      });
    }

    // Reset disables centering and goes back to 100%
    this.on(resetBtn, 'click', () => updateZoom(100, false));

    this.on(this.canvasContainerRef, 'wheel', (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (!wheelEvent.shiftKey) return;

      wheelEvent.preventDefault();
      const delta = wheelEvent.deltaY > 0 ? -10 : 10;
      updateZoom(this.zoomLevel + delta);
    });

    this.on(document, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (
        document.activeElement === document.body ||
        (this.canvasContainerRef && document.activeElement?.contains(this.canvasContainerRef))
      ) {
        if (keyEvent.key === '+' || keyEvent.key === '=') {
          keyEvent.preventDefault();
          if (this.zoomLevel < MAX_ZOOM) updateZoom(this.zoomLevel + 10);
        } else if (keyEvent.key === '-') {
          keyEvent.preventDefault();
          if (this.zoomLevel > MIN_ZOOM) updateZoom(this.zoomLevel - 10);
        } else if (keyEvent.key === '0') {
          keyEvent.preventDefault();
          updateZoom(100);
        }
      }
    });
  }

  private setupImageInteraction(): void {
    if (!this.canvasRef || !this.currentImage) return;

    let isDragging = false;
    let hasDraggedPastThreshold = false;
    let startX = 0;
    let startY = 0;
    let startClientX = 0;
    let startClientY = 0;

    // Helper to calculate distance
    const getDistance = (x1: number, y1: number, x2: number, y2: number): number => {
      return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };

    // Helper to get canvas coordinates from client coordinates
    const getCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
      if (!this.canvasRef) return { x: 0, y: 0 };
      const rect = this.canvasRef.getBoundingClientRect();
      return {
        x: (clientX - rect.left) * (this.canvasRef.width / rect.width),
        y: (clientY - rect.top) * (this.canvasRef.height / rect.height),
      };
    };

    // Helper to sample color at position and emit event
    const sampleColorAt = (centerX: number, centerY: number): void => {
      if (!this.canvasRef || !this.currentImage) return;
      const ctx = this.canvasRef.getContext('2d');
      if (ctx) {
        // Redraw original image first to clear selection box
        ctx.drawImage(this.currentImage, 0, 0);

        const pixel = ctx.getImageData(centerX, centerY, 1, 1).data;
        const hex =
          '#' +
          [pixel[0], pixel[1], pixel[2]]
            .map((x) => x.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();

        // Emit sample event
        if (this.onColorSampled) {
          this.onColorSampled(hex, centerX, centerY);
        }

        // Also emit custom event
        this.emit('image-sampled', { hex, x: centerX, y: centerY });
      }
    };

    // === MOUSE EVENTS ===
    this.on(this.canvasRef, 'mousedown', (e: Event) => {
      if (!this.canvasRef) return;
      e.stopPropagation();
      const mouseEvent = e as MouseEvent;
      const coords = getCanvasCoords(mouseEvent.clientX, mouseEvent.clientY);
      startX = coords.x;
      startY = coords.y;
      startClientX = mouseEvent.clientX;
      startClientY = mouseEvent.clientY;
      isDragging = true;
      hasDraggedPastThreshold = false;
      // Set initial cursor to pointer (will change to crosshair if dragging)
      this.canvasRef.style.cursor = 'pointer';
    });

    this.on(this.canvasRef, 'mousemove', (e: Event) => {
      if (!isDragging || !this.canvasRef || !this.currentImage) return;
      e.stopPropagation();

      const mouseEvent = e as MouseEvent;
      const distance = getDistance(startClientX, startClientY, mouseEvent.clientX, mouseEvent.clientY);

      // Check if we've exceeded the drag threshold
      if (distance > this.dragThreshold) {
        hasDraggedPastThreshold = true;
        this.canvasRef.style.cursor = 'crosshair';

        // Draw selection rectangle
        const coords = getCanvasCoords(mouseEvent.clientX, mouseEvent.clientY);
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
          ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);
        }
      }
    });

    this.on(this.canvasRef, 'mouseup', (e: Event) => {
      if (!isDragging || !this.canvasRef || !this.currentImage) return;
      e.stopPropagation();
      isDragging = false;
      this.canvasRef.style.cursor = 'pointer';

      const mouseEvent = e as MouseEvent;
      const coords = getCanvasCoords(mouseEvent.clientX, mouseEvent.clientY);

      if (hasDraggedPastThreshold) {
        // Drag completed - emit region bounds for palette extraction
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
        }

        // Calculate region bounds
        const x = Math.min(startX, coords.x);
        const y = Math.min(startY, coords.y);
        const width = Math.abs(coords.x - startX);
        const height = Math.abs(coords.y - startY);

        // Emit event with region information
        this.emit('image-sampled', { 
          x, 
          y, 
          width, 
          height,
          isRegion: true 
        });
      } else {
        // Click (no drag) - emit canvas-clicked event for file upload
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
        }
        this.emit('canvas-clicked', {});
      }
      hasDraggedPastThreshold = false;
    });

    this.on(this.canvasRef, 'mouseleave', () => {
      if (isDragging && this.canvasRef && this.currentImage) {
        isDragging = false;
        hasDraggedPastThreshold = false;
        this.canvasRef.style.cursor = 'pointer';
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
        }
      }
    });

    // === TOUCH EVENTS ===
    this.on(this.canvasRef, 'touchstart', (e: Event) => {
      if (!this.canvasRef) return;
      e.stopPropagation();
      const touchEvent = e as TouchEvent;
      if (touchEvent.touches.length !== 1) return;
      const touch = touchEvent.touches[0];
      const coords = getCanvasCoords(touch.clientX, touch.clientY);
      startX = coords.x;
      startY = coords.y;
      startClientX = touch.clientX;
      startClientY = touch.clientY;
      isDragging = true;
      hasDraggedPastThreshold = false;
    });

    this.on(this.canvasRef, 'touchmove', (e: Event) => {
      if (!isDragging || !this.canvasRef || !this.currentImage) return;
      e.stopPropagation();
      e.preventDefault(); // Prevent scrolling while dragging

      const touchEvent = e as TouchEvent;
      if (touchEvent.touches.length !== 1) return;
      const touch = touchEvent.touches[0];
      const distance = getDistance(startClientX, startClientY, touch.clientX, touch.clientY);

      if (distance > this.dragThreshold) {
        hasDraggedPastThreshold = true;

        // Draw selection rectangle
        const coords = getCanvasCoords(touch.clientX, touch.clientY);
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
          ctx.strokeRect(startX, startY, coords.x - startX, coords.y - startY);
        }
      }
    });

    this.on(this.canvasRef, 'touchend', (e: Event) => {
      if (!isDragging || !this.canvasRef || !this.currentImage) return;
      e.stopPropagation();
      isDragging = false;

      const touchEvent = e as TouchEvent;
      const touch = touchEvent.changedTouches[0];
      const coords = getCanvasCoords(touch.clientX, touch.clientY);

      if (hasDraggedPastThreshold) {
        // Drag completed - emit region bounds for palette extraction
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
        }

        // Calculate region bounds
        const x = Math.min(startX, coords.x);
        const y = Math.min(startY, coords.y);
        const width = Math.abs(coords.x - startX);
        const height = Math.abs(coords.y - startY);

        // Emit event with region information
        this.emit('image-sampled', { 
          x, 
          y, 
          width, 
          height,
          isRegion: true 
        });
      } else {
        // Tap (no drag) - emit canvas-clicked event for file upload
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
        }
        this.emit('canvas-clicked', {});
      }
      hasDraggedPastThreshold = false;
    });

    this.on(this.canvasRef, 'touchcancel', () => {
      if (isDragging && this.canvasRef && this.currentImage) {
        isDragging = false;
        hasDraggedPastThreshold = false;
        const ctx = this.canvasRef.getContext('2d');
        if (ctx) {
          ctx.drawImage(this.currentImage, 0, 0);
        }
      }
    });
  }

  /**
   * Set the drag threshold for click vs drag differentiation
   * @param threshold Threshold in pixels (default 5)
   */
  public setDragThreshold(threshold: number): void {
    this.dragThreshold = Math.max(3, Math.min(15, threshold));
  }

  /**
   * Fit the entire image within the container (Fit to Screen)
   */
  public fitToScreen(): void {
    if (!this.currentImage || !this.updateZoomFn || !this.getContainerDimensionsFn) return;

    requestAnimationFrame(() => {
      if (!this.currentImage || !this.updateZoomFn || !this.getContainerDimensionsFn) return;
      const container = this.getContainerDimensionsFn();
      const imageWidth = this.currentImage.naturalWidth || this.currentImage.width;
      const imageHeight = this.currentImage.naturalHeight || this.currentImage.height;

      if (imageWidth <= 0 || imageHeight <= 0) return;

      const zoomX = (container.width / imageWidth) * 100;
      const zoomY = (container.height / imageHeight) * 100;
      const newZoom = Math.min(zoomX, zoomY);

      this.updateZoomFn(Math.max(newZoom, 10), true);
    });
  }

  /**
   * Fit the image width to the container width (Fit to Width)
   */
  public fitToWidth(): void {
    if (!this.currentImage || !this.updateZoomFn || !this.getContainerDimensionsFn) return;

    requestAnimationFrame(() => {
      if (!this.currentImage || !this.updateZoomFn || !this.getContainerDimensionsFn) return;
      const container = this.getContainerDimensionsFn();
      const imageWidth = this.currentImage.naturalWidth || this.currentImage.width;

      if (imageWidth <= 0) return;

      const newZoom = (container.width / imageWidth) * 100;
      this.updateZoomFn(Math.max(Math.min(newZoom, 400), 10), true);
    });
  }

  /**
   * Automatically fit the image based on its dimensions relative to the container.
   * - If image is wider than container: Fit to Width
   * - If image fits within container: Fit to Screen (whole image)
   */
  public autoFit(): void {
    if (!this.currentImage || !this.getContainerDimensionsFn) return;

    requestAnimationFrame(() => {
      if (!this.currentImage || !this.getContainerDimensionsFn) return;
      const container = this.getContainerDimensionsFn();
      const imageWidth = this.currentImage.naturalWidth || this.currentImage.width;

      if (imageWidth <= 0 || container.width <= 0) return;

      if (imageWidth > container.width) {
        // Image is wider than container - fit to width
        this.fitToWidth();
      } else {
        // Image fits within container - fit whole image
        this.fitToScreen();
      }
    });
  }
}
