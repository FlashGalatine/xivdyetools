/**
 * Tests for Progress Feedback Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProgressTracker,
  createProgressTracker,
  withProgress,
  buildProgressEmbed,
  buildThinkingEmbed,
  buildQueuePositionEmbed,
  formatCooldownMessage,
  buildCooldownEmbed,
} from './progress.js';

// Mock discord-api module
vi.mock('../utils/discord-api.js', () => ({
  editOriginalResponse: vi.fn().mockResolvedValue(undefined),
}));

import { editOriginalResponse } from '../utils/discord-api.js';

// Mock logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as never;

describe('Progress Feedback Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ProgressTracker', () => {
    const baseConfig = {
      applicationId: 'app123',
      interactionToken: 'token456',
      botToken: 'botToken789',
      minElapsedMs: 1000,
    };

    it('creates tracker with initial state', () => {
      const tracker = new ProgressTracker(baseConfig);

      expect(tracker.elapsedMs).toBe(0);
      expect(tracker.shouldShowProgress()).toBe(false);
      expect(tracker.wasProgressShown()).toBe(false);
    });

    it('shouldShowProgress returns false before threshold', () => {
      const tracker = new ProgressTracker(baseConfig);

      vi.advanceTimersByTime(500);

      expect(tracker.shouldShowProgress()).toBe(false);
    });

    it('shouldShowProgress returns true after threshold', () => {
      const tracker = new ProgressTracker(baseConfig);

      vi.advanceTimersByTime(1001);

      expect(tracker.shouldShowProgress()).toBe(true);
    });

    it('does not send update before threshold', async () => {
      const tracker = new ProgressTracker(baseConfig);

      vi.advanceTimersByTime(500);
      await tracker.updateStage('rendering');

      expect(editOriginalResponse).not.toHaveBeenCalled();
    });

    it('sends update after threshold', async () => {
      const tracker = new ProgressTracker(baseConfig);

      vi.advanceTimersByTime(1500);
      await tracker.updateStage('rendering');

      expect(editOriginalResponse).toHaveBeenCalledWith(
        'app123',
        'token456',
        expect.objectContaining({
          embeds: [expect.objectContaining({
            description: expect.stringContaining('Generating image'),
          })],
        })
      );
    });

    it('marks progress as shown after update', async () => {
      const tracker = new ProgressTracker(baseConfig);

      vi.advanceTimersByTime(1500);
      await tracker.updateStage('rendering');

      expect(tracker.wasProgressShown()).toBe(true);
    });

    it('does not send update for complete stage', async () => {
      const tracker = new ProgressTracker(baseConfig);

      vi.advanceTimersByTime(1500);
      await tracker.updateStage('complete');

      expect(editOriginalResponse).not.toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      vi.mocked(editOriginalResponse).mockRejectedValueOnce(new Error('API Error'));

      const tracker = new ProgressTracker({ ...baseConfig, logger: mockLogger });

      vi.advanceTimersByTime(1500);
      await tracker.updateStage('rendering');

      expect((mockLogger as { error: typeof vi.fn }).error).toHaveBeenCalled();
    });
  });

  describe('createProgressTracker', () => {
    it('creates tracker with config', () => {
      const tracker = createProgressTracker({
        applicationId: 'app',
        interactionToken: 'token',
        botToken: 'bot',
      });

      expect(tracker).toBeInstanceOf(ProgressTracker);
    });
  });

  describe('withProgress', () => {
    it('runs operation with tracker', async () => {
      const config = {
        applicationId: 'app',
        interactionToken: 'token',
        botToken: 'bot',
      };

      const mockOperation = vi.fn(async (tracker: ProgressTracker) => {
        expect(tracker).toBeInstanceOf(ProgressTracker);
        return 'result';
      });

      const result = await withProgress(config, mockOperation);

      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('propagates errors', async () => {
      const config = {
        applicationId: 'app',
        interactionToken: 'token',
        botToken: 'bot',
        logger: mockLogger,
      };

      const error = new Error('Operation failed');
      const mockOperation = vi.fn(async () => {
        throw error;
      });

      await expect(withProgress(config, mockOperation)).rejects.toThrow('Operation failed');
      expect((mockLogger as { error: typeof vi.fn }).error).toHaveBeenCalled();
    });
  });

  describe('buildProgressEmbed', () => {
    it('builds embed for analyzing stage', () => {
      const embed = buildProgressEmbed('analyzing', 0);

      expect(embed.description).toContain('🔍');
      expect(embed.description).toContain('Analyzing');
      expect(embed.color).toBe(0x5865f2);
    });

    it('builds embed for rendering stage', () => {
      const embed = buildProgressEmbed('rendering', 2000);

      expect(embed.description).toContain('🎨');
      expect(embed.description).toContain('Generating image');
    });

    it('builds embed for fetching_market stage', () => {
      const embed = buildProgressEmbed('fetching_market', 1500);

      expect(embed.description).toContain('💰');
      expect(embed.description).toContain('market data');
    });

    it('includes elapsed time in footer', () => {
      const embed = buildProgressEmbed('processing', 3500);

      expect(embed.footer?.text).toBe('Elapsed: 4s');
    });

    it('omits footer when no elapsed time', () => {
      const embed = buildProgressEmbed('processing', 0);

      expect(embed.footer?.text).toBeUndefined();
    });
  });

  describe('buildThinkingEmbed', () => {
    it('builds default thinking embed', () => {
      const embed = buildThinkingEmbed();

      expect(embed.description).toContain('⏳');
      expect(embed.description).toContain('Processing');
      expect(embed.color).toBe(0x5865f2);
    });

    it('accepts custom message', () => {
      const embed = buildThinkingEmbed('Custom message here');

      expect(embed.description).toBe('Custom message here');
    });
  });

  describe('buildQueuePositionEmbed', () => {
    it('builds queue position embed with seconds', () => {
      const embed = buildQueuePositionEmbed(3, 45);

      expect(embed.title).toBe('⏳ Processing Request');
      expect(embed.description).toContain('#3');
      expect(embed.description).toContain('~45 seconds');
      expect(embed.color).toBe(0xfee75c);
    });

    it('formats wait time in minutes for longer waits', () => {
      const embed = buildQueuePositionEmbed(5, 120);

      expect(embed.description).toContain('~2 minute(s)');
    });

    it('includes helpful footer', () => {
      const embed = buildQueuePositionEmbed(1, 30);

      expect(embed.footer?.text).toContain('Thanks for your patience');
    });
  });

  describe('formatCooldownMessage', () => {
    it('formats cooldown message with timestamp', () => {
      vi.setSystemTime(new Date('2026-01-28T12:00:00Z'));

      const message = formatCooldownMessage(60);

      expect(message).toContain('⏳');
      expect(message).toContain('Please wait');
      expect(message).toContain('<t:'); // Discord timestamp
      expect(message).toContain(':R>'); // Relative format
    });
  });

  describe('buildCooldownEmbed', () => {
    it('builds cooldown embed without command name', () => {
      vi.setSystemTime(new Date('2026-01-28T12:00:00Z'));

      const embed = buildCooldownEmbed(30);

      expect(embed.title).toBe('⏳ Slow Down');
      expect(embed.description).toContain('this command');
      expect(embed.description).toContain('<t:');
      expect(embed.color).toBe(0xfee75c);
    });

    it('builds cooldown embed with command name', () => {
      vi.setSystemTime(new Date('2026-01-28T12:00:00Z'));

      const embed = buildCooldownEmbed(30, 'harmony');

      expect(embed.description).toContain('**/harmony**');
    });

    it('includes helpful footer', () => {
      const embed = buildCooldownEmbed(60);

      expect(embed.footer?.text).toContain('Rate limits');
    });
  });
});
