const STORAGE_KEY='nyang-display-text-scale-v1';
const MOBILE_MIGRATION_KEY='nyang-display-mobile-base-110-v1';
export const TEXT_SCALE_PRESETS=[100,115,130,150,175,200];
export function normalizeTextScale(value){const n=Number(value);return Number.isFinite(n)?Math.min(200,Math.max(100,Math.round(n/5)*5)):100;}
function browserStorage(){try{return globalThis.localStorage;}catch{return null;}}
export function readTextScale(storage=browserStorage()){try{return normalizeTextScale(storage?.getItem(STORAGE_KEY)??100);}catch{return 100;}}
/* Earlier mobile defaults used 115% as a workaround for tiny text.
   The new mobile baseline is readable at 100%, so migrate that one old
   preference only once. All other personally selected percentages remain. */
export function migrateMobileTextScale(storage=browserStorage(),isMobile=false){
  const prior=readTextScale(storage);
  if(!isMobile)return prior;
  try{
    if(storage?.getItem(MOBILE_MIGRATION_KEY)==='1')return prior;
    const legacy=storage?.getItem(STORAGE_KEY);
    const next=legacy!==null&&normalizeTextScale(legacy)===115?100:prior;
    if(next!==prior)storage.setItem(STORAGE_KEY,String(next));
    storage?.setItem(MOBILE_MIGRATION_KEY,'1');
    return next;
  }catch{return prior;}
}
export function saveTextScale(value,storage=browserStorage()){const scale=normalizeTextScale(value);try{storage?.setItem(STORAGE_KEY,String(scale));}catch{}return scale;}
export function applyTextScale(value,root){const scale=normalizeTextScale(value);root.dataset.textScale=String(scale);root.style.setProperty('--user-text-scale',String(scale/100));return scale;}

function install(){
  let scale=applyTextScale(migrateMobileTextScale(browserStorage(),window.matchMedia('(max-width:800px)').matches),document.documentElement),dialog;
  function sync(){
    if(!dialog)return;
    dialog.querySelector('[data-display-range]').value=String(scale);
    dialog.querySelector('[data-display-value]').textContent=scale+'%';
    for(const button of dialog.querySelectorAll('[data-display-scale]'))button.setAttribute('aria-pressed',String(Number(button.dataset.displayScale)===scale));
    const width=Math.round(document.querySelector('.content')?.getBoundingClientRect().width||window.innerWidth);
    dialog.querySelector('[data-display-width]').textContent=width.toLocaleString('ko-KR')+'px';
  }
  function choose(value){scale=applyTextScale(saveTextScale(value),document.documentElement);sync();}
  function open(){
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='display-dialog';dialog.setAttribute('aria-labelledby','display-settings-title');
      dialog.innerHTML=`<div class="display-dialog-head"><h2 id="display-settings-title">화면 · 글자 크기</h2><button type="button" class="btn sm" data-display-close aria-label="화면 설정 닫기">닫기</button></div><div class="display-dialog-body"><p class="display-copy">모니터와 시력에 맞춰 글자 크기를 조절하세요. 선택한 크기는 이 브라우저에 저장됩니다.</p><div class="display-scale-label"><label for="display-text-scale">글자 크기</label><output data-display-value for="display-text-scale"></output></div><input id="display-text-scale" data-display-range type="range" min="100" max="200" step="5" aria-label="글자 크기"><div class="display-presets" role="group" aria-label="글자 크기 선택">${TEXT_SCALE_PRESETS.map(n=>`<button type="button" class="btn" data-display-scale="${n}" aria-pressed="false">${n}%</button>`).join('')}</div><div class="display-example"><strong>미리보기 · 1일차 4단계</strong><span>피해량 123,456,789 · 기여도 12,345,678</span><span>0:35 캐릭터 순으로 ON, OFF</span></div><div class="display-width-info"><span>현재 본문 너비 <output data-display-width></output></span><button type="button" class="btn sm" data-display-copy>화면 정보 복사</button></div><p class="display-copy-result" data-display-result role="status"></p><button type="button" class="btn" data-display-scale="100">기본 크기로 초기화</button></div>`;
      document.body.append(dialog);
      dialog.addEventListener('input',event=>{if(event.target.matches('[data-display-range]'))choose(event.target.value);});
      dialog.addEventListener('click',async event=>{
        const preset=event.target.closest('[data-display-scale]');if(preset)choose(preset.dataset.displayScale);
        if(event.target.closest('[data-display-close]'))dialog.close();
        if(event.target.closest('[data-display-copy]')){
          const width=Math.round(document.querySelector('.content')?.getBoundingClientRect().width||window.innerWidth);
          try{await navigator.clipboard.writeText(`본문 너비 ${width}px / 브라우저 안쪽 너비 ${window.innerWidth}px / 사이트 글자 크기 ${scale}%`);dialog.querySelector('[data-display-result]').textContent='화면 정보를 복사했습니다.';}
          catch{dialog.querySelector('[data-display-result]').textContent='본문 너비 '+width+'px · 글자 크기 '+scale+'%';}
        }
      });
    }
    sync();dialog.querySelector('[data-display-result]').textContent='';dialog.showModal();
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-display-open]'))open();});
  window.addEventListener('resize',sync);
  window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){scale=applyTextScale(readTextScale(),document.documentElement);sync();}});
}
if(typeof document!=='undefined')install();
