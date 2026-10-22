import { env } from "cloudflare:workers";
import { allowedOrigin, apiHeaders } from "../../api-access";

// Read-only SSE: notify all connected viewers of a committed DB revision.
// The event contains only the revision, never player data or editing credentials.
export function GET(request: Request) {
  const headers = apiHeaders(request);
  if (!allowedOrigin(request)) return Response.json({ error:"허용되지 않은 요청입니다." }, { status:403, headers });
  headers.set("content-type","text/event-stream; charset=utf-8");
  headers.set("cache-control","no-cache, no-transform");
  headers.set("x-accel-buffering","no");
  const input = new URL(request.url).searchParams.get("since");
  let seen = input && /^\d+$/.test(input) ? Number(input) : -1;
  let cleanup: (()=>void)|undefined;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let stopped = false, checking = false;
      let poll:ReturnType<typeof setInterval>;
      let heart:ReturnType<typeof setInterval>;
      let expire:ReturnType<typeof setTimeout>;
      const stop = () => {
        if(stopped)return;
        stopped=true;
        clearInterval(poll);clearInterval(heart);clearTimeout(expire);
        request.signal.removeEventListener("abort",stop);
        try{controller.close()}catch{}
      };
      cleanup=stop;
      const emit=(value:string)=>{if(!stopped)try{controller.enqueue(encoder.encode(value))}catch{stop()}};
      const check=async()=>{
        if(checking||stopped)return;
        checking=true;
        try{
          const row=await env.DB!.prepare("SELECT revision FROM clan_state WHERE id = ?").bind("main").first<{revision:number}>();
          const next=row?.revision??0;
          if(next>seen){seen=next;emit("event: change\ndata: "+JSON.stringify({revision:next})+"\n\n");}
        }catch{ /* Reconnect on the next check, without notifying in the UI. */ }
        finally{checking=false}
      };
      emit(": connected\n\n");
      poll=setInterval(()=>{void check()},1000);
      heart=setInterval(()=>emit(": ping\n\n"),15000);
      expire=setTimeout(stop,55000);
      request.signal.addEventListener("abort",stop,{once:true});
      void check();
    },
    cancel(){cleanup?.()}
  });
  return new Response(body,{headers});
}
