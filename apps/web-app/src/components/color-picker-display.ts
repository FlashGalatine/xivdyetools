/**
 * XIV Dye Tools v2.0.0 - Color Picker Display Component
 *
 * Phase 12: Architecture Refactor
 * Color input with picker, hex input, and eyedropper functionality
 *
 * @module components/color-picker-display
 */

import { BaseComponent } from './base-component';
import { ColorService, LanguageService } from '@services/index';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { ICON_EYEDROPPER } from '@shared/ui-icons';
import '@shared/browser-api-types';

/**
 * Color Picker Display Component
 * Multi-method color input interface
 */
export class ColorPickerDisplay extends BaseComponent {
  private selectedColor: string = '#FF0000';
  private eyedropperMode: boolean = false;
  private eyedropperCanvas: HTMLCanvasElement | null = null;

  constructor(container: HTMLElement, initialColor: string = '#FF0000') {
    super(container);
    this.selectedColor = initialColor;
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
      textContent: LanguageService.t('matcher.selectColor'),
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
    });
    wrapper.appendChild(title);

    // Color preview
    const preview = this.createElement('div', {
      className: 'h-24 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm',
      attributes: {
        id: 'color-preview',
        style: `background-color: ${this.selectedColor}`,
      },
    });
    wrapper.appendChild(preview);

    // Input methods grid
    const inputGrid = this.createElement('div', {
      className: 'grid grid-cols-2 gap-3',
    });

    // Hex input
    const hexInputContainer = this.createElement('div', {
      className: 'space-y-2',
    });

    const hexLabel = this.createElement('label', {
      textContent: LanguageService.t('common.hexColor'),
      className: 'text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide',
    });

    const hexInput = this.createElement('input', {
      attributes: {
        type: 'text',
        id: 'hex-input',
        value: this.selectedColor,
        placeholder: '#FF0000',
        maxlength: '7',
      },
      className:
        'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    });

    hexInputContainer.appendChild(hexLabel);
    hexInputContainer.appendChild(hexInput);
    inputGrid.appendChild(hexInputContainer);

    // Color picker input
    const pickerContainer = this.createElement('div', {
      className: 'space-y-2',
    });

    const pickerLabel = this.createElement('label', {
      textContent: LanguageService.t('matcher.colorPicker'),
      className: 'text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide',
    });

    const pickerInput = this.createElement('input', {
      attributes: {
        type: 'color',
        id: 'color-picker',
        value: this.selectedColor,
      },
      className:
        'w-full h-10 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600',
    });

    pickerContainer.appendChild(pickerLabel);
    pickerContainer.appendChild(pickerInput);
    inputGrid.appendChild(pickerContainer);

    wrapper.appendChild(inputGrid);

    // Color values
    const valuesSection = this.createElement('div', {
      className: 'bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2',
    });

    const rgbVal = ColorService.hexToRgb(this.selectedColor);
    const hsvVal = ColorService.hexToHsv(this.selectedColor);

    const rgbText = this.createElement('div', {
      textContent: `RGB: rgb(${rgbVal.r}, ${rgbVal.g}, ${rgbVal.b})`,
      className: 'text-xs number text-gray-600 dark:text-gray-400',
      attributes: {
        id: 'rgb-display',
      },
    });

    const hsvText = this.createElement('div', {
      textContent: `HSV: ${Math.round(hsvVal.h)}° ${Math.round(hsvVal.s)}% ${Math.round(hsvVal.v)}%`,
      className: 'text-xs number text-gray-600 dark:text-gray-400',
      attributes: {
        id: 'hsv-display',
      },
    });

    valuesSection.appendChild(rgbText);
    valuesSection.appendChild(hsvText);
    wrapper.appendChild(valuesSection);

    // Eyedropper button (if supported) - inline SVG for theme color inheritance
    if ('EyeDropper' in window) {
      const eyedropperBtn = this.createElement('button', {
        innerHTML: `<span class="inline-block w-5 h-5" aria-hidden="true">${ICON_EYEDROPPER}</span> ${LanguageService.t('matcher.useEyedropper')}`,
        className:
          'btn-theme-secondary w-full px-4 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2',
        attributes: {
          id: 'eyedropper-btn',
        },
      });

      wrapper.appendChild(eyedropperBtn);
    }

    // Canvas for eyedropper (hidden)
    this.eyedropperCanvas = this.createElement('canvas', {
      attributes: {
        id: 'eyedropper-canvas',
      },
      className: 'hidden',
    });
    wrapper.appendChild(this.eyedropperCanvas);

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Hex input
    const hexInput = this.querySelector<HTMLInputElement>('#hex-input');
    if (hexInput) {
      this.on(hexInput, 'input', () => {
        let value = hexInput.value.trim();

        // Auto-prepend # if missing
        if (value && !value.startsWith('#')) {
          value = '#' + value;
        }

        // Validate hex format
        if (/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(value)) {
          this.selectedColor = value;
          this.updateDisplay();
          this.emit('color-selected', { color: value });
        }
      });

      this.on(hexInput, 'blur', () => {
        hexInput.value = this.selectedColor;
      });
    }

    // Color picker
    const colorPicker = this.querySelector<HTMLInputElement>('#color-picker');
    if (colorPicker) {
      this.on(colorPicker, 'input', () => {
        this.selectedColor = colorPicker.value;
        this.updateDisplay();
        this.emit('color-selected', { color: this.selectedColor });
      });
    }

    // Eyedropper button
    const eyedropperBtn = this.querySelector<HTMLButtonElement>('#eyedropper-btn');
    if (eyedropperBtn) {
      this.on(eyedropperBtn, 'click', () => {
        void this.activateEyedropper();
      });
    }
  }

  /**
   * Update color display
   */
  private updateDisplay(): void {
    const preview = this.querySelector<HTMLElement>('#color-preview');
    if (preview) {
      preview.style.backgroundColor = this.selectedColor;
    }

    const hexInput = this.querySelector<HTMLInputElement>('#hex-input');
    if (hexInput && hexInput.value !== this.selectedColor) {
      hexInput.value = this.selectedColor;
    }

    const colorPicker = this.querySelector<HTMLInputElement>('#color-picker');
    if (colorPicker && colorPicker.value !== this.selectedColor) {
      colorPicker.value = this.selectedColor;
    }

    const rgbVal = ColorService.hexToRgb(this.selectedColor);
    const rgbDisplay = this.querySelector<HTMLElement>('#rgb-display');
    if (rgbDisplay) {
      rgbDisplay.textContent = `RGB: rgb(${rgbVal.r}, ${rgbVal.g}, ${rgbVal.b})`;
    }

    const hsvVal = ColorService.hexToHsv(this.selectedColor);
    const hsvDisplay = this.querySelector<HTMLElement>('#hsv-display');
    if (hsvDisplay) {
      hsvDisplay.textContent = `HSV: ${Math.round(hsvVal.h)}° ${Math.round(hsvVal.s)}% ${Math.round(hsvVal.v)}%`;
    }
  }

  /**
   * Activate eyedropper tool (if supported)
   */
  private async activateEyedropper(): Promise<void> {
    try {
      if (!window.EyeDropper) {
        throw new Error('EyeDropper API not supported');
      }

      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();

      if (result && result.sRGBHex) {
        this.selectedColor = result.sRGBHex;
        this.updateDisplay();
        this.emit('color-selected', { color: this.selectedColor });
      }
    } catch {
      // User cancelled or error occurred
      logger.info('Eyedropper cancelled or not supported');
    }
  }

  /**
   * Set color from image coordinates
   * Used by ColorMatcher for eyedropper from image
   */
  setColorFromImage(canvas: HTMLCanvasElement, x: number, y: number, sampleSize: number = 1): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clamp coordinates
    const startX = Math.max(0, Math.floor(x - sampleSize / 2));
    const startY = Math.max(0, Math.floor(y - sampleSize / 2));
    const width = Math.min(sampleSize, canvas.width - startX);
    const height = Math.min(sampleSize, canvas.height - startY);

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
      count++;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    this.selectedColor = ColorService.rgbToHex(r, g, b);
    this.updateDisplay();
    this.emit('color-selected', { color: this.selectedColor });
  }

  /**
   * Get selected color
   */
  getColor(): string {
    return this.selectedColor;
  }

  /**
   * Set color programmatically
   */
  setColor(hex: string): void {
    if (/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(hex)) {
      this.selectedColor = hex;
      this.updateDisplay();
    }
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      selectedColor: this.selectedColor,
      eyedropperSupported: 'EyeDropper' in window,
    };
  }
}
