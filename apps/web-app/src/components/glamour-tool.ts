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
 * One file, two tools: the file card links to the Swatch Matcher, and SWAP
 * clears the file for both. With no file loaded the card is the drop zone.
 *
 * Spec: docs/superpowers/specs/2026-09-27-glamour-reader-design.md
 *
 * @module components/glamour-tool
 */

import { LanguageService, RouterService, ToastService } from '@services/index';
import { BaseComponent } from '@components/base-component';
import { CharaFileCard } from '@components/chara-file-card';
import { hasGlamour } from '@components/chara-ui';
import type { GlamourBlock } from '@components/glamour-block';
import { CharaSessionService } from '@services/chara-session-service';
import { clearContainer } from '@shared/utils';
import { logger } from '@shared/logger';
import type { Dye } from '@xivdyetools/types';

export class GlamourTool extends BaseComponent {
  private fileCard: CharaFileCard | null = null;
  /** DYES ON THIS GLAMOUR — its own chunk, created once a file wears anything */
  private block: GlamourBlock | null = null;
  private blockContainer: HTMLElement | null = null;
  /** Where the block draws Copy list / Export .md (the tool's header) */
  private actionsHost: HTMLElement | null = null;
  /** Invalidates an in-flight block chunk load on re-render and destroy */
  private blockLoadToken = 0;

  renderContent(): void {
    // The file card keeps nothing worth saving, so it is rebuilt; the block
    // carries its twin picks, palette draft and item names, so it moves into
    // the new container instead. A chunk load in flight is retired and redone.
    this.blockLoadToken++;
    this.fileCard?.destroy();
    this.fileCard = null;
    clearContainer(this.container);

    const root = this.createElement('div', {
      className: 'glamour-tool',
      attributes: { 'data-tool': 'glamour' },
    });
    root.style.cssText =
      'display: flex; flex-direction: column; gap: 14px; max-width: 900px; margin: 0 auto; padding: 20px 16px 32px; box-sizing: border-box; width: 100%;';

    // Title + lead left, Copy list / Export .md right (design 1a).
    const head = this.createElement('div');
    head.style.cssText =
      'display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap;';
    const text = this.createElement('div');
    text.style.cssText =
      'display: flex; flex-direction: column; gap: 6px; min-width: 0; flex: 1 1 320px;';
    const title = this.createElement('h1', {
      textContent: LanguageService.t('tools.glamour.title'),
    });
    title.style.cssText =
      'margin: 0; font-family: var(--font-display); font-size: 22px; font-weight: 700; color: var(--theme-text);';
    const lead = this.createElement('p', {
      textContent: LanguageService.t('tools.glamour.lead'),
    });
    lead.style.cssText =
      'margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--theme-text-muted);';
    text.append(title, lead);
    head.appendChild(text);
    const actions = this.createElement('div', { attributes: { 'data-role': 'reader-actions' } });
    actions.style.cssText = 'display: flex; gap: 8px; flex-shrink: 0;';
    head.appendChild(actions);
    this.actionsHost = actions;
    root.appendChild(head);

    const cardContainer = this.createElement('div');
    root.appendChild(cardContainer);
    this.fileCard = new CharaFileCard(cardContainer, {
      crossLink: {
        label: LanguageService.t('tools.character.title'),
        onOpen: () => RouterService.navigateTo('swatch'),
      },
    });
    this.fileCard.init();

    const blockContainer = this.createElement('div');
    blockContainer.style.cssText = 'width: 100%;';
    root.appendChild(blockContainer);
    this.blockContainer = blockContainer;
    if (this.block) this.block.moveTo(blockContainer, actions);

    this.container.appendChild(root);
    this.element = this.container;
    this.syncBlock();
  }

  bindEvents(): void {
    // The file card and the block bind their own events.
  }

  onMount(): void {
    this.subs.add(LanguageService.subscribe(() => this.update()));
    this.subs.add(CharaSessionService.subscribe(() => this.syncBlock()));
  }

  onUnmount(): void {
    this.blockLoadToken++;
    this.fileCard?.destroy();
    this.block?.destroy();
    this.fileCard = null;
    this.block = null;
  }

  /**
   * DYES ON THIS GLAMOUR is its own chunk: imported the first time the loaded
   * file wears anything, then left mounted, since it follows the session itself.
   */
  private syncBlock(): void {
    const session = CharaSessionService.getSession();
    const container = this.blockContainer;
    if (this.block || !container || !session || !hasGlamour(session.resolved)) return;
    const token = ++this.blockLoadToken;
    void import('@components/glamour-block')
      .then(({ GlamourBlock }) => {
        if (token !== this.blockLoadToken || this.block) return;
        this.block = new GlamourBlock(container, {
          onSubmitPalette: (dyes, name) => this.submitPalette(dyes, name),
          actionsHost: this.actionsHost ?? undefined,
        });
        this.block.init();
      })
      .catch((error: unknown) => {
        logger.error('[GlamourTool] Failed to load the glamour block', error);
        ToastService.error(LanguageService.t('errors.toolLoadFailed'));
      });
  }

  /** Make a palette → Submit to Community opens the preset form, loaded on demand. */
  private submitPalette(dyes: Dye[], name?: string): void {
    void import('@components/preset-submission-form')
      .then(({ showPresetSubmissionForm }) => {
        showPresetSubmissionForm(undefined, { dyes, name });
      })
      .catch((error: unknown) => {
        logger.error('[GlamourTool] Failed to load the preset submission form', error);
        ToastService.error(LanguageService.t('errors.toolLoadFailed'));
      });
  }
}
