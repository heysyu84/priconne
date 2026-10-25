export function createApiClient({apiOrigin = '', pageOrigin, fetcher, storage, now = Date.now}) {
  const crossOrigin = !!apiOrigin && apiOrigin !== pageOrigin;
  const key = `nyang-editor-session:${apiOrigin}`;
  let session = null;
  if (crossOrigin) try { session = JSON.parse(storage?.getItem(key) || 'null'); } catch {}
  function remember(value) {
    session = value;
    try { value ? storage?.setItem(key, JSON.stringify(value)) : storage?.removeItem(key); } catch {}
  }
  return async function apiFetch(path, options = {}) {
    if (!/^\/api\/(?:state(?:\?(?:(?:since=\d+&compact=1)|(?:compact=1&since=\d+)|(?:since=\d+)|(?:compact=1)))?|archive(?:\?(?:month=\d{4}-\d{2}|all=1))?|editor|presence|battle-entry)$/.test(path)) throw Error('지원하지 않는 API 경로입니다.');
    const headers = new Headers(options.headers);
    if (crossOrigin && session) {
      if (session.expiresAt > now() && /^[a-f0-9]{64}$/.test(session.token || '')) headers.set('Authorization', `Bearer ${session.token}`);
      else remember(null);
    }
    const response = await fetcher(crossOrigin ? new URL(path, apiOrigin).href : path, {
      ...options, headers, credentials: crossOrigin ? 'omit' : 'same-origin',
    });
    if (crossOrigin && path === '/api/editor' && response.ok) {
      const result = await response.clone().json();
      if (result.editor === false) remember(null);
      else if (result.token && result.expiresAt) remember({token: result.token, expiresAt: result.expiresAt});
    }
    if (crossOrigin && response.status === 403) remember(null);
    return response;
  };
}

export function browserApiClient() {
  const apiOrigin = document.querySelector('meta[name="nyang-api-origin"]')?.content || '';
  let storage;
  try { storage = sessionStorage; } catch {}
  return createApiClient({apiOrigin, pageOrigin: location.origin, fetcher: (...args) => fetch(...args), storage});
}
