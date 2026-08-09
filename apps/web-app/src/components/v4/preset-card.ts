/**
 * XIV Dye Tools 5.0 — Preset Card (8A Gallery).
 *
 * A preset is a post: picture-led card with votes on the face. Two states
 * that must both look intentional:
 * - With example link: the shot area leads (striped link treatment until the
 *   R2 thumbnail pipeline lands), the palette runs as a thin proportional
 *   band between image and name — a signature, not the content.
 * - Without (most at launch; all curated): the palette itself becomes the
 *   picture, full-bleed, with the NO EXAMPLE LINK caption.
 *
 * The purple Community chip is gone — tabs separate the sources; curated
 * cards carry an Official chip instead.
 *
 * @module components/v4/preset-card
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseLitComponent } from './base-lit-component';
import { LanguageService } from '@services/language-service';
import { ICON_STAR, ICON_STAR_FILLED } from '@shared/ui-icons';
import type { UnifiedPreset } from '@services/hybrid-preset-service';

/**
 * Data structure for the preset card
 */
export interface PresetCardData {
  /** The preset being displayed */
  preset: UnifiedPreset;
  /** Resolved hex colors from the preset's dyes */
  colors: string[];
  /** Example link (page URL, stored not copied), when the preset has one */
  exampleLink?: string;
}

/**
 * V4 Preset Card — 8A Gallery post card.
 *
 * @fires preset-select - card body clicked — `detail.preset`
 * @fires preset-vote - vote button clicked — `detail.preset`
 * @fires preset-save - save button clicked — `detail.preset`
 */
@customElement('v4-preset-card')
export class PresetCard extends BaseLitComponent {
  @property({ attribute: false })
  data?: PresetCardData;

  /** Saved-shelf state (from SavedPresetsService) */
  @property({ type: Boolean })
  saved: boolean = false;

  /** Whether the current user voted for this preset */
  @property({ type: Boolean })
  voted: boolean = false;

  /** Feed option: show example-link areas (off = every card a palette strip) */
  @property({ type: Boolean })
  showShot: boolean = true;

  /** Tombstone: a saved copy whose live preset the author removed */
  @property({ type: Boolean })
  tombstone: boolean = false;

  @property({ type: Boolean, reflect: true })
  selected: boolean = false;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
      }

      .preset-card {
        background: var(--theme-card-background, #17171a);
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition:
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms),
          border-color var(--v4-transition-fast, 150ms);
      }

      .preset-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
        border-color: var(--theme-text-muted, #888888);
      }

      :host([selected]) .preset-card {
        border-color: var(--theme-primary, #ea4133);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary, #ea4133) 35%, transparent);
      }

      /* Shot area (example link) / palette-as-picture */
      .shot {
        position: relative;
        height: 132px;
        display: flex;
        align-items: flex-end;
        padding: 10px 12px;
      }

      .shot-caption {
        font-family: 'Fragment Mono', monospace;
        font-size: 8.5px;
        letter-spacing: 1px;
        line-height: 1.6;
        white-space: pre-line;
        overflow-wrap: anywhere;
      }

      /* Thin proportional palette band — the signature under a shot */
      .band {
        display: flex;
        height: 10px;
        width: 100%;
      }

      .band-seg {
        height: 100%;
      }

      .preset-content {
        padding: 12px 14px 14px;
      }

      .top-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        min-width: 0;
      }

      .preset-name {
        flex: 1;
        min-width: 0;
        font-weight: 700;
        font-size: 14px;
        color: var(--theme-text, #e0e0e0);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .chip {
        font-family: 'Fragment Mono', monospace;
        font-size: 8.5px;
        letter-spacing: 1px;
        padding: 3px 7px;
        border-radius: 5px;
        flex-shrink: 0;
      }

      .chip--official {
        background: color-mix(in srgb, var(--theme-primary, #ea4133) 14%, transparent);
        color: var(--theme-primary, #ea4133);
      }

      .chip--tombstone {
        background: rgba(244, 100, 90, 0.14);
        color: #f4645a;
      }

      .preset-description {
        font-size: 12px;
        color: var(--theme-text-muted, #888888);
        line-height: 1.45;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin: 0 0 10px;
        min-height: 2.6em;
      }

      .meta-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--theme-text-muted, #888888);
        min-width: 0;
      }

      .byline {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }

      .face-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.14));
        background: transparent;
        color: var(--theme-text-muted, #888888);
        cursor: pointer;
        white-space: nowrap;
      }

      /* 1b: the star pair at pill size — state comes from the fill, never fading */
      .face-btn svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      .face-btn--on {
        background: color-mix(in srgb, var(--theme-primary, #ea4133) 16%, transparent);
        border-color: color-mix(in srgb, var(--theme-primary, #ea4133) 45%, transparent);
        color: var(--theme-primary, #ea4133);
      }

      @media (prefers-reduced-motion: reduce) {
        .preset-card {
          transition: none;
        }
        .preset-card:hover {
          transform: none;
        }
      }
    `,
  ];

  private handleClick(): void {
    if (this.data) {
      this.emit<{ preset: UnifiedPreset }>('preset-select', { preset: this.data.preset });
    }
  }

  private handleVote(e: Event): void {
    e.stopPropagation();
    if (this.data) {
      this.emit<{ preset: UnifiedPreset }>('preset-vote', { preset: this.data.preset });
    }
  }

  private handleSave(e: Event): void {
    e.stopPropagation();
    if (this.data) {
      this.emit<{ preset: UnifiedPreset }>('preset-save', { preset: this.data.preset });
    }
  }

  /** Proportional hard-stop gradient over the palette. */
  private paletteStops(colors: string[]): string {
    if (!colors.length) return '#333 0% 100%';
    return colors
      .map(
        (hex, i) =>
          `${hex} ${Math.round((i / colors.length) * 100)}% ${Math.round(((i + 1) / colors.length) * 100)}%`
      )
      .join(', ');
  }

  /** Readable ink over a hex background. */
  private inkOver(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.45 ? 'rgba(10, 10, 10, 0.78)' : 'rgba(255, 255, 255, 0.82)';
  }

  private ageText(preset: UnifiedPreset): string {
    if (preset.isCurated || !preset.createdAt) return LanguageService.t('preset.builtIn');
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(preset.createdAt).getTime()) / 86_400_000)
    );
    return LanguageService.tInterpolate('preset.daysAgo', { n: days });
  }

  protected override render(): TemplateResult {
    if (!this.data) {
      return html`<div class="preset-card"></div>`;
    }

    const { preset, colors, exampleLink } = this.data;
    const hasShot = !!exampleLink && this.showShot;
    const first = colors[0] ?? '#666666';
    const stops = this.paletteStops(colors);

    // Linked-not-uploaded treatment: a striped ground built from the palette's
    // first colour, carrying the host + caption, until R2 thumbnails exist.
    const shotStyle = hasShot
      ? `background: repeating-linear-gradient(135deg, color-mix(in srgb, ${first} 34%, var(--theme-background, #0b0b0c)) 0 9px, color-mix(in srgb, ${first} 50%, var(--theme-background, #0b0b0c)) 9px 18px);`
      : `background: linear-gradient(120deg, ${stops});`;
    const caption = hasShot ? `${LanguageService.t('preset.shotSlot')}\n${exampleLink}` : null;

    const byline = preset.isCurated
      ? LanguageService.t('preset.shipsWithApp')
      : (preset.author ?? '');
    const voteLabel = this.voted
      ? `${LanguageService.t('preset.voted')} · ${preset.voteCount}`
      : `${LanguageService.t('preset.vote')} · ${preset.voteCount}`;
    const saveLabel = this.saved
      ? LanguageService.t('preset.savedBtn')
      : LanguageService.t('preset.save');

    return html`
      <article
        class="preset-card"
        role="button"
        tabindex="0"
        aria-label="${preset.name}"
        @click=${this.handleClick}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.handleClick();
          }
        }}
      >
        <div class="shot" style=${shotStyle}>
          ${
            caption
              ? html`<span class="shot-caption" style="color: ${this.inkOver(colors[1] ?? first)}"
                  >${caption}</span
                >`
              : nothing
          }
        </div>

        ${
          hasShot
            ? html`<div class="band">
                ${colors.map(
                  (hex) => html`<div class="band-seg" style="flex: 1; background: ${hex}"></div>`
                )}
              </div>`
            : nothing
        }

        <div class="preset-content">
          <div class="top-row">
            <span class="preset-name">${preset.name}</span>
            ${
              this.tombstone
                ? html`<span class="chip chip--tombstone"
                    >${LanguageService.t('preset.removedByAuthor')}</span
                  >`
                : preset.isCurated
                  ? html`<span class="chip chip--official"
                      >${LanguageService.t('preset.tabOfficial')}</span
                    >`
                  : nothing
            }
          </div>

          <p class="preset-description">${preset.description}</p>

          <div class="meta-row">
            <span class="byline">${byline} · ${preset.dyes.length} · ${this.ageText(preset)}</span>
            <span class="actions">
              ${
                !preset.isCurated && preset.isFromAPI
                  ? html`<button
                      class="face-btn ${this.voted ? 'face-btn--on' : ''}"
                      @click=${this.handleVote}
                    >
                      ${unsafeHTML(this.voted ? ICON_STAR_FILLED : ICON_STAR)}${voteLabel}
                    </button>`
                  : nothing
              }
              <button
                class="face-btn ${this.saved ? 'face-btn--on' : ''}"
                @click=${this.handleSave}
              >
                ${unsafeHTML(this.saved ? ICON_STAR_FILLED : ICON_STAR)}${saveLabel}
              </button>
            </span>
          </div>
        </div>
      </article>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-preset-card': PresetCard;
  }
}
