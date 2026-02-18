/**
 * XIV Dye Tools - Preset Detail View Component
 *
 * Displays detailed information about a single preset including:
 * - Full color swatches with dye info
 * - Voting functionality
 * - Share functionality
 * - Tags display
 *
 * Extracted from preset-browser-tool.ts for better maintainability.
 *
 * @module components/preset-detail-view
 */

import { BaseComponent } from './base-component';
import {
  LanguageService,
  dyeService,
  hybridPresetService,
  authService,
  communityPresetService,
  ToastService,
  type UnifiedPreset,
} from '@services/index';
import { getCategoryIcon, ICON_ARROW_BACK } from '@shared/category-icons';
import { ICON_LINK } from '@shared/ui-icons';
import { ICON_CRYSTAL } from '@shared/ui-icons';
import type { Dye } from '@xivdyetools/core';

/**
 * Event callbacks for preset detail view actions
 */
export interface PresetDetailViewCallbacks {
  onBack: () => void;
  onVoteUpdate?: (preset: UnifiedPreset) => void;
}

/**
 * Preset Detail View Component
 * Displays detailed view of a preset with all dye information and actions
 */
export class PresetDetailView extends BaseComponent {
  private preset: UnifiedPreset;
  private callbacks: PresetDetailViewCallbacks;

  constructor(container: HTMLElement, preset: UnifiedPreset, callbacks: PresetDetailViewCallbacks) {
    super(container);
    this.preset = preset;
    this.callbacks = callbacks;
  }

  renderContent(): void {
    const detail = this.createElement('div', {
      className:
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6',
    });

    // Back button
    this.renderBackButton(detail);

    // Header with badges
    this.renderHeader(detail);

    // Large color swatches with dye info
    this.renderSwatchesSection(detail);

    // Tags section
    this.renderTagsSection(detail);

    // Action buttons section (share and vote)
    this.renderActionsSection(detail);

    // Login CTA if applicable
    this.renderLoginCTA(detail);

    this.element = detail;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    // Events are attached inline during render
  }

  /**
   * Render the back button
   */
  private renderBackButton(container: HTMLElement): void {
    const backBtn = this.createElement('button', {
      className:
        'mb-4 flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline',
      dataAttributes: {
        action: 'back',
      },
    });

    const backIcon = this.createElement('span', {
      className: 'w-4 h-4',
      innerHTML: ICON_ARROW_BACK,
    });
    backBtn.appendChild(backIcon);

    const backText = this.createElement('span', {
      textContent: LanguageService.t('tools.presets.backToList'),
    });
    backBtn.appendChild(backText);

    this.on(backBtn, 'click', () => {
      this.callbacks.onBack();
    });

    container.appendChild(backBtn);
  }

  /**
   * Render header with badges, title, description, and author
   */
  private renderHeader(container: HTMLElement): void {
    const header = this.createElement('div', {
      className: 'mb-6',
    });

    // Badges row
    const badges = this.createElement('div', {
      className: 'flex items-center gap-2 mb-2',
    });

    // Category badge
    const categoryMeta = hybridPresetService.getCategoryMeta(this.preset.category);
    const categoryBadge = this.createElement('span', {
      className:
        'inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm',
    });
    const categoryIcon = this.createElement('span', {
      className: 'w-4 h-4',
      innerHTML: getCategoryIcon(this.preset.category),
    });
    categoryBadge.appendChild(categoryIcon);
    const categoryName = this.createElement('span', {
      textContent: categoryMeta?.name || this.preset.category,
    });
    categoryBadge.appendChild(categoryName);
    badges.appendChild(categoryBadge);

    // Curated/Community badge
    if (this.preset.isCurated) {
      const curatedBadge = this.createElement('span', {
        className:
          'px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-sm',
        textContent: 'Official',
      });
      badges.appendChild(curatedBadge);
    } else {
      const communityBadge = this.createElement('span', {
        className:
          'px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-sm',
        textContent: 'Community',
      });
      badges.appendChild(communityBadge);
    }

    // Vote count badge
    if (this.preset.voteCount > 0) {
      const voteBadge = this.createElement('span', {
        className:
          'px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-sm flex items-center gap-1',
      });
      const starIcon = this.createElement('span', {
        innerHTML: '&#9733;',
      });
      voteBadge.appendChild(starIcon);
      const voteText = this.createElement('span', {
        textContent: `${this.preset.voteCount} votes`,
      });
      voteBadge.appendChild(voteText);
      badges.appendChild(voteBadge);
    }

    header.appendChild(badges);

    // Title
    const title = this.createElement('h2', {
      className: 'text-2xl font-bold text-gray-900 dark:text-white',
      textContent: this.preset.name,
    });
    header.appendChild(title);

    // Description
    const description = this.createElement('p', {
      className: 'mt-2 text-gray-600 dark:text-gray-400',
      textContent: this.preset.description,
    });
    header.appendChild(description);

    // Author
    if (this.preset.author) {
      const authorInfo = this.createElement('p', {
        className: 'mt-2 text-sm text-gray-500',
        textContent: `Created by ${this.preset.author}`,
      });
      header.appendChild(authorInfo);
    }

    container.appendChild(header);
  }

  /**
   * Render swatches section with dye cards
   */
  private renderSwatchesSection(container: HTMLElement): void {
    const swatchesSection = this.createElement('div', {
      className: 'space-y-4',
    });

    const swatchesTitle = this.createElement('h3', {
      className: 'font-semibold text-gray-900 dark:text-white',
      textContent: LanguageService.t('tools.presets.colorsInPalette'),
    });
    swatchesSection.appendChild(swatchesTitle);

    const swatchGrid = this.createElement('div', {
      className: 'grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4',
    });

    this.preset.dyes.forEach((dyeId) => {
      const dye = dyeService.getDyeById(dyeId);
      if (!dye) return;

      const swatchCard = this.createDyeSwatchCard(dye);
      swatchGrid.appendChild(swatchCard);
    });

    swatchesSection.appendChild(swatchGrid);
    container.appendChild(swatchesSection);
  }

  /**
   * Create a dye swatch card for detail view
   */
  private createDyeSwatchCard(dye: Dye): HTMLElement {
    const card = this.createElement('div', {
      className:
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
    });

    // Color swatch
    const swatch = this.createElement('div', {
      className: 'h-20 w-full',
      attributes: {
        style: `background-color: ${dye.hex}`,
      },
    });
    card.appendChild(swatch);

    // Dye info
    const info = this.createElement('div', {
      className: 'p-3',
    });

    const name = this.createElement('div', {
      className: 'font-medium text-sm text-gray-900 dark:text-white truncate',
      textContent: LanguageService.getDyeName(dye.id) || dye.name,
      attributes: {
        title: dye.name,
      },
    });
    info.appendChild(name);

    const hex = this.createElement('div', {
      className: 'text-xs text-gray-500 dark:text-gray-400 number',
      textContent: dye.hex.toUpperCase(),
    });
    info.appendChild(hex);

    card.appendChild(info);

    return card;
  }

  /**
   * Render tags section
   */
  private renderTagsSection(container: HTMLElement): void {
    if (!this.preset.tags || this.preset.tags.length === 0) return;

    const tagsSection = this.createElement('div', {
      className: 'mt-6',
    });

    const tagsTitle = this.createElement('h4', {
      className: 'text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
      textContent: LanguageService.t('tools.presets.tags'),
    });
    tagsSection.appendChild(tagsTitle);

    const tagsList = this.createElement('div', {
      className: 'flex flex-wrap gap-2',
    });

    this.preset.tags.forEach((tag) => {
      const tagBadge = this.createElement('span', {
        className:
          'px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
        textContent: tag,
      });
      tagsList.appendChild(tagBadge);
    });

    tagsSection.appendChild(tagsList);
    container.appendChild(tagsSection);
  }

  /**
   * Render action buttons (share and vote)
   */
  private renderActionsSection(container: HTMLElement): void {
    const actionsSection = this.createElement('div', {
      className: 'mt-6 flex flex-wrap gap-3',
    });

    // Share button
    const shareBtn = this.createElement('button', {
      className:
        'flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors',
      dataAttributes: {
        action: 'share-preset',
        presetId: this.preset.id,
      },
    });
    const shareIcon = this.createElement('span', {
      className: 'w-4 h-4 inline-block',
      innerHTML: ICON_LINK,
    });
    shareBtn.appendChild(shareIcon);
    const shareText = this.createElement('span', {
      textContent: 'Copy Link',
    });
    shareBtn.appendChild(shareText);

    this.on(shareBtn, 'click', () => {
      this.handleShare();
    });

    actionsSection.appendChild(shareBtn);

    // Vote button for community presets (from API)
    if (this.preset.isFromAPI && !this.preset.isCurated) {
      const voteBtn = this.createElement('button', {
        className:
          'flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors',
        dataAttributes: {
          action: 'vote-preset',
          presetId: this.preset.id,
        },
      });

      const voteIcon = this.createElement('span', {
        innerHTML: ICON_CRYSTAL,
        className: 'vote-icon w-5 h-5 inline-block',
      });
      voteBtn.appendChild(voteIcon);

      const voteText = this.createElement('span', {
        className: 'vote-text',
        textContent: `Vote (${this.preset.voteCount})`,
      });
      voteBtn.appendChild(voteText);

      this.on(voteBtn, 'click', () => {
        void this.handleVoteClick(voteBtn);
      });

      actionsSection.appendChild(voteBtn);

      // Check vote status and update button if already voted
      if (authService.isAuthenticated() && this.preset.apiPresetId) {
        void communityPresetService.hasVoted(this.preset.apiPresetId).then((result) => {
          if (result.has_voted) {
            voteBtn.classList.remove('bg-indigo-100', 'dark:bg-indigo-900/30');
            voteBtn.classList.add(
              'bg-green-100',
              'dark:bg-green-900/30',
              'text-green-700',
              'dark:text-green-300'
            );
            voteIcon.innerHTML = '✓';
            // Use result.vote_count if available, otherwise fall back to preset's voteCount
            const voteCount = result.vote_count ?? this.preset.voteCount;
            voteText.textContent = `Voted (${voteCount})`;
          }
        });
      }
    }

    container.appendChild(actionsSection);
  }

  /**
   * Render login CTA if not authenticated and preset is voteable
   */
  private renderLoginCTA(container: HTMLElement): void {
    if (this.preset.isFromAPI && !this.preset.isCurated && !authService.isAuthenticated()) {
      const loginCTA = this.createElement('div', {
        className:
          'mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center text-sm text-gray-600 dark:text-gray-400',
      });
      loginCTA.textContent = 'Login with Discord or XIVAuth to vote for this preset';
      container.appendChild(loginCTA);
    }
  }

  /**
   * Handle share button click
   */
  private handleShare(): void {
    const url = `${window.location.origin}/presets/${this.preset.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        ToastService.success(LanguageService.t('preset.linkCopied'));
      })
      .catch(() => {
        ToastService.error(LanguageService.t('errors.copyLinkFailed'));
      });
  }

  /**
   * Handle vote button click
   */
  private async handleVoteClick(btn: HTMLElement): Promise<void> {
    if (!authService.isAuthenticated()) {
      ToastService.warning(LanguageService.t('preset.loginToVote'));
      return;
    }

    if (!this.preset.apiPresetId) return;

    const voteIcon = btn.querySelector('.vote-icon') as HTMLElement;
    const voteText = btn.querySelector('.vote-text') as HTMLElement;
    if (!voteIcon || !voteText) return;

    // Check current vote status
    const hasVoted = voteIcon.innerHTML === '✓';

    // Disable button during API call
    btn.setAttribute('disabled', 'true');
    btn.style.opacity = '0.5';

    try {
      if (hasVoted) {
        // Remove vote
        const result = await communityPresetService.removeVote(this.preset.apiPresetId);
        if (result.success) {
          btn.classList.remove(
            'bg-green-100',
            'dark:bg-green-900/30',
            'text-green-700',
            'dark:text-green-300'
          );
          btn.classList.add(
            'bg-indigo-100',
            'dark:bg-indigo-900/30',
            'text-indigo-700',
            'dark:text-indigo-300'
          );
          voteIcon.innerHTML = ICON_CRYSTAL;
          voteText.textContent = `Vote (${result.new_vote_count})`;
          // Update preset object
          this.preset.voteCount = result.new_vote_count;
          this.callbacks.onVoteUpdate?.(this.preset);
          ToastService.info(LanguageService.t('preset.voteRemoved'));
        } else {
          ToastService.error(result.error || LanguageService.t('errors.removeVoteFailed'));
        }
      } else {
        // Add vote
        const result = await communityPresetService.voteForPreset(this.preset.apiPresetId);
        if (result.success) {
          btn.classList.remove(
            'bg-indigo-100',
            'dark:bg-indigo-900/30',
            'text-indigo-700',
            'dark:text-indigo-300'
          );
          btn.classList.add(
            'bg-green-100',
            'dark:bg-green-900/30',
            'text-green-700',
            'dark:text-green-300'
          );
          voteIcon.innerHTML = '✓';
          voteText.textContent = `Voted (${result.new_vote_count})`;
          // Update preset object
          this.preset.voteCount = result.new_vote_count;
          this.callbacks.onVoteUpdate?.(this.preset);
          ToastService.success(LanguageService.t('preset.voteAdded'));
        } else if (result.already_voted) {
          ToastService.info(LanguageService.t('preset.alreadyVoted'));
        } else {
          ToastService.error(result.error || LanguageService.t('errors.voteFailed'));
        }
      }
    } catch (error) {
      console.error('Vote error:', error);
      ToastService.error(LanguageService.t('errors.voteProcessFailed'));
    } finally {
      btn.removeAttribute('disabled');
      btn.style.opacity = '';
    }
  }

  /**
   * Get the current preset
   */
  getPreset(): UnifiedPreset {
    return this.preset;
  }

  destroy(): void {
    super.destroy();
  }
}
