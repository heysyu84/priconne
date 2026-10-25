import {env} from 'cloudflare:workers';
import {handleFutureBosses} from '../../../server/future-bosses.mjs';
export const dynamic='force-dynamic';
export const GET=(request:Request)=>handleFutureBosses(request,env);
export const POST=(request:Request)=>handleFutureBosses(request,env);
