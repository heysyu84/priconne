import { env } from 'cloudflare:workers';
import { handleSharedState } from '../../../server/shared-store.mjs';
import { initialState } from '../../../server/initial-state.mjs';

export const dynamic = 'force-dynamic';
export const GET = (request:Request) => handleSharedState(request, env, initialState);
export const PUT = (request:Request) => handleSharedState(request, env, initialState);
