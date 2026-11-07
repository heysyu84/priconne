const upstream = 'https://nyang-clan-manager.heysyu457310.chatgpt.site';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.hostname.endsWith('.priconne.pages.dev') || !url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== 'GET') return new Response('Read-only preview', {status: 405});
    if (url.pathname === '/api/editor') return Response.json({editor:false}, {headers:{'Cache-Control':'no-store'}});
    if (url.pathname !== '/api/state' && url.pathname !== '/api/archive') return new Response(null, {status:404});
    let result;
    try {
      result = await fetch(upstream + url.pathname + url.search);
    } catch {
      return Response.json({error:'Preview upstream unavailable'}, {status:502});
    }
    return new Response(result.body, {status:result.status, headers:{
      'Content-Type': result.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store',
    }});
  },
};
