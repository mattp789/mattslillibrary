// Cloudflare Pages Function: proxies /api/* to the Fly.io backend.
// Makes the browser see API + frontend as same-origin, avoiding cross-site
// cookie issues (Safari ITP, Firefox strict tracking protection, etc).

const API_ORIGIN = 'https://rsvp-reader-api.fly.dev';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = API_ORIGIN + url.pathname + url.search;

  const headers = new Headers(request.headers);
  headers.set('host', new URL(API_ORIGIN).host);
  headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '');
  headers.set('x-forwarded-proto', 'https');

  const proxied = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });

  return new Response(proxied.body, {
    status: proxied.status,
    statusText: proxied.statusText,
    headers: proxied.headers,
  });
}
