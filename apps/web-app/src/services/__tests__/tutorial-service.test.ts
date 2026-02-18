/**
 * XIV Dye Tools - TutorialService Unit Tests
 * Tests for interactive tutorial system
 */

import { TutorialService, type TutorialTool } from '../tutorial-service';
import { StorageService } from '../storage-service';
import { LanguageService } from '../language-service';
import { ModalService } from '../modal-service';

// Mock dependencies
vi.mock('../storage-service', () => ({
  StorageService: {
    getItem: vi.fn(),
    setItem: vi.fn(() => true),
    removeItem: vi.fn(() => true),
  },
}));

vi.mock('../language-service', () => ({
  LanguageService: {
    t: vi.fn((key: string) => key),
  },
}));

vi.mock('../modal-service', () => ({
  ModalService: {
    show: vi.fn(() => 'modal-id'),
    dismissTop: vi.fn(),
  },
}));

vi.mock('@shared/constants', () => ({
  STORAGE_PREFIX: 'xivdyetools',
  STORAGE_KEYS: {
    TUTORIALS_DISABLED: 'xivdyetools_tutorials_disabled',
  },
}));

describe('TutorialService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    // Clean up any active tutorial
    if (TutorialService.getState().isActive) {
      TutorialService.skip();
    }
  });

  afterEach(() => {
    // Ensure tutorial is stopped
    if (TutorialService.getState().isActive) {
      TutorialService.skip();
    }
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('getState', () => {
    it('should return initial state', () => {
      const state = TutorialService.getState();

      expect(state.isActive).toBe(false);
      expect(state.currentTool).toBeNull();
      expect(state.currentStepIndex).toBe(0);
      expect(state.totalSteps).toBe(0);
    });

    it('should return a copy of state', () => {
      const state1 = TutorialService.getState();
      const state2 = TutorialService.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('subscribe', () => {
    it('should notify subscriber immediately with current state', () => {
      const listener = vi.fn();

      const unsubscribe = TutorialService.subscribe(listener);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          currentTool: null,
        })
      );

      unsubscribe();
    });

    it('should notify subscriber on state change', () => {
      const listener = vi.fn();
      const unsubscribe = TutorialService.subscribe(listener);

      listener.mockClear();

      TutorialService.start('harmony');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          currentTool: 'harmony',
        })
      );

      unsubscribe();
      TutorialService.skip();
    });

    it('should unsubscribe properly', () => {
      const listener = vi.fn();
      const unsubscribe = TutorialService.subscribe(listener);

      listener.mockClear();
      unsubscribe();

      TutorialService.start('harmony');

      expect(listener).not.toHaveBeenCalled();

      TutorialService.skip();
    });
  });

  // ============================================================================
  // Completion Tracking Tests
  // ============================================================================

  describe('isCompleted', () => {
    it('should return false when tutorial not completed', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      expect(TutorialService.isCompleted('harmony')).toBe(false);
    });

    it('should return true when tutorial completed with matching version', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue({
        completedAt: Date.now(),
        version: '1.0.0',
      });

      expect(TutorialService.isCompleted('harmony')).toBe(true);
    });

    it('should return false when version mismatch', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue({
        completedAt: Date.now(),
        version: '0.9.0',
      });

      expect(TutorialService.isCompleted('harmony')).toBe(false);
    });
  });

  describe('markCompleted', () => {
    it('should save completion record', () => {
      TutorialService.markCompleted('harmony');

      expect(StorageService.setItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_harmony'),
        expect.objectContaining({
          version: '1.0.0',
          completedAt: expect.any(Number),
        })
      );
    });
  });

  describe('resetCompletion', () => {
    it('should remove completion record for tool', () => {
      TutorialService.resetCompletion('harmony');

      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_harmony')
      );
    });
  });

  describe('resetAllCompletions', () => {
    it('should reset all tool completions and re-enable prompts', () => {
      TutorialService.resetAllCompletions();

      // 5 tutorial completions + 1 tutorials_disabled flag
      expect(StorageService.removeItem).toHaveBeenCalledTimes(6);
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_harmony')
      );
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_matcher')
      );
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_comparison')
      );
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_mixer')
      );
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_accessibility')
      );
      // Also removes the global disabled flag
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorials_disabled')
      );
    });
  });

  // ============================================================================
  // Global Disable Tests
  // ============================================================================

  describe('areAllPromptsDisabled', () => {
    it('should return false when not disabled', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(false);
      expect(TutorialService.areAllPromptsDisabled()).toBe(false);
    });

    it('should return false when key does not exist', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      expect(TutorialService.areAllPromptsDisabled()).toBe(false);
    });

    it('should return true when disabled', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(true);
      expect(TutorialService.areAllPromptsDisabled()).toBe(true);
    });
  });

  describe('disableAllPrompts', () => {
    it('should set disabled flag to true', () => {
      TutorialService.disableAllPrompts();
      expect(StorageService.setItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorials_disabled'),
        true
      );
    });
  });

  describe('enableAllPrompts', () => {
    it('should remove disabled flag', () => {
      TutorialService.enableAllPrompts();
      expect(StorageService.removeItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorials_disabled')
      );
    });
  });

  describe('promptStart with global disable', () => {
    it('should not show modal when all prompts are disabled', () => {
      // Simulate disabled state
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key.includes('tutorials_disabled')) return true;
        return null; // Tutorial not completed
      });

      TutorialService.promptStart('harmony');

      expect(ModalService.show).not.toHaveBeenCalled();
    });

    it('should handle disable all button click', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      let capturedContent: HTMLElement | null = null;

      // Capture the modal content
      (ModalService.show as ReturnType<typeof vi.fn>).mockImplementation((options) => {
        capturedContent = options.content as HTMLElement;
        return 'modal-id';
      });

      TutorialService.promptStart('harmony');

      // Find and click the disable all button (Skip, Disable All, Start - index 1)
      const buttons = (capturedContent as HTMLElement | null)?.querySelectorAll('button');
      const disableAllButton = buttons?.[1]; // Second button is disable all

      if (disableAllButton) {
        disableAllButton.click();
      }

      // Should dismiss modal and disable all prompts
      expect(ModalService.dismissTop).toHaveBeenCalled();
      expect(StorageService.setItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorials_disabled'),
        true
      );
    });
  });

  // ============================================================================
  // Tutorial Control Tests
  // ============================================================================

  describe('start', () => {
    it('should start tutorial for valid tool', () => {
      TutorialService.start('harmony');

      const state = TutorialService.getState();

      expect(state.isActive).toBe(true);
      expect(state.currentTool).toBe('harmony');
      expect(state.currentStepIndex).toBe(0);
      expect(state.totalSteps).toBeGreaterThan(0);

      TutorialService.skip();
    });

    it('should dispatch tutorial:show-step event', () => {
      const listener = vi.fn();
      document.addEventListener('tutorial:show-step', listener);

      TutorialService.start('harmony');

      expect(listener).toHaveBeenCalled();

      document.removeEventListener('tutorial:show-step', listener);
      TutorialService.skip();
    });

    it('should handle invalid tool gracefully', () => {
      TutorialService.start('invalid' as TutorialTool);

      const state = TutorialService.getState();
      expect(state.isActive).toBe(false);
    });
  });

  describe('next', () => {
    it('should advance to next step', () => {
      TutorialService.start('harmony');
      const initialIndex = TutorialService.getState().currentStepIndex;

      TutorialService.next();

      expect(TutorialService.getState().currentStepIndex).toBe(initialIndex + 1);

      TutorialService.skip();
    });

    it('should complete tutorial at last step', () => {
      TutorialService.start('comparison'); // 3 steps

      // Advance to last step and beyond
      TutorialService.next();
      TutorialService.next();
      TutorialService.next();

      const state = TutorialService.getState();
      expect(state.isActive).toBe(false);
    });

    it('should do nothing when tutorial not active', () => {
      TutorialService.next();

      expect(TutorialService.getState().isActive).toBe(false);
    });
  });

  describe('previous', () => {
    it('should go back to previous step', () => {
      TutorialService.start('harmony');
      TutorialService.next();

      const currentIndex = TutorialService.getState().currentStepIndex;

      TutorialService.previous();

      expect(TutorialService.getState().currentStepIndex).toBe(currentIndex - 1);

      TutorialService.skip();
    });

    it('should not go below step 0', () => {
      TutorialService.start('harmony');

      TutorialService.previous();

      expect(TutorialService.getState().currentStepIndex).toBe(0);

      TutorialService.skip();
    });

    it('should do nothing when tutorial not active', () => {
      TutorialService.previous();

      expect(TutorialService.getState().isActive).toBe(false);
    });
  });

  describe('skip', () => {
    it('should skip tutorial without marking complete', () => {
      TutorialService.start('harmony');
      TutorialService.skip();

      const state = TutorialService.getState();

      expect(state.isActive).toBe(false);
      expect(StorageService.setItem).not.toHaveBeenCalledWith(
        expect.stringContaining('tutorial_harmony'),
        expect.anything()
      );
    });

    it('should dispatch tutorial:end event', () => {
      const listener = vi.fn();
      document.addEventListener('tutorial:end', listener);

      TutorialService.start('harmony');
      TutorialService.skip();

      expect(listener).toHaveBeenCalled();

      document.removeEventListener('tutorial:end', listener);
    });

    it('should do nothing when tutorial not active', () => {
      expect(() => TutorialService.skip()).not.toThrow();
    });
  });

  describe('complete', () => {
    it('should complete tutorial and mark as done', () => {
      TutorialService.start('harmony');
      TutorialService.complete();

      const state = TutorialService.getState();

      expect(state.isActive).toBe(false);
      expect(StorageService.setItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_harmony'),
        expect.anything()
      );
    });

    it('should do nothing when tutorial not active', () => {
      TutorialService.complete();

      expect(StorageService.setItem).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Tutorial Access Tests
  // ============================================================================

  describe('getTutorial', () => {
    it('should return tutorial for valid tool', () => {
      const tutorial = TutorialService.getTutorial('harmony');

      expect(tutorial).not.toBeNull();
      expect(tutorial?.tool).toBe('harmony');
      expect(tutorial?.steps.length).toBeGreaterThan(0);
    });

    it('should return null for invalid tool', () => {
      const tutorial = TutorialService.getTutorial('invalid' as TutorialTool);

      expect(tutorial).toBeNull();
    });
  });

  describe('getCurrentStep', () => {
    it('should return current step when tutorial active', () => {
      TutorialService.start('harmony');

      const step = TutorialService.getCurrentStep();

      expect(step).not.toBeNull();
      expect(step?.id).toBeDefined();

      TutorialService.skip();
    });

    it('should return null when tutorial not active', () => {
      const step = TutorialService.getCurrentStep();

      expect(step).toBeNull();
    });
  });

  describe('isAvailable', () => {
    it('should return true when tutorials exist', () => {
      expect(TutorialService.isAvailable()).toBe(true);
    });
  });

  // ============================================================================
  // Tutorial Steps Tests
  // ============================================================================

  describe('Tutorial Steps', () => {
    it('should have harmony tutorial with 4 steps', () => {
      const tutorial = TutorialService.getTutorial('harmony');
      expect(tutorial?.steps.length).toBe(4);
    });

    it('should have matcher tutorial with 4 steps', () => {
      const tutorial = TutorialService.getTutorial('matcher');
      expect(tutorial?.steps.length).toBe(4);
    });

    it('should have comparison tutorial with 3 steps', () => {
      const tutorial = TutorialService.getTutorial('comparison');
      expect(tutorial?.steps.length).toBe(3);
    });

    it('should have mixer tutorial with 4 steps', () => {
      const tutorial = TutorialService.getTutorial('mixer');
      expect(tutorial?.steps.length).toBe(4);
    });

    it('should have accessibility tutorial with 3 steps', () => {
      const tutorial = TutorialService.getTutorial('accessibility');
      expect(tutorial?.steps.length).toBe(3);
    });

    it('should have valid step properties', () => {
      const tutorial = TutorialService.getTutorial('harmony');

      tutorial?.steps.forEach((step) => {
        expect(step.id).toBeDefined();
        expect(step.target).toBeDefined();
        expect(step.titleKey).toBeDefined();
        expect(step.descriptionKey).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Prompt Start Tests
  // ============================================================================

  describe('promptStart', () => {
    it('should show modal prompt for uncompleted tutorial', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      TutorialService.promptStart('harmony');

      expect(ModalService.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom',
          size: 'sm',
        })
      );
    });

    it('should not show modal for completed tutorial', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue({
        completedAt: Date.now(),
        version: '1.0.0',
      });

      TutorialService.promptStart('harmony');

      expect(ModalService.show).not.toHaveBeenCalled();
    });

    it('should handle skip button click and mark tutorial complete', () => {
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      let capturedContent: HTMLElement | null = null;

      // Capture the modal content
      (ModalService.show as ReturnType<typeof vi.fn>).mockImplementation((options) => {
        capturedContent = options.content as HTMLElement;
        return 'modal-id';
      });

      TutorialService.promptStart('harmony');

      // Find and click the skip button
      const buttons = (capturedContent as HTMLElement | null)?.querySelectorAll('button');
      const skipButton = buttons?.[0]; // First button is skip

      if (skipButton) {
        skipButton.click();
      }

      // Should dismiss modal and mark as complete
      expect(ModalService.dismissTop).toHaveBeenCalled();
      expect(StorageService.setItem).toHaveBeenCalledWith(
        expect.stringContaining('tutorial_harmony'),
        expect.anything()
      );
    });

    it('should handle start button click and begin tutorial', () => {
      vi.useFakeTimers();
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      let capturedContent: HTMLElement | null = null;

      // Capture the modal content
      (ModalService.show as ReturnType<typeof vi.fn>).mockImplementation((options) => {
        capturedContent = options.content as HTMLElement;
        return 'modal-id';
      });

      TutorialService.promptStart('harmony');

      // Find and click the start button (Skip, Disable All, Start - index 2)
      const buttons = (capturedContent as HTMLElement | null)?.querySelectorAll('button');
      const startButton = buttons?.[2]; // Third button is start

      if (startButton) {
        startButton.click();
      }

      // Should dismiss modal
      expect(ModalService.dismissTop).toHaveBeenCalled();

      // Advance timer to trigger tutorial start
      vi.advanceTimersByTime(300);

      // Tutorial should be started
      expect(TutorialService.getState().isActive).toBe(true);
      expect(TutorialService.getState().currentTool).toBe('harmony');

      TutorialService.skip();
      vi.useRealTimers();
    });
  });

  // ============================================================================
  // Event Dispatch Tests
  // ============================================================================

  describe('Event Dispatch', () => {
    it('should dispatch tutorial:show-step with step details', () => {
      const listener = vi.fn();
      document.addEventListener('tutorial:show-step', listener);

      TutorialService.start('harmony');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            step: expect.objectContaining({ id: 'base-color' }),
            stepIndex: 0,
            totalSteps: 4,
          }),
        })
      );

      document.removeEventListener('tutorial:show-step', listener);
      TutorialService.skip();
    });

    it('should dispatch tutorial:end on cleanup', () => {
      const listener = vi.fn();
      document.addEventListener('tutorial:end', listener);

      TutorialService.start('harmony');
      TutorialService.skip();

      expect(listener).toHaveBeenCalled();

      document.removeEventListener('tutorial:end', listener);
    });
  });

  // ============================================================================
  // BeforeShow Callback Tests
  // ============================================================================

  describe('BeforeShow Callback', () => {
    it('should handle step with beforeShow callback', async () => {
      // The tutorial definitions have steps without beforeShow
      // This tests that the service handles the presence/absence of beforeShow
      TutorialService.start('harmony');

      // Just verify it doesn't crash
      expect(TutorialService.getState().isActive).toBe(true);

      TutorialService.skip();
    });
  });

  // ============================================================================
  // State Reset Tests
  // ============================================================================

  describe('State Reset', () => {
    it('should reset state on cleanup', () => {
      TutorialService.start('harmony');
      TutorialService.next();

      TutorialService.skip();

      const state = TutorialService.getState();

      expect(state.isActive).toBe(false);
      expect(state.currentTool).toBeNull();
      expect(state.currentStepIndex).toBe(0);
      expect(state.totalSteps).toBe(0);
    });
  });

  // ============================================================================
  // All Tools Tests
  // ============================================================================

  describe('All Tools', () => {
    const tools: TutorialTool[] = ['harmony', 'matcher', 'comparison', 'mixer', 'accessibility'];

    tools.forEach((tool) => {
      it(`should start tutorial for ${tool}`, () => {
        TutorialService.start(tool);

        const state = TutorialService.getState();

        expect(state.isActive).toBe(true);
        expect(state.currentTool).toBe(tool);

        TutorialService.skip();
      });

      it(`should track completion for ${tool}`, () => {
        TutorialService.markCompleted(tool);

        expect(StorageService.setItem).toHaveBeenCalledWith(
          expect.stringContaining(`tutorial_${tool}`),
          expect.anything()
        );
      });
    });
  });
});
