export default { async fetch(r,env){ const name=decodeURIComponent(new URL(r.url).search.slice(3)); const out={};
 try { const h=new Headers(); h.set('X-User-Discord-Name', name); out.headersSet='ok'; } catch(e){ out.headersSet='THROW '+e.message }
 try { const q=new Request('https://internal/x',{headers:{'X-User-Discord-Name':name}}); out.request='ok'; const res=await env.SVC.fetch(q); out.binding=await res.json(); } catch(e){ out.request='THROW '+e.message }
 return Response.json(out);} }
