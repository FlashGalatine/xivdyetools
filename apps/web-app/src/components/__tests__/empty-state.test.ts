/**
 * XIV Dye Tools - EmptyState Unit Tests
 *
 * Tests the empty state component for zero-result scenarios.
 * Covers icon rendering, action buttons, and preset configurations.
 *
 * @module components/__tests__/empty-state.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock tool-panel-builders to prevent circular dependency when running with other tests
vi.mock('@services/tool-panel-builders', () => ({
  buildFiltersPanel: vi.fn(),
  buildMarketPanel: vi.fn(),
  buildPanelSection: vi.fn(),
  buildCheckboxPanelSection: vi.fn(),
  buildSelectPanelSection: vi.fn(),
  buildRadioPanelSection: vi.fn(),
}));

import {
  EmptyState,
  EMPTY_STATE_PRESETS,
  createEmptyState,
  getEmptyStateHTML,
} from '../empty-state';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  getText,
  getAttr,
} from '../../__tests__/component-utils';

describe('EmptyState', () => {
  let container: HTMLElement;
  let emptyState: EmptyState | null;

  beforeEach(() => {
    container = createTestContainer();
    emptyState = null;
  });

  afterEach(() => {
    if (emptyState) {
      try {
        emptyState.destroy();
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
    it('should render empty state wrapper', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
      });
      emptyState.init();

      expect(query(container, '.empty-state')).not.toBeNull();
    });

    it('should render title', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results found',
      });
      emptyState.init();

      const title = query(container, '.empty-state-title');
      expect(getText(title)).toBe('No results found');
    });

    it('should render description when provided', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
        description: 'Try adjusting your search criteria',
      });
      emptyState.init();

      const description = query(container, '.empty-state-description');
      expect(getText(description)).toBe('Try adjusting your search criteria');
    });

    it('should not render description when not provided', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
      });
      emptyState.init();

      const description = query(container, '.empty-state-description');
      expect(description).toBeNull();
    });
  });

  // ============================================================================
  // Icon Rendering Tests
  // ============================================================================

  describe('Icon Rendering', () => {
    it('should render emoji icon as text', () => {
      emptyState = new EmptyState(container, {
        icon: '🎨',
        title: 'No palette',
      });
      emptyState.init();

      const icon = query(container, '.empty-state-icon');
      expect(getText(icon)).toBe('🎨');
    });

    it('should render SVG icon as innerHTML', () => {
      const svgIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
      emptyState = new EmptyState(container, {
        icon: svgIcon,
        title: 'No results',
      });
      emptyState.init();

      const icon = query(container, '.empty-state-icon');
      expect(query(icon!, 'svg')).not.toBeNull();
    });

    it('should have aria-hidden on icon', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
      });
      emptyState.init();

      const icon = query(container, '.empty-state-icon');
      expect(getAttr(icon, 'aria-hidden')).toBe('true');
    });
  });

  // ============================================================================
  // Action Button Tests
  // ============================================================================

  describe('Action Buttons', () => {
    it('should render primary action button', () => {
      const onAction = vi.fn();
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
        actionLabel: 'Clear filters',
        onAction,
      });
      emptyState.init();

      const button = query<HTMLButtonElement>(container, '.empty-state-action button');
      expect(button).not.toBeNull();
      expect(getText(button)).toBe('Clear filters');
    });

    it('should call onAction when primary button clicked', () => {
      const onAction = vi.fn();
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
        actionLabel: 'Clear filters',
        onAction,
      });
      emptyState.init();

      const button = query<HTMLButtonElement>(container, '.empty-state-action button');
      click(button);

      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should render secondary action button', () => {
      const onSecondary = vi.fn();
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
        actionLabel: 'Primary',
        onAction: vi.fn(),
        secondaryActionLabel: 'Secondary',
        onSecondaryAction: onSecondary,
      });
      emptyState.init();

      const buttons = container.querySelectorAll('.empty-state-action button');
      expect(buttons.length).toBe(2);
    });

    it('should call onSecondaryAction when secondary button clicked', () => {
      const onSecondary = vi.fn();
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
        actionLabel: 'Primary',
        onAction: vi.fn(),
        secondaryActionLabel: 'Go back',
        onSecondaryAction: onSecondary,
      });
      emptyState.init();

      const buttons = container.querySelectorAll<HTMLButtonElement>('.empty-state-action button');
      click(buttons[1]); // Second button is secondary

      expect(onSecondary).toHaveBeenCalledTimes(1);
    });

    it('should not render action container when no actions provided', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
      });
      emptyState.init();

      const actionContainer = query(container, '.empty-state-action');
      expect(actionContainer).toBeNull();
    });

    it('should not render button without callback', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
        actionLabel: 'Clear', // No onAction provided
      });
      emptyState.init();

      const button = query(container, '.empty-state-action button');
      expect(button).toBeNull();
    });
  });

  // ============================================================================
  // Update Method Tests
  // ============================================================================

  describe('setOptions', () => {
    it('should update title', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'Initial title',
      });
      emptyState.init();

      emptyState.setOptions({ title: 'Updated title' });

      expect(getText(query(container, '.empty-state-title'))).toBe('Updated title');
    });

    it('should add description', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'Title',
      });
      emptyState.init();

      expect(query(container, '.empty-state-description')).toBeNull();

      emptyState.setOptions({ description: 'New description' });

      expect(getText(query(container, '.empty-state-description'))).toBe('New description');
    });

    it('should update icon', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'Title',
      });
      emptyState.init();

      emptyState.setOptions({ icon: '🎨' });

      expect(getText(query(container, '.empty-state-icon'))).toBe('🎨');
    });
  });

  // ============================================================================
  // Preset Tests
  // ============================================================================

  describe('Presets', () => {
    describe('noSearchResults', () => {
      it('should create preset with query in title', () => {
        const preset = EMPTY_STATE_PRESETS.noSearchResults('test query');

        expect(preset.title).toContain('test query');
      });

      it('should include clear action callback', () => {
        const onClear = vi.fn();
        const preset = EMPTY_STATE_PRESETS.noSearchResults('query', onClear);

        expect(preset.onAction).toBe(onClear);
      });
    });

    describe('allFilteredOut', () => {
      it('should create preset with reset action', () => {
        const onReset = vi.fn();
        const preset = EMPTY_STATE_PRESETS.allFilteredOut(onReset);

        expect(preset.onAction).toBe(onReset);
        expect(preset.actionLabel).toBeDefined();
      });
    });

    describe('noHarmonyResults', () => {
      it('should create preset with select dye action', () => {
        const onSelect = vi.fn();
        const preset = EMPTY_STATE_PRESETS.noHarmonyResults(onSelect);

        expect(preset.onAction).toBe(onSelect);
      });
    });

    describe('error', () => {
      it('should create error preset with message', () => {
        const preset = EMPTY_STATE_PRESETS.error('Something broke');

        expect(preset.description).toBe('Something broke');
      });

      it('should include retry action', () => {
        const onRetry = vi.fn();
        const preset = EMPTY_STATE_PRESETS.error('Error', onRetry);

        expect(preset.onAction).toBe(onRetry);
      });
    });

    describe('loading', () => {
      it('should create loading preset without actions', () => {
        const preset = EMPTY_STATE_PRESETS.loading();

        expect(preset.onAction).toBeUndefined();
        expect(preset.actionLabel).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('createEmptyState', () => {
    it('should create and initialize empty state', () => {
      emptyState = createEmptyState(container, {
        icon: '📭',
        title: 'Empty',
      });

      expect(query(container, '.empty-state')).not.toBeNull();
    });

    it('should return initialized component', () => {
      emptyState = createEmptyState(container, {
        icon: '📭',
        title: 'Empty',
      });

      // Should be able to call methods
      expect(() => emptyState!.setOptions({ title: 'New' })).not.toThrow();
    });
  });

  describe('getEmptyStateHTML', () => {
    it('should return valid HTML string', () => {
      const html = getEmptyStateHTML({
        icon: '🔍',
        title: 'No results',
      });

      expect(html).toContain('empty-state');
      expect(html).toContain('empty-state-icon');
      expect(html).toContain('empty-state-title');
      expect(html).toContain('No results');
    });

    it('should include description when provided', () => {
      const html = getEmptyStateHTML({
        icon: '🔍',
        title: 'Title',
        description: 'Description text',
      });

      expect(html).toContain('empty-state-description');
      expect(html).toContain('Description text');
    });

    it('should render SVG icons directly', () => {
      const svgIcon = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>';
      const html = getEmptyStateHTML({
        icon: svgIcon,
        title: 'Title',
      });

      expect(html).toContain('<svg');
      expect(html).toContain('viewBox="0 0 24 24"');
    });

    it('should escape non-SVG icons', () => {
      const html = getEmptyStateHTML({
        icon: '<script>alert("xss")</script>',
        title: 'Title',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      emptyState = new EmptyState(container, {
        icon: '🔍',
        title: 'No results',
      });
      emptyState.init();

      emptyState.destroy();

      expect(query(container, '.empty-state')).toBeNull();
    });
  });
});
