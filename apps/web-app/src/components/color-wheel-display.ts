/**
 * XIV Dye Tools v2.0.0 - Color Wheel Display Component
 *
 * Phase 12: Architecture Refactor
 * Task 13: Redesigned with donut/ring style visualization
 * Visualizes color harmony relationships on an interactive color wheel
 *
 * @module components/color-wheel-display
 */

import { BaseComponent } from './base-component';
import { ColorService, ThemeService, LanguageService } from '@services/index';
import type { Dye } from '@shared/types';
import { clearContainer } from '@shared/utils';

/**
 * Color Wheel Display Component
 * Shows color harmony relationships on an SVG color wheel with donut/ring design
 */
export class ColorWheelDisplay extends BaseComponent {
  private baseColor: string;
  private harmonyDyes: Dye[];
  private harmonyType: string;
  private wheelSize: number = 200;
  private wheelCenter: number = 100;
  private outerRadius: number = 90; // Outer edge of donut
  private innerRadius: number = 50; // Inner edge of donut (creates the "hole")
  private dotRadius: number = 70; // Radius where dots are placed

  constructor(
    container: HTMLElement,
    baseColor: string,
    harmonyDyes: Dye[],
    harmonyType: string,
    size: number = 200
  ) {
    super(container);
    this.baseColor = baseColor;
    this.harmonyDyes = harmonyDyes;
    this.harmonyType = harmonyType;
    this.wheelSize = size;
    this.wheelCenter = size / 2;
    this.outerRadius = size * 0.45; // 45% of size for outer radius
    this.innerRadius = size * 0.25; // 25% of size for inner radius
    this.dotRadius = size * 0.35; // 35% of size for dot placement (middle of ring)
  }

  /**
   * Render the color wheel component with modern donut/ring design
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'flex justify-center',
    });

    // Get theme for styling
    const theme = ThemeService.getCurrentThemeObject();
    const lineColor = theme.isDark ? 'rgba(100, 100, 100, 0.8)' : 'rgba(100, 100, 100, 0.6)';
    const dotStrokeColor = theme.isDark ? '#333333' : '#FFFFFF';
    const indicatorColor = theme.isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)';

    // Create SVG element with accessibility attributes
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${this.wheelSize} ${this.wheelSize}`);
    svg.setAttribute('width', String(this.wheelSize));
    svg.setAttribute('height', String(this.wheelSize));
    svg.setAttribute('role', 'img');
    // Provide meaningful description for screen readers
    const harmonyLabel = LanguageService.t(`harmony.${this.harmonyType}`);
    svg.setAttribute(
      'aria-label',
      `${LanguageService.t('harmony.colorWheel')}: ${harmonyLabel} (${this.harmonyDyes.length} ${LanguageService.t('harmony.colors')})`
    );
    svg.classList.add('color-wheel');

    // Create defs for gradients
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);

    // Draw color segments as donut/ring (60 segments = 6° each)
    const segments = 60;
    for (let i = 0; i < segments; i++) {
      const hue = (i / segments) * 360;
      const angle1 = ((i / segments) * 360 - 90) * (Math.PI / 180);
      const angle2 = (((i + 1) / segments) * 360 - 90) * (Math.PI / 180);

      // Calculate outer arc points
      const outerX1 = this.wheelCenter + this.outerRadius * Math.cos(angle1);
      const outerY1 = this.wheelCenter + this.outerRadius * Math.sin(angle1);
      const outerX2 = this.wheelCenter + this.outerRadius * Math.cos(angle2);
      const outerY2 = this.wheelCenter + this.outerRadius * Math.sin(angle2);

      // Calculate inner arc points
      const innerX1 = this.wheelCenter + this.innerRadius * Math.cos(angle1);
      const innerY1 = this.wheelCenter + this.innerRadius * Math.sin(angle1);
      const innerX2 = this.wheelCenter + this.innerRadius * Math.cos(angle2);
      const innerY2 = this.wheelCenter + this.innerRadius * Math.sin(angle2);

      // Create radial gradient for saturation (inner = less saturated, outer = fully saturated)
      const gradientId = `gradient-${i}`;
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
      gradient.setAttribute('id', gradientId);
      gradient.setAttribute('cx', '50%');
      gradient.setAttribute('cy', '50%');
      gradient.setAttribute('r', '50%');

      const innerStop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      innerStop.setAttribute('offset', '0%');
      innerStop.setAttribute('stop-color', `hsl(${hue}, 60%, 70%)`); // Less saturated at inner edge

      const outerStop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      outerStop.setAttribute('offset', '100%');
      outerStop.setAttribute('stop-color', `hsl(${hue}, 100%, 50%)`); // Fully saturated at outer edge

      gradient.appendChild(innerStop);
      gradient.appendChild(outerStop);
      defs.appendChild(gradient);

      // Create path for donut segment (arc from inner to outer radius)
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const pathData = `
        M ${outerX1} ${outerY1}
        A ${this.outerRadius} ${this.outerRadius} 0 0 1 ${outerX2} ${outerY2}
        L ${innerX2} ${innerY2}
        A ${this.innerRadius} ${this.innerRadius} 0 0 0 ${innerX1} ${innerY1}
        Z
      `;
      path.setAttribute('d', pathData.trim());
      path.setAttribute('fill', `hsl(${hue}, 100%, 50%)`);
      path.setAttribute('opacity', '0.85');
      path.classList.add('transition-opacity', 'hover:opacity-100');
      svg.appendChild(path);
    }

    // Get base color hue
    const baseRgb = ColorService.hexToRgb(this.baseColor);
    const baseHsv = ColorService.rgbToHsv(baseRgb.r, baseRgb.g, baseRgb.b);
    const baseHue = baseHsv.h;

    // Draw subtle harmony angle indicators (radial lines)
    const indicatorAngles = this.getHarmonyAngles(this.harmonyType, baseHue);
    for (const angle of indicatorAngles) {
      const radAngle = (angle - 90) * (Math.PI / 180);
      const x1 = this.wheelCenter + this.innerRadius * Math.cos(radAngle);
      const y1 = this.wheelCenter + this.innerRadius * Math.sin(radAngle);
      const x2 = this.wheelCenter + this.outerRadius * Math.cos(radAngle);
      const y2 = this.wheelCenter + this.outerRadius * Math.sin(radAngle);

      const indicatorLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      indicatorLine.setAttribute('x1', String(x1));
      indicatorLine.setAttribute('y1', String(y1));
      indicatorLine.setAttribute('x2', String(x2));
      indicatorLine.setAttribute('y2', String(y2));
      indicatorLine.setAttribute('stroke', indicatorColor);
      indicatorLine.setAttribute('stroke-width', '2');
      indicatorLine.setAttribute('opacity', '0.5');
      svg.appendChild(indicatorLine);
    }

    // Draw connection lines from base to harmony colors
    for (const dye of this.harmonyDyes) {
      const harmonyRgb = ColorService.hexToRgb(dye.hex);
      const harmonyHsv = ColorService.rgbToHsv(harmonyRgb.r, harmonyRgb.g, harmonyRgb.b);
      const harmonyHue = harmonyHsv.h;

      const baseAngle = (baseHue - 90) * (Math.PI / 180);
      const harmonyAngle = (harmonyHue - 90) * (Math.PI / 180);

      const x1 = this.wheelCenter + this.dotRadius * Math.cos(baseAngle);
      const y1 = this.wheelCenter + this.dotRadius * Math.sin(baseAngle);
      const x2 = this.wheelCenter + this.dotRadius * Math.cos(harmonyAngle);
      const y2 = this.wheelCenter + this.dotRadius * Math.sin(harmonyAngle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', lineColor);
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '4,4');
      line.setAttribute('opacity', '0.6');
      svg.appendChild(line);
    }

    // Draw color dots for harmony colors with hover effect
    for (const dye of this.harmonyDyes) {
      const harmonyRgb = ColorService.hexToRgb(dye.hex);
      const harmonyHsv = ColorService.rgbToHsv(harmonyRgb.r, harmonyRgb.g, harmonyRgb.b);
      const harmonyHue = harmonyHsv.h;

      const harmonyAngle = (harmonyHue - 90) * (Math.PI / 180);
      const x = this.wheelCenter + this.dotRadius * Math.cos(harmonyAngle);
      const y = this.wheelCenter + this.dotRadius * Math.sin(harmonyAngle);

      // Outer glow circle for better visibility
      const glowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glowCircle.setAttribute('cx', String(x));
      glowCircle.setAttribute('cy', String(y));
      glowCircle.setAttribute('r', '12');
      glowCircle.setAttribute('fill', dye.hex);
      glowCircle.setAttribute('opacity', '0.3');
      glowCircle.classList.add('transition-all', 'duration-200');
      svg.appendChild(glowCircle);

      // Main color dot
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', '9');
      circle.setAttribute('fill', dye.hex);
      circle.setAttribute('stroke', dotStrokeColor);
      circle.setAttribute('stroke-width', '2.5');
      circle.classList.add('cursor-pointer', 'transition-all', 'duration-200');

      // Add tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${LanguageService.getDyeName(dye.itemID) || dye.name} (${dye.hex})`;
      circle.appendChild(title);

      // Hover effect to enlarge glow and dot
      circle.addEventListener('mouseenter', () => {
        glowCircle.setAttribute('r', '16');
        glowCircle.setAttribute('opacity', '0.5');
        circle.setAttribute('r', '11');
      });
      circle.addEventListener('mouseleave', () => {
        glowCircle.setAttribute('r', '12');
        glowCircle.setAttribute('opacity', '0.3');
        circle.setAttribute('r', '9');
      });

      svg.appendChild(circle);
    }

    // Draw base color dot (larger, more prominent)
    const baseAngle = (baseHue - 90) * (Math.PI / 180);
    const baseX = this.wheelCenter + this.dotRadius * Math.cos(baseAngle);
    const baseY = this.wheelCenter + this.dotRadius * Math.sin(baseAngle);

    // Base color glow
    const baseGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    baseGlow.setAttribute('cx', String(baseX));
    baseGlow.setAttribute('cy', String(baseY));
    baseGlow.setAttribute('r', '16');
    baseGlow.setAttribute('fill', this.baseColor);
    baseGlow.setAttribute('opacity', '0.4');
    svg.appendChild(baseGlow);

    // Base color dot
    const baseCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    baseCircle.setAttribute('cx', String(baseX));
    baseCircle.setAttribute('cy', String(baseY));
    baseCircle.setAttribute('r', '11');
    baseCircle.setAttribute('fill', this.baseColor);
    baseCircle.setAttribute('stroke', dotStrokeColor);
    baseCircle.setAttribute('stroke-width', '3');

    // Add tooltip for base color
    const baseTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    baseTitle.textContent = `Base Color (${this.baseColor})`;
    baseCircle.appendChild(baseTitle);

    svg.appendChild(baseCircle);

    // Add center label showing harmony type
    const centerLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerLabel.setAttribute('x', String(this.wheelCenter));
    centerLabel.setAttribute('y', String(this.wheelCenter + 4)); // Slight vertical adjustment for better centering
    centerLabel.setAttribute('text-anchor', 'middle');
    // Ensure font-size is at least 12px for mobile readability (Lighthouse requirement)
    const fontSize = Math.max(12, this.wheelSize * 0.06);
    centerLabel.setAttribute('font-size', String(fontSize));
    centerLabel.setAttribute('font-weight', '600');
    centerLabel.setAttribute('fill', theme.isDark ? '#CCCCCC' : '#666666');
    centerLabel.setAttribute('opacity', '0.7');
    centerLabel.textContent = this.getHarmonyTypeShortName(this.harmonyType);
    svg.appendChild(centerLabel);

    wrapper.appendChild(svg);
    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Get harmony angle indicators based on harmony type
   */
  private getHarmonyAngles(harmonyType: string, baseHue: number): number[] {
    switch (harmonyType) {
      case 'complementary':
        return [baseHue, (baseHue + 180) % 360];
      case 'analogous':
        return [baseHue, (baseHue + 30) % 360, (baseHue - 30 + 360) % 360];
      case 'triadic':
        return [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360];
      case 'split-complementary':
        return [baseHue, (baseHue + 150) % 360, (baseHue + 210) % 360];
      case 'tetradic':
        return [baseHue, (baseHue + 60) % 360, (baseHue + 180) % 360, (baseHue + 240) % 360];
      case 'square':
        return [baseHue, (baseHue + 90) % 360, (baseHue + 180) % 360, (baseHue + 270) % 360];
      case 'monochromatic':
        return [baseHue];
      case 'compound':
        return [baseHue, (baseHue + 30) % 360, (baseHue - 30 + 360) % 360, (baseHue + 180) % 360];
      case 'shades':
        return [baseHue, (baseHue + 15) % 360, (baseHue - 15 + 360) % 360];
      default:
        return [baseHue];
    }
  }

  /**
   * Get short name for harmony type (for center label)
   */
  private getHarmonyTypeShortName(harmonyType: string): string {
    const shortNames: Record<string, string> = {
      complementary: 'COMP',
      analogous: 'ANALOG',
      triadic: 'TRIAD',
      'split-complementary': 'SPLIT',
      tetradic: 'TETRA',
      square: 'SQUARE',
      monochromatic: 'MONO',
      compound: 'COMPND',
      shades: 'SHADES',
    };
    return shortNames[harmonyType] || harmonyType.toUpperCase().slice(0, 6);
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // NOTE: Theme changes are handled automatically via CSS custom properties
    // No need to call update() on theme change - SVG styling inherits from root element
    // This prevents expensive full re-render cycles during theme switching
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    super.destroy();
  }

  /**
   * Get component state
   */
  protected getState(): Record<string, unknown> {
    return {
      baseColor: this.baseColor,
      harmonyType: this.harmonyType,
      dyeCount: this.harmonyDyes.length,
    };
  }
}
