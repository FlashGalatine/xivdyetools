/**
 * Cloudflare Pages Middleware
 * Handles domain redirects from old domain to new domain
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

  // Continue to next middleware or route handler
  return next();
}
