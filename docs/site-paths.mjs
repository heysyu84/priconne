// Keep all portraits, fonts and data inside the published repository path.
export function assetUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  const base = globalThis.document?.baseURI;
  if(base&&new URL(base).hostname.endsWith('.chatgpt.site')&&/^\/(source-library|portrait-assets)\//.test(path))return new URL('priconne'+path,'https://heysyu84.github.io/').href;
  return base ? new URL(path.slice(1), new URL('.', base)).pathname : path;
}
