/**
 * XIV Dye Tools 5.0 - About Modal Component (the five cuts)
 *
 * The confirmed Modal Directions About frame:
 * - The build-stack line is gone (a player looking up who made a dye tool is
 *   not shopping for a build chain)
 * - Version becomes data: three mono cells — version, build, dye count (the
 *   one number in here anybody checks, and the one that moved in 7.5)
 * - Seven labelled chips become seven 44px icon links in one row
 * - The dev API folds into a single disclosure row, closed by default
 * - The disclaimer gets a box: bordered block with a mono label instead of
 *   the smallest type in the modal
 * - Logo drops 120px → 84px — it is a modal, not a splash screen
 *
 * @module components/about-modal
 */

import { ModalService } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { dyeService } from '@services/dye-service-wrapper';
import { APP_NAME, APP_VERSION, BUILD_DATE } from '@shared/constants';
import { SOCIAL_LINKS as CORE_SOCIAL_LINKS } from '@xivdyetools/core';
import {
  ICON_GITHUB,
  ICON_TWITTER,
  ICON_TWITCH,
  ICON_BLUESKY,
  ICON_DISCORD,
  ICON_PATREON,
  ICON_KOFI,
} from '@shared/social-icons';
import { LOGO_SPARKLES } from '@shared/app-logo';

// ============================================================================
// Social Media Links (icon-only, 44px targets)
// ============================================================================

interface SocialLink {
  label: string;
  url: string;
  icon: string;
}

/**
 * Icons are presentation and stay here; the URLs come from core, because the
 * bot's `/about` prints the same seven and a duplicated list is one that
 * drifts. Keyed by label so a reordering in core carries through and a
 * renamed entry fails loudly rather than silently losing its icon.
 */
const SOCIAL_ICONS: Record<string, string> = {
  GitHub: ICON_GITHUB,
  'X/Twitter': ICON_TWITTER,
  Twitch: ICON_TWITCH,
  Bluesky: ICON_BLUESKY,
  Discord: ICON_DISCORD,
  Patreon: ICON_PATREON,
  'Ko-fi': ICON_KOFI,
};

const SOCIAL_LINKS: SocialLink[] = CORE_SOCIAL_LINKS.map(({ label, url }) => ({
  label,
  url,
  icon: SOCIAL_ICONS[label] ?? '',
}));

// ============================================================================
// About Modal Class
// ============================================================================

/**
 * About modal showing app information and credits
 */
export class AboutModal {
  private modalId: string | null = null;

  /**
   * Show the about modal
   */
  show(): void {
    if (this.modalId) return; // Already showing

    const content = this.createContent();

    this.modalId = ModalService.show({
      type: 'custom',
      title: LanguageService.t('about.title'),
      eyebrow: APP_NAME.toUpperCase(),
      subtitle: LanguageService.t('about.subtitle'),
      content,
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      confirmText: LanguageService.t('common.close'),
      onClose: () => {
        this.modalId = null;
      },
    });
  }

  /**
   * Close the about modal
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
    container.className = 'about-modal-content';

    // Logo (84px — it is a modal, not a splash screen)
    const logoContainer = document.createElement('div');
    logoContainer.className = 'flex justify-center mb-3';
    const logoWrapper = document.createElement('div');
    logoWrapper.style.width = '84px';
    logoWrapper.style.height = '84px';
    logoWrapper.innerHTML = LOGO_SPARKLES;
    logoContainer.appendChild(logoWrapper);
    container.appendChild(logoContainer);

    const appTitle = document.createElement('h3');
    appTitle.className = 'text-lg font-bold text-center mb-4';
    appTitle.style.color = 'var(--theme-text)';
    appTitle.textContent = APP_NAME;
    container.appendChild(appTitle);

    // Version becomes data: three mono cells
    container.appendChild(this.createStatsRow());

    // Creator line
    const creatorText = document.createElement('p');
    creatorText.className = 'text-sm text-center mb-5';
    creatorText.style.color = 'var(--theme-text)';
    creatorText.textContent = LanguageService.t('footer.createdBy');
    container.appendChild(creatorText);

    // Socials: one row of 44px icon links
    container.appendChild(this.createSocialRow());

    // Credits
    container.appendChild(this.createCredits());

    // Developer API disclosure (closed by default)
    container.appendChild(this.createApiDisclosure());

    // Attribution block (bordered, mono label — no longer the smallest type)
    container.appendChild(this.createAttribution());

    return container;
  }

  /**
   * Three mono cells: version, build, dye count.
   */
  private createStatsRow(): HTMLElement {
    const dyeCount = dyeService.getAllDyes().length;
    const stats: Array<{ value: string; label: string; accent?: boolean }> = [
      { value: `v${APP_VERSION}`, label: LanguageService.t('about.statVersion') },
      ...(BUILD_DATE ? [{ value: BUILD_DATE, label: LanguageService.t('about.statBuild') }] : []),
      { value: String(dyeCount), label: LanguageService.t('about.statDyes'), accent: true },
    ];

    const row = document.createElement('div');
    row.className = 'flex justify-center gap-2 mb-5';

    stats.forEach((stat) => {
      const cell = document.createElement('div');
      cell.className = 'flex flex-col items-center gap-1 px-4 py-2.5 rounded-lg';
      cell.style.backgroundColor = 'var(--theme-card-background)';

      const value = document.createElement('span');
      value.className = 'text-sm font-bold';
      value.style.fontFamily = "'Fragment Mono', monospace";
      value.style.color = stat.accent ? 'var(--theme-primary)' : 'var(--theme-text)';
      value.textContent = stat.value;
      cell.appendChild(value);

      const label = document.createElement('span');
      label.className = 'm16-label';
      label.textContent = stat.label;
      cell.appendChild(label);

      row.appendChild(cell);
    });

    return row;
  }

  /**
   * Seven 44px icon links in one row — the labels were saying "Ko-Fi" next
   * to a Ko-fi logo; the name lives in aria-label/title now.
   */
  private createSocialRow(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'mb-5';

    const label = document.createElement('div');
    label.className = 'm16-label text-center mb-2';
    label.textContent = LanguageService.t('about.elsewhere');
    section.appendChild(label);

    const rowEl = document.createElement('div');
    rowEl.className = 'flex justify-center gap-1.5 flex-wrap';

    SOCIAL_LINKS.forEach((social) => {
      const link = document.createElement('a');
      link.className = 'flex items-center justify-center rounded-lg transition-colors';
      link.style.width = '44px';
      link.style.height = '44px';
      link.style.backgroundColor = 'var(--theme-card-background)';
      link.style.color = 'var(--theme-text)';
      link.href = social.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = social.label;
      link.setAttribute('aria-label', social.label);

      link.addEventListener('mouseenter', () => {
        link.style.backgroundColor = 'var(--theme-card-hover)';
      });
      link.addEventListener('mouseleave', () => {
        link.style.backgroundColor = 'var(--theme-card-background)';
      });

      const iconSpan = document.createElement('span');
      iconSpan.className = 'inline-block w-5 h-5';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.innerHTML = social.icon;
      link.appendChild(iconSpan);

      rowEl.appendChild(link);
    });

    section.appendChild(rowEl);
    return section;
  }

  /**
   * Credits: Universalis + spectral.js, each with its host as the link.
   */
  private createCredits(): HTMLElement {
    const creditsSection = document.createElement('div');
    creditsSection.className = 'text-center mb-5 space-y-1.5';

    const credit = (text: string, host: string, url: string): HTMLElement => {
      const p = document.createElement('p');
      p.className = 'text-xs';
      p.style.color = 'var(--theme-text-muted)';
      p.appendChild(document.createTextNode(text + ' '));
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'hover:underline';
      a.style.color = 'var(--theme-primary)';
      a.style.fontFamily = "'Fragment Mono', monospace";
      a.textContent = host;
      p.appendChild(a);
      return p;
    };

    creditsSection.appendChild(
      credit(
        LanguageService.t('footer.universalisCredit'),
        'universalis.app',
        'https://universalis.app/'
      )
    );
    creditsSection.appendChild(
      credit(
        LanguageService.t('about.spectralCredit'),
        'spectral.js',
        'https://github.com/rvanwijnen/spectral.js'
      )
    );

    return creditsSection;
  }

  /**
   * The dev API folds away: one disclosure row, closed by default, for an
   * audience of maybe five people.
   */
  private createApiDisclosure(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'mb-5 rounded-lg border';
    section.style.borderColor = 'var(--theme-border)';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'w-full flex items-center justify-between gap-2 px-3 text-left';
    toggle.style.minHeight = '46px';
    toggle.style.color = 'var(--theme-text)';
    toggle.setAttribute('aria-expanded', 'false');

    const toggleText = document.createElement('span');
    toggleText.className = 'flex flex-col';
    const apiLabel = document.createElement('span');
    apiLabel.className = 'm16-label';
    apiLabel.textContent = LanguageService.t('about.developerApi');
    toggleText.appendChild(apiLabel);
    const apiSummary = document.createElement('span');
    apiSummary.className = 'text-xs';
    apiSummary.style.color = 'var(--theme-text-muted)';
    apiSummary.textContent = LanguageService.t('about.apiSummary');
    toggleText.appendChild(apiSummary);
    toggle.appendChild(toggleText);

    const caret = document.createElement('span');
    caret.setAttribute('aria-hidden', 'true');
    caret.style.color = 'var(--theme-text-muted)';
    caret.textContent = '▸';
    toggle.appendChild(caret);

    const body = document.createElement('div');
    body.className = 'hidden px-3 pb-3';

    const desc = document.createElement('p');
    desc.className = 'text-xs mb-2';
    desc.style.color = 'var(--theme-text-muted)';
    desc.textContent = LanguageService.t('about.developerApiDesc');
    body.appendChild(desc);

    const links = document.createElement('div');
    links.className = 'flex flex-col gap-1';
    const apiLink = (label: string, host: string, url: string): HTMLElement => {
      const a = document.createElement('a');
      a.className = 'flex items-baseline gap-2 text-xs hover:underline';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.color = 'var(--theme-text)';
      const l = document.createElement('span');
      l.textContent = label;
      a.appendChild(l);
      const h = document.createElement('span');
      h.style.fontFamily = "'Fragment Mono', monospace";
      h.style.color = 'var(--theme-primary)';
      h.textContent = host;
      a.appendChild(h);
      return a;
    };
    links.appendChild(
      apiLink(
        LanguageService.t('about.dataApiLabel'),
        'data.xivdyetools.app',
        'https://data.xivdyetools.app'
      )
    );
    links.appendChild(
      apiLink(
        LanguageService.t('about.apiDocsLabel'),
        'developers.xivdyetools.app',
        'https://developers.xivdyetools.app'
      )
    );
    body.appendChild(links);

    toggle.addEventListener('click', () => {
      const isOpen = !body.classList.contains('hidden');
      body.classList.toggle('hidden', isOpen);
      caret.textContent = isOpen ? '▸' : '▾';
      toggle.setAttribute('aria-expanded', String(!isOpen));
    });

    section.appendChild(toggle);
    section.appendChild(body);
    return section;
  }

  /**
   * The disclaimer gets a box — bordered block with a mono label, at the
   * same size as the credits instead of the smallest type in the modal.
   */
  private createAttribution(): HTMLElement {
    const block = document.createElement('div');
    block.className = 'rounded-lg border px-3 py-3';
    block.style.borderColor = 'var(--theme-border)';

    const label = document.createElement('div');
    label.className = 'm16-label mb-1.5';
    label.textContent = LanguageService.t('about.legalLabel');
    block.appendChild(label);

    const disclaimer = document.createElement('p');
    disclaimer.className = 'text-xs mb-1';
    disclaimer.style.color = 'var(--theme-text-muted)';
    disclaimer.textContent = LanguageService.t('footer.disclaimer');
    block.appendChild(disclaimer);

    const notAffiliated = document.createElement('p');
    notAffiliated.className = 'text-xs';
    notAffiliated.style.color = 'var(--theme-text-muted)';
    notAffiliated.textContent = LanguageService.t('footer.notAffiliated');
    block.appendChild(notAffiliated);

    return block;
  }
}

// Singleton instance to prevent multiple about modals
let aboutModalInstance: AboutModal | null = null;

/**
 * Show the about modal
 * Uses singleton pattern to prevent multiple instances
 */
export function showAboutModal(): void {
  if (!aboutModalInstance) {
    aboutModalInstance = new AboutModal();
  }
  aboutModalInstance.show();
}
