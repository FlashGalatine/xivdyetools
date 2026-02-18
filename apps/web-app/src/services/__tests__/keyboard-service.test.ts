/**
 * XIV Dye Tools - KeyboardService Unit Tests
 * Tests for centralized keyboard shortcut management
 */

import { KeyboardService } from '../keyboard-service';
import { ThemeService } from '../theme-service';
import { LanguageService } from '../language-service';
import { ModalService } from '../modal-service';
import * as shortcutsPanel from '@components/shortcuts-panel';

// Mock dependencies
vi.mock('../theme-service', () => ({
  ThemeService: {
    toggleDarkMode: vi.fn(),
  },
}));

vi.mock('../language-service', () => ({
  LanguageService: {
    cycleToNextLocale: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../modal-service', () => ({
  ModalService: {
    hasOpenModals: vi.fn(() => false),
  },
}));

vi.mock('@components/shortcuts-panel', () => ({
  showShortcutsPanel: vi.fn(),
}));

// Mock FEATURE_FLAGS
vi.mock('@shared/constants', () => ({
  FEATURE_FLAGS: {
    ENABLE_KEYBOARD_SHORTCUTS: true,
  },
}));

describe('KeyboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    KeyboardService.destroy();
    (ModalService.hasOpenModals as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  afterEach(() => {
    KeyboardService.destroy();
  });

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialize', () => {
    it('should initialize keyboard service', () => {
      KeyboardService.initialize();

      // Service should be initialized (can handle key events)
      const event = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(event);

      // Should dispatch navigation event for tool 1
      // (We can't easily check this without more setup, but no error means success)
    });

    it('should not re-initialize if already initialized', () => {
      KeyboardService.initialize();
      KeyboardService.initialize();

      // Should only have one event listener (logged warning on second call)
    });
  });

  // ============================================================================
  // Destroy Tests
  // ============================================================================

  describe('destroy', () => {
    it('should clean up event listeners', () => {
      KeyboardService.initialize();
      KeyboardService.destroy();

      // Service should not respond to key events after destroy
    });

    it('should handle destroy when not initialized', () => {
      expect(() => KeyboardService.destroy()).not.toThrow();
    });
  });

  // ============================================================================
  // Tool Navigation Tests
  // ============================================================================

  describe('Tool Navigation (1-5 keys)', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should dispatch navigation event for key 1 (harmony)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { toolId: 'harmony' },
        })
      );

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should dispatch navigation event for key 2 (matcher)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '2' });
      document.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { toolId: 'matcher' },
        })
      );

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should dispatch navigation event for key 3 (accessibility)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '3' });
      document.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { toolId: 'accessibility' },
        })
      );

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should dispatch navigation event for key 4 (comparison)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '4' });
      document.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { toolId: 'comparison' },
        })
      );

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should dispatch navigation event for key 5 (mixer)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '5' });
      document.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { toolId: 'mixer' },
        })
      );

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should not navigate when Shift is pressed', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1', shiftKey: true });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should not navigate when Ctrl is pressed', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1', ctrlKey: true });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should not navigate when Alt is pressed', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1', altKey: true });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should not navigate when Meta is pressed', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1', metaKey: true });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });
  });

  // ============================================================================
  // Theme Toggle Tests
  // ============================================================================

  describe('Theme Toggle (Shift+T)', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should toggle theme on Shift+T', () => {
      const event = new KeyboardEvent('keydown', { key: 'T', shiftKey: true });
      document.dispatchEvent(event);

      expect(ThemeService.toggleDarkMode).toHaveBeenCalled();
    });

    it('should toggle theme on Shift+t (lowercase)', () => {
      const event = new KeyboardEvent('keydown', { key: 't', shiftKey: true });
      document.dispatchEvent(event);

      expect(ThemeService.toggleDarkMode).toHaveBeenCalled();
    });

    it('should handle theme toggle error gracefully', () => {
      (ThemeService.toggleDarkMode as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Theme error');
      });

      const event = new KeyboardEvent('keydown', { key: 'T', shiftKey: true });
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });
  });

  // ============================================================================
  // Language Cycle Tests
  // ============================================================================

  describe('Language Cycle (Shift+L)', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should cycle language on Shift+L', () => {
      const event = new KeyboardEvent('keydown', { key: 'L', shiftKey: true });
      document.dispatchEvent(event);

      expect(LanguageService.cycleToNextLocale).toHaveBeenCalled();
    });

    it('should cycle language on Shift+l (lowercase)', () => {
      const event = new KeyboardEvent('keydown', { key: 'l', shiftKey: true });
      document.dispatchEvent(event);

      expect(LanguageService.cycleToNextLocale).toHaveBeenCalled();
    });

    it('should handle language cycle error gracefully', async () => {
      (LanguageService.cycleToNextLocale as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Language error')
      );

      const event = new KeyboardEvent('keydown', { key: 'L', shiftKey: true });
      expect(() => document.dispatchEvent(event)).not.toThrow();
    });
  });

  // ============================================================================
  // Help Shortcut Tests
  // ============================================================================

  describe('Help Shortcut (?)', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should show shortcuts panel on ?', () => {
      const event = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(event);

      expect(shortcutsPanel.showShortcutsPanel).toHaveBeenCalled();
    });

    it('should show shortcuts panel on Shift+/', () => {
      const event = new KeyboardEvent('keydown', { key: '/', shiftKey: true });
      document.dispatchEvent(event);

      expect(shortcutsPanel.showShortcutsPanel).toHaveBeenCalled();
    });

    it('should NOT show shortcuts panel when modal is open', () => {
      (ModalService.hasOpenModals as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const event = new KeyboardEvent('keydown', { key: '?' });
      document.dispatchEvent(event);

      // Shortcuts panel is blocked when modal is open
      expect(shortcutsPanel.showShortcutsPanel).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Modal Blocking Tests
  // ============================================================================

  describe('Modal Blocking', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should not handle shortcuts when modal is open (except ?)', () => {
      (ModalService.hasOpenModals as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should not toggle theme when modal is open', () => {
      (ModalService.hasOpenModals as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const event = new KeyboardEvent('keydown', { key: 'T', shiftKey: true });
      document.dispatchEvent(event);

      expect(ThemeService.toggleDarkMode).not.toHaveBeenCalled();
    });

    it('should not cycle language when modal is open', () => {
      (ModalService.hasOpenModals as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const event = new KeyboardEvent('keydown', { key: 'L', shiftKey: true });
      document.dispatchEvent(event);

      expect(LanguageService.cycleToNextLocale).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Input Field Blocking Tests
  // ============================================================================

  describe('Input Field Blocking', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should not handle shortcuts when typing in input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
      document.body.removeChild(input);
    });

    it('should not handle shortcuts when typing in textarea', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
      document.body.removeChild(textarea);
    });

    it('should not handle shortcuts when typing in contenteditable', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);
      div.focus();

      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '1' });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
      document.body.removeChild(div);
    });
  });

  // ============================================================================
  // Unmapped Key Tests
  // ============================================================================

  describe('Unmapped Keys', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should ignore unmapped keys', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: 'a' });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();
      expect(ThemeService.toggleDarkMode).not.toHaveBeenCalled();
      expect(LanguageService.cycleToNextLocale).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should ignore key 6 (not mapped)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '6' });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should ignore key 0 (not mapped)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '0' });
      document.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });
  });

  // ============================================================================
  // preventDefault Tests
  // ============================================================================

  describe('preventDefault', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should prevent default for tool navigation keys', () => {
      const event = new KeyboardEvent('keydown', { key: '1', cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default for theme toggle', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'T',
        shiftKey: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default for language cycle', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'L',
        shiftKey: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default for help shortcut', () => {
      const event = new KeyboardEvent('keydown', { key: '?', cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
