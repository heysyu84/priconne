// Measure actual menu typography instead of guessing a resolution breakpoint.
export function compactNavigation(viewport, available, required, compact=false) {
  return viewport<=800 || available<required+(compact?12:0);
}
// Keep all eight destinations readable even when desktop UI text is enlarged.
export function bottomNavigationColumns(availableWidth, itemWidth) {
  const perItem=Math.max(1,itemWidth);
  return availableWidth>=8*perItem+8?8:availableWidth>=4*perItem+8?4:2;
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
  const toolbar=doc.querySelector('.topbar .top-actions');
  const logo=sidebar.querySelector('.logo');
  const toolbarProbe=doc.createElement('header');
  toolbarProbe.className='topbar';
  toolbarProbe.dataset.toolbarProbe='';
  toolbarProbe.setAttribute('aria-hidden','true');
  toolbarProbe.inert=true;
  if(toolbar){
    const sample=toolbar.cloneNode(true);
    for(const el of sample.querySelectorAll('[id]'))el.removeAttribute('id');
    toolbarProbe.append(sample);
    doc.body.append(toolbarProbe);
  }
  let frame=0,compact=false;
  function measure(){
    frame=0;
    const viewport=root.clientWidth;
    probe.style.width=sidebar.getBoundingClientRect().width+'px';
    const style=win.getComputedStyle(probe);
    const available=probe.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0);
    const gap=parseFloat(style.columnGap)||0;
    const widestLabel=Math.max(0,...[...probe.children].map(b=>Math.max(b.getBoundingClientRect().width,b.scrollWidth)));
    const needed=Math.ceil(widestLabel*buttons.length+gap*Math.max(0,buttons.length-1)+buttons.length*5);
    compact=compactNavigation(viewport,available,needed,compact);
    const layout=compact?'compact':'wide';
    if(root.dataset.navLayout!==layout){
      const active=doc.activeElement,page=active?.closest?.('.nav')?.dataset.page;
      root.dataset.navLayout=layout;
      if(compact&&page)bottom.querySelector('[data-page="'+page+'"]')?.focus({preventScroll:true});
    }
    if(toolbar){
      const currentStatus=toolbar.querySelector('.status')?.textContent||'';
      const sampledStatus=toolbarProbe.querySelector('.status');
      if(sampledStatus&&sampledStatus.textContent!==currentStatus)sampledStatus.textContent=currentStatus;
      const intrinsicWidth=toolbarProbe.querySelector('.top-actions')?.getBoundingClientRect().width||0;
      const wordmarkWidth=logo?.getBoundingClientRect().width||175;
      // Measure the natural row, never its already-shrunk stacked presentation.
      const stacked=compact&&(intrinsicWidth+wordmarkWidth+42>viewport);
      const toolbarLayout=stacked?'stacked':'inline';
      if(root.dataset.topbarLayout!==toolbarLayout)root.dataset.topbarLayout=toolbarLayout;
    }
    if(compact){
      // Measure intrinsic label widths independently of current grid columns.
      // A DOM range remains accurate if a wide label overflows its grid cell.
      const bottomStyle=win.getComputedStyle(bottom);
      const bottomWidth=bottom.clientWidth-(parseFloat(bottomStyle.paddingLeft)||0)-(parseFloat(bottomStyle.paddingRight)||0);
      const itemWidth=Math.ceil(Math.max(0,...[...bottom.querySelectorAll('button')].map(button=>{
        const textNode=[...button.childNodes].find(node=>node.nodeType===3&&node.textContent.trim());
        const range=doc.createRange();
        if(textNode)range.selectNodeContents(textNode);
        else range.selectNodeContents(button);
        const labelWidth=range.getBoundingClientRect().width;
        const iconWidth=button.querySelector('span')?.getBoundingClientRect().width||0;
        const buttonStyle=win.getComputedStyle(button);
        return Math.max(labelWidth,iconWidth)+(parseFloat(buttonStyle.paddingLeft)||0)+(parseFloat(buttonStyle.paddingRight)||0)+4;
      })));
      const columns=bottomNavigationColumns(bottomWidth,itemWidth);
      if(bottom.dataset.navColumns!==String(columns))bottom.dataset.navColumns=String(columns);
    }else{
      delete bottom.dataset.navColumns;
    }
    root.style.setProperty('--adaptive-nav-bottom',compact?Math.ceil(bottom.getBoundingClientRect().height+24)+'px':'0px');
  }
  const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(measure);};
  const resize=new win.ResizeObserver(schedule);resize.observe(sidebar);resize.observe(bottom);if(toolbar)resize.observe(toolbar);
  const mutation=new win.MutationObserver(schedule);mutation.observe(root,{attributes:true,attributeFilter:['data-text-scale']});
  win.addEventListener('resize',schedule);
  doc.fonts?.addEventListener?.('loadingdone',schedule);
  doc.fonts?.ready.then(schedule);
  measure();
  return ()=>{resize.disconnect();mutation.disconnect();win.removeEventListener('resize',schedule);doc.fonts?.removeEventListener?.('loadingdone',schedule);if(frame)win.cancelAnimationFrame(frame);probe.remove();toolbarProbe.remove();};
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>installAdaptiveNavigation(),{once:true});
 else installAdaptiveNavigation();
}
