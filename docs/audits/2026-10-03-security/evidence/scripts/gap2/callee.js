export default { async fetch(r){ const v=r.headers.get('X-User-Discord-Name'); return Response.json({v, cps:[...(v||'')].map(c=>c.codePointAt(0).toString(16))}); } }
