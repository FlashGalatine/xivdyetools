/**
 * XIV Dye Tools - ColorPickerDisplay Unit Tests
 *
 * Tests the color picker display component for selecting colors.
 * Covers rendering, hex input validation, color picker sync, and eyedropper.
 *
 * @module components/__tests__/color-picker-display.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorPickerDisplay } from '../color-picker-display';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  input,
  getAttr,
} from '../../__tests__/component-utils';

vi.mock('@services/index', () => ({
  ColorService: {
    hexToRgb: vi.fn((hex: string) => {
      // Simple mock implementation
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      return { r, g, b };
    }),
    hexToHsv: vi.fn(() => ({ h: 0, s: 100, v: 100 })),
    rgbToHex: vi.fn((r: number, g: number, b: number) => {
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }),
  },
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_EYEDROPPER: '<svg></svg>',
}));

describe('ColorPickerDisplay', () => {
  let container: HTMLElement;
  let picker: ColorPickerDisplay | null;

  beforeEach(() => {
    container = createTestContainer();
    picker = null;
    vi.clearAllMocks();
    // Remove EyeDropper mock by default
    delete (window as any).EyeDropper;
  });

  afterEach(() => {
    if (picker) {
      try {
        picker.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render color preview', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const preview = query(container, '#color-preview');
      expect(preview).not.toBeNull();
    });

    it('should render hex input', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const hexInput = query(container, '#hex-input');
      expect(hexInput).not.toBeNull();
    });

    it('should render color picker input', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const colorPicker = query(container, '#color-picker');
      expect(colorPicker).not.toBeNull();
      expect(getAttr(colorPicker, 'type')).toBe('color');
    });

    it('should render RGB display', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const rgbDisplay = query(container, '#rgb-display');
      expect(rgbDisplay).not.toBeNull();
    });

    it('should render HSV display', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const hsvDisplay = query(container, '#hsv-display');
      expect(hsvDisplay).not.toBeNull();
    });

    it('should use initial color', () => {
      picker = new ColorPickerDisplay(container, '#00FF00');
      picker.init();

      const preview = query(container, '#color-preview') as HTMLElement;
      expect(preview.style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('should use default color when not specified', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      expect(hexInput?.value).toBe('#FF0000');
    });
  });

  // ============================================================================
  // Hex Input Tests
  // ============================================================================

  describe('Hex Input', () => {
    it('should update color on valid hex input', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      if (hexInput) {
        hexInput.value = '#00FF00';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      expect(picker.getColor()).toBe('#00FF00');
    });

    it('should auto-prepend # when missing', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      if (hexInput) {
        hexInput.value = '00FF00';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      expect(picker.getColor()).toBe('#00FF00');
    });

    it('should accept 3-character hex codes', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      if (hexInput) {
        hexInput.value = '#0F0';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      expect(picker.getColor()).toBe('#0F0');
    });

    it('should not update on invalid hex input', () => {
      picker = new ColorPickerDisplay(container, '#FF0000');
      picker.init();

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      if (hexInput) {
        hexInput.value = 'invalid';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      expect(picker.getColor()).toBe('#FF0000');
    });

    it('should restore value on blur if invalid', () => {
      picker = new ColorPickerDisplay(container, '#FF0000');
      picker.init();

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      if (hexInput) {
        hexInput.value = 'invalid';
        hexInput.dispatchEvent(new Event('blur', { bubbles: true }));
      }

      expect(hexInput?.value).toBe('#FF0000');
    });

    it('should emit color-selected event on valid input', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const eventSpy = vi.fn();
      container.addEventListener('color-selected', eventSpy);

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      if (hexInput) {
        hexInput.value = '#00FF00';
        hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Color Picker Tests
  // ============================================================================

  describe('Color Picker', () => {
    it('should update color on picker change', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const colorPicker = query<HTMLInputElement>(container, '#color-picker');
      if (colorPicker) {
        // Color picker input returns lowercase
        colorPicker.value = '#0000ff';
        colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
      }

      expect(picker.getColor().toLowerCase()).toBe('#0000ff');
    });

    it('should sync hex input when picker changes', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const colorPicker = query<HTMLInputElement>(container, '#color-picker');
      if (colorPicker) {
        // Color picker input returns lowercase
        colorPicker.value = '#0000ff';
        colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const hexInput = query<HTMLInputElement>(container, '#hex-input');
      expect(hexInput?.value.toLowerCase()).toBe('#0000ff');
    });

    it('should update preview when picker changes', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const colorPicker = query<HTMLInputElement>(container, '#color-picker');
      if (colorPicker) {
        colorPicker.value = '#0000FF';
        colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
      }

      const preview = query(container, '#color-preview') as HTMLElement;
      expect(preview.style.backgroundColor).toBe('rgb(0, 0, 255)');
    });

    it('should emit color-selected event on picker change', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const eventSpy = vi.fn();
      container.addEventListener('color-selected', eventSpy);

      const colorPicker = query<HTMLInputElement>(container, '#color-picker');
      if (colorPicker) {
        colorPicker.value = '#0000FF';
        colorPicker.dispatchEvent(new Event('input', { bubbles: true }));
      }

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Eyedropper Tests
  // ============================================================================

  describe('Eyedropper', () => {
    it('should not render eyedropper button when API not supported', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      const eyedropperBtn = query(container, '#eyedropper-btn');
      expect(eyedropperBtn).toBeNull();
    });

    it('should render eyedropper button when API is supported', () => {
      // Mock EyeDropper API
      (window as any).EyeDropper = vi.fn();

      picker = new ColorPickerDisplay(container);
      picker.init();

      const eyedropperBtn = query(container, '#eyedropper-btn');
      expect(eyedropperBtn).not.toBeNull();
    });

    it('should call EyeDropper API when button clicked', async () => {
      const mockOpen = vi.fn().mockResolvedValue({ sRGBHex: '#ABCDEF' });
      // Must use a class constructor for EyeDropper
      (window as any).EyeDropper = class {
        open = mockOpen;
      };

      picker = new ColorPickerDisplay(container);
      picker.init();

      const eyedropperBtn = query<HTMLButtonElement>(container, '#eyedropper-btn');
      click(eyedropperBtn);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockOpen).toHaveBeenCalled();
    });

    it('should update color from eyedropper result', async () => {
      const mockOpen = vi.fn().mockResolvedValue({ sRGBHex: '#ABCDEF' });
      // Must use a class constructor for EyeDropper
      (window as any).EyeDropper = class {
        open = mockOpen;
      };

      picker = new ColorPickerDisplay(container);
      picker.init();

      const eyedropperBtn = query<HTMLButtonElement>(container, '#eyedropper-btn');
      click(eyedropperBtn);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(picker.getColor()).toBe('#ABCDEF');
    });
  });

  // ============================================================================
  // Programmatic API Tests
  // ============================================================================

  describe('Programmatic API', () => {
    it('should get color with getColor()', () => {
      picker = new ColorPickerDisplay(container, '#123456');
      picker.init();

      expect(picker.getColor()).toBe('#123456');
    });

    it('should set color with setColor()', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      picker.setColor('#AABBCC');

      expect(picker.getColor()).toBe('#AABBCC');
    });

    it('should update display when setColor is called', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      picker.setColor('#AABBCC');

      const preview = query(container, '#color-preview') as HTMLElement;
      expect(preview.style.backgroundColor).toBe('rgb(170, 187, 204)');
    });

    it('should not set invalid color', () => {
      picker = new ColorPickerDisplay(container, '#FF0000');
      picker.init();

      picker.setColor('invalid');

      expect(picker.getColor()).toBe('#FF0000');
    });

    it('should accept 3-character hex in setColor', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      picker.setColor('#ABC');

      expect(picker.getColor()).toBe('#ABC');
    });
  });

  // ============================================================================
  // Image Color Sampling Tests
  // ============================================================================

  describe('Image Color Sampling', () => {
    // Note: These tests are skipped because jsdom doesn't support canvas getContext('2d')
    // In a real environment with the canvas npm package installed, these would work

    it('should handle canvas without context gracefully', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      // Create a canvas (jsdom doesn't support getContext so it returns null)
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;

      // Should not throw even when context is null
      expect(() => picker!.setColorFromImage(canvas, 5, 5, 1)).not.toThrow();
    });

    it('should not change color when canvas context is null', () => {
      picker = new ColorPickerDisplay(container, '#FF0000');
      picker.init();

      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;

      picker.setColorFromImage(canvas, 5, 5, 1);

      // Color should remain unchanged because getContext returns null in jsdom
      expect(picker.getColor()).toBe('#FF0000');
    });
  });

  // ============================================================================
  // Display Update Tests
  // ============================================================================

  describe('Display Updates', () => {
    it('should update RGB display when color changes', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      picker.setColor('#00FF00');

      const rgbDisplay = query(container, '#rgb-display');
      expect(rgbDisplay?.textContent).toContain('0');
      expect(rgbDisplay?.textContent).toContain('255');
    });

    it('should update HSV display when color changes', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      picker.setColor('#00FF00');

      const hsvDisplay = query(container, '#hsv-display');
      expect(hsvDisplay?.textContent).toContain('HSV');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      picker = new ColorPickerDisplay(container);
      picker.init();

      picker.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
