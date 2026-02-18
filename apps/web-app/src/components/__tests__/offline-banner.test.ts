/**
 * XIV Dye Tools - OfflineBanner Unit Tests
 *
 * Tests the offline banner singleton component.
 * Covers online/offline detection, banner visibility, and event handling.
 *
 * @module components/__tests__/offline-banner.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { OfflineBanner } from '../offline-banner';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  getText,
  getAttr,
} from '../../__tests__/component-utils';

// Track original navigator.onLine
const originalNavigatorOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

// Helper to set navigator.onLine
function setOnlineStatus(isOnline: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    value: isOnline,
    writable: true,
    configurable: true,
  });
}

describe('OfflineBanner', () => {
  let banner: OfflineBanner | null;

  beforeEach(() => {
    banner = null;
    // Clear any singleton instance
    // @ts-expect-error - accessing private static for testing
    OfflineBanner.instance = null;
    // Default to online
    setOnlineStatus(true);
    // Reset body padding
    document.body.style.paddingTop = '';
  });

  afterEach(() => {
    if (banner) {
      banner.destroy();
    }
    // Restore original navigator.onLine
    if (originalNavigatorOnLine) {
      Object.defineProperty(navigator, 'onLine', originalNavigatorOnLine);
    }
    // Clean up any remaining banner elements
    const existingBanner = document.getElementById('offline-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    document.body.style.paddingTop = '';
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Singleton Tests
  // ============================================================================

  describe('Singleton', () => {
    it('should return same instance on multiple getInstance calls', () => {
      const instance1 = OfflineBanner.getInstance();
      const instance2 = OfflineBanner.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after destroy', () => {
      const instance1 = OfflineBanner.getInstance();
      instance1.destroy();

      const instance2 = OfflineBanner.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('Initialization', () => {
    it('should create banner element on initialize', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      expect(document.getElementById('offline-banner')).not.toBeNull();
    });

    it('should have role="alert"', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const el = document.getElementById('offline-banner');
      expect(getAttr(el, 'role')).toBe('alert');
    });

    it('should have aria-live="polite"', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const el = document.getElementById('offline-banner');
      expect(getAttr(el, 'aria-live')).toBe('polite');
    });

    it('should contain offline message', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const message = document.getElementById('offline-banner-message');
      expect(message).not.toBeNull();
      expect(message?.textContent).toContain('offline');
    });

    it('should contain dismiss button', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const dismissBtn = query(document.getElementById('offline-banner')!, 'button');
      expect(dismissBtn).not.toBeNull();
    });
  });

  // ============================================================================
  // Online Status Tests
  // ============================================================================

  describe('Online Status', () => {
    it('should report online status correctly', () => {
      setOnlineStatus(true);
      banner = OfflineBanner.getInstance();

      expect(banner.getIsOnline()).toBe(true);
    });

    it('should report offline status correctly', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();

      expect(banner.getIsOnline()).toBe(false);
    });
  });

  // ============================================================================
  // Banner Visibility Tests
  // ============================================================================

  describe('Banner Visibility', () => {
    it('should hide banner when online', () => {
      setOnlineStatus(true);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const el = document.getElementById('offline-banner') as HTMLElement;
      expect(el.style.transform).toBe('translateY(-100%)');
    });

    it('should show banner when offline', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const el = document.getElementById('offline-banner') as HTMLElement;
      // Browser may normalize to translateY(0) or translateY(0px)
      expect(el.style.transform).toMatch(/translateY\(0(px)?\)/);
    });

    it('should add body padding when banner shown', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      expect(document.body.style.paddingTop).not.toBe('');
      expect(document.body.style.paddingTop).not.toBe('0');
    });

    it('should remove body padding when banner hidden', () => {
      setOnlineStatus(true);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      // Padding should be reset - could be '', '0', or '0px' depending on browser
      expect(['', '0', '0px']).toContain(document.body.style.paddingTop);
    });
  });

  // ============================================================================
  // Programmatic Control Tests
  // ============================================================================

  describe('Programmatic Control', () => {
    it('should show banner with showBanner()', () => {
      setOnlineStatus(true);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      banner.showBanner();

      const el = document.getElementById('offline-banner') as HTMLElement;
      expect(el.style.transform).toMatch(/translateY\(0(px)?\)/);
    });

    it('should hide banner with hideBanner()', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      banner.hideBanner();

      const el = document.getElementById('offline-banner') as HTMLElement;
      expect(el.style.transform).toBe('translateY(-100%)');
    });
  });

  // ============================================================================
  // Dismiss Button Tests
  // ============================================================================

  describe('Dismiss Button', () => {
    it('should hide banner when dismiss button clicked', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const dismissBtn = query<HTMLButtonElement>(
        document.getElementById('offline-banner')!,
        'button'
      );
      click(dismissBtn);

      const el = document.getElementById('offline-banner') as HTMLElement;
      expect(el.style.transform).toBe('translateY(-100%)');
    });

    it('should have aria-label on dismiss button', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      const dismissBtn = query(document.getElementById('offline-banner')!, 'button');
      expect(dismissBtn?.hasAttribute('aria-label')).toBe(true);
    });
  });

  // ============================================================================
  // Event Listener Tests
  // ============================================================================

  describe('Online/Offline Events', () => {
    it('should update on online event', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      // Simulate going online
      setOnlineStatus(true);
      window.dispatchEvent(new Event('online'));

      expect(banner.getIsOnline()).toBe(true);
    });

    it('should update on offline event', () => {
      setOnlineStatus(true);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      // Simulate going offline
      setOnlineStatus(false);
      window.dispatchEvent(new Event('offline'));

      expect(banner.getIsOnline()).toBe(false);
    });

    it('should show banner when going offline', () => {
      setOnlineStatus(true);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      setOnlineStatus(false);
      window.dispatchEvent(new Event('offline'));

      const el = document.getElementById('offline-banner') as HTMLElement;
      expect(el.style.transform).toMatch(/translateY\(0(px)?\)/);
    });

    it('should hide banner when going online', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      setOnlineStatus(true);
      window.dispatchEvent(new Event('online'));

      const el = document.getElementById('offline-banner') as HTMLElement;
      expect(el.style.transform).toBe('translateY(-100%)');
    });
  });

  // ============================================================================
  // Status Change Subscription Tests
  // ============================================================================

  describe('onStatusChange', () => {
    it('should call callback on online event', () => {
      banner = OfflineBanner.getInstance();
      const callback = vi.fn();

      banner.onStatusChange(callback);
      window.dispatchEvent(new Event('online'));

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should call callback on offline event', () => {
      banner = OfflineBanner.getInstance();
      const callback = vi.fn();

      banner.onStatusChange(callback);
      window.dispatchEvent(new Event('offline'));

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should return unsubscribe function', () => {
      banner = OfflineBanner.getInstance();
      const callback = vi.fn();

      const unsubscribe = banner.onStatusChange(callback);
      unsubscribe();

      window.dispatchEvent(new Event('online'));

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Message Update Tests
  // ============================================================================

  describe('updateMessage', () => {
    it('should update message text', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      banner.updateMessage();

      const message = document.getElementById('offline-banner-message');
      expect(message).not.toBeNull();
    });
  });

  // ============================================================================
  // Cleanup Tests
  // ============================================================================

  describe('Cleanup', () => {
    it('should remove banner element on destroy', () => {
      banner = OfflineBanner.getInstance();
      banner.initialize();

      expect(document.getElementById('offline-banner')).not.toBeNull();

      banner.destroy();
      banner = null;

      expect(document.getElementById('offline-banner')).toBeNull();
    });

    it('should reset body padding on destroy', () => {
      setOnlineStatus(false);
      banner = OfflineBanner.getInstance();
      banner.initialize();

      banner.destroy();
      banner = null;

      // Padding should be reset - could be '', '0', or '0px' depending on browser
      expect(['', '0', '0px']).toContain(document.body.style.paddingTop);
    });

    it('should clear singleton instance on destroy', () => {
      banner = OfflineBanner.getInstance();
      banner.destroy();
      banner = null;

      // @ts-expect-error - accessing private static for testing
      expect(OfflineBanner.instance).toBeNull();
    });
  });
});
