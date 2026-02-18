/**
 * Progress Feedback Service (V4)
 *
 * Provides status updates for long-running operations by editing
 * the deferred interaction response with progress indicators.
 *
 * Use cases:
 * - Image generation (>500ms)
 * - Market data fetching (>1s)
 * - Complex color calculations
 *
 * @module services/progress
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { editOriginalResponse } from '../utils/discord-api.js';
import type { DiscordEmbed, InteractionResponseData } from '../utils/response.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Progress stage identifiers
 */
export type ProgressStage =
  | 'analyzing'
  | 'rendering'
  | 'fetching_market'
  | 'processing'
  | 'finalizing'
  | 'complete';

/**
 * Progress indicator configuration
 */
export interface ProgressConfig {
  /** Discord application ID */
  applicationId: string;
  /** Interaction token */
  interactionToken: string;
  /** Discord bot token (for API calls) */
  botToken: string;
  /** Minimum elapsed time before showing progress (ms) */
  minElapsedMs?: number;
  /** Optional logger */
  logger?: ExtendedLogger;
}

/**
 * Progress state
 */
export interface ProgressState {
  /** When the operation started */
  startTime: number;
  /** Current stage */
  currentStage: ProgressStage;
  /** Whether we've shown a progress update */
  hasShownProgress: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default minimum elapsed time before showing progress */
const DEFAULT_MIN_ELAPSED_MS = 1000;

/** Stage display information */
const STAGE_DISPLAY: Record<ProgressStage, { emoji: string; message: string }> = {
  analyzing: {
    emoji: '🔍',
    message: 'Analyzing your request...',
  },
  rendering: {
    emoji: '🎨',
    message: 'Generating image...',
  },
  fetching_market: {
    emoji: '💰',
    message: 'Fetching market data...',
  },
  processing: {
    emoji: '⚙️',
    message: 'Processing colors...',
  },
  finalizing: {
    emoji: '✨',
    message: 'Finalizing results...',
  },
  complete: {
    emoji: '✅',
    message: 'Complete!',
  },
};

/** Animated dots for progress indication */
const PROGRESS_DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ============================================================================
// Progress Tracker
// ============================================================================

/**
 * Progress tracker for a single operation
 */
export class ProgressTracker {
  private config: Omit<Required<ProgressConfig>, 'logger'> & Pick<ProgressConfig, 'logger'>;
  private state: ProgressState;
  private animationFrame: number = 0;

  constructor(config: ProgressConfig) {
    this.config = {
      ...config,
      minElapsedMs: config.minElapsedMs ?? DEFAULT_MIN_ELAPSED_MS,
    };

    this.state = {
      startTime: Date.now(),
      currentStage: 'processing',
      hasShownProgress: false,
    };
  }

  /**
   * Get elapsed time in milliseconds
   */
  get elapsedMs(): number {
    return Date.now() - this.state.startTime;
  }

  /**
   * Check if we should show progress (based on elapsed time)
   */
  shouldShowProgress(): boolean {
    return this.elapsedMs >= this.config.minElapsedMs;
  }

  /**
   * Update the progress stage
   *
   * Only sends an update if enough time has elapsed.
   *
   * @param stage - New progress stage
   */
  async updateStage(stage: ProgressStage): Promise<void> {
    this.state.currentStage = stage;

    // Only show progress if enough time has elapsed
    if (!this.shouldShowProgress()) {
      return;
    }

    // Don't update if we're at the complete stage (final response handles that)
    if (stage === 'complete') {
      return;
    }

    try {
      await this.sendProgressUpdate();
      this.state.hasShownProgress = true;
    } catch (error) {
      if (this.config.logger) {
        this.config.logger.error(
          'Failed to send progress update',
          error instanceof Error ? error : undefined
        );
      }
    }
  }

  /**
   * Send a progress update to Discord
   */
  private async sendProgressUpdate(): Promise<void> {
    const display = STAGE_DISPLAY[this.state.currentStage];
    const dot = PROGRESS_DOTS[this.animationFrame % PROGRESS_DOTS.length];
    this.animationFrame++;

    const embed: DiscordEmbed = {
      description: `${dot} ${display.emoji} ${display.message}`,
      color: 0x5865f2, // Discord Blurple
      footer: {
        text: `Elapsed: ${Math.round(this.elapsedMs / 1000)}s`,
      },
    };

    await editOriginalResponse(
      this.config.applicationId,
      this.config.interactionToken,
      { embeds: [embed] }
    );
  }

  /**
   * Check if a progress update was shown
   */
  wasProgressShown(): boolean {
    return this.state.hasShownProgress;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a progress tracker
 *
 * @param config - Progress configuration
 * @returns Progress tracker instance
 */
export function createProgressTracker(config: ProgressConfig): ProgressTracker {
  return new ProgressTracker(config);
}

/**
 * Run an operation with progress tracking
 *
 * Automatically tracks progress and sends updates for long-running operations.
 *
 * @param config - Progress configuration
 * @param stages - Stages to execute with their functions
 * @returns Final result
 */
export async function withProgress<T>(
  config: ProgressConfig,
  operation: (tracker: ProgressTracker) => Promise<T>
): Promise<T> {
  const tracker = createProgressTracker(config);

  try {
    const result = await operation(tracker);
    return result;
  } catch (error) {
    if (config.logger) {
      config.logger.error(
        'Operation failed during progress tracking',
        error instanceof Error ? error : undefined
      );
    }
    throw error;
  }
}

// ============================================================================
// Progress Embeds
// ============================================================================

/**
 * Build a progress embed for the current stage
 *
 * @param stage - Current progress stage
 * @param elapsedMs - Elapsed time in milliseconds
 * @returns Discord embed
 */
export function buildProgressEmbed(stage: ProgressStage, elapsedMs: number): DiscordEmbed {
  const display = STAGE_DISPLAY[stage];

  return {
    description: `${display.emoji} ${display.message}`,
    color: 0x5865f2,
    ...(elapsedMs > 0 && {
      footer: { text: `Elapsed: ${Math.round(elapsedMs / 1000)}s` },
    }),
  };
}

/**
 * Build a "thinking" embed for deferred responses
 *
 * @param customMessage - Optional custom message
 * @returns Discord embed
 */
export function buildThinkingEmbed(customMessage?: string): DiscordEmbed {
  return {
    description: customMessage ?? '⏳ Processing your request...',
    color: 0x5865f2,
  };
}

// ============================================================================
// Queue Position (for rate limiting feedback)
// ============================================================================

/**
 * Build a queue position embed
 *
 * @param position - Position in queue (1-indexed)
 * @param estimatedWaitSeconds - Estimated wait time in seconds
 * @returns Discord embed
 */
export function buildQueuePositionEmbed(
  position: number,
  estimatedWaitSeconds: number
): DiscordEmbed {
  const waitTime = estimatedWaitSeconds > 60
    ? `~${Math.round(estimatedWaitSeconds / 60)} minute(s)`
    : `~${estimatedWaitSeconds} seconds`;

  return {
    title: '⏳ Processing Request',
    description: `You're **#${position}** in the queue.\n\nEstimated wait: ${waitTime}`,
    color: 0xfee75c, // Yellow
    footer: {
      text: 'High-quality image generation takes time. Thanks for your patience!',
    },
  };
}

// ============================================================================
// Cooldown Formatting
// ============================================================================

/**
 * Format a cooldown message with countdown
 *
 * @param retryAfterSeconds - Seconds until retry allowed
 * @returns Formatted message
 */
export function formatCooldownMessage(retryAfterSeconds: number): string {
  const retryTimestamp = Math.floor(Date.now() / 1000) + retryAfterSeconds;

  return `⏳ Please wait before using this command again.\n\nYou can try again <t:${retryTimestamp}:R>.`;
}

/**
 * Build a cooldown embed
 *
 * @param retryAfterSeconds - Seconds until retry allowed
 * @param commandName - Name of the command (optional)
 * @returns Discord embed
 */
export function buildCooldownEmbed(
  retryAfterSeconds: number,
  commandName?: string
): DiscordEmbed {
  const retryTimestamp = Math.floor(Date.now() / 1000) + retryAfterSeconds;
  const cmdText = commandName ? `**/${commandName}**` : 'this command';

  return {
    title: '⏳ Slow Down',
    description: `You're using ${cmdText} too quickly.\n\nYou can try again <t:${retryTimestamp}:R>.`,
    color: 0xfee75c,
    footer: {
      text: 'Rate limits help ensure the bot remains responsive for everyone.',
    },
  };
}
