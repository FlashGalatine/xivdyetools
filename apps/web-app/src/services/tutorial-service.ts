/**
 * XIV Dye Tools v2.4.0 - Tutorial Service
 *
 * Interactive tutorial system with step-by-step guidance
 * Uses spotlight/coach-mark pattern to highlight features
 *
 * @module services/tutorial-service
 */

import { StorageService } from './storage-service';
import { LanguageService } from './language-service';
import { ModalService } from './modal-service';
import { logger } from '@shared/logger';
import { STORAGE_PREFIX, STORAGE_KEYS } from '@shared/constants';

// ============================================================================
// Tutorial Types
// ============================================================================

/**
 * Tool identifier for tutorial tracking
 */
export type TutorialTool = 'harmony' | 'matcher' | 'comparison' | 'mixer' | 'accessibility';

/**
 * Single tutorial step definition
 */
export interface TutorialStep {
  /** Unique step identifier */
  id: string;
  /** CSS selector or element ID for the target element */
  target: string;
  /** Locale key for title (e.g., 'tutorial.harmony.step1.title') */
  titleKey: string;
  /** Locale key for description */
  descriptionKey: string;
  /** Preferred tooltip position relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Optional action to perform before showing this step */
  beforeShow?: () => void | Promise<void>;
  /** Optional callback when step is shown */
  onShow?: () => void;
  /** Whether to highlight multiple elements (comma-separated selectors) */
  multipleTargets?: boolean;
}

/**
 * Tutorial definition for a tool
 */
export interface Tutorial {
  /** Tool identifier */
  tool: TutorialTool;
  /** Array of steps in order */
  steps: TutorialStep[];
}

/**
 * Tutorial state
 */
interface TutorialState {
  isActive: boolean;
  currentTool: TutorialTool | null;
  currentStepIndex: number;
  totalSteps: number;
}

/**
 * Tutorial completion record
 */
interface TutorialCompletion {
  completedAt: number;
  version: string;
}

// ============================================================================
// Tutorial Definitions
// ============================================================================

/**
 * Harmony Generator tutorial steps
 *
 * Note: Selectors must work with Shadow DOM (querySelectorDeep traverses shadow roots).
 * V4 layout uses Lit components - elements are inside shadow DOM of:
 * - v4-layout-shell → dye-palette-drawer, v4-config-sidebar, v4-tool-banner
 */
const HARMONY_TUTORIAL: Tutorial = {
  tool: 'harmony',
  steps: [
    {
      id: 'base-color',
      // Target the swatch grid in dye-palette-drawer (inside shadow DOM)
      target: '.swatch-grid, .category-section',
      titleKey: 'tutorial.harmony.baseColor.title',
      descriptionKey: 'tutorial.harmony.baseColor.description',
      position: 'left',
    },
    {
      id: 'search-filter',
      // Target the search and filter area in dye-palette-drawer
      target: '.filter-bar, .search-box',
      titleKey: 'tutorial.harmony.filters.title',
      descriptionKey: 'tutorial.harmony.filters.description',
      position: 'left',
    },
    {
      id: 'favorites',
      // Target the favorites section in dye-palette-drawer
      target: '.favorites-section',
      titleKey: 'tutorial.harmony.favorites.title',
      descriptionKey: 'tutorial.harmony.favorites.description',
      position: 'left',
    },
    {
      id: 'tool-banner',
      // Target the tool banner for navigation
      target: 'v4-tool-banner, .v4-tool-banner',
      titleKey: 'tutorial.harmony.toolBanner.title',
      descriptionKey: 'tutorial.harmony.toolBanner.description',
      position: 'bottom',
    },
  ],
};

/**
 * Color Matcher (Extractor) tutorial steps
 *
 * Note: "matcher" is the internal tutorial tool name, but the tool is called "extractor" in the router.
 * This tutorial focuses on the palette extractor functionality.
 */
const MATCHER_TUTORIAL: Tutorial = {
  tool: 'matcher',
  steps: [
    {
      id: 'color-palette',
      // Target the swatch grid in dye-palette-drawer for selecting colors
      target: '.swatch-grid, .category-section',
      titleKey: 'tutorial.matcher.palette.title',
      descriptionKey: 'tutorial.matcher.palette.description',
      position: 'left',
    },
    {
      id: 'extraction-settings',
      // Target the config toggle for vibrancy boost
      target: '.config-row, v4-toggle-switch',
      titleKey: 'tutorial.matcher.settings.title',
      descriptionKey: 'tutorial.matcher.settings.description',
      position: 'right',
    },
    {
      id: 'max-colors',
      // Target the slider wrapper for max colors
      target: '.slider-wrapper, v4-range-slider',
      titleKey: 'tutorial.matcher.maxColors.title',
      descriptionKey: 'tutorial.matcher.maxColors.description',
      position: 'right',
    },
    {
      id: 'display-options',
      // Target the display options component
      target: 'v4-display-options',
      titleKey: 'tutorial.matcher.displayOptions.title',
      descriptionKey: 'tutorial.matcher.displayOptions.description',
      position: 'right',
    },
  ],
};

/**
 * Dye Comparison tutorial steps
 */
const COMPARISON_TUTORIAL: Tutorial = {
  tool: 'comparison',
  steps: [
    {
      id: 'select-dyes',
      // Target the swatch grid to select dyes for comparison
      target: '.swatch-grid, .category-section',
      titleKey: 'tutorial.comparison.select.title',
      descriptionKey: 'tutorial.comparison.select.description',
      position: 'left',
    },
    {
      id: 'display-options',
      // Target the display options for customizing the comparison view
      target: 'v4-display-options',
      titleKey: 'tutorial.comparison.displayOptions.title',
      descriptionKey: 'tutorial.comparison.displayOptions.description',
      position: 'right',
    },
    {
      id: 'favorites',
      // Target the favorites section
      target: '.favorites-section',
      titleKey: 'tutorial.comparison.favorites.title',
      descriptionKey: 'tutorial.comparison.favorites.description',
      position: 'left',
    },
  ],
};

/**
 * Dye Mixer tutorial steps
 */
const MIXER_TUTORIAL: Tutorial = {
  tool: 'mixer',
  steps: [
    {
      id: 'select-colors',
      // Target the swatch grid to select colors to mix
      target: '.swatch-grid, .category-section',
      titleKey: 'tutorial.mixer.selectColors.title',
      descriptionKey: 'tutorial.mixer.selectColors.description',
      position: 'left',
    },
    {
      id: 'mixing-mode',
      // Target the mixing mode dropdown selector
      target: '.config-select',
      titleKey: 'tutorial.mixer.mixingMode.title',
      descriptionKey: 'tutorial.mixer.mixingMode.description',
      position: 'right',
    },
    {
      id: 'max-results',
      // Target the max results slider
      target: '.slider-wrapper, v4-range-slider',
      titleKey: 'tutorial.mixer.maxResults.title',
      descriptionKey: 'tutorial.mixer.maxResults.description',
      position: 'right',
    },
    {
      id: 'display-options',
      // Target the display options component
      target: 'v4-display-options',
      titleKey: 'tutorial.mixer.displayOptions.title',
      descriptionKey: 'tutorial.mixer.displayOptions.description',
      position: 'right',
    },
  ],
};

/**
 * Accessibility Checker tutorial steps
 */
const ACCESSIBILITY_TUTORIAL: Tutorial = {
  tool: 'accessibility',
  steps: [
    {
      id: 'select-dyes',
      // Target the swatch grid to select dyes for accessibility check
      target: '.swatch-grid, .category-section',
      titleKey: 'tutorial.accessibility.select.title',
      descriptionKey: 'tutorial.accessibility.select.description',
      position: 'left',
    },
    {
      id: 'vision-types',
      // Target the vision type toggle switches
      target: '.config-row, v4-toggle-switch',
      titleKey: 'tutorial.accessibility.visionTypes.title',
      descriptionKey: 'tutorial.accessibility.visionTypes.description',
      position: 'right',
    },
    {
      id: 'display-settings',
      // Target the simulation display toggles
      target: 'v4-display-options',
      titleKey: 'tutorial.accessibility.displaySettings.title',
      descriptionKey: 'tutorial.accessibility.displaySettings.description',
      position: 'right',
    },
  ],
};

/**
 * All tutorials indexed by tool
 */
const TUTORIALS: Record<TutorialTool, Tutorial> = {
  harmony: HARMONY_TUTORIAL,
  matcher: MATCHER_TUTORIAL,
  comparison: COMPARISON_TUTORIAL,
  mixer: MIXER_TUTORIAL,
  accessibility: ACCESSIBILITY_TUTORIAL,
};

// ============================================================================
// Storage Keys
// ============================================================================

const TUTORIAL_VERSION = '1.0.0';
const getStorageKey = (tool: TutorialTool): string => `${STORAGE_PREFIX}_tutorial_${tool}`;

// ============================================================================
// Tutorial Service Class
// ============================================================================

/**
 * Service for managing interactive tutorials
 * Static singleton pattern with event-driven updates
 */
export class TutorialService {
  private static state: TutorialState = {
    isActive: false,
    currentTool: null,
    currentStepIndex: 0,
    totalSteps: 0,
  };

  private static listeners: Set<(state: TutorialState) => void> = new Set();
  private static spotlightElement: HTMLElement | null = null;

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current tutorial state
   */
  static getState(): Readonly<TutorialState> {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  static subscribe(listener: (state: TutorialState) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private static notifyListeners(): void {
    const stateCopy = { ...this.state };
    this.listeners.forEach((listener) => listener(stateCopy));
  }

  // ============================================================================
  // Tutorial Completion Tracking
  // ============================================================================

  /**
   * Check if a tutorial has been completed
   */
  static isCompleted(tool: TutorialTool): boolean {
    const completion = StorageService.getItem<TutorialCompletion>(getStorageKey(tool));
    return completion !== null && completion.version === TUTORIAL_VERSION;
  }

  /**
   * Mark a tutorial as completed
   */
  static markCompleted(tool: TutorialTool): void {
    const completion: TutorialCompletion = {
      completedAt: Date.now(),
      version: TUTORIAL_VERSION,
    };
    StorageService.setItem(getStorageKey(tool), completion);
    logger.info(`Tutorial completed: ${tool}`);
  }

  /**
   * Reset tutorial completion for a tool
   */
  static resetCompletion(tool: TutorialTool): void {
    StorageService.removeItem(getStorageKey(tool));
    logger.info(`Tutorial reset: ${tool}`);
  }

  /**
   * Reset all tutorial completions and re-enable tutorial prompts
   */
  static resetAllCompletions(): void {
    const tools: TutorialTool[] = ['harmony', 'matcher', 'comparison', 'mixer', 'accessibility'];
    tools.forEach((tool) => this.resetCompletion(tool));
    // Also re-enable tutorial prompts if they were disabled
    this.enableAllPrompts();
    logger.info('All tutorials reset');
  }

  // ============================================================================
  // Tutorial Prompt Global Disable
  // ============================================================================

  /**
   * Check if all tutorial prompts are disabled
   */
  static areAllPromptsDisabled(): boolean {
    return StorageService.getItem<boolean>(STORAGE_KEYS.TUTORIALS_DISABLED, false) === true;
  }

  /**
   * Disable all tutorial prompts globally
   * User will no longer be prompted for any tutorials
   */
  static disableAllPrompts(): void {
    StorageService.setItem(STORAGE_KEYS.TUTORIALS_DISABLED, true);
    logger.info('All tutorial prompts disabled');
  }

  /**
   * Re-enable tutorial prompts
   * User will be prompted for tutorials again (for tools not yet completed)
   */
  static enableAllPrompts(): void {
    StorageService.removeItem(STORAGE_KEYS.TUTORIALS_DISABLED);
    logger.info('Tutorial prompts re-enabled');
  }

  // ============================================================================
  // Tutorial Control
  // ============================================================================

  /**
   * Start a tutorial for a specific tool
   */
  static start(tool: TutorialTool): void {
    const tutorial = TUTORIALS[tool];
    if (!tutorial || tutorial.steps.length === 0) {
      logger.warn(`No tutorial found for tool: ${tool}`);
      return;
    }

    this.state = {
      isActive: true,
      currentTool: tool,
      currentStepIndex: 0,
      totalSteps: tutorial.steps.length,
    };

    this.notifyListeners();
    void this.showCurrentStep();
    logger.info(`Tutorial started: ${tool}`);
  }

  /**
   * Show the current step
   */
  private static async showCurrentStep(): Promise<void> {
    if (!this.state.currentTool) return;

    const tutorial = TUTORIALS[this.state.currentTool];
    const step = tutorial.steps[this.state.currentStepIndex];

    if (!step) {
      this.complete();
      return;
    }

    // Execute beforeShow if defined
    if (step.beforeShow) {
      try {
        await step.beforeShow();
      } catch (error) {
        logger.warn('Tutorial beforeShow failed:', error);
      }
    }

    // Dispatch event for spotlight component to handle
    const event = new CustomEvent('tutorial:show-step', {
      detail: {
        step,
        stepIndex: this.state.currentStepIndex,
        totalSteps: this.state.totalSteps,
      },
      bubbles: true,
    });
    document.dispatchEvent(event);

    // Execute onShow callback
    if (step.onShow) {
      step.onShow();
    }
  }

  /**
   * Go to next step
   */
  static next(): void {
    if (!this.state.isActive || !this.state.currentTool) return;

    const tutorial = TUTORIALS[this.state.currentTool];
    if (this.state.currentStepIndex < tutorial.steps.length - 1) {
      this.state.currentStepIndex++;
      this.notifyListeners();
      void this.showCurrentStep();
    } else {
      this.complete();
    }
  }

  /**
   * Go to previous step
   */
  static previous(): void {
    if (!this.state.isActive || this.state.currentStepIndex <= 0) return;

    this.state.currentStepIndex--;
    this.notifyListeners();
    void this.showCurrentStep();
  }

  /**
   * Skip the tutorial
   */
  static skip(): void {
    if (!this.state.isActive) return;

    logger.info(`Tutorial skipped: ${this.state.currentTool}`);
    this.cleanup();
  }

  /**
   * Complete the tutorial
   */
  static complete(): void {
    if (!this.state.isActive || !this.state.currentTool) return;

    this.markCompleted(this.state.currentTool);
    this.cleanup();
  }

  /**
   * Clean up tutorial state
   */
  private static cleanup(): void {
    // Dispatch cleanup event
    document.dispatchEvent(new CustomEvent('tutorial:end'));

    this.state = {
      isActive: false,
      currentTool: null,
      currentStepIndex: 0,
      totalSteps: 0,
    };

    this.notifyListeners();
  }

  // ============================================================================
  // Tutorial Access
  // ============================================================================

  /**
   * Get tutorial for a tool
   */
  static getTutorial(tool: TutorialTool): Tutorial | null {
    return TUTORIALS[tool] ?? null;
  }

  /**
   * Get current step
   */
  static getCurrentStep(): TutorialStep | null {
    if (!this.state.currentTool) return null;

    const tutorial = TUTORIALS[this.state.currentTool];
    return tutorial.steps[this.state.currentStepIndex] ?? null;
  }

  /**
   * Check if tutorials are available
   */
  static isAvailable(): boolean {
    return Object.keys(TUTORIALS).length > 0;
  }

  // ============================================================================
  // Prompt to Start Tutorial
  // ============================================================================

  /**
   * Show prompt to start tutorial for a tool
   */
  static promptStart(tool: TutorialTool): void {
    // Don't show prompt if tool is already completed or all prompts are disabled
    if (this.isCompleted(tool) || this.areAllPromptsDisabled()) return;

    const content = document.createElement('div');
    content.className = 'text-center';

    const message = document.createElement('p');
    message.className = 'mb-4';
    message.style.color = 'var(--theme-text-muted)';
    message.textContent = LanguageService.t('tutorial.prompt.message');
    content.appendChild(message);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex flex-wrap justify-center gap-3';

    // Skip button - skips just this tour
    const skipBtn = document.createElement('button');
    skipBtn.className = 'px-4 py-2 text-sm rounded-lg transition-colors';
    skipBtn.style.backgroundColor = 'var(--theme-card-background)';
    skipBtn.style.color = 'var(--theme-text-muted)';
    skipBtn.textContent = LanguageService.t('tutorial.prompt.skip');
    skipBtn.addEventListener('click', () => {
      ModalService.dismissTop();
      this.markCompleted(tool); // Don't ask again for this tool
    });

    // Disable all button - disables all tour prompts
    const disableAllBtn = document.createElement('button');
    disableAllBtn.className = 'px-4 py-2 text-sm rounded-lg transition-colors';
    disableAllBtn.style.backgroundColor = 'var(--theme-card-background)';
    disableAllBtn.style.color = 'var(--theme-text-muted)';
    disableAllBtn.textContent = LanguageService.t('tutorial.prompt.disableAll');
    disableAllBtn.addEventListener('click', () => {
      ModalService.dismissTop();
      this.disableAllPrompts(); // Don't ask again for any tool
    });

    // Start tour button
    const startBtn = document.createElement('button');
    startBtn.className = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
    startBtn.style.backgroundColor = 'var(--theme-primary)';
    startBtn.style.color = 'var(--theme-text-header)';
    startBtn.textContent = LanguageService.t('tutorial.prompt.start');
    startBtn.addEventListener('click', () => {
      ModalService.dismissTop();
      setTimeout(() => this.start(tool), 300);
    });

    buttonContainer.appendChild(skipBtn);
    buttonContainer.appendChild(disableAllBtn);
    buttonContainer.appendChild(startBtn);
    content.appendChild(buttonContainer);

    ModalService.show({
      type: 'custom',
      title: `📚 ${LanguageService.t('tutorial.prompt.title')}`,
      content,
      size: 'sm',
      closable: true,
    });
  }
}
