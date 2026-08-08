/**
 * XIV Dye Tools 5.0 — My Submissions modal (8S shared flow, 620px).
 *
 * The screen the shipped app never had: every submission with its status —
 * LIVE (green) · IN REVIEW (amber) · NOT PUBLISHED (red) — a note for the
 * non-live states, and per-status actions on one line. A rejected
 * submission used to just fail to appear, with the reason living only in
 * the moderation worker; until the presets-api exposes that reason, the
 * rejected note falls back to the review explanation.
 *
 * @module components/my-submissions-modal
 */

import { ModalService } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { ToastService } from '@services/toast-service';
import { presetSubmissionService } from '@services/preset-submission-service';
import { dyeService } from '@services/dye-service-wrapper';
import type { CommunityPreset } from '@services/community-preset-service';

type StatusKind = 'live' | 'review' | 'rejected';

function statusKind(preset: CommunityPreset): StatusKind {
  switch (preset.status) {
    case 'approved':
      return 'live';
    case 'rejected':
      return 'rejected';
    case 'pending':
    case 'flagged':
    default:
      return 'review';
  }
}

const STATUS_TONE: Record<StatusKind, string> = {
  live: '#61C554',
  review: '#F4BF4F',
  rejected: '#F4645A',
};

function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function statValue(value: string, label: string, color: string): string {
  return `
    <div style="flex: 1; min-width: 0; text-align: center; padding: 10px 6px; border: 1px solid var(--theme-border); border-radius: 10px;">
      <div style="font-family: 'Fragment Mono', monospace; font-size: 20px; color: ${color};">${value}</div>
      <div style="font-family: 'Fragment Mono', monospace; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-top: 2px;">${label}</div>
    </div>`;
}

function bandFor(preset: CommunityPreset): string {
  const segs = preset.dyes
    .map((id) => dyeService.getDyeById(id))
    .filter((d) => d !== null)
    .map((d) => `<span style="flex: 1; background: ${d!.hex};"></span>`)
    .join('');
  return `<span style="display: flex; width: 56px; height: 22px; border-radius: 6px; overflow: hidden; border: 1px solid var(--theme-border); flex: 0 0 auto;">${segs}</span>`;
}

/**
 * Show the 8S My Submissions modal. Fetches fresh; each row carries its
 * status chip, note, and per-status actions.
 */
export async function showMySubmissionsModal(onChanged?: () => void): Promise<void> {
  const t = (key: string) => LanguageService.t(key);

  let presets: CommunityPreset[] = [];
  try {
    const response = await presetSubmissionService.getMySubmissions();
    presets = response.presets;
  } catch {
    ToastService.error(t('errors.apiFailed'));
    return;
  }

  const live = presets.filter((p) => statusKind(p) === 'live');
  const awaiting = presets.filter((p) => statusKind(p) === 'review');
  const totalVotes = live.reduce((sum, p) => sum + p.vote_count, 0);

  const content = document.createElement('div');

  const rows = presets
    .map((preset, index) => {
      const kind = statusKind(preset);
      const tone = STATUS_TONE[kind];
      const statusLabel =
        kind === 'live'
          ? t('preset.statusLive')
          : kind === 'review'
            ? t('preset.statusReview')
            : t('preset.statusRejected');
      // Rejection reasons live in the moderation worker until the API
      // exposes them — the review note is the honest fallback.
      const note = kind === 'live' ? '' : t('preset.reviewNote');
      const actions =
        kind === 'live'
          ? [
              { id: 'view', label: t('preset.actView') },
              { id: 'edit', label: t('preset.edit') },
              { id: 'delete', label: t('preset.delete') },
            ]
          : kind === 'review'
            ? [
                { id: 'edit', label: t('preset.edit') },
                { id: 'delete', label: t('preset.delete') },
              ]
            : [
                { id: 'edit', label: t('preset.edit') },
                { id: 'resubmit', label: t('preset.actResubmit') },
                { id: 'delete', label: t('preset.delete') },
              ];
      const actionButtons = actions
        .map((action, actionIndex) => {
          const destructive = actionIndex === actions.length - 1;
          return `<button data-action="${action.id}" data-index="${index}" style="font-size: 11.5px; font-weight: 600; padding: 5px 11px; border-radius: 7px; cursor: pointer; border: 1px solid ${
            destructive ? tint('#F4645A', 0.3) : 'var(--theme-border)'
          }; background: ${destructive ? 'transparent' : 'var(--theme-card-background)'}; color: ${
            destructive ? '#F4645A' : 'var(--theme-text)'
          };">${action.label}</button>`;
        })
        .join('');

      return `
        <div style="border: 1px solid ${kind === 'rejected' ? tint('#F4645A', 0.35) : 'var(--theme-border)'}; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            ${bandFor(preset)}
            <span style="flex: 1; min-width: 0; font-size: 13.5px; font-weight: 650; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${preset.name}</span>
            <span style="font-family: 'Fragment Mono', monospace; font-size: 11px; color: var(--theme-text-muted); flex: 0 0 auto;">${
              kind === 'live' ? preset.vote_count : '—'
            } ${t('preset.votesLabel')}</span>
            <span style="font-family: 'Fragment Mono', monospace; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${tint(tone, 0.16)}; color: ${tone}; flex: 0 0 auto;">${statusLabel}</span>
          </div>
          ${
            note
              ? `<div style="font-size: 11.5px; line-height: 1.5; color: var(--theme-text); background: ${tint(tone, 0.08)}; border-radius: 7px; padding: 7px 10px; margin-top: 8px;">${note}</div>`
              : ''
          }
          <div style="display: flex; gap: 6px; margin-top: 9px;">${actionButtons}</div>
        </div>`;
    })
    .join('');

  content.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      ${statValue(String(live.length), t('preset.statPublished'), '#61C554')}
      ${statValue(String(totalVotes), t('preset.statTotalVotes'), 'var(--theme-primary)')}
      ${statValue(String(awaiting.length), t('preset.statAwaitingReview'), '#F4BF4F')}
    </div>
    ${rows || `<p style="font-size: 13px; color: var(--theme-text-muted); text-align: center; padding: 24px 0;">${t('preset.noSubmissionsYet')}</p>`}
  `;

  content.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-action]');
    if (!btn) return;
    const preset = presets[Number(btn.getAttribute('data-index'))];
    if (!preset) return;
    const action = btn.getAttribute('data-action');

    if (action === 'view') {
      ModalService.dismissTop();
      window.location.assign(`/presets/community-${preset.id}`);
      return;
    }
    if (action === 'edit' || action === 'resubmit') {
      ModalService.dismissTop();
      void import('./preset-edit-form').then(({ showPresetEditForm }) => {
        showPresetEditForm(preset, (result) => {
          if (result.success) onChanged?.();
        });
      });
      return;
    }
    if (action === 'delete') {
      const confirmEl = document.createElement('p');
      confirmEl.textContent = t('preset.confirmDelete');
      ModalService.showConfirm({
        title: t('preset.deleteTitle'),
        content: confirmEl,
        destructive: true,
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        onConfirm: async () => {
          try {
            await presetSubmissionService.deletePreset(preset.id);
            ToastService.success(t('preset.deleteSuccess'));
            ModalService.dismissTop();
            onChanged?.();
          } catch {
            ToastService.error(t('errors.deletePresetFailed'));
          }
        },
      });
    }
  });

  ModalService.show({
    type: 'custom',
    title: t('preset.mySubmissions'),
    subtitle: LanguageService.tInterpolate('preset.mineSummary', {
      n: presets.length,
      v: totalVotes,
    }),
    content,
    panelWidth: 620,
  });
}
