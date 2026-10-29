/** Fail loudly if a runtime test accidentally attempts another service call. */
export default {
  fetch(): Response {
    return new Response('Unexpected local service call', { status: 500 });
  },
} satisfies ExportedHandler;
