/**
 * XIV Dye Tools v2.1.0 - Welcome Modal Component
 *
 * First-time user welcome modal introducing app features
 * Shows only once unless reset by user
 *
 * @module components/welcome-modal
 */

import { ModalService } from '@services/modal-service';
import { StorageService } from '@services/storage-service';
import { LanguageService } from '@services/language-service';
import { TutorialService } from '@services/tutorial-service';
import { STORAGE_KEYS, APP_NAME, APP_VERSION } from '@shared/constants';
import {
  ICON_TOOL_HARMONY,
  ICON_TOOL_MATCHER,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_MIXER,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_DYE_MIXER,
  ICON_TOOL_PRESETS,
  ICON_TOOL_BUDGET,
  ICON_TOOL_CHARACTER,
} from '@shared/tool-icons';

// ============================================================================
// Tool Definitions
// ============================================================================

interface ToolInfo {
  id: string;
  icon: string;
  nameKey: string;
  descriptionKey: string;
}

const TOOLS: ToolInfo[] = [
  {
    id: 'harmony',
    icon: ICON_TOOL_HARMONY,
    nameKey: 'tools.harmony.shortName',
    descriptionKey: 'tools.harmony.description',
  },
  {
    id: 'extractor',
    icon: ICON_TOOL_MATCHER,
    nameKey: 'tools.matcher.shortName',
    descriptionKey: 'tools.matcher.description',
  },
  {
    id: 'comparison',
    icon: ICON_TOOL_COMPARISON,
    nameKey: 'tools.comparison.shortName',
    descriptionKey: 'tools.comparison.description',
  },
  {
    id: 'gradient',
    icon: ICON_TOOL_MIXER,
    nameKey: 'tools.gradient.shortName',
    descriptionKey: 'tools.gradient.description',
  },
  {
    id: 'mixer',
    icon: ICON_TOOL_DYE_MIXER,
    nameKey: 'tools.mixer.shortName',
    descriptionKey: 'tools.mixer.description',
  },
  {
    id: 'presets',
    icon: ICON_TOOL_PRESETS,
    nameKey: 'tools.presets.shortName',
    descriptionKey: 'tools.presets.description',
  },
  {
    id: 'budget',
    icon: ICON_TOOL_BUDGET,
    nameKey: 'tools.budget.shortName',
    descriptionKey: 'tools.budget.description',
  },
  {
    id: 'swatch',
    icon: ICON_TOOL_CHARACTER,
    nameKey: 'tools.character.shortName',
    descriptionKey: 'tools.character.description',
  },
  {
    id: 'accessibility',
    icon: ICON_TOOL_ACCESSIBILITY,
    nameKey: 'tools.accessibility.shortName',
    descriptionKey: 'tools.accessibility.description',
  },
];

// ============================================================================
// Welcome Modal Class
// ============================================================================

/**
 * Welcome modal for first-time users
 */
export class WelcomeModal {
  private modalId: string | null = null;
  private dontShowAgain = false;

  /**
   * Check if welcome modal should be shown
   */
  static shouldShow(): boolean {
    return !StorageService.getItem<boolean>(STORAGE_KEYS.WELCOME_SEEN, false);
  }

  /**
   * Mark welcome as seen and set version to prevent changelog showing
   */
  static markAsSeen(): void {
    StorageService.setItem(STORAGE_KEYS.WELCOME_SEEN, true);
    // Also set version so changelog doesn't show for this version
    StorageService.setItem(STORAGE_KEYS.LAST_VERSION_VIEWED, APP_VERSION);
  }

  /**
   * Reset welcome modal (for testing or settings)
   */
  static reset(): void {
    StorageService.removeItem(STORAGE_KEYS.WELCOME_SEEN);
  }

  /**
   * Show the welcome modal
   */
  show(): void {
    if (this.modalId) return; // Already showing

    const content = this.createContent();

    this.modalId = ModalService.showWelcome({
      title: LanguageService.t('welcome.title'),
      content,
      size: 'lg',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      onClose: () => {
        if (this.dontShowAgain) {
          WelcomeModal.markAsSeen();
        }
        this.modalId = null;
      },
    });
  }

  /**
   * Close the welcome modal
   */
  close(): void {
    if (this.modalId) {
      ModalService.dismiss(this.modalId);
      this.modalId = null;
    }
  }

  /**
   * Create modal content
   */
  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'welcome-modal-content';

    // Introduction text
    const intro = document.createElement('p');
    intro.className = 'mb-6';
    intro.style.color = 'var(--theme-text-muted)';
    intro.textContent = LanguageService.t('welcome.intro');
    container.appendChild(intro);

    // Tools grid
    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'grid grid-cols-3 gap-3 mb-6';

    TOOLS.forEach((tool) => {
      const toolCard = this.createToolCard(tool);
      toolsGrid.appendChild(toolCard);
    });

    container.appendChild(toolsGrid);

    // Quick tips section
    const tipsSection = this.createTipsSection();
    container.appendChild(tipsSection);

    // Don't show again checkbox
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'flex items-center gap-2 mt-6 pt-4 border-t';
    checkboxContainer.style.borderColor = 'var(--theme-border)';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'welcome-dont-show';
    checkbox.className = 'w-4 h-4 rounded';
    checkbox.style.accentColor = 'var(--theme-primary)';
    checkbox.addEventListener('change', () => {
      this.dontShowAgain = checkbox.checked;
    });

    const label = document.createElement('label');
    label.htmlFor = 'welcome-dont-show';
    label.className = 'text-sm cursor-pointer';
    label.style.color = 'var(--theme-text-muted)';
    label.textContent = LanguageService.t('welcome.dontShowAgain');

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);
    container.appendChild(checkboxContainer);

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-end gap-3 mt-4';

    // "Take the Tour" button (secondary)
    const takeTourBtn = document.createElement('button');
    takeTourBtn.className =
      'px-6 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
    takeTourBtn.style.backgroundColor = 'var(--theme-card-background)';
    takeTourBtn.style.color = 'var(--theme-text)';
    takeTourBtn.style.border = '1px solid var(--theme-primary)';
    takeTourBtn.addEventListener('mouseenter', () => {
      takeTourBtn.style.backgroundColor = 'var(--theme-card-hover)';
    });
    takeTourBtn.addEventListener('mouseleave', () => {
      takeTourBtn.style.backgroundColor = 'var(--theme-card-background)';
    });
    takeTourBtn.textContent = LanguageService.t('welcome.takeTour');
    takeTourBtn.addEventListener('click', () => {
      this.dontShowAgain = true; // Mark as seen
      this.close();
      WelcomeModal.markAsSeen();
      // Start tutorial after modal animation completes
      setTimeout(() => {
        TutorialService.start('harmony');
      }, 350);
    });

    // "Get Started" button (primary)
    const getStartedBtn = document.createElement('button');
    getStartedBtn.className =
      'px-6 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
    getStartedBtn.style.backgroundColor = 'var(--theme-primary)';
    getStartedBtn.style.color = 'var(--theme-text-header)';
    getStartedBtn.addEventListener('mouseenter', () => {
      getStartedBtn.style.filter = 'brightness(1.1)';
    });
    getStartedBtn.addEventListener('mouseleave', () => {
      getStartedBtn.style.filter = '';
    });
    getStartedBtn.textContent = LanguageService.t('welcome.getStarted');
    getStartedBtn.addEventListener('click', () => {
      this.dontShowAgain = true; // Always mark as seen when clicking Get Started
      this.close();
      WelcomeModal.markAsSeen();
    });

    buttonContainer.appendChild(takeTourBtn);
    buttonContainer.appendChild(getStartedBtn);
    container.appendChild(buttonContainer);

    return container;
  }

  /**
   * Create a tool card
   */
  private createToolCard(tool: ToolInfo): HTMLElement {
    const card = document.createElement('div');
    card.className = 'flex flex-col items-center p-3 rounded-lg transition-colors cursor-pointer';
    card.style.backgroundColor = 'var(--theme-card-background)';
    card.addEventListener('mouseenter', () => {
      card.style.backgroundColor = 'var(--theme-card-hover)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.backgroundColor = 'var(--theme-card-background)';
    });

    // Use inline SVG for theme color inheritance
    const iconContainer = document.createElement('span');
    iconContainer.className = 'w-8 h-8 mb-2 flex items-center justify-center';
    iconContainer.style.color = 'var(--theme-text)';
    iconContainer.setAttribute('aria-hidden', 'true');
    iconContainer.innerHTML = tool.icon;
    card.appendChild(iconContainer);

    const name = document.createElement('span');
    name.className = 'text-xs font-medium text-center';
    name.style.color = 'var(--theme-text)';
    name.textContent = LanguageService.t(tool.nameKey);
    card.appendChild(name);

    // Tooltip with description
    card.title = LanguageService.t(tool.descriptionKey);

    return card;
  }

  /**
   * Create quick tips section
   */
  private createTipsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'rounded-lg p-4';
    section.style.backgroundColor = 'var(--theme-background-secondary)';

    const title = document.createElement('h3');
    title.className = 'text-sm font-semibold mb-2';
    title.style.color = 'var(--theme-text)';
    title.textContent = LanguageService.t('welcome.quickTips');
    section.appendChild(title);

    const tips = [
      LanguageService.t('welcome.tip1'),
      LanguageService.t('welcome.tip2'),
      LanguageService.t('welcome.tip3'),
    ];

    const list = document.createElement('ul');
    list.className = 'space-y-1';

    tips.forEach((tip) => {
      const item = document.createElement('li');
      item.className = 'text-sm flex items-start gap-2';
      item.style.color = 'var(--theme-text-muted)';
      const bullet = document.createElement('span');
      bullet.style.color = 'var(--theme-primary)';
      bullet.textContent = '•';
      item.appendChild(bullet);
      item.appendChild(document.createTextNode(' ' + tip));
      list.appendChild(item);
    });

    section.appendChild(list);

    return section;
  }
}

/**
 * Show welcome modal if first visit
 */
export function showWelcomeIfFirstVisit(): void {
  if (WelcomeModal.shouldShow()) {
    // Small delay to ensure app is fully loaded
    setTimeout(() => {
      const modal = new WelcomeModal();
      modal.show();
    }, 500);
  }
}
