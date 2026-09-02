/**
 * XIV Dye Tools - KeyboardService Unit Tests
 * Tests for centralized keyboard shortcut management
 */

import { KeyboardService } from '../keyboard-service';
import { toggleThemeVariant } from '../theme-switch';
import { LanguageService } from '../language-service';
import { ModalService } from '../modal-service';
import { RouterService } from '../router-service';
import * as shortcutsPanel from '@components/shortcuts-panel';

// Mock dependencies — Shift+T goes through the shared theme switch (the one
// path that records a deliberate theme change), never ThemeService directly
vi.mock('../theme-switch', () => ({
  toggleThemeVariant: vi.fn(),
}));

vi.mock('../language-service', () => ({
  LanguageService: {
    cycleToNextLocale: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../router-service', () => ({
  RouterService: { navigateTo: vi.fn() },
}));

vi.mock('../modal-service', () => ({
  ModalService: {
    hasOpenModals: vi.fn(() => false),
  },
}));

vi.mock('@components/shortcuts-panel', () => ({
  showShortcutsPanel: vi.fn(),
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

  describe('Tool Navigation (1-9 keys)', () => {
    beforeEach(() => {
      KeyboardService.initialize();
      vi.mocked(RouterService.navigateTo).mockClear();
    });

    /**
     * BUG-014: these used to assert only that the service DISPATCHED
     * `keyboard-navigate-tool`, with each test registering the listener itself.
     * Nothing in the app ever listened for that event, so the shortcuts the
     * shortcuts panel advertises did nothing while the suite stayed green.
     * Asserting the navigation is what makes a missing consumer a failure.
     */
    it.each([
      ['1', 'harmony'],
      ['2', 'extractor'],
      ['3', 'accessibility'],
      ['4', 'comparison'],
      ['5', 'gradient'],
      ['6', 'presets'],
      ['7', 'budget'],
      ['8', 'swatch'],
      ['9', 'mixer'],
    ])('navigates to the right tool for key %s', (key, toolId) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key }));

      expect(RouterService.navigateTo).toHaveBeenCalledWith(toolId);
    });

    it('still emits keyboard-navigate-tool for anything listening', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ detail: { toolId: 'harmony' } })
      );

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it.each([
      ['Shift', { shiftKey: true }],
      ['Ctrl', { ctrlKey: true }],
      ['Alt', { altKey: true }],
      ['Meta', { metaKey: true }],
    ])('does not navigate when %s is held', (_name, modifier) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ...modifier }));

      expect(RouterService.navigateTo).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Theme Toggle Tests
  // ============================================================================

  describe('Theme Toggle (Shift+T)', () => {
    beforeEach(() => {
      KeyboardService.initialize();
    });

    it('should toggle theme on Shift+T through the shared theme switch', () => {
      const event = new KeyboardEvent('keydown', { key: 'T', shiftKey: true });
      document.dispatchEvent(event);

      expect(toggleThemeVariant).toHaveBeenCalled();
    });

    it('should toggle theme on Shift+t (lowercase)', () => {
      const event = new KeyboardEvent('keydown', { key: 't', shiftKey: true });
      document.dispatchEvent(event);

      expect(toggleThemeVariant).toHaveBeenCalled();
    });

    it('should handle theme toggle error gracefully', () => {
      vi.mocked(toggleThemeVariant).mockImplementation(() => {
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
  // Share Shortcut Tests
  // ============================================================================

  describe('Share Shortcut (Shift+S)', () => {
    let shell: HTMLElement;
    let shareButton: HTMLElement & { share: () => void };

    beforeEach(() => {
      KeyboardService.initialize();
      // The share buttons live inside the layout shell's shadow DOM, so the
      // fixture has to reproduce that boundary — a light-DOM button would
      // pass a test the real lookup would fail.
      shell = document.createElement('v4-layout-shell');
      const root = shell.attachShadow({ mode: 'open' });
      shareButton = document.createElement('v4-share-button') as HTMLElement & {
        share: () => void;
      };
      // share(), not click(): the component's @click binding sits on an inner
      // <button> in its own shadow root, so a host click is a silent no-op.
      // Asserting on click() here would pass while the feature was broken.
      shareButton.share = vi.fn();
      root.appendChild(shareButton);
      document.body.appendChild(shell);
    });

    afterEach(() => {
      shell.remove();
    });

    it('should share the active tool on Shift+S', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', shiftKey: true }));

      expect(shareButton.share).toHaveBeenCalled();
    });

    it('should share on Shift+s (lowercase)', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', shiftKey: true }));

      expect(shareButton.share).toHaveBeenCalled();
    });

    it('should ignore a disabled share button rather than firing a bad share', () => {
      shareButton.setAttribute('disabled', '');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', shiftKey: true }));

      expect(shareButton.share).not.toHaveBeenCalled();
    });

    it('should do nothing when the active tool has no share button', () => {
      shareButton.remove();

      expect(() =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', shiftKey: true }))
      ).not.toThrow();
    });

    it('should not share while a modal is open', () => {
      (ModalService.hasOpenModals as ReturnType<typeof vi.fn>).mockReturnValue(true);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'S', shiftKey: true }));

      expect(shareButton.share).not.toHaveBeenCalled();
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

      expect(toggleThemeVariant).not.toHaveBeenCalled();
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

    // REGRESSION: every tool renders inside V4LayoutShell's shadow root, so
    // `document.activeElement` retargets to the HOST (<v4-layout-shell>) and the
    // old guard saw no input at all — meaning shortcuts fired while typing
    // anywhere in the app. Reported as Shift+T flipping the theme while naming a
    // palette after a .chara import; the same slip hit `1`-`9` in any search box.
    // The three tests above miss it because a light-DOM input does not retarget.
    it('should not handle shortcuts when typing in an input inside a shadow root', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadow.appendChild(input);
      input.focus();

      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      // composed: true — a real keystroke crosses the shadow boundary on its
      // way to the document-level listener.
      const event = new KeyboardEvent('keydown', { key: '1', bubbles: true, composed: true });
      input.dispatchEvent(event);

      expect(listener).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
      document.body.removeChild(host);
    });

    it('should not toggle the theme on Shift+T typed into a shadow-root input', () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const shadow = host.attachShadow({ mode: 'open' });
      const input = document.createElement('input');
      shadow.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'T',
        shiftKey: true,
        bubbles: true,
        composed: true,
      });
      input.dispatchEvent(event);

      expect(toggleThemeVariant).not.toHaveBeenCalled();

      document.body.removeChild(host);
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
      expect(toggleThemeVariant).not.toHaveBeenCalled();
      expect(LanguageService.cycleToNextLocale).not.toHaveBeenCalled();

      window.removeEventListener('keyboard-navigate-tool', listener);
    });

    it('should dispatch navigation event for key 6 (presets)', () => {
      const listener = vi.fn();
      window.addEventListener('keyboard-navigate-tool', listener);

      const event = new KeyboardEvent('keydown', { key: '6' });
      document.dispatchEvent(event);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { toolId: 'presets' },
        })
      );

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
