/**
 * XIV Dye Tools - My Submissions Panel
 *
 * Displays the user's own preset submissions with status badges
 * Shows pending, approved, and rejected submissions
 *
 * @module components/my-submissions-panel
 */

import { BaseComponent } from './base-component';
import { LanguageService, dyeService } from '@services/index';
import { presetSubmissionService, authService } from '@services/index';
import type { CommunityPreset, PresetStatus } from '@services/community-preset-service';
import { getCategoryIcon } from '@shared/category-icons';
import { ICON_DOCUMENT } from '@shared/ui-icons';
import { showPresetEditForm } from './preset-edit-form';

// Use singleton dyeService from services (imported above)

/**
 * My Submissions Panel
 * Shows authenticated user's preset submissions
 */
export class MySubmissionsPanel extends BaseComponent {
  private submissions: CommunityPreset[] = [];
  private isLoading = false;
  private expandedPresetId: string | null = null;

  constructor(container: HTMLElement) {
    super(container);
  }

  /**
   * Required by BaseComponent abstract class.
   * Note: This component uses async render() directly instead of renderContent().
   */
  renderContent(): void {
    // Rendering handled by async render() override
  }

  async render(): Promise<void> {
    // Remove old element if it exists to prevent duplicates on re-render
    if (this.element) {
      this.element.remove();
      this.element = null;
    }

    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    // Check authentication
    if (!authService.isAuthenticated()) {
      const authPrompt = this.createElement('div', {
        className: 'text-center py-8 text-gray-500 dark:text-gray-400',
        textContent: LanguageService.t('preset.signInToViewSubmissions'),
      });
      wrapper.appendChild(authPrompt);
      this.element = wrapper;
      this.container.appendChild(this.element);
      return;
    }

    // Header
    const header = this.createElement('div', {
      className: 'flex items-center justify-between mb-4',
    });

    const title = this.createElement('h3', {
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
      textContent: LanguageService.t('preset.mySubmissions'),
    });
    header.appendChild(title);

    // Refresh button
    const refreshBtn = this.createElement('button', {
      className:
        'p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors',
      dataAttributes: { action: 'refresh' },
      attributes: { 'aria-label': LanguageService.t('aria.refreshSubmissions') },
    });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>`;
    header.appendChild(refreshBtn);

    wrapper.appendChild(header);

    // Loading state
    const listContainer = this.createElement('div', {
      id: 'submissions-list',
    });
    listContainer.appendChild(this.renderLoadingState());
    wrapper.appendChild(listContainer);

    this.element = wrapper;
    this.container.appendChild(this.element);

    // Load submissions
    await this.loadSubmissions();

    // Bind events
    this.bindEvents();
  }

  /**
   * Load user's submissions from API
   */
  private async loadSubmissions(): Promise<void> {
    this.isLoading = true;
    this.updateListContainer(this.renderLoadingState());

    try {
      const response = await presetSubmissionService.getMySubmissions();
      this.submissions = response.presets;
      this.updateListContainer(this.renderSubmissionsList());
    } catch (error) {
      console.error('Failed to load submissions:', error);
      this.updateListContainer(this.renderErrorState());
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Update the list container content
   */
  private updateListContainer(content: HTMLElement): void {
    const container = this.element?.querySelector('#submissions-list');
    if (container) {
      container.innerHTML = '';
      container.appendChild(content);
    }
  }

  /**
   * Render loading state
   */
  private renderLoadingState(): HTMLElement {
    const loading = this.createElement('div', {
      className: 'text-center py-8 text-gray-500 dark:text-gray-400',
    });

    const spinner = this.createElement('div', {
      className:
        'inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-indigo-600 mb-2',
    });
    loading.appendChild(spinner);

    const text = this.createElement('p', {
      textContent: LanguageService.t('preset.loadingSubmissions'),
    });
    loading.appendChild(text);

    return loading;
  }

  /**
   * Render error state
   */
  private renderErrorState(): HTMLElement {
    return this.createElement('div', {
      className: 'text-center py-8 text-red-500 dark:text-red-400',
      textContent: LanguageService.t('errors.failedToLoadSubmissions'),
    });
  }

  /**
   * Render submissions list
   */
  private renderSubmissionsList(): HTMLElement {
    const list = this.createElement('div', {
      className: 'space-y-3',
    });

    if (this.submissions.length === 0) {
      const empty = this.createElement('div', {
        className: 'text-center py-8 text-gray-500 dark:text-gray-400',
      });

      const icon = this.createElement('div', {
        className: 'w-12 h-12 mx-auto mb-2',
        innerHTML: ICON_DOCUMENT,
      });
      empty.appendChild(icon);

      const text = this.createElement('p', {
        textContent: LanguageService.t('preset.noSubmissionsYet'),
      });
      empty.appendChild(text);

      const hint = this.createElement('p', {
        className: 'text-sm mt-1',
        textContent: LanguageService.t('preset.submitPresetHint'),
      });
      empty.appendChild(hint);

      list.appendChild(empty);
      return list;
    }

    this.submissions.forEach((preset) => {
      const card = this.createSubmissionCard(preset);
      list.appendChild(card);
    });

    return list;
  }

  /**
   * Create a submission card
   */
  private createSubmissionCard(preset: CommunityPreset): HTMLElement {
    const isExpanded = this.expandedPresetId === preset.id;
    const statusInfo = presetSubmissionService.getStatusInfo(preset.status);

    const card = this.createElement('div', {
      className:
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
      dataAttributes: { presetId: preset.id },
    });

    // Header row (always visible)
    const headerRow = this.createElement('div', {
      className:
        'p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750',
      dataAttributes: { action: 'toggle-expand' },
    });

    // Color swatch strip (mini)
    const swatchStrip = this.createElement('div', {
      className: 'flex rounded overflow-hidden w-16 h-8 flex-shrink-0',
    });

    preset.dyes.forEach((dyeId) => {
      const dye = dyeService.getDyeById(dyeId);
      const swatch = this.createElement('div', {
        className: 'flex-1',
        attributes: { style: `background-color: ${dye?.hex || '#888888'}` },
      });
      swatchStrip.appendChild(swatch);
    });
    headerRow.appendChild(swatchStrip);

    // Name and category
    const info = this.createElement('div', {
      className: 'flex-1 min-w-0',
    });

    const nameRow = this.createElement('div', {
      className: 'flex items-center gap-2',
    });

    const categoryIcon = this.createElement('span', {
      className: 'w-4 h-4 flex-shrink-0',
      innerHTML: getCategoryIcon(preset.category_id),
    });
    nameRow.appendChild(categoryIcon);

    const name = this.createElement('span', {
      className: 'font-medium text-gray-900 dark:text-white truncate',
      textContent: preset.name,
    });
    nameRow.appendChild(name);

    info.appendChild(nameRow);

    // Date
    const date = this.createElement('div', {
      className: 'text-xs text-gray-500 dark:text-gray-400',
      textContent: new Date(preset.created_at).toLocaleDateString(),
    });
    info.appendChild(date);

    headerRow.appendChild(info);

    // Status badge
    const statusBadge = this.createElement('div', {
      className: `flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusInfo.colorClass}`,
    });

    const statusIcon = this.createElement('span', {
      textContent: statusInfo.icon,
    });
    statusBadge.appendChild(statusIcon);

    const statusLabel = this.createElement('span', {
      textContent: statusInfo.label,
    });
    statusBadge.appendChild(statusLabel);

    headerRow.appendChild(statusBadge);

    // Expand arrow
    const arrow = this.createElement('span', {
      className: `text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`,
      innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`,
    });
    headerRow.appendChild(arrow);

    card.appendChild(headerRow);

    // Expanded details (conditionally shown)
    if (isExpanded) {
      const details = this.renderPresetDetails(preset);
      card.appendChild(details);
    }

    return card;
  }

  /**
   * Render expanded preset details
   */
  private renderPresetDetails(preset: CommunityPreset): HTMLElement {
    const details = this.createElement('div', {
      className: 'px-3 pb-3 pt-0 border-t border-gray-100 dark:border-gray-700',
    });

    // Description
    const description = this.createElement('p', {
      className: 'text-sm text-gray-600 dark:text-gray-400 mb-3 mt-3',
      textContent: preset.description,
    });
    details.appendChild(description);

    // Dye list
    const dyeSection = this.createElement('div', {
      className: 'mb-3',
    });

    const dyeTitle = this.createElement('div', {
      className: 'text-xs font-medium text-gray-500 dark:text-gray-500 mb-2',
      textContent: LanguageService.t('preset.dyes'),
    });
    dyeSection.appendChild(dyeTitle);

    const dyeList = this.createElement('div', {
      className: 'flex flex-wrap gap-2',
    });

    preset.dyes.forEach((dyeId) => {
      const dye = dyeService.getDyeById(dyeId);
      if (!dye) return;

      const dyeChip = this.createElement('div', {
        className:
          'flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs',
      });

      const colorDot = this.createElement('div', {
        className: 'w-3 h-3 rounded-full border border-gray-200 dark:border-gray-600',
        attributes: { style: `background-color: ${dye.hex}` },
      });
      dyeChip.appendChild(colorDot);

      const dyeName = this.createElement('span', {
        className: 'text-gray-700 dark:text-gray-300',
        textContent: LanguageService.getDyeName(dye.id) || dye.name,
      });
      dyeChip.appendChild(dyeName);

      dyeList.appendChild(dyeChip);
    });

    dyeSection.appendChild(dyeList);
    details.appendChild(dyeSection);

    // Tags
    if (preset.tags && preset.tags.length > 0) {
      const tagSection = this.createElement('div', {
        className: 'mb-3',
      });

      const tagTitle = this.createElement('div', {
        className: 'text-xs font-medium text-gray-500 dark:text-gray-500 mb-2',
        textContent: LanguageService.t('preset.tags'),
      });
      tagSection.appendChild(tagTitle);

      const tagList = this.createElement('div', {
        className: 'flex flex-wrap gap-1',
      });

      preset.tags.forEach((tag) => {
        const tagChip = this.createElement('span', {
          className:
            'px-2 py-0.5 bg-[var(--theme-primary)]/10 text-[var(--theme-primary)] rounded text-xs',
          textContent: tag,
        });
        tagList.appendChild(tagChip);
      });

      tagSection.appendChild(tagList);
      details.appendChild(tagSection);
    }

    // Stats
    const stats = this.createElement('div', {
      className: 'flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400',
    });

    const voteKey = preset.vote_count === 1 ? 'preset.voteCount' : 'preset.votesCount';
    const votes = this.createElement('span', {
      textContent: LanguageService.tInterpolate(voteKey, { count: preset.vote_count.toString() }),
    });
    stats.appendChild(votes);

    details.appendChild(stats);

    // Action buttons section
    const actions = this.createElement('div', {
      className: 'flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700',
    });

    // Edit button (only for non-rejected presets)
    if (preset.status !== 'rejected') {
      const editBtn = this.createElement('button', {
        className:
          'px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors',
        textContent: `✏️ ${LanguageService.t('preset.edit')}`,
        dataAttributes: { action: 'edit', presetId: preset.id },
      });
      actions.appendChild(editBtn);
    }

    const deleteBtn = this.createElement('button', {
      className:
        'px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors',
      textContent: `🗑️ ${LanguageService.t('preset.delete')}`,
      dataAttributes: { action: 'delete', presetId: preset.id },
    });
    actions.appendChild(deleteBtn);

    details.appendChild(actions);

    return details;
  }

  bindEvents(): void {
    // Toggle expand
    this.on(this.element!, 'click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const toggleBtn = target.closest('[data-action="toggle-expand"]') as HTMLElement;
      if (toggleBtn) {
        const card = toggleBtn.closest('[data-preset-id]') as HTMLElement;
        if (card) {
          const presetId = card.dataset.presetId;
          if (presetId) {
            this.expandedPresetId = this.expandedPresetId === presetId ? null : presetId;
            this.updateListContainer(this.renderSubmissionsList());
          }
        }
      }

      // Edit button
      const editBtn = target.closest('[data-action="edit"]') as HTMLElement;
      if (editBtn) {
        e.stopPropagation(); // Prevent toggle
        const presetId = editBtn.dataset.presetId;
        if (presetId) {
          this.handleEdit(presetId);
        }
      }

      // Delete button
      const deleteBtn = target.closest('[data-action="delete"]') as HTMLElement;
      if (deleteBtn) {
        e.stopPropagation(); // Prevent toggle
        const presetId = deleteBtn.dataset.presetId;
        if (
          presetId &&
          confirm(LanguageService.t('preset.confirmDelete'))
        ) {
          this.handleDelete(presetId);
        }
      }

      // Refresh button
      const refreshBtn = target.closest('[data-action="refresh"]');
      if (refreshBtn) {
        this.loadSubmissions();
      }
    });
  }

  /**
   * Handle preset edit
   */
  private handleEdit(presetId: string): void {
    const preset = this.submissions.find((p) => p.id === presetId);
    if (!preset) {
      console.error('Preset not found:', presetId);
      return;
    }

    // Show edit form modal, refresh list on successful edit
    showPresetEditForm(preset, (result) => {
      if (result.success && result.preset) {
        // Update local preset data
        const index = this.submissions.findIndex((p) => p.id === presetId);
        if (index !== -1) {
          this.submissions[index] = result.preset;
          this.updateListContainer(this.renderSubmissionsList());
        }
      }
    });
  }

  /**
   * Handle preset deletion
   */
  private async handleDelete(presetId: string): Promise<void> {
    try {
      const result = await presetSubmissionService.deletePreset(presetId);
      if (result.success) {
        // Remove from local list and re-render
        this.submissions = this.submissions.filter((p) => p.id !== presetId);
        this.updateListContainer(this.renderSubmissionsList());
      } else {
        alert(result.error || LanguageService.t('errors.failedToDeletePreset'));
      }
    } catch (error) {
      console.error('Failed to delete preset:', error);
      alert(LanguageService.t('errors.failedToDeletePreset'));
    }
  }

  destroy(): void {
    this.submissions = [];
    this.expandedPresetId = null;
    super.destroy();
  }
}
