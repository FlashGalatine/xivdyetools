/**
 * Ping command — basic connectivity check.
 * `!xd ping` → responds with "Pong!" and WebSocket latency.
 */

import type { CommandContext } from '../router.js';

export async function handlePingCommand(ctx: CommandContext): Promise<void> {
  const startTime = Date.now();
  const sent = await ctx.message.channel?.sendMessage({
    content: '🏓 Pong!',
    replies: [{ id: ctx.message.id, mention: false }],
  });
  const latency = Date.now() - startTime;
  await sent?.edit({ content: `🏓 Pong! (${latency}ms)` });
}
