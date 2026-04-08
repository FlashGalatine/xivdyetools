/**
 * XIV Dye Tools v2.2.0 - Dye Action Dropdown Component
 *
 * Quick-action dropdown menu for dye items
 * Options: Add to Comparison, Add to Mixer, Add to Accessibility Checker,
 *          See Color Harmonies, See Budget Suggestions, Copy Hex Code
 *
 * @module components/dye-action-dropdown
 */

import type { Dye } from '@xivdyetools/types';
import { LanguageService, StorageService, RouterService } from '@services/index';
import { ToastService } from '@services/toast-service';
import { ModalService } from '@services/modal-service';
import { DyeService } from '@services/dye-service-wrapper';
import { logger } from '@shared/logger';

// ============================================================================
// Action Types
// ============================================================================

export type DyeAction = 'comparison' | 'mixer' | 'accessibility' | 'harmony' | 'copy' | 'budget';

// ============================================================================
// Storage Keys and Constants
// ============================================================================

const STORAGE_KEYS = {
  comparison: 'v3_comparison_selected_dyes',
  mixer: 'v3_mixer_selected_dyes',
  accessibility: 'v3_accessibility_selected_dyes',
  budget: 'v3_budget_target',
} as const;

const MAX_SLOTS = {
  comparison: 4,
  mixer: 2,
  accessibility: 4,
} as const;

// ============================================================================
// SVG Icons (filled/solid style for visibility)
// ============================================================================

const ICON_ACTION_COMPARISON = `<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
  <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clip-rule="evenodd"/>
</svg>`;

const ICON_ACTION_MIXER = `<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
  <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd"/>
</svg>`;

const ICON_ACTION_BUDGET = `<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95c-.285.475-.507 1-.67 1.55H6a1 1 0 000 2h.013a9.358 9.358 0 000 1H6a1 1 0 100 2h.351c.163.55.385 1.075.67 1.55C7.721 15.216 8.768 16 10 16s2.279-.784 2.979-1.95a1 1 0 10-1.715-1.029c-.472.786-.96.979-1.264.979-.304 0-.792-.193-1.264-.979a4.265 4.265 0 01-.264-.521H10a1 1 0 100-2H8.017a7.36 7.36 0 010-1H10a1 1 0 100-2H8.472c.08-.185.167-.36.264-.521z"/>
</svg>`;

const ICON_ACTION_ACCESSIBILITY = `<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
  <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
</svg>`;

const ICON_ACTION_COPY = `<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z"/>
  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/>
</svg>`;

const ICON_ACTION_HARMONY = `<svg viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
  <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd"/>
</svg>`;

export interface DyeActionCallback {
  (action: DyeAction, dye: Dye): void;
}

// ============================================================================
// Dye Action Dropdown Component
// ============================================================================

/**
 * Creates a dropdown button with quick actions for a dye
 */
// Counter for unique menu IDs
let menuIdCounter = 0;

export function createDyeActionDropdown(dye: Dye, onAction?: DyeActionCallback): HTMLElement {
  const container = document.createElement('div');
  container.className = 'dye-action-dropdown relative';

  // Generate unique ID for accessibility relationship
  const menuId = `dye-action-menu-${++menuIdCounter}`;

  // Dropdown button
  const button = document.createElement('button');
  button.type = 'button';
  button.className =
    'flex items-center justify-center w-8 h-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors';
  button.style.color = 'var(--theme-text-muted)';
  button.addEventListener('mouseenter', () => {
    button.style.color = 'var(--theme-text)';
    button.style.backgroundColor = 'var(--theme-card-hover)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.color = 'var(--theme-text-muted)';
    button.style.backgroundColor = '';
  });
  button.setAttribute('aria-label', LanguageService.t('harmony.actions'));
  button.setAttribute('aria-haspopup', 'true');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', menuId);

  // Three dots icon (aria-hidden for screen readers)
  button.innerHTML = `
    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
    </svg>
  `;

  // Dropdown menu
  const menu = document.createElement('div');
  menu.id = menuId;
  menu.className =
    'absolute right-0 top-full mt-1 z-50 min-w-[160px] py-1 rounded-lg shadow-lg opacity-0 invisible transform scale-95 origin-top-right transition-all duration-150';
  menu.style.backgroundColor = 'var(--theme-card-background)';
  menu.style.borderWidth = '1px';
  menu.style.borderStyle = 'solid';
  menu.style.borderColor = 'var(--theme-border)';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', LanguageService.t('harmony.actionsMenu'));
  // Use inert for better accessibility - prevents focus while hidden
  menu.setAttribute('inert', '');

  // Menu items
  const actions: Array<{
    action: DyeAction;
    icon: string;
    labelKey: string;
    defaultLabel: string;
  }> = [
    {
      action: 'comparison',
      icon: ICON_ACTION_COMPARISON,
      labelKey: 'harmony.addToComparison',
      defaultLabel: 'Add to Comparison',
    },
    {
      action: 'mixer',
      icon: ICON_ACTION_MIXER,
      labelKey: 'harmony.addToMixer',
      defaultLabel: 'Add to Mixer',
    },
    {
      action: 'accessibility',
      icon: ICON_ACTION_ACCESSIBILITY,
      labelKey: 'harmony.addToAccessibility',
      defaultLabel: 'Add to Accessibility Checker',
    },
    {
      action: 'harmony',
      icon: ICON_ACTION_HARMONY,
      labelKey: 'harmony.seeHarmonies',
      defaultLabel: 'See Color Harmonies',
    },
    {
      action: 'budget',
      icon: ICON_ACTION_BUDGET,
      labelKey: 'harmony.seeBudget',
      defaultLabel: 'See Budget Suggestions',
    },
    {
      action: 'copy',
      icon: ICON_ACTION_COPY,
      labelKey: 'harmony.copyHex',
      defaultLabel: 'Copy Hex',
    },
  ];

  actions.forEach(({ action, icon, labelKey, defaultLabel: _defaultLabel }) => {
    const menuItem = document.createElement('button');
    menuItem.type = 'button';
    menuItem.className =
      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors';
    menuItem.style.color = 'var(--theme-text)';
    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = 'var(--theme-card-hover)';
    });
    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = '';
    });
    menuItem.setAttribute('role', 'menuitem');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'w-4 h-4 flex-shrink-0';
    iconSpan.innerHTML = icon;
    menuItem.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.textContent = LanguageService.t(labelKey);
    menuItem.appendChild(labelSpan);

    menuItem.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      closeMenu();

      switch (action) {
        case 'copy':
          void copyHexToClipboard(dye.hex);
          break;
        case 'comparison':
          addToComparison(dye);
          break;
        case 'mixer':
          addToMixer(dye);
          break;
        case 'accessibility':
          addToAccessibility(dye);
          break;
        case 'harmony':
          navigateToHarmony(dye);
          break;
        case 'budget':
          setAsBudgetTarget(dye);
          break;
      }

      // Keep callback for backwards compatibility
      if (onAction) {
        onAction(action, dye);
      }
    });

    menu.appendChild(menuItem);
  });

  container.appendChild(button);
  container.appendChild(menu);

  // Toggle menu on button click
  let isOpen = false;

  function openMenu(): void {
    // Close any other open dropdowns first by dispatching a global event
    document.dispatchEvent(
      new CustomEvent('dye-dropdown-close-all', { detail: { except: container } })
    );

    isOpen = true;
    menu.classList.remove('opacity-0', 'invisible', 'scale-95');
    menu.classList.add('opacity-100', 'visible', 'scale-100');
    button.setAttribute('aria-expanded', 'true');
    // Remove inert to allow focus on menu items
    menu.removeAttribute('inert');

    // Add click outside listener
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  }

  function closeMenu(): void {
    isOpen = false;
    // Set inert before hiding to prevent focus issues
    menu.setAttribute('inert', '');
    menu.classList.add('opacity-0', 'invisible', 'scale-95');
    menu.classList.remove('opacity-100', 'visible', 'scale-100');
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleClickOutside);
  }

  function handleClickOutside(e: MouseEvent): void {
    if (!container.contains(e.target as Node)) {
      closeMenu();
    }
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close on escape
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closeMenu();
      button.focus();
    }
  });

  // Listen for global close event (fired when another dropdown opens)
  function handleCloseAll(e: Event): void {
    const customEvent = e as CustomEvent<{ except: HTMLElement }>;
    // Close this dropdown unless it's the one that triggered the event
    // Also check if container is still in DOM to handle cleanup
    if (isOpen && customEvent.detail?.except !== container && document.body.contains(container)) {
      closeMenu();
    }
  }

  document.addEventListener('dye-dropdown-close-all', handleCloseAll);

  // Attach cleanup mechanism to container for lifecycle management
  // This should be called when the dropdown is removed from the DOM
  (container as HTMLElement & { __cleanup?: () => void }).__cleanup = (): void => {
    closeMenu(); // Ensure menu is closed and click listener is removed
    document.removeEventListener('dye-dropdown-close-all', handleCloseAll);
  };

  return container;
}

/**
 * Copy hex value to clipboard
 */
async function copyHexToClipboard(hex: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(hex);
    ToastService.success(`${LanguageService.t('harmony.copiedHex')}: ${hex}`);
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = hex;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      ToastService.success(`${LanguageService.t('harmony.copiedHex')}: ${hex}`);
    } catch {
      ToastService.error(LanguageService.t('harmony.copyFailed'));
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

// ============================================================================
// Tool Integration Functions
// ============================================================================

/**
 * Add dye to Comparison tool
 */
function addToComparison(dye: Dye): void {
  const currentDyes = StorageService.getItem<number[]>(STORAGE_KEYS.comparison) ?? [];

  // Check if dye already exists
  if (currentDyes.includes(dye.id)) {
    ToastService.info(LanguageService.t('harmony.dyeAlreadyInComparison'));
    return;
  }

  // Has space - add directly
  if (currentDyes.length < MAX_SLOTS.comparison) {
    currentDyes.push(dye.id);
    StorageService.setItem(STORAGE_KEYS.comparison, currentDyes);
    ToastService.success(LanguageService.t('harmony.addedToComparison'));
    RouterService.navigateTo('comparison');
    return;
  }

  // Full - show slot selection modal
  showSlotSelectionModal('comparison', dye, currentDyes);
}

/**
 * Add dye to Mixer tool
 */
function addToMixer(dye: Dye): void {
  const currentDyes = StorageService.getItem<number[]>(STORAGE_KEYS.mixer) ?? [];

  // Check if dye already exists
  if (currentDyes.includes(dye.id)) {
    ToastService.info(LanguageService.t('harmony.dyeAlreadyInMixer'));
    return;
  }

  // Has space - add directly
  if (currentDyes.length < MAX_SLOTS.mixer) {
    currentDyes.push(dye.id);
    StorageService.setItem(STORAGE_KEYS.mixer, currentDyes);
    ToastService.success(LanguageService.t('harmony.addedToMixer'));
    RouterService.navigateTo('mixer');
    return;
  }

  // Full - show slot selection modal
  showSlotSelectionModal('mixer', dye, currentDyes);
}

/**
 * Add dye to Accessibility Checker tool
 */
function addToAccessibility(dye: Dye): void {
  const currentDyes = StorageService.getItem<number[]>(STORAGE_KEYS.accessibility) ?? [];

  // Check if dye already exists
  if (currentDyes.includes(dye.id)) {
    ToastService.info(LanguageService.t('harmony.dyeAlreadyInAccessibility'));
    return;
  }

  // Has space - add directly
  if (currentDyes.length < MAX_SLOTS.accessibility) {
    currentDyes.push(dye.id);
    StorageService.setItem(STORAGE_KEYS.accessibility, currentDyes);
    ToastService.success(LanguageService.t('harmony.addedToAccessibility'));
    RouterService.navigateTo('accessibility');
    return;
  }

  // Full - show slot selection modal
  showSlotSelectionModal('accessibility', dye, currentDyes);
}

/**
 * Set dye as Budget Suggestions target
 */
function setAsBudgetTarget(dye: Dye): void {
  StorageService.setItem(STORAGE_KEYS.budget, dye.id);
  RouterService.navigateTo('budget');
}

/**
 * Navigate to Harmony tool with dye pre-selected
 * Uses itemID for localization-safe deep linking
 */
function navigateToHarmony(dye: Dye): void {
  logger.info(
    `[DyeActionDropdown] navigateToHarmony called - dye: "${dye.name}", itemID: ${dye.itemID}`
  );
  RouterService.navigateTo('harmony', { dyeId: String(dye.itemID) });
}

/**
 * Show modal for selecting which slot to overwrite
 */
function showSlotSelectionModal(
  tool: 'comparison' | 'mixer' | 'accessibility',
  newDye: Dye,
  currentDyeIds: number[]
): void {
  const dyeService = DyeService.getInstance();

  // Get localized tool name
  let _toolName: string;
  if (tool === 'comparison') {
    _toolName = LanguageService.t('tools.comparison.shortName');
  } else if (tool === 'mixer') {
    _toolName = LanguageService.t('tools.mixer.shortName');
  } else {
    _toolName = LanguageService.t('tools.accessibility.shortName');
  }

  // Generate slot labels
  const slotLabels =
    tool === 'mixer'
      ? [LanguageService.t('mixer.startDye'), LanguageService.t('mixer.endDye')]
      : currentDyeIds.map((_, i) => `${LanguageService.t('common.slot')} ${i + 1}`);

  // Build content as DOM elements (SEC-002: avoid innerHTML for defense-in-depth)
  const contentEl = document.createElement('div');

  const description = document.createElement('p');
  description.className = 'mb-4';
  description.style.color = 'var(--theme-text)';
  description.textContent = LanguageService.t('harmony.slotsFull');
  contentEl.appendChild(description);

  const slotsContainer = document.createElement('div');
  slotsContainer.className = 'space-y-2';

  // Store modalId so slot buttons can dismiss it (must be let — assigned after closures capture it)
  // eslint-disable-next-line prefer-const
  let modalId: ReturnType<typeof ModalService.show>;

  currentDyeIds.forEach((dyeId, index) => {
    const existingDye = dyeService.getDyeById(dyeId);
    const dyeName = existingDye
      ? LanguageService.getDyeName(existingDye.itemID) || existingDye.name
      : 'Unknown';
    const dyeHex = existingDye?.hex ?? '#888888';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'flex items-center gap-3 w-full p-3 rounded-lg border transition-colors';
    btn.style.background = 'var(--theme-card-background)';
    btn.style.borderColor = 'var(--theme-border)';

    const swatch = document.createElement('div');
    swatch.className = 'w-8 h-8 rounded';
    swatch.style.background = dyeHex;
    swatch.style.border = '1px solid var(--theme-border)';
    btn.appendChild(swatch);

    const info = document.createElement('div');
    info.className = 'flex-1 text-left';
    const labelP = document.createElement('p');
    labelP.className = 'font-medium text-sm';
    labelP.style.color = 'var(--theme-text)';
    labelP.textContent = slotLabels[index];
    info.appendChild(labelP);
    const nameP = document.createElement('p');
    nameP.className = 'text-xs';
    nameP.style.color = 'var(--theme-text-muted)';
    nameP.textContent = dyeName;
    info.appendChild(nameP);
    btn.appendChild(info);

    const replaceLabel = document.createElement('span');
    replaceLabel.className = 'text-xs';
    replaceLabel.style.color = 'var(--theme-text-muted)';
    replaceLabel.textContent = LanguageService.t('common.replace');
    btn.appendChild(replaceLabel);

    // Click handler — directly attached, no setTimeout needed
    btn.addEventListener('click', () => {
      const storageKey = STORAGE_KEYS[tool];
      currentDyeIds[index] = newDye.id;
      StorageService.setItem(storageKey, currentDyeIds);

      ModalService.dismiss(modalId);
      ToastService.success(LanguageService.t('harmony.replacedInTool'));
      RouterService.navigateTo(tool);
    });

    // Hover effects
    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = 'var(--theme-card-hover)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = 'var(--theme-card-background)';
    });

    slotsContainer.appendChild(btn);
  });

  contentEl.appendChild(slotsContainer);

  // "Adding dye" preview
  const newDyeName = LanguageService.getDyeName(newDye.itemID) || newDye.name;

  const preview = document.createElement('div');
  preview.className = 'mt-4 p-3 rounded-lg flex items-center gap-3';
  preview.style.background = 'var(--theme-background-secondary)';

  const previewSwatch = document.createElement('div');
  previewSwatch.className = 'w-8 h-8 rounded';
  previewSwatch.style.background = newDye.hex;
  previewSwatch.style.border = '1px solid var(--theme-border)';
  preview.appendChild(previewSwatch);

  const previewInfo = document.createElement('div');
  const addingLabel = document.createElement('p');
  addingLabel.className = 'text-xs';
  addingLabel.style.color = 'var(--theme-text-muted)';
  addingLabel.textContent = LanguageService.t('harmony.addingDye') + ':';
  previewInfo.appendChild(addingLabel);
  const addingName = document.createElement('p');
  addingName.className = 'font-medium text-sm';
  addingName.style.color = 'var(--theme-text)';
  addingName.textContent = newDyeName;
  previewInfo.appendChild(addingName);
  preview.appendChild(previewInfo);

  contentEl.appendChild(preview);

  modalId = ModalService.show({
    type: 'custom',
    title: LanguageService.t('harmony.selectSlotToReplace'),
    content: contentEl,
    size: 'sm',
    closable: true,
    closeOnBackdrop: true,
    cancelText: LanguageService.t('common.cancel'),
  });
}
