/**
 * Ping command — basic connectivity check.
 * `!xd ping` → responds with "Pong!" and WebSocket latency.
 */

import type { CommandContext } from '../router.js';

export async function handlePingCommand(ctx: CommandContext): Promise<void> {
  const startTime = Date.now();
  await ctx.message.channel?.sendMessage({
    content: `🏓 Pong! (${Date.now() - startTime}ms)`,
    replies: [{ id: ctx.message.id, mention: false }],
  });
}
