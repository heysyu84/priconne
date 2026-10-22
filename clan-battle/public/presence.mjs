export const PRESENCE_INTERVAL_MS = 20_000;
export const BROWSER_PRESENCE_KEY = 'nyang-browser-presence';
const validId = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

export function startPresence({apiFetch, onCount, storage, crypto = globalThis.crypto,
  document = globalThis.document, window = globalThis.window, locks = globalThis.navigator?.locks,
  setInterval = globalThis.setInterval, clearInterval = globalThis.clearInterval}) {
  if (storage === undefined) try { storage = globalThis.localStorage; } catch {}
  let fallbackId, stopped = false, pending = false;
  const identity = () => {
    try { const existing = storage?.getItem(BROWSER_PRESENCE_KEY); if (validId(existing)) return existing; } catch {}
    fallbackId ||= [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('');
    try { storage?.setItem(BROWSER_PRESENCE_KEY, fallbackId); } catch {}
    return fallbackId;
  };
  async function heartbeat() {
    if (stopped || pending || document?.visibilityState === 'hidden') return;
    pending = true;
    try {
      const browserId = locks?.request ? await locks.request(BROWSER_PRESENCE_KEY, identity) : identity();
      const response = await apiFetch('/api/presence', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({browserId}), signal:AbortSignal.timeout(8000)});
      if (!response.ok) throw Error('Presence unavailable');
      const result = await response.json();
      if (!Number.isSafeInteger(result.online) || result.online < 0) throw Error('Invalid count');
      if (!stopped) onCount(result.online);
    } catch { if (!stopped) onCount(null); }
    finally { pending = false; }
  }
  const visibility = () => { if (document?.visibilityState !== 'hidden') void heartbeat(); };
  const online = () => { void heartbeat(); };
  document?.addEventListener?.('visibilitychange', visibility);
  window?.addEventListener?.('online', online);
  const timer = setInterval(() => { void heartbeat(); }, PRESENCE_INTERVAL_MS);
  void heartbeat();
  return {heartbeat, stop() {
    stopped = true; clearInterval(timer);
    document?.removeEventListener?.('visibilitychange', visibility);
    window?.removeEventListener?.('online', online);
  }};
}
