/**
 * XIV Dye Tools - About Modal Component
 *
 * Modal displaying app information, credits, social links, and attribution
 * Triggered by info button in header
 *
 * @module components/about-modal
 */

import { ModalService } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { APP_NAME, APP_VERSION } from '@shared/constants';
import {
  ICON_GITHUB,
  ICON_TWITTER,
  ICON_TWITCH,
  ICON_BLUESKY,
  ICON_DISCORD,
  ICON_PATREON,
  ICON_KOFI,
} from '@shared/social-icons';
import { ICON_CRYSTAL } from '@shared/ui-icons';
import { LOGO_SPARKLES } from '@shared/app-logo';

// ============================================================================
// Social Media Links
// ============================================================================

interface SocialLink {
  label: string;
  url: string;
  icon: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  { label: 'GitHub', url: 'https://github.com/FlashGalatine', icon: ICON_GITHUB },
  { label: 'X/Twitter', url: 'https://x.com/AsheJunius', icon: ICON_TWITTER },
  { label: 'Twitch', url: 'https://www.twitch.tv/flashgalatine', icon: ICON_TWITCH },
  { label: 'BlueSky', url: 'https://bsky.app/profile/projectgalatine.com', icon: ICON_BLUESKY },
  { label: 'Discord', url: 'https://discord.gg/5VUSKTZCe5', icon: ICON_DISCORD },
  { label: 'Patreon', url: 'https://patreon.com/ProjectGalatine', icon: ICON_PATREON },
  { label: 'Ko-Fi', url: 'https://ko-fi.com/flashgalatine', icon: ICON_KOFI },
];

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
      content,
      size: 'md',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
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

    // App info section with logo
    const appInfo = document.createElement('div');
    appInfo.className = 'text-center mb-6';

    // Large logo at the top
    const logoContainer = document.createElement('div');
    logoContainer.className = 'flex justify-center mb-4';
    const logoWrapper = document.createElement('div');
    logoWrapper.style.width = '120px';
    logoWrapper.style.height = '120px';
    logoWrapper.innerHTML = LOGO_SPARKLES;
    logoContainer.appendChild(logoWrapper);
    appInfo.appendChild(logoContainer);

    const appTitle = document.createElement('h2');
    appTitle.className = 'text-xl font-bold mb-1';
    appTitle.style.color = 'var(--theme-text)';
    appTitle.textContent = APP_NAME;
    appInfo.appendChild(appTitle);

    const version = document.createElement('p');
    version.className = 'text-sm number';
    version.style.color = 'var(--theme-text-muted)';
    version.textContent = `v${APP_VERSION}`;
    appInfo.appendChild(version);

    const buildInfo = document.createElement('p');
    buildInfo.className = 'text-xs mt-1';
    buildInfo.style.color = 'var(--theme-text-muted)';
    buildInfo.textContent = 'Built with TypeScript, Vite, and Tailwind CSS';
    appInfo.appendChild(buildInfo);

    container.appendChild(appInfo);

    // Creator section
    const creatorSection = document.createElement('div');
    creatorSection.className = 'text-center mb-6 pb-6 border-b';
    creatorSection.style.borderColor = 'var(--theme-border)';

    const creatorText = document.createElement('p');
    creatorText.className = 'text-sm';
    creatorText.style.color = 'var(--theme-text)';
    creatorText.innerHTML = `${LanguageService.t('footer.createdBy')} <span class="inline-block w-4 h-4 ml-0.5" aria-hidden="true" style="vertical-align: middle;">${ICON_CRYSTAL}</span>`;
    creatorSection.appendChild(creatorText);

    container.appendChild(creatorSection);

    // Social links section
    const socialSection = document.createElement('div');
    socialSection.className = 'mb-6';

    const socialTitle = document.createElement('h3');
    socialTitle.className = 'text-sm font-semibold mb-3 text-center';
    socialTitle.style.color = 'var(--theme-text)';
    socialTitle.textContent = LanguageService.t('about.connect');
    socialSection.appendChild(socialTitle);

    const socialGrid = document.createElement('div');
    socialGrid.className = 'flex flex-wrap justify-center gap-3';

    SOCIAL_LINKS.forEach((social) => {
      const link = document.createElement('a');
      link.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors';
      link.style.backgroundColor = 'var(--theme-card-background)';
      link.style.color = 'var(--theme-text)';
      link.href = social.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = social.label;

      link.addEventListener('mouseenter', () => {
        link.style.backgroundColor = 'var(--theme-card-hover)';
      });
      link.addEventListener('mouseleave', () => {
        link.style.backgroundColor = 'var(--theme-card-background)';
      });

      const iconSpan = document.createElement('span');
      iconSpan.className = 'inline-block w-4 h-4';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.innerHTML = social.icon;
      link.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.textContent = social.label;
      link.appendChild(labelSpan);

      socialGrid.appendChild(link);
    });

    socialSection.appendChild(socialGrid);
    container.appendChild(socialSection);

    // Credits section (Universalis + Spectral.js)
    const creditsSection = document.createElement('div');
    creditsSection.className = 'text-center mb-6 space-y-2';

    const universalisText = document.createElement('p');
    universalisText.className = 'text-xs';
    universalisText.style.color = 'var(--theme-text-muted)';
    universalisText.innerHTML = `${LanguageService.t('footer.universalisCredit')} <a href="https://universalis.app/" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Universalis</a>`;
    creditsSection.appendChild(universalisText);

    const spectralText = document.createElement('p');
    spectralText.className = 'text-xs';
    spectralText.style.color = 'var(--theme-text-muted)';
    spectralText.innerHTML = `Realistic paint mixing powered by <a href="https://github.com/rvanwijnen/spectral.js" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">spectral.js</a> (Kubelka-Munk theory)`;
    creditsSection.appendChild(spectralText);

    container.appendChild(creditsSection);

    // Square Enix disclaimer section
    const disclaimerSection = document.createElement('div');
    disclaimerSection.className = 'text-center mb-6 pt-4 border-t';
    disclaimerSection.style.borderColor = 'var(--theme-border)';

    const disclaimerText = document.createElement('p');
    disclaimerText.className = 'text-xs';
    disclaimerText.style.color = 'var(--theme-text-muted)';
    disclaimerText.innerHTML = `${LanguageService.t('footer.disclaimer')}<br>${LanguageService.t('footer.notAffiliated')}`;
    disclaimerSection.appendChild(disclaimerText);

    container.appendChild(disclaimerSection);

    // Close button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex justify-center';

    const closeBtn = document.createElement('button');
    closeBtn.className =
      'px-6 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
    closeBtn.style.backgroundColor = 'var(--theme-primary)';
    closeBtn.style.color = 'var(--theme-text-header)';
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.filter = 'brightness(1.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.filter = '';
    });
    closeBtn.textContent = LanguageService.t('common.close');
    closeBtn.addEventListener('click', () => {
      this.close();
    });

    buttonContainer.appendChild(closeBtn);
    container.appendChild(buttonContainer);

    return container;
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

/**
 * Close the about modal if open
 */
export function closeAboutModal(): void {
  if (aboutModalInstance) {
    aboutModalInstance.close();
    aboutModalInstance = null;
  }
}
