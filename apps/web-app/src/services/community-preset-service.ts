/**
 * Community Preset Service
 * Fetches community presets from the xivdyetools-worker API
 */
/* istanbul ignore file */

import { logger } from '@shared/logger';
import { authService } from './auth-service';
import type { CommunityPreset, PresetFilters, PresetListResponse } from '@xivdyetools/types';

// ============================================
// Types
// ============================================

// CommunityPreset, PresetFilters and PresetListResponse are the
// shared `@xivdyetools/types` contracts, re-exported here so existing
// `@services/community-preset-service` imports keep working unchanged.
export type { CommunityPreset, PresetFilters, PresetListResponse };

export interface CategoryWithCount {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  is_curated: boolean;
  preset_count: number;
}

/**
 * Why a vote failure is a code and not a sentence: this service has no locale,
 * so every English string it used to return was toasted verbatim by
 * `preset-detail` regardless of the user's language. It names the reason; the
 * component looks the text up (`VOTE_ERROR_KEYS` there).
 */
export type VoteErrorCode =
  'notLoggedIn' | 'alreadyVoted' | 'voteFailed' | 'removeVoteFailed' | 'network';

/**
 * Kept local rather than adopted from `@xivdyetools/types`' `VoteResponse`.
 *
 * The real wire response on a 409 (already voted) is
 * `{ success: true, already_voted: true, new_vote_count }` — see
 * `apps/presets-api/src/handlers/votes.ts` `addVote()`, which matches the
 * shared `VoteSuccessResponse` exactly (`already_voted` only exists on the
 * success variant). `voteForPreset()`/`removeVote()` below deliberately
 * report that case as `success: false` instead, so their callers
 * (`preset-detail.ts`, `preset-tool.ts`) can route it through their
 * already-voted branch (an info toast, no vote-count update) rather than
 * the success branch (success toast + vote-count update) without those
 * components having to branch on `already_voted` themselves. The shared
 * discriminated union has no variant for "success:false with
 * already_voted/new_vote_count", so adopting it here would mean either
 * restructuring those two components' toast logic (out of scope for a
 * type-only refactor) or passing through a `success: true` response that
 * changes which toast fires. Flat and un-discriminated on purpose.
 */
export interface VoteResponse {
  success: boolean;
  new_vote_count: number;
  already_voted?: boolean;
  errorCode?: VoteErrorCode;
  /** The presets-API's own message, when it sent one. Never app-authored copy. */
  error?: string;
}

export interface VoteCheckResponse {
  has_voted: boolean;
  vote_count: number;
}

// ============================================
// Configuration
// ============================================

/**
 * Default API URL - can be overridden via environment or config
 */
const DEFAULT_API_URL = 'https://api.xivdyetools.app';

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Request timeout in milliseconds
 */
const REQUEST_TIMEOUT = 10000;

// ============================================
// Cache Implementation
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;

  constructor(ttl: number = CACHE_TTL) {
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

// ============================================
// Service Implementation
// ============================================

/**
 * Community Preset Service
 * Singleton service for fetching community presets from the API
 */
export class CommunityPresetService {
  private static instance: CommunityPresetService | null = null;

  private readonly apiUrl: string;
  private readonly cache: SimpleCache<unknown>;
  private initialized = false;
  private available = false;

  private constructor() {
    // Build-time override only (same as auth-service / preset-submission-
    // service). SECURITY (FINDING-032 / WEB-4): this used to fall back to a
    // `window.PRESET_API_URL` global that nothing set — a markup injection
    // could have defined it by DOM clobbering (`<a id="PRESET_API_URL"
    // href="https://evil…">`) and pointed the bearer-token vote requests at
    // an attacker host. Runtime globals never choose an API origin.
    this.apiUrl = import.meta.env.VITE_PRESETS_API_URL || DEFAULT_API_URL;
    this.cache = new SimpleCache(CACHE_TTL);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CommunityPresetService {
    if (!CommunityPresetService.instance) {
      CommunityPresetService.instance = new CommunityPresetService();
    }
    return CommunityPresetService.instance;
  }

  /**
   * Initialize the service and check API availability
   * BUG-015 FIX: Added Promise.race fallback timeout for browsers
   * where AbortController might not work reliably
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return this.available;
    }

    try {
      // BUG-015: Use Promise.race as a fallback timeout mechanism
      // This ensures timeout works even if AbortController isn't fully supported
      const healthCheckPromise = this.fetchWithTimeout(`${this.apiUrl}/health`, {
        method: 'GET',
      });

      const timeoutPromise = new Promise<Response>((_, reject) =>
        setTimeout(
          () => reject(new Error('Health check timeout (fallback)')),
          REQUEST_TIMEOUT + 1000
        )
      );

      const response = await Promise.race([healthCheckPromise, timeoutPromise]);

      this.available = response.ok;
      this.initialized = true;

      if (this.available) {
        logger.info('CommunityPresetService: API available');
      } else {
        logger.warn('CommunityPresetService: API returned non-OK status');
      }
    } catch (error) {
      logger.warn('CommunityPresetService: API not available', error);
      this.available = false;
      this.initialized = true;
    }

    return this.available;
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeout: number = REQUEST_TIMEOUT
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make API request with error handling
   */
  private async request<T>(path: string, cacheKey?: string): Promise<T> {
    // Check cache first
    if (cacheKey) {
      const cached = this.cache.get(cacheKey) as T | null;
      if (cached) {
        return cached;
      }
    }

    const url = `${this.apiUrl}${path}`;

    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || `API request failed: ${response.status}`);
      }

      const data = (await response.json()) as T;

      // Cache successful response
      if (cacheKey) {
        this.cache.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout', { cause: error });
      }
      throw error;
    }
  }

  // ============================================
  // Public API Methods
  // ============================================

  /**
   * Get presets with optional filtering
   */
  async getPresets(filters: PresetFilters = {}): Promise<PresetListResponse> {
    const params = new URLSearchParams();

    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.is_curated !== undefined) params.set('is_curated', String(filters.is_curated));

    const query = params.toString();
    const path = `/api/v1/presets${query ? `?${query}` : ''}`;
    const cacheKey = `presets:${query}`;

    return this.request<PresetListResponse>(path, cacheKey);
  }

  /**
   * Get featured presets (top voted)
   */
  async getFeaturedPresets(): Promise<CommunityPreset[]> {
    const response = await this.request<{ presets: CommunityPreset[] }>(
      '/api/v1/presets/featured',
      'presets:featured'
    );
    return response.presets;
  }

  /**
   * Get a single preset by ID
   */
  async getPreset(id: string): Promise<CommunityPreset | null> {
    try {
      return await this.request<CommunityPreset>(
        `/api/v1/presets/${encodeURIComponent(id)}`,
        `preset:${id}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all categories with preset counts
   */
  async getCategories(): Promise<CategoryWithCount[]> {
    const response = await this.request<{ categories: CategoryWithCount[] }>(
      '/api/v1/categories',
      'categories'
    );
    return response.categories;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('CommunityPresetService: Cache cleared');
  }

  /**
   * Invalidate specific cache entries
   */
  invalidatePresets(): void {
    // Clear all preset-related cache entries
    this.cache.delete('presets:featured');
    this.cache.delete('categories');
    // Note: Individual preset queries will expire naturally
  }

  // ============================================
  // Voting Methods
  // ============================================

  /**
   * Vote for a preset
   * Requires authentication
   */
  async voteForPreset(presetId: string): Promise<VoteResponse> {
    if (!authService.isAuthenticated()) {
      return {
        success: false,
        new_vote_count: 0,
        errorCode: 'notLoggedIn',
      };
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.apiUrl}/api/v1/votes/${encodeURIComponent(presetId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeaders(),
          },
        }
      );

      const data = (await response.json()) as VoteResponse;

      if (response.status === 409) {
        // Already voted
        return {
          success: false,
          new_vote_count: data.new_vote_count || 0,
          already_voted: true,
          errorCode: 'alreadyVoted',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          new_vote_count: 0,
          errorCode: 'voteFailed',
          error: (data as { message?: string }).message,
        };
      }

      // Invalidate cache for this preset
      this.cache.delete(`preset:${presetId}`);
      this.cache.delete(`vote:${presetId}`);

      logger.info(`Voted for preset ${presetId}`);
      return data;
    } catch (error) {
      logger.error('Error voting for preset:', error);
      return {
        success: false,
        new_vote_count: 0,
        errorCode: 'network',
      };
    }
  }

  /**
   * Remove vote from a preset
   * Requires authentication
   */
  async removeVote(presetId: string): Promise<VoteResponse> {
    if (!authService.isAuthenticated()) {
      return {
        success: false,
        new_vote_count: 0,
        errorCode: 'notLoggedIn',
      };
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.apiUrl}/api/v1/votes/${encodeURIComponent(presetId)}`,
        {
          method: 'DELETE',
          headers: {
            ...authService.getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        return {
          success: false,
          new_vote_count: 0,
          errorCode: 'removeVoteFailed',
          error: data.message,
        };
      }

      const data = (await response.json()) as VoteResponse;

      // Invalidate cache
      this.cache.delete(`preset:${presetId}`);
      this.cache.delete(`vote:${presetId}`);

      logger.info(`Removed vote from preset ${presetId}`);
      return data;
    } catch (error) {
      logger.error('Error removing vote:', error);
      return {
        success: false,
        new_vote_count: 0,
        errorCode: 'network',
      };
    }
  }

  /**
   * Check if user has voted for a preset
   * Requires authentication
   */
  async hasVoted(presetId: string): Promise<VoteCheckResponse> {
    if (!authService.isAuthenticated()) {
      return { has_voted: false, vote_count: 0 };
    }

    // Check cache first
    const cacheKey = `vote:${presetId}`;
    const cached = this.cache.get(cacheKey) as VoteCheckResponse | null;
    if (cached) {
      return cached;
    }

    try {
      const response = await this.fetchWithTimeout(
        `${this.apiUrl}/api/v1/votes/${encodeURIComponent(presetId)}/check`,
        {
          method: 'GET',
          headers: {
            ...authService.getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        return { has_voted: false, vote_count: 0 };
      }

      const data = (await response.json()) as VoteCheckResponse;

      // Cache the result
      this.cache.set(cacheKey, data);

      return data;
    } catch (error) {
      logger.error('Error checking vote status:', error);
      return { has_voted: false, vote_count: 0 };
    }
  }
}

// Export singleton instance
export const communityPresetService = CommunityPresetService.getInstance();
