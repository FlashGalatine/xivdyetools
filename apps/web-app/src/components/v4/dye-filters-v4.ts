/**
 * XIV Dye Tools v4.0 - Dye Filters Component
 *
 * Shared component for controlling dye exclusion filters.
 * Provides toggles for type-based and acquisition-based dye filtering.
 *
 * @module components/v4/dye-filters-v4
 */

import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import type { DyeFiltersConfig } from '@shared/tool-config-types';
import { DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import { LanguageService } from '../../services/language-service';

// Import toggle switch for internal use
import './toggle-switch-v4';

/**
 * Event detail for dye-filters-change event
 */
export interface DyeFiltersChangeDetail {
  /** The filter key that changed */
  filter: keyof DyeFiltersConfig;
  /** The new value */
  value: boolean;
  /** All current filter values */
  allFilters: DyeFiltersConfig;
}

/**
 * V4 Dye Filters - Shared dye exclusion toggles
 *
 * Controls which dye types and acquisition sources are filtered out
 * from tool results. Organized into two collapsible sections:
 * - Dye Types: Metallic, Pastel, Dark, Cosmic, Ishgardian, Expensive
 * - Acquisition Source: Vendor, Craft, Allied Society
 *
 * @fires dye-filters-change - Emits when any filter changes
 *   - `detail.filter`: The filter key that changed
 *   - `detail.value`: The new boolean value
 *   - `detail.allFilters`: All current filter values
 *
 * @example
 * ```html
 * <v4-dye-filters
 *   .excludeMetallic=${false}
 *   .excludePastel=${false}
 *   @dye-filters-change=${this.handleChange}
 * ></v4-dye-filters>
 * ```
 */
@customElement('v4-dye-filters')
export class DyeFiltersV4 extends BaseLitComponent {
  // ========== Type-based Filter Properties ==========

  @property({ type: Boolean, attribute: 'exclude-metallic' })
  excludeMetallic: boolean = DEFAULT_DYE_FILTERS.excludeMetallic;

  @property({ type: Boolean, attribute: 'exclude-pastel' })
  excludePastel: boolean = DEFAULT_DYE_FILTERS.excludePastel;

  @property({ type: Boolean, attribute: 'exclude-dark' })
  excludeDark: boolean = DEFAULT_DYE_FILTERS.excludeDark;

  @property({ type: Boolean, attribute: 'exclude-cosmic' })
  excludeCosmic: boolean = DEFAULT_DYE_FILTERS.excludeCosmic;

  @property({ type: Boolean, attribute: 'exclude-ishgardian' })
  excludeIshgardian: boolean = DEFAULT_DYE_FILTERS.excludeIshgardian;

  @property({ type: Boolean, attribute: 'exclude-expensive' })
  excludeExpensive: boolean = DEFAULT_DYE_FILTERS.excludeExpensive;

  // ========== Acquisition-based Filter Properties ==========

  @property({ type: Boolean, attribute: 'exclude-vendor-dyes' })
  excludeVendorDyes: boolean = DEFAULT_DYE_FILTERS.excludeVendorDyes;

  @property({ type: Boolean, attribute: 'exclude-craft-dyes' })
  excludeCraftDyes: boolean = DEFAULT_DYE_FILTERS.excludeCraftDyes;

  @property({ type: Boolean, attribute: 'exclude-allied-society-dyes' })
  excludeAlliedSocietyDyes: boolean = DEFAULT_DYE_FILTERS.excludeAlliedSocietyDyes;

  // ========== Collapsed State ==========

  @state()
  private dyeTypesCollapsed: boolean = false;

  @state()
  private acquisitionCollapsed: boolean = true;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
      }

      .dye-filters {
        display: flex;
        flex-direction: column;
        gap: var(--v4-display-options-group-gap, 20px);
      }

      .option-group {
        display: flex;
        flex-direction: column;
        gap: var(--v4-display-options-gap, 12px);
      }

      .option-group-label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: var(--v4-display-options-label-size, 11px);
        color: var(--v4-display-options-label-color, var(--theme-text-muted, #888888));
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 500;
        margin-bottom: 4px;
      }

      .option-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        padding: 4px 0;
        margin-bottom: 4px;
        border-radius: 4px;
        transition: background-color 150ms ease;
      }

      .option-group-header:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }

      .option-group-header .option-group-label {
        margin-bottom: 0;
      }

      .collapse-icon {
        font-size: 10px;
        color: var(--theme-text-muted, #888888);
        transition: transform 150ms ease;
        margin-right: 4px;
      }

      .collapse-icon.collapsed {
        transform: rotate(180deg);
      }

      .option-group-content {
        display: flex;
        flex-direction: column;
        gap: var(--v4-display-options-gap, 12px);
        overflow: hidden;
        max-height: 500px;
        transition:
          max-height 200ms ease-out,
          opacity 150ms ease;
        opacity: 1;
      }

      .option-group-content.collapsed {
        max-height: 0;
        opacity: 0;
        pointer-events: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .option-group-header,
        .collapse-icon,
        .option-group-content {
          transition: none;
        }
      }

      .option-row {
        display: flex;
        align-items: center;
      }
    `,
  ];

  /**
   * Get current filters as a DyeFiltersConfig object
   */
  private getCurrentFilters(): DyeFiltersConfig {
    return {
      excludeMetallic: this.excludeMetallic,
      excludePastel: this.excludePastel,
      excludeDark: this.excludeDark,
      excludeCosmic: this.excludeCosmic,
      excludeIshgardian: this.excludeIshgardian,
      excludeExpensive: this.excludeExpensive,
      excludeVendorDyes: this.excludeVendorDyes,
      excludeCraftDyes: this.excludeCraftDyes,
      excludeAlliedSocietyDyes: this.excludeAlliedSocietyDyes,
    };
  }

  /**
   * Handle filter change from toggle switch
   */
  private handleFilterChange(filter: keyof DyeFiltersConfig, checked: boolean): void {
    (this as unknown as Record<string, boolean>)[filter] = checked;

    this.emit<DyeFiltersChangeDetail>('dye-filters-change', {
      filter,
      value: checked,
      allFilters: this.getCurrentFilters(),
    });
  }

  /**
   * Toggle collapsed state for a section
   */
  private toggleSection(section: 'dyeTypes' | 'acquisition'): void {
    if (section === 'dyeTypes') {
      this.dyeTypesCollapsed = !this.dyeTypesCollapsed;
    } else if (section === 'acquisition') {
      this.acquisitionCollapsed = !this.acquisitionCollapsed;
    }
  }

  /**
   * Render a collapsible section header
   */
  private renderSectionHeader(
    label: string,
    collapsed: boolean,
    onToggle: () => void
  ): TemplateResult {
    return html`
      <div
        class="option-group-header"
        @click=${onToggle}
        role="button"
        aria-expanded=${!collapsed}
        tabindex="0"
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div class="option-group-label">${label}</div>
        <span class="collapse-icon ${collapsed ? 'collapsed' : ''}">${collapsed ? '▼' : '▲'}</span>
      </div>
    `;
  }

  /**
   * Render dye types group
   */
  private renderDyeTypesGroup(): TemplateResult {
    return html`
      <div class="option-group">
        ${this.renderSectionHeader(
          LanguageService.t('filters.dyeTypes'),
          this.dyeTypesCollapsed,
          () => this.toggleSection('dyeTypes')
        )}
        <div class="option-group-content ${this.dyeTypesCollapsed ? 'collapsed' : ''}">
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeMetallic')}
              .checked=${this.excludeMetallic}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeMetallic', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludePastel')}
              .checked=${this.excludePastel}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludePastel', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeDark')}
              .checked=${this.excludeDark}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeDark', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeCosmic')}
              .checked=${this.excludeCosmic}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeCosmic', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeIshgardian')}
              .checked=${this.excludeIshgardian}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeIshgardian', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeExpensive')}
              .checked=${this.excludeExpensive}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeExpensive', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render acquisition source group
   */
  private renderAcquisitionGroup(): TemplateResult {
    return html`
      <div class="option-group">
        ${this.renderSectionHeader(
          LanguageService.t('filters.acquisitionSource'),
          this.acquisitionCollapsed,
          () => this.toggleSection('acquisition')
        )}
        <div class="option-group-content ${this.acquisitionCollapsed ? 'collapsed' : ''}">
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeVendorDyes')}
              .checked=${this.excludeVendorDyes}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeVendorDyes', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeCraftDyes')}
              .checked=${this.excludeCraftDyes}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeCraftDyes', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('filters.excludeAlliedSocietyDyes')}
              .checked=${this.excludeAlliedSocietyDyes}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleFilterChange('excludeAlliedSocietyDyes', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
        </div>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <div class="dye-filters">${this.renderDyeTypesGroup()} ${this.renderAcquisitionGroup()}</div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-dye-filters': DyeFiltersV4;
  }
}
