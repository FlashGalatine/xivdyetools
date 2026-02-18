/**
 * XIV Dye Tools v2.3.0 - Changelog Modal Component
 *
 * Shows "What's New" modal after version updates
 * Displays recent changes to returning users
 *
 * Changelog data is automatically parsed from CHANGELOG.md at build time
 * by the vite-plugin-changelog-parser plugin.
 *
 * @module components/changelog-modal
 */

import { ModalService } from '@services/modal-service';
import { StorageService } from '@services/storage-service';
import { LanguageService } from '@services/language-service';
import { STORAGE_KEYS, APP_VERSION } from '@shared/constants';
import { changelogEntries } from 'virtual:changelog';

// ============================================================================
// Changelog Data Structure
// ============================================================================

interface ChangelogEntry {
  version: string;
  date: string;
  highlights: string[];
}

// ============================================================================
// Changelog Modal Class
// ============================================================================

/**
 * Changelog modal for returning users after updates
 */
export class ChangelogModal {
  private modalId: string | null = null;

  /**
   * Check if changelog modal should be shown
   * Shows when stored version differs from current version
   */
  static shouldShow(): boolean {
    const lastVersion = StorageService.getItem<string>(STORAGE_KEYS.LAST_VERSION_VIEWED, '');

    // Don't show if no last version (first visit - welcome modal handles that)
    if (!lastVersion) {
      return false;
    }

    // Show if version has changed
    return lastVersion !== APP_VERSION;
  }

  /**
   * Mark current version as viewed
   */
  static markAsViewed(): void {
    StorageService.setItem(STORAGE_KEYS.LAST_VERSION_VIEWED, APP_VERSION);
  }

  /**
   * Reset changelog modal (for testing or settings)
   */
  static reset(): void {
    StorageService.removeItem(STORAGE_KEYS.LAST_VERSION_VIEWED);
  }

  /**
   * Get the entries to display (current version + recent history)
   * Uses dynamically parsed changelog data from CHANGELOG.md
   */
  private getRelevantEntries(): ChangelogEntry[] {
    // Find current version entry from parsed changelog
    const currentEntry = changelogEntries.find((e) => e.version === APP_VERSION);

    // Get up to 3 previous versions for context
    const currentIndex = changelogEntries.findIndex((e) => e.version === APP_VERSION);
    const previousEntries = changelogEntries.slice(currentIndex + 1, currentIndex + 3);

    const entries: ChangelogEntry[] = [];
    if (currentEntry) {
      entries.push(currentEntry);
    }
    entries.push(...previousEntries);

    return entries;
  }

  /**
   * Show the changelog modal
   */
  show(): void {
    if (this.modalId) return; // Already showing

    const content = this.createContent();

    this.modalId = ModalService.showChangelog({
      title: LanguageService.t('changelog.title'),
      content,
      size: 'md',
      closable: true,
      closeOnBackdrop: true,
      closeOnEscape: true,
      onClose: () => {
        ChangelogModal.markAsViewed();
        this.modalId = null;
      },
    });
  }

  /**
   * Close the changelog modal
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
    container.className = 'changelog-modal-content';

    const entries = this.getRelevantEntries();

    if (entries.length === 0) {
      // Fallback if no changelog data for current version
      const fallback = document.createElement('p');
      fallback.className = 'text-gray-600 dark:text-gray-300';
      fallback.textContent = LanguageService.t('changelog.noChanges');
      container.appendChild(fallback);
    } else {
      // Current version highlights
      const currentEntry = entries[0];
      if (currentEntry) {
        const currentSection = this.createVersionSection(currentEntry, true);
        container.appendChild(currentSection);
      }

      // Previous versions (collapsed summary)
      if (entries.length > 1) {
        const previousSection = document.createElement('div');
        previousSection.className = 'mt-6 pt-4 border-t border-gray-200 dark:border-gray-700';

        const previousTitle = document.createElement('h4');
        previousTitle.className = 'text-sm font-medium text-gray-500 dark:text-gray-400 mb-3';
        previousTitle.textContent = LanguageService.t('changelog.previousUpdates');
        previousSection.appendChild(previousTitle);

        const previousList = document.createElement('div');
        previousList.className = 'space-y-2';

        entries.slice(1).forEach((entry) => {
          const item = document.createElement('div');
          item.className = 'text-sm text-gray-600 dark:text-gray-400';
          // SECURITY: Use DOM construction instead of innerHTML for text content
          const versionSpan = document.createElement('span');
          versionSpan.className = 'font-medium';
          versionSpan.textContent = `v${entry.version}`;
          item.appendChild(versionSpan);
          item.appendChild(document.createTextNode(` - ${entry.highlights[0]}`));
          previousList.appendChild(item);
        });

        previousSection.appendChild(previousList);
        container.appendChild(previousSection);
      }
    }

    // Action buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className =
      'flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700';

    // View full changelog link
    const viewFullBtn = document.createElement('a');
    viewFullBtn.className = 'text-sm text-blue-600 dark:text-blue-400 hover:underline';
    viewFullBtn.href =
      'https://github.com/FlashGalatine/xivdyetools/blob/main/apps/web-app/CHANGELOG-tldr.md';
    viewFullBtn.target = '_blank';
    viewFullBtn.rel = 'noopener noreferrer';
    viewFullBtn.textContent = LanguageService.t('changelog.viewFull');

    // Got it button
    const gotItBtn = document.createElement('button');
    gotItBtn.className = `
      px-6 py-2 text-sm font-medium rounded-lg
      text-white bg-blue-600 hover:bg-blue-700 transition-colors
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
    `
      .replace(/\s+/g, ' ')
      .trim();
    gotItBtn.textContent = LanguageService.t('changelog.gotIt');
    gotItBtn.addEventListener('click', () => {
      this.close();
    });

    buttonContainer.appendChild(viewFullBtn);
    buttonContainer.appendChild(gotItBtn);
    container.appendChild(buttonContainer);

    return container;
  }

  /**
   * Create a version section with highlights
   */
  private createVersionSection(entry: ChangelogEntry, isCurrent: boolean): HTMLElement {
    const section = document.createElement('div');
    section.className = isCurrent ? '' : 'mt-4';

    // Version header (only for non-current entries)
    if (!isCurrent) {
      const header = document.createElement('h4');
      header.className = 'text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2';
      header.textContent = `v${entry.version}`;
      section.appendChild(header);
    }

    // Highlights list
    const list = document.createElement('ul');
    list.className = 'space-y-2';

    entry.highlights.forEach((highlight) => {
      const item = document.createElement('li');
      item.className = 'flex items-start gap-2 text-gray-600 dark:text-gray-300';
      // SECURITY: Use DOM construction instead of innerHTML for text content
      const starSpan = document.createElement('span');
      starSpan.className = 'text-green-500 dark:text-green-400 flex-shrink-0';
      starSpan.textContent = '★';
      const textSpan = document.createElement('span');
      textSpan.textContent = highlight;
      item.appendChild(starSpan);
      item.appendChild(textSpan);
      list.appendChild(item);
    });

    section.appendChild(list);

    return section;
  }
}

/**
 * Show changelog modal if version has changed
 */
export function showChangelogIfUpdated(): void {
  if (ChangelogModal.shouldShow()) {
    // Small delay to ensure app is fully loaded and welcome modal has had a chance
    setTimeout(() => {
      const modal = new ChangelogModal();
      modal.show();
    }, 1000);
  }
}
