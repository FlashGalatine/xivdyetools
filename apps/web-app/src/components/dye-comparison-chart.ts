/**
 * XIV Dye Tools v2.0.0 - Dye Comparison Chart Component
 *
 * Phase 12: Architecture Refactor
 * Canvas-based visualization of dye comparisons
 *
 * @module components/dye-comparison-chart
 */

import { BaseComponent } from './base-component';
import { ThemeService, LanguageService } from '@services/index';
import type { Dye } from '@shared/types';
import { clearContainer } from '@shared/utils';

/**
 * Chart type options
 */
export type ChartType = 'hue-saturation' | 'brightness';

/**
 * Dye Comparison Chart Component
 * Renders canvas-based visualizations of dye color spaces
 */
export class DyeComparisonChart extends BaseComponent {
  private dyes: Dye[] = [];
  private chartType: ChartType = 'hue-saturation';
  private canvas: HTMLCanvasElement | null = null;
  private chartWidth: number = 600;
  private chartHeight: number = 400;
  private themeUnsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, chartType: ChartType = 'hue-saturation', dyes: Dye[] = []) {
    super(container);
    this.chartType = chartType;
    this.dyes = dyes;
  }

  /**
   * Render the chart component
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-2',
    });

    // Title
    const title = this.createElement('h3', {
      textContent: this.getChartTitle(),
      className: 'text-lg font-semibold text-gray-900 dark:text-white',
    });
    wrapper.appendChild(title);

    // Description
    const description = this.createElement('p', {
      textContent: this.getChartDescription(),
      className: 'text-sm text-gray-600 dark:text-gray-400',
    });
    wrapper.appendChild(description);

    // Canvas container
    const canvasContainer = this.createElement('div', {
      className:
        'rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800',
    });

    this.canvas = this.createElement('canvas', {
      attributes: {
        width: String(this.chartWidth),
        height: String(this.chartHeight),
      },
      className: 'w-full',
    });

    canvasContainer.appendChild(this.canvas);
    wrapper.appendChild(canvasContainer);

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);

    // Draw chart
    if (this.canvas && this.dyes.length > 0) {
      setTimeout(() => this.drawChart(), 0);
    }
  }

  /**
   * Get chart title
   */
  private getChartTitle(): string {
    return this.chartType === 'hue-saturation'
      ? LanguageService.t('comparison.chart.hueSaturationTitle')
      : LanguageService.t('comparison.chart.brightnessTitle');
  }

  /**
   * Get chart description
   */
  private getChartDescription(): string {
    if (this.chartType === 'hue-saturation') {
      return LanguageService.t('comparison.chart.hueSaturationDesc');
    }
    return LanguageService.t('comparison.chart.brightnessDesc');
  }

  /**
   * Draw the chart
   */
  private drawChart(): void {
    if (!this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    // Get theme colors from ThemeService
    const theme = ThemeService.getCurrentThemeObject();
    const textColor = theme.palette.text;
    const gridColor = theme.palette.textMuted;
    const bgColor = theme.palette.background;

    // Clear canvas with theme background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.chartWidth, this.chartHeight);

    if (this.chartType === 'hue-saturation') {
      this.drawHueSaturationChart(ctx, textColor, gridColor);
    } else {
      this.drawBrightnessChart(ctx, textColor, gridColor);
    }
  }

  /**
   * Draw hue-saturation chart
   */
  private drawHueSaturationChart(
    ctx: CanvasRenderingContext2D,
    textColor: string,
    gridColor: string
  ): void {
    const padding = 40;
    const width = this.chartWidth - padding * 2;
    const height = this.chartHeight - padding * 2;

    // Draw axes
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, this.chartHeight - padding);
    ctx.lineTo(this.chartWidth - padding, this.chartHeight - padding); // X-axis
    ctx.moveTo(padding, this.chartHeight - padding);
    ctx.lineTo(padding, padding); // Y-axis
    ctx.stroke();

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Vertical grid lines (hue)
    for (let i = 0; i <= 10; i++) {
      const x = padding + (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, this.chartHeight - padding);
      ctx.stroke();
    }

    // Horizontal grid lines (saturation)
    for (let i = 0; i <= 10; i++) {
      const y = this.chartHeight - padding - (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(this.chartWidth - padding, y);
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = textColor;
    ctx.font = '12px Habibi, serif';
    ctx.textAlign = 'center';

    // X-axis labels (Hue: 0-360)
    for (let i = 0; i <= 10; i++) {
      const x = padding + (width / 10) * i;
      const label = String(Math.round((i / 10) * 360));
      ctx.fillText(label, x, this.chartHeight - padding + 20);
    }

    // Y-axis labels (Saturation: 0-100)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i++) {
      const y = this.chartHeight - padding - (height / 10) * i;
      const label = String(Math.round((i / 10) * 100));
      ctx.fillText(label, padding - 10, y + 4);
    }

    // Draw axis names
    ctx.textAlign = 'center';
    ctx.fillText(
      LanguageService.t('comparison.chart.hueAxis'),
      this.chartWidth / 2,
      this.chartHeight - 5
    );
    ctx.save();
    ctx.translate(15, this.chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(LanguageService.t('comparison.chart.saturationAxis'), 0, 0);
    ctx.restore();

    // Plot dyes using actual dye colors
    for (let i = 0; i < this.dyes.length; i++) {
      const dye = this.dyes[i];
      const x = padding + (dye.hsv.h / 360) * width;
      const y = this.chartHeight - padding - (dye.hsv.s / 100) * height;

      // Draw point with actual dye color
      ctx.fillStyle = dye.hex;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw border using theme text color
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = textColor;
      ctx.font = 'bold 12px Habibi, serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, y - 12);
    }
  }

  /**
   * Draw brightness chart
   */
  private drawBrightnessChart(
    ctx: CanvasRenderingContext2D,
    textColor: string,
    gridColor: string
  ): void {
    const padding = 40;
    const width = this.chartWidth - padding * 2;
    const height = this.chartHeight - padding * 2;

    // Draw axes
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, this.chartHeight - padding);
    ctx.lineTo(this.chartWidth - padding, this.chartHeight - padding); // X-axis
    ctx.moveTo(padding, this.chartHeight - padding);
    ctx.lineTo(padding, padding); // Y-axis
    ctx.stroke();

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Vertical grid lines (hue)
    for (let i = 0; i <= 10; i++) {
      const x = padding + (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, this.chartHeight - padding);
      ctx.stroke();
    }

    // Horizontal grid lines (brightness)
    for (let i = 0; i <= 10; i++) {
      const y = this.chartHeight - padding - (height / 10) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(this.chartWidth - padding, y);
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = textColor;
    ctx.font = '12px Habibi, serif';
    ctx.textAlign = 'center';

    // X-axis labels (Hue: 0-360)
    for (let i = 0; i <= 10; i++) {
      const x = padding + (width / 10) * i;
      const label = String(Math.round((i / 10) * 360));
      ctx.fillText(label, x, this.chartHeight - padding + 20);
    }

    // Y-axis labels (Brightness: 0-100)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 10; i++) {
      const y = this.chartHeight - padding - (height / 10) * i;
      const label = String(Math.round((i / 10) * 100));
      ctx.fillText(label, padding - 10, y + 4);
    }

    // Draw axis names
    ctx.textAlign = 'center';
    ctx.fillText(
      LanguageService.t('comparison.chart.hueAxis'),
      this.chartWidth / 2,
      this.chartHeight - 5
    );
    ctx.save();
    ctx.translate(15, this.chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(LanguageService.t('comparison.chart.brightnessAxis'), 0, 0);
    ctx.restore();

    // Plot dyes using actual dye colors
    for (let i = 0; i < this.dyes.length; i++) {
      const dye = this.dyes[i];
      const x = padding + (dye.hsv.h / 360) * width;
      const y = this.chartHeight - padding - (dye.hsv.v / 100) * height;

      // Draw point with actual dye color
      ctx.fillStyle = dye.hex;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw border using theme text color
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = textColor;
      ctx.font = 'bold 12px Habibi, serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, y - 12);
    }
  }

  /**
   * Update dyes
   */
  updateDyes(dyes: Dye[]): void {
    this.dyes = dyes;
    this.update();
  }

  /**
   * Change chart type
   */
  setChartType(type: ChartType): void {
    this.chartType = type;
    this.update();
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Handle window resize
    const resizeObserver = new ResizeObserver(() => {
      if (this.canvas && this.canvas.parentElement) {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.chartWidth = Math.max(300, rect.width);
        this.drawChart();
      }
    });

    if (this.canvas && this.canvas.parentElement) {
      resizeObserver.observe(this.canvas.parentElement);
    }

    // Subscribe to theme changes to redraw chart
    this.themeUnsubscribe = ThemeService.subscribe(() => {
      this.drawChart();
    });
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    // Unsubscribe from theme changes
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }

    // Clear arrays and references
    this.dyes = [];
    this.canvas = null;

    super.destroy();
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      chartType: this.chartType,
      dyeCount: this.dyes.length,
    };
  }
}
