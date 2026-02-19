/**
 * XIV Dye Tools v4.0 - V4 Layout Entry Point
 *
 * Initializes the V4LayoutShell with RouterService integration.
 * Handles tool lazy-loading and navigation with the new glassmorphism UI.
 *
 * This module mirrors v3-layout.ts but uses the V4 component architecture:
 * - V4LayoutShell (header + tool banner + sidebar + content)
 * - ConfigController for centralized config state
 * - Tools rendered inside the shell's content slot
 *
 * @module components/v4-layout
 */

import { RouterService, type ToolId } from '@services/router-service';
import { ConfigController } from '@services/config-controller';
import { LanguageService, StorageService, ModalService } from '@services/index';
import { TutorialService, type TutorialTool } from '@services/tutorial-service';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { STORAGE_PREFIX } from '@shared/constants';
import type { BaseComponent } from './base-component';
import type { V4LayoutShell } from './v4/v4-layout-shell';
import { ModalContainer } from './modal-container';
import { ToastContainer } from './toast-container';
import { showThemeModal } from './v4/theme-modal';
import { showLanguageModal } from './v4/language-modal';
import { showAboutModal } from './about-modal';
import { WelcomeModal } from './welcome-modal';

// Import V4 layout shell (registers custom element)
import '@components/v4/v4-layout-shell';

// Track active tool instance for cleanup
let activeTool: BaseComponent | null = null;
let layoutElement: V4LayoutShell | null = null;
let _configController: ConfigController | null = null;
let languageUnsubscribe: (() => void) | null = null;
let configUnsubscribe: (() => void) | null = null;
let modalContainer: ModalContainer | null = null;
let toastContainer: ToastContainer | null = null;

// ============================================================================
// Tutorial Integration
// ============================================================================

/**
 * Mapping from router tool IDs to tutorial tool IDs
 * Note: Router uses different IDs than tutorials for some tools
 */
const TOOL_TO_TUTORIAL: Partial<Record<ToolId, TutorialTool>> = {
  harmony: 'harmony',
  extractor: 'matcher', // Router uses 'extractor', tutorial uses 'matcher'
  comparison: 'comparison',
  gradient: 'mixer', // Router uses 'gradient', tutorial uses 'mixer'
  accessibility: 'accessibility',
};

/**
 * Get storage key for tracking if a tool's tutorial has been offered
 */
function getTutorialOfferedKey(tool: TutorialTool): string {
  return `${STORAGE_PREFIX}_tutorial_offered_${tool}`;
}

/**
 * Check if tutorial has been offered for this tool
 */
function isTutorialOffered(tool: TutorialTool): boolean {
  return StorageService.getItem<boolean>(getTutorialOfferedKey(tool), false) ?? false;
}

/**
 * Mark tutorial as offered for this tool
 */
function markTutorialOffered(tool: TutorialTool): void {
  StorageService.setItem(getTutorialOfferedKey(tool), true);
}

/**
 * Prompt user to take tutorial on first visit to a tool
 * Only prompts once per tool, respects completion status
 */
function promptTutorialIfFirstVisit(tool: TutorialTool): void {
  // Skip if welcome modal hasn't been dismissed yet (user is brand new)
  if (WelcomeModal.shouldShow()) {
    return;
  }

  // Skip if tutorial already completed
  if (TutorialService.isCompleted(tool)) {
    return;
  }

  // Skip if tutorial already offered for this tool
  if (isTutorialOffered(tool)) {
    return;
  }

  // Skip if another modal is open
  if (ModalService.hasOpenModals()) {
    return;
  }

  // Skip if a tutorial is currently active
  if (TutorialService.getState().isActive) {
    return;
  }

  // Mark as offered before prompting (prevents race conditions)
  markTutorialOffered(tool);

  // Small delay to let tool render completely before showing tutorial prompt
  setTimeout(() => {
    TutorialService.promptStart(tool);
  }, 800);
}

// ============================================================================
// Layout Initialization
// ============================================================================

/**
 * Initialize the v4 layout
 */
export async function initializeV4Layout(container: HTMLElement): Promise<void> {
  // Initialize router
  RouterService.initialize();

  // Get config controller instance
  _configController = ConfigController.getInstance();

  const initialTool = RouterService.getCurrentToolId();
  logger.info(`[V4 Layout] Initializing with tool: ${initialTool}`);

  // Create V4LayoutShell element
  layoutElement = document.createElement('v4-layout-shell') as V4LayoutShell;
  layoutElement.setAttribute('active-tool', initialTool);
  container.appendChild(layoutElement);

  // Listen for tool changes from ToolBanner
  layoutElement.addEventListener('tool-change', ((e: CustomEvent<{ toolId: ToolId }>) => {
    const { toolId } = e.detail;
    RouterService.navigateTo(toolId);
  }) as EventListener);

  // Listen for config changes from ConfigSidebar
  layoutElement.addEventListener('config-change', ((
    e: CustomEvent<{ tool: string; key: string; value: unknown }>
  ) => {
    const { tool, key, value } = e.detail;
    logger.debug(`[V4 Layout] Config change: ${tool}.${key} = ${value}`);

    // Notify active tool if it has setConfig method
    // Pass the full context (tool, key, value) so tools can handle
    // both tool-specific config and shared market config
    if (activeTool && 'setConfig' in activeTool) {
      (
        activeTool as BaseComponent & { setConfig: (config: Record<string, unknown>) => void }
      ).setConfig({ _tool: tool, [key]: value });
    }
  }) as EventListener);

  // Listen for dye selections from the Color Palette drawer
  layoutElement.addEventListener('dye-selected', ((
    e: CustomEvent<{ dye: { id: number; name: string; hex: string } }>
  ) => {
    const { dye } = e.detail;
    logger.debug(`[V4 Layout] Dye selected from palette: ${dye.name}`);

    // Route dye selection to active tool if it has selectDye method
    if (activeTool && 'selectDye' in activeTool) {
      (activeTool as BaseComponent & { selectDye: (dye: unknown) => void }).selectDye(dye);
    } else if (activeTool && 'addDye' in activeTool) {
      // Fallback for tools that use addDye instead of selectDye
      (activeTool as BaseComponent & { addDye: (dye: unknown) => void }).addDye(dye);
    } else {
      logger.debug(
        `[V4 Layout] Tool ${RouterService.getCurrentToolId()} does not support dye selection`
      );
    }
  }) as EventListener);

  // Listen for clear all dyes request from the Color Palette drawer
  layoutElement.addEventListener('clear-all-dyes', (() => {
    logger.debug('[V4 Layout] Clear all dyes requested');

    // Route clear request to active tool if it has clearDyes or clearSelection method
    if (activeTool && 'clearDyes' in activeTool) {
      (activeTool as BaseComponent & { clearDyes: () => void }).clearDyes();
    } else if (activeTool && 'clearSelection' in activeTool) {
      // Fallback for tools that use clearSelection instead of clearDyes
      (activeTool as BaseComponent & { clearSelection: () => void }).clearSelection();
    } else {
      logger.debug(
        `[V4 Layout] Tool ${RouterService.getCurrentToolId()} does not support clearing dyes`
      );
    }
  }) as EventListener);

  // Listen for custom color selections from the Color Palette drawer
  layoutElement.addEventListener('custom-color-selected', ((e: CustomEvent<{ hex: string }>) => {
    const { hex } = e.detail;
    logger.debug(`[V4 Layout] Custom color selected: ${hex}`);

    // Route custom color to active tool if it has selectCustomColor method
    if (activeTool && 'selectCustomColor' in activeTool) {
      (
        activeTool as BaseComponent & { selectCustomColor: (hex: string) => void }
      ).selectCustomColor(hex);
    } else {
      logger.debug(
        `[V4 Layout] Tool ${RouterService.getCurrentToolId()} does not support custom color selection`
      );
    }
  }) as EventListener);

  // Listen for theme button click from header
  layoutElement.addEventListener('theme-click', (() => {
    logger.debug('[V4 Layout] Theme button clicked');
    showThemeModal();
  }) as EventListener);

  // Listen for about button click from header
  layoutElement.addEventListener('about-click', (() => {
    logger.debug('[V4 Layout] About button clicked');
    showAboutModal();
  }) as EventListener);

  // Listen for language button click from header
  layoutElement.addEventListener('language-click', (() => {
    logger.debug('[V4 Layout] Language button clicked');
    showLanguageModal();
  }) as EventListener);

  // Initialize modal container for v4 layout
  // Create modal root if it doesn't exist
  let modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.appendChild(modalRoot);
  }
  modalContainer = new ModalContainer(modalRoot);
  modalContainer.init();

  // Initialize toast container for v4 layout
  // Create toast root if it doesn't exist
  let toastRoot = document.getElementById('toast-root');
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    document.body.appendChild(toastRoot);
  }
  toastContainer = new ToastContainer(toastRoot);
  toastContainer.init();

  // Subscribe to route changes (browser back/forward)
  RouterService.subscribe((state) => {
    logger.info(`[V4 Layout] Route changed to: ${state.toolId}`);
    if (layoutElement) {
      layoutElement.setAttribute('active-tool', state.toolId);
    }
    void loadToolContent(state.toolId);
  });

  // Subscribe to language changes for re-rendering
  languageUnsubscribe = LanguageService.subscribe(() => {
    logger.info('[V4 Layout] Language changed, tool may need refresh');
  });

  // Wait for V4LayoutShell to complete its initial Lit render
  // This ensures the shadow DOM is available before we query for content container
  await layoutElement.updateComplete;

  // Load initial tool
  await loadToolContent(initialTool);

  logger.info('[V4 Layout] Initialized successfully');
}

/**
 * Get the content container inside V4LayoutShell's shadow DOM
 */
function getContentContainer(): HTMLElement | null {
  if (!layoutElement) return null;

  // V4LayoutShell uses shadow DOM, so we need to query inside it
  const shadowRoot = layoutElement.shadowRoot;
  if (!shadowRoot) {
    logger.warn('[V4 Layout] No shadow root found on layout element');
    return null;
  }

  // The content scroll container
  const contentScroll = shadowRoot.querySelector('.v4-layout-content-scroll');
  return contentScroll as HTMLElement | null;
}

/**
 * Load tool content into the V4 layout content area
 */
async function loadToolContent(toolId: ToolId): Promise<void> {
  const contentContainer = getContentContainer();

  if (!contentContainer) {
    logger.error('[V4 Layout] Content container not found');
    return;
  }

  // Cleanup previous tool
  if (activeTool) {
    activeTool.destroy();
    activeTool = null;
  }

  // Clear existing content
  clearContainer(contentContainer);

  // Show loading state
  contentContainer.innerHTML = `
    <div class="flex items-center justify-center h-64">
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style="border-color: var(--theme-primary); border-top-color: transparent;"></div>
        <p style="color: var(--theme-text-muted);">Loading ${toolId}...</p>
      </div>
    </div>
  `;

  // Create panel containers for tool
  // V4 tools need left/right panel containers, even though ConfigSidebar is separate
  const toolContainer = document.createElement('div');
  toolContainer.className = 'v4-tool-container';
  toolContainer.style.cssText = 'display: flex; flex-direction: column; height: 100%;';

  // For V4, the left panel content goes into ConfigSidebar (handled separately)
  // Tools render their main content directly
  const mainPanel = document.createElement('div');
  mainPanel.className = 'v4-tool-main';
  mainPanel.style.cssText = 'flex: 1; overflow-y: auto;';
  toolContainer.appendChild(mainPanel);

  // Load tool-specific content
  try {
    switch (toolId) {
      case 'harmony': {
        const { HarmonyTool } = await import('@components/harmony-tool');
        // In V4, tools render into the main content area
        // The ConfigSidebar handles configuration controls separately
        activeTool = new HarmonyTool(toolContainer, {
          leftPanel: mainPanel, // Tool will use this for non-config content
          rightPanel: mainPanel,
          drawerContent: null, // V4 doesn't use drawer
        });
        activeTool.init();
        logger.info('[V4 Layout] Harmony tool loaded');
        break;
      }
      case 'extractor': {
        const { ExtractorTool } = await import('@components/extractor-tool');
        activeTool = new ExtractorTool(toolContainer, {
          leftPanel: mainPanel,
          rightPanel: mainPanel,
          drawerContent: null,
        });
        activeTool.init();
        logger.info('[V4 Layout] Extractor tool loaded');
        break;
      }
      case 'accessibility': {
        const { AccessibilityTool } = await import('@components/accessibility-tool');
        activeTool = new AccessibilityTool(toolContainer, {
          leftPanel: mainPanel,
          rightPanel: mainPanel,
          drawerContent: null,
        });
        activeTool.init();
        logger.info('[V4 Layout] Accessibility tool loaded');
        break;
      }
      case 'comparison': {
        const { ComparisonTool } = await import('@components/comparison-tool');
        activeTool = new ComparisonTool(toolContainer, {
          leftPanel: mainPanel,
          rightPanel: mainPanel,
          drawerContent: null,
        });
        activeTool.init();
        logger.info('[V4 Layout] Comparison tool loaded');
        break;
      }
      case 'gradient': {
        const { GradientTool } = await import('@components/gradient-tool');
        activeTool = new GradientTool(toolContainer, {
          leftPanel: mainPanel,
          rightPanel: mainPanel,
          drawerContent: null,
        });
        activeTool.init();
        logger.info('[V4 Layout] Gradient Builder loaded');
        break;
      }
      case 'mixer': {
        const { MixerTool } = await import('@components/mixer-tool');
        activeTool = new MixerTool(toolContainer, {
          leftPanel: mainPanel,
          rightPanel: mainPanel,
          drawerContent: null,
        });
        activeTool.init();
        logger.info('[V4 Layout] Dye Mixer loaded');
        break;
      }
      case 'presets': {
        // Load v4 Lit-based preset tool
        await import('./v4/preset-tool');
        clearContainer(contentContainer);
        const presetTool = document.createElement('v4-preset-tool');
        contentContainer.appendChild(presetTool);
        logger.info('[V4 Layout] Presets tool loaded (v4)');
        return; // Early return since we handled the container directly
      }
      case 'budget': {
        const { BudgetTool } = await import('@components/budget-tool');
        activeTool = new BudgetTool(toolContainer, {
          leftPanel: mainPanel,
          rightPanel: mainPanel,
          drawerContent: null,
        });
        activeTool.init();
        logger.info('[V4 Layout] Budget tool loaded');
        break;
      }
      case 'swatch': {
        const { SwatchTool } = await import('@components/swatch-tool');
        activeTool = new SwatchTool(toolContainer, {
          leftPanel: mainPanel,
          rightPanel: mainPanel,
          drawerContent: null,
        });
        activeTool.init();
        logger.info('[V4 Layout] Swatch Matcher loaded');
        break;
      }
      default:
        renderPlaceholder(contentContainer, toolId);
        return;
    }

    // Clear loading and append tool container
    clearContainer(contentContainer);
    contentContainer.appendChild(toolContainer);

    // Check if we should prompt for tutorial on first visit to this tool
    const tutorialTool = TOOL_TO_TUTORIAL[toolId];
    if (tutorialTool) {
      promptTutorialIfFirstVisit(tutorialTool);
    }
  } catch (error) {
    logger.error(`[V4 Layout] Failed to load ${toolId}:`, error);
    contentContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center text-center" style="min-height: 400px; padding: 3rem 2rem;">
        <svg style="width: 150px; height: 150px; opacity: 0.25; margin-bottom: 1.5rem; color: var(--theme-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--theme-text);">Failed to load tool</p>
        <p style="font-size: 1rem; opacity: 0.7; color: var(--theme-text);">Please try again or refresh the page</p>
      </div>
    `;
  }
}

/**
 * Render placeholder for unknown tools
 */
function renderPlaceholder(container: HTMLElement, toolId: string): void {
  container.innerHTML = `
    <div class="flex flex-col items-center justify-center text-center" style="min-height: 400px; padding: 3rem 2rem;">
      <svg style="width: 150px; height: 150px; opacity: 0.25; margin-bottom: 1.5rem; color: var(--theme-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <p style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--theme-text);">${toolId} Tool</p>
      <p style="font-size: 1rem; opacity: 0.7; color: var(--theme-text);">Coming soon</p>
    </div>
  `;
}

/**
 * Cleanup the v4 layout
 */
export function destroyV4Layout(): void {
  // Clean up subscriptions
  if (languageUnsubscribe) {
    languageUnsubscribe();
    languageUnsubscribe = null;
  }

  if (configUnsubscribe) {
    configUnsubscribe();
    configUnsubscribe = null;
  }

  // Clean up tool
  if (activeTool) {
    activeTool.destroy();
    activeTool = null;
  }

  // Clean up modal container
  if (modalContainer) {
    modalContainer.destroy();
    modalContainer = null;
  }

  // Clean up toast container
  if (toastContainer) {
    toastContainer.destroy();
    toastContainer = null;
  }

  // Clean up layout element
  if (layoutElement) {
    layoutElement.remove();
    layoutElement = null;
  }

  // Clean up router
  RouterService.destroy();

  _configController = null;

  logger.info('[V4 Layout] Destroyed');
}
