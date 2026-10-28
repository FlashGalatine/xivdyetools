/** Local producer fixture: the existing Fetcher request passes through unchanged. */
export default {
  fetch(request: Request, env: { DISCORD_WORKER: Fetcher }): Promise<Response> {
    return env.DISCORD_WORKER.fetch(request);
  },
} satisfies ExportedHandler<{ DISCORD_WORKER: Fetcher }>;
