/**
 * XIV Dye Tools 5.0 — Sign-in modal (8S shared flow, 460px).
 *
 * The honest account gate: browsing and saving work without an account —
 * the saved shelf is local and survives sign-out and worker outages. An
 * account is only needed to vote and submit. Light-DOM 16A modal, so
 * Tailwind utilities apply here.
 *
 * @module components/signin-modal
 */

import { ModalService } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { authService } from '@services/auth-service';

function row(tick: string, tickBg: string, tickColor: string, label: string, note: string): string {
  return `
    <div style="display: flex; align-items: flex-start; gap: 10px; padding: 7px 0;">
      <span style="flex: 0 0 auto; width: 20px; height: 20px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; background: ${tickBg}; color: ${tickColor};">${tick}</span>
      <span style="min-width: 0;">
        <span style="display: block; font-size: 13px; font-weight: 600; color: var(--theme-text);">${label}</span>
        <span style="display: block; font-size: 11.5px; color: var(--theme-text-muted);">${note}</span>
      </span>
    </div>`;
}

/**
 * Show the 8S sign-in modal. Returns immediately; provider buttons kick off
 * the OAuth redirect.
 */
export function showSignInModal(): void {
  const t = (key: string) => LanguageService.t(key);

  const content = document.createElement('div');
  content.innerHTML = `
    <p style="font-size: 15px; font-weight: 650; line-height: 1.4; color: var(--theme-text); margin: 0 0 6px;">${t('preset.signinHeadline')}</p>
    <p style="font-size: 12.5px; line-height: 1.55; color: var(--theme-text-muted); margin: 0 0 14px;">${t('preset.signinBlurb')}</p>

    <div style="font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-bottom: 4px;">${t('preset.gateTitle')}</div>
    ${row('✓', 'rgba(97, 197, 84, 0.16)', '#61C554', t('preset.gateBrowse'), t('preset.gateBrowseNote'))}
    ${row('✓', 'rgba(97, 197, 84, 0.16)', '#61C554', t('preset.gateSave'), t('preset.gateSaveNote'))}
    ${row('★', 'color-mix(in srgb, var(--theme-primary) 16%, transparent)', 'var(--theme-primary)', t('preset.gateVote'), t('preset.gateVoteNote'))}
    ${row('★', 'color-mix(in srgb, var(--theme-primary) 16%, transparent)', 'var(--theme-primary)', t('preset.gateSubmit'), t('preset.gateSubmitNote'))}

    <div style="display: flex; flex-direction: column; gap: 8px; margin: 14px 0;">
      <button id="signin-discord" style="display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(88, 101, 242, 0.45); background: rgba(88, 101, 242, 0.14); cursor: pointer; text-align: left;">
        <span style="flex: 0 0 auto; width: 24px; height: 24px; border-radius: 7px; background: #5865F2; color: #FFFFFF; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">D</span>
        <span style="min-width: 0;">
          <span style="display: block; font-size: 13.5px; font-weight: 650; color: var(--theme-text);">Discord</span>
          <span style="display: block; font-size: 11px; color: var(--theme-text-muted);">${t('preset.providerDiscordNote')}</span>
        </span>
      </button>
      <button id="signin-xivauth" style="display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--theme-border); background: var(--theme-card-background); cursor: pointer; text-align: left;">
        <span style="flex: 0 0 auto; width: 24px; height: 24px; border-radius: 7px; background: var(--theme-background-secondary); color: var(--theme-text-muted); display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">X</span>
        <span style="min-width: 0;">
          <span style="display: block; font-size: 13.5px; font-weight: 650; color: var(--theme-text);">XIVAuth</span>
          <span style="display: block; font-size: 11px; color: var(--theme-text-muted);">${t('preset.providerXivauthNote')}</span>
        </span>
      </button>
    </div>

    <p style="font-size: 11px; line-height: 1.55; color: var(--theme-text-muted); margin: 0;">${t('preset.privacyNote')}</p>
  `;

  content.querySelector('#signin-discord')?.addEventListener('click', () => {
    void authService.login(window.location.pathname, 'presets');
  });
  content.querySelector('#signin-xivauth')?.addEventListener('click', () => {
    void authService.loginWithXIVAuth(window.location.pathname, 'presets');
  });

  ModalService.show({
    type: 'custom',
    title: LanguageService.t('preset.signIn'),
    subtitle: LanguageService.t('preset.signinSub'),
    content,
    panelWidth: 460,
  });
}
