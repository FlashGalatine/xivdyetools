/**
 * XIV Dye Tools 5.0 - Welcome Modal Component (W2 Shortlist)
 *
 * First-visit welcome per the confirmed Modal Directions W2 frame:
 * four colour-in/colour-out leads (Harmony, Extractor, Mixer, Gradient) with
 * one line each, the other five tools named in a mono row (text, not targets),
 * and two tips. The dead `dontShowAgain` checkbox is cut — `markAsSeen()`
 * already runs on every close path (BUG-077), so the control offered a choice
 * that had already been made.
 *
 * Get started lands on the router's own default (never a hardcoded tool);
 * Take the tour starts the tutorial there too.
 *
 * @module components/welcome-modal
 */

import { ModalService } from '@services/modal-service';
import { StorageService } from '@services/storage-service';
import { LanguageService } from '@services/language-service';
import { TutorialService, type TutorialTool } from '@services/tutorial-service';
import { RouterService } from '@services/router-service';
import { STORAGE_KEYS, APP_VERSION } from '@shared/constants';
import { TOOL_ICONS } from '@shared/tool-icons';

// ============================================================================
// W2 Shortlist — the four leads (colour-in, colour-out; Budget is in the row)
// ============================================================================

interface LeadInfo {
  id: string;
  icon: string;
  /** Existing tool title key — the lead names track the tool registry */
  nameKey: string;
  /** W2 one-liner */
  lineKey: string;
}

const LEADS: LeadInfo[] = [
  {
    id: 'harmony',
    icon: TOOL_ICONS.harmony,
    nameKey: 'tools.harmony.title',
    lineKey: 'welcome.lead.harmony',
  },
  {
    id: 'extractor',
    icon: TOOL_ICONS.extractor,
    nameKey: 'tools.matcher.title',
    lineKey: 'welcome.lead.extractor',
  },
  {
    id: 'mixer',
    icon: TOOL_ICONS.mixer,
    nameKey: 'tools.mixer.title',
    lineKey: 'welcome.lead.mixer',
  },
  {
    id: 'gradient',
    icon: TOOL_ICONS.gradient,
    nameKey: 'tools.gradient.title',
    lineKey: 'welcome.lead.gradient',
  },
];

/** The five in the mono row — named so nothing is hidden, but text, not targets */
const REST_SHORT_NAME_KEYS = [
  'tools.comparison.shortName',
  'tools.budget.shortName',
  'tools.presets.shortName',
  'tools.character.shortName',
  'tools.accessibility.shortName',
];

// ============================================================================
// Welcome Modal Class
// ============================================================================

/**
 * Welcome modal for first-time users
 */
export class WelcomeModal {
  private modalId: string | null = null;

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
      eyebrow: LanguageService.t('welcome.eyebrow'),
      content,
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      cancelText: LanguageService.t('welcome.takeTour'),
      onCancel: () => {
        // Start the tutorial on the router's default tool after the modal
        // animation completes
        setTimeout(() => {
          // TutorialTool is a narrower union than ToolId; start() warns and
          // no-ops if the router default ever moves to a tool without a tour
          TutorialService.start(RouterService.getDefaultTool() as TutorialTool);
        }, 350);
      },
      confirmText: LanguageService.t('welcome.getStarted'),
      onConfirm: () => {
        // Land somewhere deliberate: the router's own default, never a
        // hardcoded tool name (the five mono-row tools are text, not targets)
        RouterService.navigateTo(RouterService.getDefaultTool());
      },
      onClose: () => {
        // BUG-077 (2026-07-18 audit): any close counts as "seen" — matching
        // the documented "shows only once" behavior. Previously X/backdrop/
        // Escape left WELCOME_SEEN unset, so the modal nagged on every visit
        // AND (because markAsSeen is the first writer of LAST_VERSION_VIEWED)
        // permanently suppressed the changelog auto-popup for those users.
        WelcomeModal.markAsSeen();
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
   * Create modal content (W2: intro, four leads, mono row, two tips)
   */
  private createContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'welcome-modal-content';

    // Introduction text
    const intro = document.createElement('p');
    intro.className = 'mb-5 text-sm leading-relaxed';
    intro.style.color = 'var(--theme-text-muted)';
    intro.textContent = LanguageService.t('welcome.intro');
    container.appendChild(intro);

    // The four leads
    const leadList = document.createElement('div');
    leadList.className = 'flex flex-col gap-2 mb-5';
    LEADS.forEach((lead) => {
      leadList.appendChild(this.createLeadRow(lead));
    });
    container.appendChild(leadList);

    // The other five, named in a mono row
    const rest = document.createElement('div');
    rest.className = 'mb-5';

    const restLabel = document.createElement('div');
    restLabel.className = 'm16-label mb-1';
    restLabel.textContent = LanguageService.t('welcome.restLabel');
    rest.appendChild(restLabel);

    const restRow = document.createElement('div');
    restRow.className = 'text-xs';
    restRow.style.fontFamily = 'var(--font-mono)';
    restRow.style.color = 'var(--theme-text-muted)';
    restRow.textContent = REST_SHORT_NAME_KEYS.map((key) => LanguageService.t(key)).join(' · ');
    rest.appendChild(restRow);

    container.appendChild(rest);

    // Two tips
    container.appendChild(this.createTipsSection());

    return container;
  }

  /**
   * Create one lead row: glyph, tool name, one line
   */
  private createLeadRow(lead: LeadInfo): HTMLElement {
    const row = document.createElement('div');
    row.className = 'flex items-start gap-3 p-3 rounded-xl';
    row.style.backgroundColor = 'var(--theme-card-background)';

    const iconContainer = document.createElement('span');
    iconContainer.className = 'flex items-center justify-center flex-shrink-0';
    iconContainer.style.width = '30px';
    iconContainer.style.height = '30px';
    iconContainer.style.color = 'var(--theme-text)';
    iconContainer.setAttribute('aria-hidden', 'true');
    iconContainer.innerHTML = lead.icon;
    row.appendChild(iconContainer);

    const text = document.createElement('div');
    text.className = 'flex flex-col gap-0.5 min-w-0';

    const name = document.createElement('span');
    name.className = 'text-sm font-semibold';
    name.style.color = 'var(--theme-text)';
    name.textContent = LanguageService.t(lead.nameKey);
    text.appendChild(name);

    const line = document.createElement('span');
    line.className = 'text-xs leading-relaxed';
    line.style.color = 'var(--theme-text-muted)';
    line.textContent = LanguageService.t(lead.lineKey);
    text.appendChild(line);

    row.appendChild(text);
    return row;
  }

  /**
   * Create the two-tip section (the Spectrum pricing tip is cut — Budget is
   * no longer on the shortlist, and three tips overflowed DE/FR/JA)
   */
  private createTipsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'rounded-xl p-4';
    section.style.backgroundColor = 'var(--theme-background-secondary)';

    const title = document.createElement('div');
    title.className = 'm16-label mb-2';
    title.textContent = LanguageService.t('welcome.tipsLabel');
    section.appendChild(title);

    const tips = [LanguageService.t('welcome.tip1'), LanguageService.t('welcome.tip2')];

    const list = document.createElement('ul');
    list.className = 'space-y-1.5';

    tips.forEach((tip) => {
      const item = document.createElement('li');
      item.className = 'text-xs leading-relaxed flex items-start gap-2';
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
