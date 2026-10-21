import shell from "../public/clan-shell.html?raw";

export function GET() {
  return new Response(shell, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
