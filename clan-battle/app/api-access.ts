// Only our production Pages frontends may use the shared API from another origin.
export const PAGES_ORIGIN = "https://heysyu84.github.io";
export const CLOUDFLARE_PAGES_ORIGIN = "https://priconne.pages.dev";
const PAGES_ORIGINS = new Set([PAGES_ORIGIN, CLOUDFLARE_PAGES_ORIGIN]);
export const isPagesRequest = (request: Request) => PAGES_ORIGINS.has(request.headers.get("origin") || "");
export function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin || isPagesRequest(request);
}
export function apiHeaders(request: Request) {
  const headers = new Headers({ "cache-control": "no-store", "vary": "Origin" });
  if (isPagesRequest(request)) headers.set("access-control-allow-origin", request.headers.get("origin")!);
  return headers;
}
export function apiJSON(request: Request, data: unknown, init: ResponseInit = {}) {
  const headers = apiHeaders(request);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return Response.json(data, { ...init, headers });
}
export function preflight(request: Request, methods: string[]) {
  if (!allowedOrigin(request)) return apiJSON(request, { error: "허용되지 않은 요청입니다." }, { status: 403 });
  const method = request.headers.get("access-control-request-method");
  const requestedHeaders = (request.headers.get("access-control-request-headers") || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
  if ((method && !methods.includes(method)) || requestedHeaders.some(h => !["authorization", "content-type", "x-nyang-client"].includes(h))) return apiJSON(request, { error: "허용되지 않은 요청입니다." }, { status: 403 });
  const headers = apiHeaders(request);
  headers.set("access-control-allow-methods", methods.join(", "));
  headers.set("access-control-allow-headers", "Authorization, Content-Type, X-Nyang-Client");
  headers.set("access-control-max-age", "600");
  return new Response(null, { status: 204, headers });
}
