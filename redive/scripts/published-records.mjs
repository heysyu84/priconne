// Published fallback records are data, not generated UI. Keep them byte-for-byte
// while rebuilding code; live records continue to come from the existing API.
export function preservePublishedSeed(html,published){
  if(!published)return html;
  const pattern=/(<script id="seed-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
  const old=published.match(pattern);
  if(!old)return html;
  JSON.parse(old[2]);
  return html.replace(pattern,(_,open,data,close)=>open+old[2]+close);
}
export function preservePublishedReferences(code,published){
  if(!published)return code;
  for(const name of ['MONTH_IMPORT','ROSTER_REFERENCE','HISTORY_REFERENCE','AWARD_REFERENCE']){
    const pattern=new RegExp('^const '+name+'=(.*);$','m');
    const old=published.match(pattern);
    if(old){JSON.parse(old[1]);code=code.replace(pattern,()=>old[0]);}
  }
  return code;
}
