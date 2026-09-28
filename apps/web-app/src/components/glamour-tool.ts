/**
 * XIV Dye Tools — Glamour Reader, the tenth tool (design 1a/1b, 2026-09-27).
 *
 * What is this character wearing, and can it be worn? The loaded `.chara`
 * file (PR #206's CharaSessionService, shared with the Swatch Matcher) read
 * as a glamour: the in-game verdict first, then every piece with its dyes,
 * the twins a piece can be named from, and the GPOSERS list with its
 * Acquisition lines. No sidebar: tribe and gender come from the file and
 * nothing here is a colour match.
 *
 * Spec: docs/superpowers/specs/2026-09-27-glamour-reader-design.md
 *
 * @module components/glamour-tool
 */

import { BaseComponent } from '@components/base-component';
import { LanguageService } from '@services/index';
import { clearContainer } from '@shared/utils';

export class GlamourTool extends BaseComponent {
  renderContent(): void {
    clearContainer(this.container);
    const root = this.createElement('div', {
      className: 'glamour-tool',
      attributes: { 'data-tool': 'glamour' },
    });
    root.style.cssText =
      'display: flex; flex-direction: column; gap: 16px; max-width: 900px; margin: 0 auto; padding: 24px 16px;';

    const head = this.createElement('div');
    head.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    const title = this.createElement('h1', {
      textContent: LanguageService.t('tools.glamour.title'),
    });
    title.style.cssText =
      'margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--theme-text);';
    const lead = this.createElement('p', {
      textContent: LanguageService.t('tools.glamour.description'),
    });
    lead.style.cssText = 'margin: 0; font-size: 13.5px; color: var(--theme-text-muted);';
    head.append(title, lead);
    root.appendChild(head);

    this.container.appendChild(root);
    this.element = this.container;
  }

  bindEvents(): void {
    // The reader's controls bind their own events.
  }

  onMount(): void {
    this.subs.add(LanguageService.subscribe(() => this.update()));
  }
}
