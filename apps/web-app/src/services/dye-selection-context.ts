/**
 * XIV Dye Tools v2.0.0 - Dye Selection Context
 *
 * Phase 12: Architecture Refactor
 * Shared context for dye selection across tools
 *
 * @module services/dye-selection-context
 */

import type { Dye } from '@shared/types';

type SelectionChangedCallback = (toolId: string, dyes: Dye[]) => void;

/**
 * Context for sharing dye selections between tools
 */
export class DyeSelectionContext {
  private selections: Map<string, Dye[]> = new Map();
  private listeners: Set<SelectionChangedCallback> = new Set();

  /**
   * Set the selected dyes for a tool
   * @param toolId ID of the tool making the selection
   * @param dyes Array of selected dyes
   */
  select(toolId: string, dyes: Dye[]): void {
    this.selections.set(toolId, dyes);
    this.notifyListeners(toolId, dyes);
  }

  /**
   * Get the selected dyes for a tool
   * @param toolId ID of the tool to get selection for
   * @returns Array of selected dyes
   */
  get(toolId: string): Dye[] {
    return this.selections.get(toolId) ?? [];
  }

  /**
   * Copy selection from one tool to another
   * @param fromToolId Source tool ID
   * @param toToolId Destination tool ID
   */
  copyToTool(fromToolId: string, toToolId: string): void {
    const dyes = this.get(fromToolId);
    this.select(toToolId, [...dyes]);
  }

  /**
   * Subscribe to selection changes
   * @param callback Function to call when selection changes
   * @returns Unsubscribe function
   */
  subscribe(callback: SelectionChangedCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of a selection change
   */
  private notifyListeners(toolId: string, dyes: Dye[]): void {
    this.listeners.forEach((cb) => cb(toolId, dyes));
  }
}
