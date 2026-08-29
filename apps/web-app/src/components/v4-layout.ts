/**
 * XIV Dye Tools v4.0 - V4 Layout Entry Point
 *
 * Initializes the V4LayoutShell with RouterService integration.
 * Handles tool lazy-loading and navigation with the new glassmorphism UI.
 *
 * This module mirrors v3-layout.ts but uses the V4 component architecture:
 * - V4LayoutShell (header + tool banner + sidebar + content)
 * - Tools rendered inside the shell's content slot
 *
 * @module components/v4-layout
 */

import { RouterService, type ToolId } from '@services/router-service';
import { LanguageService, StorageService, ModalService } from '@services/index';
import { TutorialService, type TutorialTool } from '@services/tutorial-service';
import { TelemetryService, type ToolEntry } from '@services/telemetry-service';
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
import { showChangelogModal } from './changelog-modal';
import { showAdvancedOptionsPanel } from './advanced-options-panel';
import { WelcomeModal } from './welcome-modal';
// Rules that must reach tool content inside the shell's shadow root. The same
// file is @imported by styles/tailwind.css for the light-DOM (modal) mounts of
// the same components — one source, two scopes (2026-08-16 audit, DEAD-020).
import toolContentCss from '@/styles/tool-content.css?inline';

// Import V4 layout shell (registers custom element)
import '@components/v4/v4-layout-shell';

// Track active tool instance for cleanup
let activeTool: BaseComponent | null = null;
let layoutElement: V4LayoutShell | null = null;

// BUG-040 (2026-07-18 audit): monotonically increasing navigation sequence —
// a loadToolContent invocation that discovers it was superseded after an
// await must not instantiate its tool (orphaned instance with live
// subscriptions) or clobber the newer navigation's DOM.
let navigationSeq = 0;

// BUG-078: pending first-visit tutorial prompt timer (cleared on navigation)
let tutorialPromptTimer: ReturnType<typeof setTimeout> | null = null;
let modalContainer: ModalContainer | null = null;
let toastContainer: ToastContainer | null = null;

// Telemetry: only the tool the app booted into can be an 'initial' or 'share'
// entry; every later navigation is 'nav' (spec §1). Captured once in
// initializeV4Layout before the first loadToolContent call, then consumed
// (set back to null) by the first recordToolView.
let bootEntry: ToolEntry | null = null;

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

  // BUG-078 (2026-07-18 audit): managed timer, cleared on navigation; the
  // route is re-validated and the one-time offer is only burned when the
  // prompt actually fires — a raw uncancelled timer could pop the previous
  // tool's tutorial over the current tool and permanently consume its offer.
  if (tutorialPromptTimer !== null) {
    clearTimeout(tutorialPromptTimer);
  }

  // Small delay to let tool render completely before showing tutorial prompt
  tutorialPromptTimer = setTimeout(() => {
    tutorialPromptTimer = null;
    // Route changed during the delay — this prompt belongs to the old tool
    if (TOOL_TO_TUTORIAL[RouterService.getCurrentToolId()] !== tool) {
      return;
    }
    markTutorialOffered(tool);
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
    e: CustomEvent<{
      dye: { id: number; name: string; hex: string; stainID?: number };
      random?: boolean;
    }>
  ) => {
    const { dye, random } = e.detail;
    logger.debug(`[V4 Layout] Dye selected from palette: ${dye.name}`);

    // Telemetry: a swatch click is a deliberate pick; the random button is not
    if (!random && typeof dye.stainID === 'number') {
      TelemetryService.trackDyePick(dye.stainID, 'drawer');
    }

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

  // Listen for "What's New" (changelog) button click from header
  layoutElement.addEventListener('changelog-click', (() => {
    logger.debug('[V4 Layout] Changelog button clicked');
    void showChangelogModal();
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

  // Listen for the advanced-options gear click from header. The panel
  // dispatches its data events (settings-reset, clear-all-dyes, ...) on
  // layoutElement so the listeners below keep working unchanged.
  layoutElement.addEventListener('advanced-click', (() => {
    logger.debug('[V4 Layout] Advanced options button clicked');
    showAdvancedOptionsPanel(layoutElement ?? undefined);
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
  // Held for the app's lifetime — the shell is never torn down (destroyV4Layout
  // was removed as dead code, 2026-08-16), so no unsubscribe handle is kept.
  LanguageService.subscribe(() => {
    logger.info('[V4 Layout] Language changed, tool may need refresh');
    // Route titles are locale keys, so the tab title is stale until re-read.
    RouterService.refreshDocumentTitle();
  });

  // Wait for V4LayoutShell to complete its initial Lit render
  // This ensures the shadow DOM is available before we query for content container
  await layoutElement.updateComplete;

  // Shared rules for every tool's card grid and empty state. Injected once
  // into the shell's shadow root — tool containers only carry the class.
  //
  // This injection is load-bearing, not a convenience: tools render INSIDE
  // V4LayoutShell's shadow DOM, so nothing in styles/globals.css or
  // styles/v4-layout.css reaches them. A rule that must apply to tool content
  // belongs in styles/tool-content.css (loaded here AND page-side) or in an
  // inline style; putting it only in a page stylesheet is a silent no-op
  // (that is how the Harmony empty state ended up drawing its 62px glyph at
  // 437px — the sizing rule never applied).
  if (
    layoutElement.shadowRoot &&
    !layoutElement.shadowRoot.querySelector('#v5-results-grid-style')
  ) {
    const gridStyle = document.createElement('style');
    gridStyle.id = 'v5-results-grid-style';
    gridStyle.textContent = `
      ${toolContentCss}

      /* Results grid — Q4 decision: three cards per row on desktop, two on
         mobile. Flex rather than fixed grid tracks so a partial final row
         centres with the rest; with grid tracks the leftovers hugged the
         left edge while the block itself looked centred. The max-width is
         the 3-up row (3 x 320 + 2 x 12), so wide viewports never reach 4-up. */
      .v5-results-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-content: flex-start;
        gap: 12px;
        width: 100%;
        max-width: 984px;
        margin-inline: auto;
      }
      .v5-results-grid > * {
        flex: 0 1 320px;
        max-width: 320px;
        min-width: 0;
      }
      @media (max-width: 768px) {
        .v5-results-grid {
          gap: 8px;
          max-width: none;
        }
        .v5-results-grid > * {
          flex: 1 1 calc(50% - 4px);
          max-width: calc(50% - 4px);
        }
      }

      /* Empty state — one treatment everywhere: the tool glyph dimmed inside
         a shaded, dashed box with the instruction below it. Modelled on the
         Accessibility Checker / Dye Comparison states, which were the two
         that already looked right because they styled themselves inline. */
      .v5-empty-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
        padding: 60px 40px;
        margin-inline: auto;
        width: 100%;
        max-width: 520px;
        border-radius: 12px;
        border: 1px dashed var(--theme-border, rgba(255, 255, 255, 0.15));
        background: var(--theme-empty-state-background, rgba(0, 0, 0, 0.2));
        color: var(--theme-text-muted);
      }
      .v5-empty-state-icon,
      .empty-state-icon {
        width: 150px;
        height: 150px;
        max-width: 60%;
        margin: 0 0 20px;
        opacity: 0.4;
        color: var(--theme-text-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .v5-empty-state-icon svg,
      .empty-state-icon svg {
        width: 100%;
        height: 100%;
        display: block;
      }
      .v5-empty-state-title,
      .empty-state-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--theme-text);
        margin: 0 0 8px;
      }
      .v5-empty-state-text,
      .empty-state-description {
        font-size: 1rem;
        line-height: 1.5;
        color: var(--theme-text-muted);
        max-width: 400px;
        margin: 0;
      }
      .empty-state-action {
        margin-top: 20px;
      }
    `;
    layoutElement.shadowRoot.appendChild(gridStyle);
  }

  // Telemetry: capture the boot entry BEFORE the first loadToolContent — a
  // share link carries query params, a plain boot does not (spec §1).
  bootEntry = RouterService.getCurrentRoute().params.toString() !== '' ? 'share' : 'initial';

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
 * Localized display name for a tool, for user-facing copy that names it.
 * Falls back to the raw id if the route table has no entry (unreachable for a
 * real `ToolId`, but `loadToolContent` must not throw on one).
 */
function toolDisplayName(toolId: ToolId): string {
  const route = RouterService.getRouteForTool(toolId);
  return route ? LanguageService.t(route.titleKey) : toolId;
}

/**
 * Reset the "is this the boot tool" telemetry state (for testing only).
 * `bootEntry` is module state that otherwise survives for the whole
 * test-file run, so a later suite's tool load would look like a "later"
 * navigation instead of the boot view.
 * @internal
 */
export function __resetTelemetryStateForTesting(): void {
  bootEntry = null;
}

/** Record a completed tool load for telemetry (tool_view + dwell clock). */
function recordToolView(toolId: ToolId): void {
  const entry: ToolEntry = bootEntry ?? 'nav';
  bootEntry = null;
  TelemetryService.startTool(toolId, entry);
  TelemetryService.track('tool_view', { tool: toolId, entry });
}

/**
 * Load tool content into the V4 layout content area
 */
async function loadToolContent(toolId: ToolId): Promise<void> {
  // BUG-040: rapid navigation overlaps invocations across the dynamic-import
  // awaits; only the latest sequence may instantiate its tool
  const seq = ++navigationSeq;
  const superseded = (): boolean => seq !== navigationSeq;

  // BUG-078: a tutorial prompt scheduled by the previous tool must not fire
  // over this one
  if (tutorialPromptTimer !== null) {
    clearTimeout(tutorialPromptTimer);
    tutorialPromptTimer = null;
  }

  const contentContainer = getContentContainer();

  if (!contentContainer) {
    logger.error('[V4 Layout] Content container not found');
    return;
  }

  // Telemetry: close the dwell window of whatever was showing (no-op if nothing was)
  TelemetryService.endTool();

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
        <p style="color: var(--theme-text-muted);">${LanguageService.tInterpolate(
          'common.loadingTool',
          { tool: toolDisplayName(toolId) }
        )}</p>
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
        if (superseded()) return; // BUG-040: a newer navigation took over
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
        if (superseded()) return; // BUG-040: a newer navigation took over
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
        if (superseded()) return; // BUG-040: a newer navigation took over
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
        if (superseded()) return; // BUG-040: a newer navigation took over
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
        if (superseded()) return; // BUG-040: a newer navigation took over
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
        if (superseded()) return; // BUG-040: a newer navigation took over
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
        if (superseded()) return; // BUG-040
        clearContainer(contentContainer);
        const presetTool = document.createElement('v4-preset-tool');
        contentContainer.appendChild(presetTool);
        logger.info('[V4 Layout] Presets tool loaded (v4)');
        recordToolView(toolId);
        return; // Early return since we handled the container directly
      }
      case 'budget': {
        const { BudgetTool } = await import('@components/budget-tool');
        if (superseded()) return; // BUG-040: a newer navigation took over
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
        if (superseded()) return; // BUG-040: a newer navigation took over
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
    recordToolView(toolId);

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
        <p style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--theme-text);">${LanguageService.t('errors.toolLoadFailed')}</p>
        <p style="font-size: 1rem; opacity: 0.7; color: var(--theme-text);">${LanguageService.t('errors.tryAgainOrRefresh')}</p>
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
      <p style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--theme-text);">${LanguageService.tInterpolate('common.comingSoonTool', { tool: toolId })}</p>
      <p style="font-size: 1rem; opacity: 0.7; color: var(--theme-text);">${LanguageService.t('common.comingSoon')}</p>
    </div>
  `;
}
