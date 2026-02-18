/**
 * XIV Dye Tools v3.0.0 - Mockup System Entry Point
 *
 * Development-only mockup system for testing the new two-panel layout
 * before production deployment.
 *
 * Access via: http://localhost:5173/?mockup=true
 *
 * @module mockups/index
 */

import { MockupShell, type MockupToolId } from './MockupShell';
import { CollapsiblePanel } from './CollapsiblePanel';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';

// Import mockup-only gradient themes (NOT loaded in production)
import './mockup-gradient-themes.css';

// Experimental mockup theme definitions
const MOCKUP_GRADIENT_THEMES = [
  { id: 'gradient-light', label: 'Gradient Light', description: 'Warm sunrise (coral → gold)' },
  { id: 'gradient-dark', label: 'Gradient Dark', description: 'Cool twilight (purple → teal)' },
] as const;

type MockupGradientThemeId = (typeof MOCKUP_GRADIENT_THEMES)[number]['id'];

// Track current mockup gradient theme
let currentMockupGradientTheme: MockupGradientThemeId | null = null;

/**
 * Apply a mockup-only gradient theme
 * These themes layer on top of the standard theme system
 */
function applyMockupGradientTheme(themeId: MockupGradientThemeId | null): void {
  const root = document.documentElement;

  // Remove all mockup gradient theme classes
  MOCKUP_GRADIENT_THEMES.forEach((t) => {
    root.classList.remove(`theme-${t.id}`);
  });

  // Apply new theme if specified
  if (themeId) {
    root.classList.add(`theme-${themeId}`);
    logger.info(`Applied mockup gradient theme: ${themeId}`);
  } else {
    logger.info('Removed mockup gradient theme, using standard theme');
  }

  currentMockupGradientTheme = themeId;
  updateThemeSwitcherUI();
}

/**
 * Update the theme switcher button states
 */
function updateThemeSwitcherUI(): void {
  const buttons = document.querySelectorAll('.mockup-theme-btn');
  buttons.forEach((btn) => {
    const btnTheme = btn.getAttribute('data-theme');
    const isActive =
      btnTheme === currentMockupGradientTheme ||
      (btnTheme === 'standard' && !currentMockupGradientTheme);
    btn.classList.toggle('active', isActive);
  });
}

// Re-export components for external use
export { MockupShell, type MockupToolId } from './MockupShell';
export { MockupNav, getLocalizedMockupTools } from './MockupNav';
export { IconRail } from './IconRail';
export { MobileDrawer } from './MobileDrawer';
export { CollapsiblePanel } from './CollapsiblePanel';

// Import tool mockup types
import type { HarmonyMockup } from './tools/HarmonyMockup';
import type { BaseComponent } from '@components/base-component';

// Track active mockup instance for cleanup
let activeMockup: BaseComponent | null = null;

/**
 * Load the mockup system into the content container
 */
export function loadMockupSystem(container: HTMLElement): void {
  // Clear existing content
  clearContainer(container);

  // Create info banner
  const banner = document.createElement('div');
  banner.className = 'mb-4 p-4 rounded-lg border-2 border-dashed';
  banner.setAttribute(
    'style',
    `
    background: var(--theme-background-secondary);
    border-color: var(--theme-primary);
    color: var(--theme-text);
  `
  );
  banner.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="flex-shrink-0 w-6 h-6 mt-0.5" style="color: var(--theme-primary);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </span>
      <div class="flex-1">
        <h3 class="font-bold text-lg mb-1">v3.0.0 UI Mockup Mode</h3>
        <p class="text-sm opacity-80 mb-2">
          You're viewing the development mockups for the upcoming two-panel layout redesign.
        </p>
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="px-2 py-1 rounded" style="background: var(--theme-card-hover);">
            <svg class="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            Left: Tool Nav + Config
          </span>
          <span class="px-2 py-1 rounded" style="background: var(--theme-card-hover);">
            <svg class="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            Right: Results
          </span>
          <span class="px-2 py-1 rounded" style="background: var(--theme-card-hover);">
            <svg class="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            Mobile: Drawer
          </span>
        </div>
        <div class="mockup-theme-switcher">
          <span class="mockup-theme-switcher-label">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
            Experimental:
          </span>
          <button class="mockup-theme-btn active" data-theme="standard" title="Use current theme (no gradient overlay)">Standard</button>
          <button class="mockup-theme-btn gradient-light" data-theme="gradient-light" title="Warm sunrise gradient (coral → gold)">Gradient Light</button>
          <button class="mockup-theme-btn gradient-dark" data-theme="gradient-dark" title="Cool twilight gradient (purple → teal)">Gradient Dark</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(banner);

  // Wire up theme switcher buttons
  const themeBtns = banner.querySelectorAll('.mockup-theme-btn');
  themeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-theme');
      if (themeId === 'standard') {
        applyMockupGradientTheme(null);
      } else {
        applyMockupGradientTheme(themeId as MockupGradientThemeId);
      }
    });
  });

  // Create shell container
  const shellContainer = document.createElement('div');
  shellContainer.className = 'mockup-container';
  container.appendChild(shellContainer);

  // Initialize MockupShell
  const shell = new MockupShell(shellContainer, {
    initialTool: 'harmony',
    onToolChange: (toolId) => {
      logger.info(`Tool changed to: ${toolId}`);
      void loadToolMockup(shell, toolId);
    },
  });
  shell.init();

  // Load initial tool mockup
  void loadToolMockup(shell, 'harmony');

  logger.info('Mockup system initialized');
}

/**
 * Load a specific tool mockup into the shell
 */
async function loadToolMockup(shell: MockupShell, toolId: MockupToolId): Promise<void> {
  const leftPanel = shell.getLeftPanelContent();
  const rightPanel = shell.getRightPanelContent();
  const drawerContent = shell.getMobileDrawerContent();

  if (!leftPanel || !rightPanel) {
    logger.error('Panel containers not found');
    return;
  }

  // Cleanup previous mockup
  if (activeMockup) {
    activeMockup.destroy();
    activeMockup = null;
  }

  // Clear existing content
  clearContainer(leftPanel);
  clearContainer(rightPanel);
  if (drawerContent) {
    clearContainer(drawerContent);
  }

  // Show loading state
  rightPanel.innerHTML = `
    <div class="flex items-center justify-center h-64">
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style="border-color: var(--theme-primary); border-top-color: transparent;"></div>
        <p style="color: var(--theme-text-muted);">Loading ${toolId} mockup...</p>
      </div>
    </div>
  `;

  // Load tool-specific mockup
  try {
    switch (toolId) {
      case 'harmony': {
        const { HarmonyMockup } = await import('./tools/HarmonyMockup');
        const mockupContainer = document.createElement('div');
        activeMockup = new HarmonyMockup(mockupContainer, {
          leftPanel,
          rightPanel,
          drawerContent,
        });
        activeMockup.init();
        logger.info('Harmony Mockup loaded');
        break;
      }
      case 'matcher': {
        const { MatcherMockup } = await import('./tools/MatcherMockup');
        const mockupContainer = document.createElement('div');
        activeMockup = new MatcherMockup(mockupContainer, {
          leftPanel,
          rightPanel,
          drawerContent,
        });
        activeMockup.init();
        logger.info('Matcher Mockup loaded');
        break;
      }
      case 'accessibility': {
        const { AccessibilityMockup } = await import('./tools/AccessibilityMockup');
        const mockupContainer = document.createElement('div');
        activeMockup = new AccessibilityMockup(mockupContainer, {
          leftPanel,
          rightPanel,
          drawerContent,
        });
        activeMockup.init();
        logger.info('Accessibility Mockup loaded');
        break;
      }
      case 'comparison': {
        const { ComparisonMockup } = await import('./tools/ComparisonMockup');
        const mockupContainer = document.createElement('div');
        activeMockup = new ComparisonMockup(mockupContainer, {
          leftPanel,
          rightPanel,
          drawerContent,
        });
        activeMockup.init();
        logger.info('Comparison Mockup loaded');
        break;
      }
      case 'mixer': {
        const { MixerMockup } = await import('./tools/MixerMockup');
        const mockupContainer = document.createElement('div');
        activeMockup = new MixerMockup(mockupContainer, {
          leftPanel,
          rightPanel,
          drawerContent,
        });
        activeMockup.init();
        logger.info('Mixer Mockup loaded');
        break;
      }
      case 'presets': {
        const { PresetsMockup } = await import('./tools/PresetsMockup');
        const mockupContainer = document.createElement('div');
        activeMockup = new PresetsMockup(mockupContainer, {
          leftPanel,
          rightPanel,
          drawerContent,
        });
        activeMockup.init();
        logger.info('Presets Mockup loaded');
        break;
      }
      case 'budget': {
        const { BudgetMockup } = await import('./tools/BudgetMockup');
        const mockupContainer = document.createElement('div');
        activeMockup = new BudgetMockup(mockupContainer, {
          leftPanel,
          rightPanel,
          drawerContent,
        });
        activeMockup.init();
        logger.info('Budget Mockup loaded');
        break;
      }
      default:
        renderPlaceholderMockup(leftPanel, rightPanel, drawerContent, toolId);
        break;
    }
  } catch (error) {
    logger.error(`Failed to load ${toolId} mockup:`, error);
    rightPanel.innerHTML = `
      <div class="flex items-center justify-center h-64">
        <div class="text-center" style="color: var(--theme-text);">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>Failed to load mockup</p>
        </div>
      </div>
    `;
  }
}

/**
 * Render placeholder content for a tool mockup
 */
function renderPlaceholderMockup(
  leftPanel: HTMLElement,
  rightPanel: HTMLElement,
  drawerContent: HTMLElement | null,
  toolId: MockupToolId
): void {
  // Tool-specific config labels
  const toolConfigs: Record<MockupToolId, { leftItems: string[]; rightItems: string[] }> = {
    harmony: {
      leftItems: ['Dye Selector', 'Harmony Type', 'Companion Count', 'Dye Filters', 'Market Board'],
      rightItems: ['Color Wheel', 'Harmony Cards Grid', 'Matched Dyes', 'Palette Export'],
    },
    matcher: {
      leftItems: [
        'Image Upload',
        'Color Picker',
        'Sample Size',
        'Palette Mode',
        'Dye Filters',
        'Market Board',
      ],
      rightItems: [
        'Image Canvas + Zoom',
        'Matched Dye Results',
        'Recent Colors',
        'Extracted Palette',
      ],
    },
    accessibility: {
      leftItems: ['Dye Selector (up to 4)', 'Vision Type Toggles', 'Display Options'],
      rightItems: ['Vision Simulation Cards', 'Contrast Analysis', 'Distinguishability Matrix'],
    },
    comparison: {
      leftItems: ['Dye Selector (up to 4)', 'Comparison Options', 'Market Board'],
      rightItems: ['Hue-Saturation Plot', 'Brightness Chart', 'Color Distance Matrix'],
    },
    mixer: {
      leftItems: [
        'Start Dye',
        'End Dye',
        'Steps Slider',
        'Color Space Toggle',
        'Dye Filters',
        'Market Board',
      ],
      rightItems: ['Interpolation Gradient', 'Intermediate Dye Matches', 'Palette Export'],
    },
    presets: {
      leftItems: ['Category Filters', 'Sort Options', 'Auth Status', 'My Submissions'],
      rightItems: ['Featured Presets', 'Preset Grid', 'Preset Detail View'],
    },
    budget: {
      leftItems: [
        'Target Dye',
        'Quick Picks',
        'Budget Slider',
        'Sort Options',
        'Dye Filters',
        'Data Center',
      ],
      rightItems: ['Target Overview', 'Alternatives List', 'Savings Summary', 'Value Score'],
    },
  };

  const config = toolConfigs[toolId];

  // Left panel content
  leftPanel.innerHTML = `
    <div class="p-4">
      <h3 class="text-sm font-semibold uppercase tracking-wider mb-4" style="color: var(--theme-text-muted);">
        ${toolId.charAt(0).toUpperCase() + toolId.slice(1)} Config
      </h3>
      <div class="space-y-3">
        ${config.leftItems
          .map(
            (item, i) => `
          <div class="p-3 rounded-lg border" style="background: var(--theme-background-secondary); border-color: var(--theme-border);">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded flex items-center justify-center" style="background: var(--theme-card-hover);">
                <span class="text-xs font-bold" style="color: var(--theme-text-muted);">${i + 1}</span>
              </div>
              <span class="text-sm font-medium" style="color: var(--theme-text);">${item}</span>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;

  // Right panel content
  rightPanel.innerHTML = `
    <div class="grid gap-4 lg:grid-cols-2">
      ${config.rightItems
        .map(
          (item) => `
        <div class="p-6 rounded-lg border-2 border-dashed flex items-center justify-center min-h-[200px]"
             style="background: var(--theme-card-background); border-color: var(--theme-border);">
          <div class="text-center">
            <svg class="w-10 h-10 mx-auto mb-2 opacity-30" style="color: var(--theme-text);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p class="text-sm font-medium" style="color: var(--theme-text);">${item}</p>
            <p class="text-xs mt-1" style="color: var(--theme-text-muted);">Placeholder</p>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  // Mobile drawer content (mirrors left panel)
  if (drawerContent) {
    drawerContent.innerHTML = leftPanel.innerHTML;
  }
}
