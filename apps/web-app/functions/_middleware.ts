/**
 * Cloudflare Pages middleware. Handles domain redirects from the old domain to
 * the new one, and keeps the SPA catch-all out of the immutable asset cache.
 *
 * @entrypoint No importer by design — Pages loads this by path convention
 * from functions/, so static analysis cannot see the call site.
 */

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const { request, next } = context;
  const url = new URL(request.url);

  // Redirect old domain to new domain
  if (url.hostname === 'xivdyetools.projectgalatine.com') {
    const newUrl = new URL(request.url);
    newUrl.hostname = 'xivdyetools.app';

    return Response.redirect(newUrl.toString(), 301);
  }

  // FINDING-027 -- the SPA catch-all must never be cached as a script under the
  // `/assets/*` immutable rule; see the 2026-08 cache-poisoning incident.
  // `public/_redirects` answers every unmatched path with `/index.html 200`,
  // and Cloudflare Pages merges overlapping `_headers` patterns, so a request
  // for a hashed asset this deployment does not have came back as HTML carrying
  // `max-age=31536000, immutable` and was served as the script for a year.
  if (url.pathname.startsWith('/assets/')) {
    const response = await next();
    if (response.headers.get('Content-Type')?.includes('text/html')) {
      return new Response('Not found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return response;
  }

  // Continue to next middleware or route handler
  return next();
}
