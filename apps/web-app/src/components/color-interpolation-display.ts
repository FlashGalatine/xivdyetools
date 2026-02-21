/**
 * XIV Dye Tools v2.0.0 - Color Interpolation Display Component
 *
 * Phase 12: Architecture Refactor
 * Displays color gradient and matching intermediate dyes
 *
 * @module components/color-interpolation-display
 */

import { BaseComponent } from './base-component';
import { LanguageService, AnnouncerService } from '@services/index';
import type { Dye } from '@shared/types';
import { clearContainer } from '@shared/utils';

/**
 * Interpolation step with dye match
 */
export interface InterpolationStep {
  position: number; // 0-1
  theoreticalColor: string;
  matchedDye: Dye | null;
  distance: number; // Distance from theoretical color
}

/**
 * Color Interpolation Display Component
 * Shows gradient and matching dyes for color transition
 */
export class ColorInterpolationDisplay extends BaseComponent {
  private startColor: string = '#FF0000';
  private endColor: string = '#0000FF';
  private steps: InterpolationStep[] = [];
  private colorSpace: 'rgb' | 'hsv' = 'hsv';
  private selectedStopIndex: number = -1; // T4: Track selected gradient stop

  constructor(
    container: HTMLElement,
    startColor: string = '#FF0000',
    endColor: string = '#0000FF',
    steps: InterpolationStep[] = [],
    colorSpace: 'rgb' | 'hsv' = 'hsv'
  ) {
    super(container);
    this.startColor = startColor;
    this.endColor = endColor;
    this.steps = steps;
    this.colorSpace = colorSpace;
  }

  /**
   * Render the interpolation display
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    // Title
    const title = this.createElement('h3', {
      textContent: LanguageService.tInterpolate('mixer.colorTransition', {
        space: this.colorSpace.toUpperCase(),
      }),
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
    });
    wrapper.appendChild(title);

    if (this.steps.length === 0) {
      const emptyState = this.createElement('div', {
        className: 'text-center py-8 text-gray-500 dark:text-gray-400',
        textContent: LanguageService.t('mixer.noInterpolationData'),
      });
      wrapper.appendChild(emptyState);
      clearContainer(this.container);
      this.element = wrapper;
      this.container.appendChild(this.element);
      return;
    }

    // Add Distance explanation legend
    const legend = this.renderDistanceLegend();
    wrapper.appendChild(legend);

    // Gradient bar
    const gradientBar = this.renderGradientBar();
    wrapper.appendChild(gradientBar);

    // Steps list
    const stepsList = this.renderStepsList();
    wrapper.appendChild(stepsList);

    // Quality metrics
    const metrics = this.renderMetrics();
    wrapper.appendChild(metrics);

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Render the Distance explanation legend
   */
  private renderDistanceLegend(): HTMLElement {
    const container = this.createElement('div', {
      className:
        'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3',
    });

    // Title with info icon
    const title = this.createElement('div', {
      className: 'flex items-center gap-2 font-semibold text-sm text-blue-900 dark:text-blue-200',
    });

    const icon = this.createElement('img', {
      attributes: {
        src: '/assets/icons/info.svg',
        alt: '',
        'aria-hidden': 'true',
      },
      className: 'w-4 h-4',
    });

    const titleText = this.createElement('span', {
      textContent: LanguageService.t('mixer.understandingDistance'),
    });

    title.appendChild(icon);
    title.appendChild(titleText);
    container.appendChild(title);

    // Explanation
    const explanation = this.createElement('div', {
      className: 'text-xs text-blue-800 dark:text-blue-300 space-y-2',
    });

    const p1 = this.createElement('p', {
      textContent: LanguageService.t('mixer.distanceExplanation'),
      className: 'leading-relaxed',
    });
    explanation.appendChild(p1);

    const p2 = this.createElement('p', {
      textContent: LanguageService.t('mixer.distanceHint'),
      className: 'leading-relaxed font-semibold',
    });
    explanation.appendChild(p2);

    container.appendChild(explanation);

    // Color scale legend
    const scaleLabel = this.createElement('div', {
      textContent: LanguageService.t('mixer.qualityScale'),
      className: 'text-xs font-semibold text-blue-900 dark:text-blue-200 mt-2',
    });
    container.appendChild(scaleLabel);

    const scaleItems = [
      {
        range: '≤30',
        color: 'text-green-600 dark:text-green-400 font-semibold',
        label: LanguageService.t('mixer.excellentMatch'),
      },
      {
        range: '31-60',
        color: 'text-blue-600 dark:text-blue-400 font-semibold',
        label: LanguageService.t('mixer.goodMatch'),
      },
      {
        range: '61-100',
        color: 'text-yellow-600 dark:text-yellow-400 font-semibold',
        label: LanguageService.t('mixer.fairMatch'),
      },
      {
        range: '>100',
        color: 'text-red-600 dark:text-red-400 font-semibold',
        label: LanguageService.t('mixer.poorMatch'),
      },
    ];

    for (const item of scaleItems) {
      const scaleItem = this.createElement('div', {
        className: 'flex gap-2 text-xs',
      });

      const rangeSpan = this.createElement('span', {
        textContent: `${item.range}:`,
        className: `${item.color} w-14`,
      });

      const labelSpan = this.createElement('span', {
        textContent: item.label,
        className: 'text-blue-700 dark:text-blue-300',
      });

      scaleItem.appendChild(rangeSpan);
      scaleItem.appendChild(labelSpan);
      explanation.appendChild(scaleItem);
    }

    return container;
  }

  /**
   * Render the gradient bar with interactive stops (T4)
   */
  private renderGradientBar(): HTMLElement {
    const container = this.createElement('div', {
      className: 'space-y-2',
    });

    // Gradient display label
    const label = this.createElement('div', {
      textContent: LanguageService.t('mixer.colorGradient'),
      className: 'text-sm font-semibold text-gray-700 dark:text-gray-300',
    });
    container.appendChild(label);

    // Gradient container with stops overlay (T4)
    const gradientWrapper = this.createElement('div', {
      className: 'relative',
      attributes: {
        id: 'gradient-stops-wrapper',
      },
    });

    // Gradient background
    const gradient = this.createElement('div', {
      className: 'h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-md',
      attributes: {
        id: 'gradient-bar',
      },
    });

    // Build gradient stops
    const gradientStops = this.steps
      .map((step) => `${step.theoreticalColor} ${Math.round(step.position * 100)}%`)
      .join(', ');

    gradient.style.background = `linear-gradient(to right, ${gradientStops})`;
    gradientWrapper.appendChild(gradient);

    // Add interactive stop markers (T4)
    const stopsContainer = this.createElement('div', {
      className: 'absolute inset-0 flex items-end pointer-events-none',
      attributes: {
        id: 'stops-container',
      },
    });

    this.steps.forEach((step, index) => {
      const stopMarker = this.createStopMarker(step, index);
      stopsContainer.appendChild(stopMarker);
    });

    gradientWrapper.appendChild(stopsContainer);
    container.appendChild(gradientWrapper);

    // Hint text
    const hint = this.createElement('p', {
      textContent: LanguageService.t('mixer.clickStopHint'),
      className: 'text-xs text-gray-500 dark:text-gray-400 italic',
    });
    container.appendChild(hint);

    // Start and end labels
    const labels = this.createElement('div', {
      className: 'flex justify-between text-xs text-gray-600 dark:text-gray-400',
    });

    const startLabel = this.createElement('div', {
      className: 'flex items-center gap-1',
    });
    const startSwatch = this.createElement('div', {
      className: 'dye-swatch w-3 h-3 rounded border border-gray-400',
      attributes: {
        style: `background-color: ${this.startColor}`,
      },
    });
    const startText = this.createElement('span', { textContent: LanguageService.t('mixer.start') });
    startLabel.appendChild(startSwatch);
    startLabel.appendChild(startText);

    const endLabel = this.createElement('div', {
      className: 'flex items-center gap-1',
    });
    const endSwatch = this.createElement('div', {
      className: 'dye-swatch w-3 h-3 rounded border border-gray-400',
      attributes: {
        style: `background-color: ${this.endColor}`,
      },
    });
    const endText = this.createElement('span', { textContent: LanguageService.t('mixer.end') });
    endLabel.appendChild(endSwatch);
    endLabel.appendChild(endText);

    labels.appendChild(startLabel);
    labels.appendChild(endLabel);
    container.appendChild(labels);

    return container;
  }

  /**
   * Create an interactive stop marker (T4)
   */
  private createStopMarker(step: InterpolationStep, index: number): HTMLElement {
    const isSelected = this.selectedStopIndex === index;
    const position = step.position * 100;

    // Stop marker container (positioned absolutely)
    const marker = this.createElement('button', {
      className: `absolute pointer-events-auto cursor-pointer transition-all duration-150
        ${isSelected ? 'z-20' : 'z-10'}`,
      attributes: {
        style: `left: ${position}%; transform: translateX(-50%);`,
        title: step.matchedDye
          ? `${Math.round(position)}% - ${LanguageService.getDyeName(step.matchedDye.itemID) || step.matchedDye.name}`
          : `${Math.round(position)}%`,
        'aria-label': `Stop at ${Math.round(position)}%${step.matchedDye ? ', ' + step.matchedDye.name : ''}`,
        'data-stop-index': String(index),
      },
    });

    // Stop handle (diamond shape)
    const handle = this.createElement('div', {
      className: `w-4 h-4 rotate-45 border-2 transition-all duration-150
        ${
          isSelected
            ? 'border-blue-500 shadow-lg scale-125'
            : 'border-gray-400 dark:border-gray-500 hover:border-blue-400 hover:scale-110'
        }`,
      attributes: {
        style: `background-color: ${step.matchedDye?.hex || step.theoreticalColor};`,
      },
    });
    marker.appendChild(handle);

    // Position label below (only for selected or on hover via CSS)
    const posLabel = this.createElement('div', {
      textContent: `${Math.round(position)}%`,
      className: `absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs number whitespace-nowrap
        ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`,
      attributes: {
        style: 'color: var(--theme-text);',
      },
    });
    marker.appendChild(posLabel);

    // Add group class for hover effects
    marker.classList.add('group');

    // Click handler
    this.on(marker, 'click', (e: Event) => {
      e.preventDefault();
      this.selectStop(index);
    });

    return marker;
  }

  /**
   * Select a gradient stop (T4)
   */
  private selectStop(index: number): void {
    const previousIndex = this.selectedStopIndex;
    this.selectedStopIndex = this.selectedStopIndex === index ? -1 : index;

    // Update marker visuals
    this.updateStopMarkerVisuals(previousIndex, this.selectedStopIndex);

    // Highlight corresponding step in list
    this.highlightStepInList(this.selectedStopIndex);

    // Announce for screen readers
    if (this.selectedStopIndex >= 0) {
      const step = this.steps[this.selectedStopIndex];
      const dyeName = step.matchedDye?.name || 'No match';
      AnnouncerService.announce(`Stop ${Math.round(step.position * 100)}% selected: ${dyeName}`);
    } else {
      AnnouncerService.announce('Stop deselected');
    }
  }

  /**
   * Update stop marker visuals after selection change (T4)
   */
  private updateStopMarkerVisuals(oldIndex: number, newIndex: number): void {
    const stopsContainer = this.querySelector<HTMLElement>('#stops-container');
    if (!stopsContainer) return;

    const markers = stopsContainer.querySelectorAll('button[data-stop-index]');

    markers.forEach((markerEl) => {
      const marker = markerEl as HTMLElement;
      const idx = parseInt(marker.getAttribute('data-stop-index') || '-1', 10);
      const handle = marker.querySelector('div');
      const label = marker.querySelectorAll('div')[1];

      if (idx === newIndex) {
        // Selected state
        marker.classList.add('z-20');
        marker.classList.remove('z-10');
        if (handle) {
          handle.classList.add('border-blue-500', 'shadow-lg', 'scale-125');
          handle.classList.remove('border-gray-400', 'dark:border-gray-500');
        }
        if (label) {
          label.classList.add('opacity-100');
          label.classList.remove('opacity-0');
        }
      } else {
        // Deselected state
        marker.classList.remove('z-20');
        marker.classList.add('z-10');
        if (handle) {
          handle.classList.remove('border-blue-500', 'shadow-lg', 'scale-125');
          handle.classList.add('border-gray-400', 'dark:border-gray-500');
        }
        if (label) {
          label.classList.remove('opacity-100');
          label.classList.add('opacity-0');
        }
      }
    });
  }

  /**
   * Highlight corresponding step in the list (T4)
   */
  private highlightStepInList(index: number): void {
    const listContainer = this.querySelector<HTMLElement>('.max-h-80.overflow-y-auto');
    if (!listContainer) return;

    const items = listContainer.children;

    Array.from(items).forEach((item, idx) => {
      const el = item as HTMLElement;
      if (idx === index) {
        // Highlight selected
        el.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
        // Scroll into view
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        // Remove highlight
        el.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'dark:bg-blue-900/30');
      }
    });
  }

  /**
   * Render the steps list
   */
  private renderStepsList(): HTMLElement {
    const container = this.createElement('div', {
      className: 'space-y-2',
    });

    const label = this.createElement('div', {
      textContent: LanguageService.t('mixer.intermediateDyes'),
      className: 'text-sm font-semibold text-gray-700 dark:text-gray-300',
    });
    container.appendChild(label);

    const listContainer = this.createElement('div', {
      className: 'space-y-1 max-h-80 overflow-y-auto',
    });

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const item = this.renderStepItem(step, i);
      listContainer.appendChild(item);
    }

    container.appendChild(listContainer);

    return container;
  }

  /**
   * Render a single step item (T4: now interactive)
   */
  private renderStepItem(step: InterpolationStep, index: number): HTMLElement {
    const isSelected = this.selectedStopIndex === index;

    const item = this.createElement('div', {
      className: `flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors
        ${
          isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500'
            : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }`,
      attributes: {
        'data-step-index': String(index),
        role: 'button',
        tabindex: '0',
        'aria-label': `Step ${Math.round(step.position * 100)}%: ${step.matchedDye?.name || 'No match'}`,
      },
    });

    // Click to select stop
    this.on(item, 'click', () => {
      this.selectStop(index);
    });

    // Keyboard support
    this.on(item, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        e.preventDefault();
        this.selectStop(index);
      }
    });

    // Position indicator
    const position = this.createElement('div', {
      textContent: `${Math.round(step.position * 100)}%`,
      className: 'text-xs font-bold text-gray-600 dark:text-gray-400 w-10 text-center',
    });
    item.appendChild(position);

    // Theoretical color swatch
    const theoreticalSwatch = this.createElement('div', {
      className: 'dye-swatch w-6 h-6 rounded border border-gray-300 dark:border-gray-600',
      attributes: {
        style: `background-color: ${step.theoreticalColor}`,
        title: `Theoretical: ${step.theoreticalColor}`,
      },
    });
    item.appendChild(theoreticalSwatch);

    if (step.matchedDye) {
      // Arrow
      const arrow = this.createElement('span', {
        textContent: '→',
        className: 'text-gray-400',
      });
      item.appendChild(arrow);

      // Matched dye swatch
      const matchedSwatch = this.createElement('div', {
        className: 'dye-swatch w-6 h-6 rounded border-2 border-gray-400',
        attributes: {
          style: `background-color: ${step.matchedDye.hex}`,
          title: step.matchedDye.hex,
        },
      });
      item.appendChild(matchedSwatch);

      // Dye info
      const info = this.createElement('div', {
        className: 'flex-1 min-w-0',
      });

      const name = this.createElement('div', {
        textContent: LanguageService.getDyeName(step.matchedDye.itemID) || step.matchedDye.name,
        className: 'text-sm font-semibold text-gray-900 dark:text-white truncate',
      });

      const distance = this.createElement('div', {
        textContent: `${LanguageService.t('mixer.distance')} ${step.distance.toFixed(1)}`,
        className: `text-xs ${this.getDistanceColor(step.distance)} number`,
      });

      info.appendChild(name);
      info.appendChild(distance);
      item.appendChild(info);
    } else {
      // No match found
      const noMatch = this.createElement('div', {
        textContent: LanguageService.t('mixer.noCloseMatch'),
        className: 'text-xs text-gray-500 dark:text-gray-400 italic flex-1',
      });
      item.appendChild(noMatch);
    }

    return item;
  }

  /**
   * Get color class for distance
   */
  private getDistanceColor(distance: number): string {
    if (distance <= 30) {
      return 'text-green-600 dark:text-green-400';
    }
    if (distance <= 60) {
      return 'text-blue-600 dark:text-blue-400';
    }
    if (distance <= 100) {
      return 'text-yellow-600 dark:text-yellow-400';
    }
    return 'text-red-600 dark:text-red-400';
  }

  /**
   * Render quality metrics
   */
  private renderMetrics(): HTMLElement {
    const container = this.createElement('div', {
      className:
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2',
    });

    const title = this.createElement('div', {
      textContent: LanguageService.t('mixer.transitionQuality'),
      className: 'text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2',
    });
    container.appendChild(title);

    // Calculate metrics
    let matchedCount = 0;
    let totalDistance = 0;
    let maxDistance = 0;

    for (const step of this.steps) {
      if (step.matchedDye) {
        matchedCount++;
        totalDistance += step.distance;
        maxDistance = Math.max(maxDistance, step.distance);
      }
    }

    const avgDistance = matchedCount > 0 ? totalDistance / matchedCount : 0;
    const coverage = (matchedCount / this.steps.length) * 100;

    // Coverage
    const coverageDiv = this.createElement('div', {
      className: 'space-y-1',
    });

    const coverageLabel = this.createElement('div', {
      textContent: `${LanguageService.t('mixer.coverage')} ${coverage.toFixed(0)}% (${matchedCount}/${this.steps.length} ${LanguageService.t('mixer.matched')})`,
      className: 'text-xs text-gray-700 dark:text-gray-300',
    });

    const coverageBar = this.createElement('div', {
      className: 'h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden',
    });

    const coverageFill = this.createElement('div', {
      className: 'h-full bg-blue-500',
      attributes: {
        style: `width: ${coverage}%`,
      },
    });

    coverageBar.appendChild(coverageFill);
    coverageDiv.appendChild(coverageLabel);
    coverageDiv.appendChild(coverageBar);
    container.appendChild(coverageDiv);

    // Average distance
    const avgDiv = this.createElement('div', {
      className: 'flex justify-between text-xs text-gray-700 dark:text-gray-300',
    });

    const avgLabel = this.createElement('span', {
      textContent: LanguageService.t('mixer.avgDistance'),
    });

    const avgValue = this.createElement('span', {
      textContent: avgDistance.toFixed(1),
      className: 'number',
    });

    avgDiv.appendChild(avgLabel);
    avgDiv.appendChild(avgValue);
    container.appendChild(avgDiv);

    // Max distance
    const maxDiv = this.createElement('div', {
      className: 'flex justify-between text-xs text-gray-700 dark:text-gray-300',
    });

    const maxLabel = this.createElement('span', {
      textContent: LanguageService.t('mixer.maxDistance'),
    });

    const maxValue = this.createElement('span', {
      textContent: maxDistance.toFixed(1),
      className: 'number',
    });

    maxDiv.appendChild(maxLabel);
    maxDiv.appendChild(maxValue);
    container.appendChild(maxDiv);

    return container;
  }

  /**
   * Update interpolation data
   */
  updateInterpolation(startColor: string, endColor: string, steps: InterpolationStep[]): void {
    this.startColor = startColor;
    this.endColor = endColor;
    this.steps = steps;
    this.update();
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Add interactivity if needed
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      startColor: this.startColor,
      endColor: this.endColor,
      stepCount: this.steps.length,
      colorSpace: this.colorSpace,
    };
  }
}
