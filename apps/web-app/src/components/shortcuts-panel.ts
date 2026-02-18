/**
 * XIV Dye Tools v2.1.0 - Keyboard Shortcuts Panel (O4)
 *
 * Displays available keyboard shortcuts in a modal dialog
 * Triggered by pressing "?" key or clicking the help button
 *
 * @module components/shortcuts-panel
 */

import { ModalService } from '@services/index';
import { LanguageService } from '@services/index';

// ============================================================================
// Shortcut Definitions
// ============================================================================

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string;
    description: string;
  }[];
}

/**
 * Get keyboard shortcuts organized by category
 */
function getShortcuts(): ShortcutGroup[] {
  return [
    {
      title: LanguageService.t('shortcuts.navigation'),
      shortcuts: [
        {
          keys: '1-5',
          description: LanguageService.t('shortcuts.switchTool'),
        },
        {
          keys: 'Esc',
          description: LanguageService.t('shortcuts.closeModal'),
        },
      ],
    },
    {
      title: LanguageService.t('shortcuts.quickActions'),
      shortcuts: [
        {
          keys: 'Shift + T',
          description: LanguageService.t('shortcuts.toggleTheme'),
        },
        {
          keys: 'Shift + L',
          description: LanguageService.t('shortcuts.cycleLanguage'),
        },
        { keys: '?', description: LanguageService.t('shortcuts.showHelp') },
      ],
    },
    {
      title: LanguageService.t('shortcuts.dyeSelection'),
      shortcuts: [
        {
          keys: 'Tab',
          description: LanguageService.t('shortcuts.focusSelector'),
        },
        {
          keys: '↑↓←→',
          description: LanguageService.t('shortcuts.navigateDyes'),
        },
        {
          keys: 'Enter',
          description: LanguageService.t('shortcuts.selectDye'),
        },
      ],
    },
  ];
}

// ============================================================================
// Panel Rendering
// ============================================================================

/**
 * Create the shortcuts panel content element
 */
function createPanelContent(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'shortcuts-panel space-y-6';

  const shortcuts = getShortcuts();

  shortcuts.forEach((group) => {
    // Group section
    const section = document.createElement('div');
    section.className = 'shortcut-group';

    // Group title
    const title = document.createElement('h4');
    title.className = 'text-sm font-semibold mb-3 pb-2 border-b';
    title.style.cssText = 'color: var(--theme-text); border-color: var(--theme-border);';
    title.textContent = group.title;
    section.appendChild(title);

    // Shortcuts table
    const table = document.createElement('div');
    table.className = 'space-y-2';

    group.shortcuts.forEach((shortcut) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-4';

      // Key badge
      const keyBadge = document.createElement('kbd');
      keyBadge.className = 'px-2 py-1 text-xs font-mono rounded';
      keyBadge.style.cssText =
        'background: var(--theme-background-secondary); color: var(--theme-text); border: 1px solid var(--theme-border);';
      keyBadge.textContent = shortcut.keys;

      // Description
      const description = document.createElement('span');
      description.className = 'text-sm flex-1';
      description.style.cssText = 'color: var(--theme-text-muted);';
      description.textContent = shortcut.description;

      row.appendChild(description);
      row.appendChild(keyBadge);
      table.appendChild(row);
    });

    section.appendChild(table);
    container.appendChild(section);
  });

  // Platform hint
  const platformHint = document.createElement('p');
  platformHint.className = 'text-xs mt-4 pt-4 border-t';
  platformHint.style.cssText = 'color: var(--theme-text-muted); border-color: var(--theme-border);';

  // Detect platform for modifier key hint
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modifierKey = isMac ? '⌘ Cmd' : 'Ctrl';
  platformHint.innerHTML = `
    <span class="opacity-70">
      ${LanguageService.t('shortcuts.platformHint')}:
      ${LanguageService.t('shortcuts.useModifier')}
    </span>
  `;
  container.appendChild(platformHint);

  return container;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Show the keyboard shortcuts panel
 * @returns Modal ID for programmatic dismissal
 */
export function showShortcutsPanel(): string {
  return ModalService.show({
    type: 'custom',
    title: LanguageService.t('shortcuts.title'),
    content: createPanelContent(),
    size: 'sm',
    closable: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
  });
}
