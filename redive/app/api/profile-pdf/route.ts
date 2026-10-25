// A native attachment response also works in mobile browsers that restrict blob
// downloads. The generated report is returned immediately and is never stored.
export const dynamic='force-dynamic';
export async function POST(request:Request){
  const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(request.headers.get('Origin')!==new URL(request.url).origin)return new Response('허용되지 않은 요청입니다.',{status:403,headers});
  if(Number(request.headers.get('Content-Length')||0)>6000000)return new Response('PDF가 너무 큽니다.',{status:413,headers});
  const raw=await request.text();if(raw.length>6000000)return new Response('PDF가 너무 큽니다.',{status:413,headers});
  const form=new URLSearchParams(raw),encoded=form.get('pdf')||'',filename=String(form.get('filename')||'개인_이력.pdf').replace(/[\r\n"\\/]/g,'_').slice(0,180);
  try{
    const binary=atob(encoded);if(!binary.startsWith('%PDF-'))throw new Error('Invalid PDF');
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    const disposition=form.get('view')==='inline'?'inline':'attachment';
    return new Response(bytes,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`${disposition}; filename="profile.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`}});
  }catch{return new Response('PDF 파일을 확인해 주세요.',{status:400,headers});}
}
