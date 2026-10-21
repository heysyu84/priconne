// Keep all portraits, fonts and data inside the published repository path.
export function assetUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  const base = globalThis.document?.baseURI;
  return base ? new URL(path.slice(1), new URL('.', base)).pathname : path;
}
