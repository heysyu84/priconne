import { shell } from '../server/shell.mjs';

export const dynamic = 'force-dynamic';
export function GET() {
  return new Response(shell, {headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
