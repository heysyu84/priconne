/* Tiny foreground-data loading marker; not used for background sync or UI-only actions. */
(()=>{
'use strict';
const marker=document.getElementById('nyang-now-loading');
if(!marker||typeof window.fetch!=='function')return;
let pending=0;
function update(){marker.hidden=pending===0;}
function begin(){
  pending++;update();let finished=false;
  return ()=>{if(finished)return;finished=true;pending=Math.max(0,pending-1);update();};
}
const finishStartup=begin();
const app=document.getElementById('app');
if(document.querySelector('meta[name="nyang-legacy-api-origin"]')){
  // Keep visible until shared records are ready, not just the header.
  window.addEventListener('nyang:shared-ready',finishStartup,{once:true});
}else if(app){
  let observer;
  const completed=()=>{if(!app.firstElementChild)return;observer?.disconnect();finishStartup();};
  if(app.firstElementChild)queueMicrotask(completed);
  else{observer=new MutationObserver(completed);observer.observe(app,{childList:true});}
  window.addEventListener('load',completed,{once:true});
}else finishStartup();
setTimeout(finishStartup,20000);
const nativeFetch=window.fetch;
function isVisibleDataRequest(input,options){
  const method=String(options?.method||input?.method||'GET').toUpperCase();
  if(method!=='GET')return false;
  const raw=typeof input==='string'||input instanceof URL?input:input?.url;
  if(!raw)return false;
  let url;
  try{url=new URL(raw,location.href);}catch{return false;}
  const path=url.pathname;
  if(/\/api\/(?:presence|changes|editor|battle-entry)$/.test(path))return false;
  if(/\/api\/state$/.test(path))return !url.searchParams.has('since');
  if(/\/api\/(?:archive|future-bosses)$/.test(path))return true;
  return /\/(?:history-\d{4}\/[^/]+|archive-data\/[^/]+|future-bosses|aikurumi-snapshot(?:-stage3)?)\.json$/.test(path);
}
window.fetch=function(input,options){
  if(!isVisibleDataRequest(input,options))return Reflect.apply(nativeFetch,window,arguments);
  const complete=begin();
  try{return Promise.resolve(Reflect.apply(nativeFetch,window,arguments)).finally(complete);}
  catch(error){complete();throw error;}
};
})();
