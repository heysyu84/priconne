// Measure actual menu typography instead of guessing a resolution breakpoint.
export function compactNavigation(viewport, available, required, compact=false) {
  return viewport<=800 || available<required+(compact?12:0);
}
export function installAdaptiveNavigation(doc=document,win=window) {
  const sidebar=doc.querySelector('.sidebar'),bottom=doc.querySelector('.mobile-nav');
  if(!sidebar||!bottom)return;
  const root=doc.documentElement,buttons=[...sidebar.querySelectorAll('.nav')];
  const probe=doc.createElement('aside');probe.className='sidebar';probe.dataset.navProbe='';
  probe.setAttribute('aria-hidden','true');probe.inert=true;
  for(const button of buttons){
    const copy=button.cloneNode(true);copy.removeAttribute('data-page');copy.removeAttribute('id');
    copy.tabIndex=-1;probe.append(copy);
  }
  doc.body.append(probe);
  let frame=0,compact=false;
  function measure(){
    frame=0;
    const viewport=root.clientWidth;
    probe.style.width=sidebar.getBoundingClientRect().width+'px';
    const style=win.getComputedStyle(probe);
    const available=probe.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0);
    const gap=parseFloat(style.columnGap)||0;
    const needed=Math.max(0,...[...probe.children].map(b=>b.getBoundingClientRect().width))*buttons.length+gap*Math.max(0,buttons.length-1);
    compact=compactNavigation(viewport,available,needed,compact);
    const layout=compact?'compact':'wide';
    if(root.dataset.navLayout!==layout){
      const active=doc.activeElement,page=active?.closest?.('.nav')?.dataset.page;
      root.dataset.navLayout=layout;
      if(compact&&page)bottom.querySelector('[data-page="'+page+'"]')?.focus({preventScroll:true});
    }
    root.style.setProperty('--adaptive-nav-bottom',compact?Math.ceil(bottom.getBoundingClientRect().height+24)+'px':'0px');
  }
  const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(measure);};
  const resize=new win.ResizeObserver(schedule);resize.observe(sidebar);resize.observe(bottom);
  const mutation=new win.MutationObserver(schedule);mutation.observe(root,{attributes:true,attributeFilter:['data-text-scale']});
  win.addEventListener('resize',schedule);
  doc.fonts?.addEventListener?.('loadingdone',schedule);
  doc.fonts?.ready.then(schedule);
  measure();
  return ()=>{resize.disconnect();mutation.disconnect();win.removeEventListener('resize',schedule);doc.fonts?.removeEventListener?.('loadingdone',schedule);if(frame)win.cancelAnimationFrame(frame);probe.remove();};
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installAdaptiveNavigation(),{once:true});
 else installAdaptiveNavigation();
}
