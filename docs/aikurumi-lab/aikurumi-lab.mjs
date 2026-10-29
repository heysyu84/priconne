import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs';
import {filterReviewItems,reviewFlags,reviewSummary} from './aikurumi-review-filters.mjs';
import {classifySourceTactic,OPERATION_LABELS} from './aikurumi-operation-types.mjs';
import {findNonOverlappingStage3} from './aikurumi-stage3-composer.mjs';

const el=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('ko-KR');
const url=value=>{try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
const state=flags=>(flags||[]).map((v,i)=>'<span title="'+(i===5?'AUTO':String(i+1)+'번 캐릭터')+'" class="'+(v?'on':'off')+'">'+(i===5?'A':i+1)+(v?'●':'○')+'</span>').join(' ');
const list=el('list'),detail=el('detail'),boss=el('boss'),filter=el('filter'),query=el('search');
const stagePicker=el('month'),operationFilter=el('operation'),composePanel=el('stage3-section');
let items=[],selected=null,sourceData=null;
const sourceCache=new Map();
const windowSafeUnitMap=()=>sourceData?.characterData?.names||{};
const windowSafePositions=()=>sourceData?.characterData?.positionUnits||[];
const bossNames=()=>sourceData?.bosses?.map(b=>b.unitName)||[];

function visible(){
 return filterReviewItems(items,{boss:boss.value,mode:filter.value,operation:operationFilter.value,query:query.value});
}
function statusLabel(p){
 const f=reviewFlags(p);
 if(f.notesOnly)return {text:'본문 없음',style:'muted'};
 if(f.hasUnknown)return {text:'행동 대상 확인',style:'review'};
 if(f.hasWarning)return {text:'미해석 경고',style:'review'};
 if(!f.noWarnings)return {text:'검토 필요',style:'review'};
 return {text:'형식 경고 없음',style:'ok'};
}
function drawList(){
 const filtered=visible(),all=reviewSummary(items),found=reviewSummary(filtered);
 el('list-title').textContent='외부 자료 '+found.total.toLocaleString('ko-KR')+'건 / 전체 '+all.total.toLocaleString('ko-KR')+'건';
 if(!filtered.some(x=>x.id===selected))selected=filtered[0]?.id??null;
 const y=list.scrollTop;
 list.innerHTML=filtered.length?filtered.map(x=>{
  const p=x.preview,s=statusLabel(p),party=p.matchedKoreanNames||p.originalLineup.map(c=>c.unitName);
  const category=classifySourceTactic(x.task,x.link);
  return '<button type="button" class="item '+(x.id===selected?'selected':'')+'" data-item="'+esc(x.id)+'" aria-current="'+(x.id===selected?'true':'false')+'">'
   +'<div class="item-title"><span>'+esc(x.boss.index)+'넴 · '+esc(party.join(' / '))+'</span><span class="'+s.style+' item-status">'+s.text+'</span></div>'
   +'<small>#'+esc(x.task.id)+' · '+esc(OPERATION_LABELS[category.operation])+(category.carry?' · 이월용':'')+' · '+esc(x.link.name||'원본 링크 없음')+' · '+(p.rows.length?p.rows.length+'행':'조작문 없음')+'</small></button>';
 }).join(''):'<p class="empty">선택한 조건에 맞는 자료가 없습니다.</p>';
 list.scrollTop=y;
 const sum=el('summary');
 if(sum)sum.textContent='전체 '+all.total+'건 · 조작문 '+all.timeline+'건 · 미해석 '+all.warning+'건 · 행동 대상 미확인 '+all.unknown+'건 · 본문 없음 '+all.notes+'건';
 drawDetail(filtered.find(x=>x.id===selected));
}
function detailPair(label,value){
 return '<div class="stat"><span class="label">'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
}
function drawDetail(item){
 if(!item){detail.innerHTML='<p class="muted">왼쪽에서 택틱을 선택해 주세요.</p>';return;}
 const p=item.preview,f=reviewFlags(p),s=statusLabel(p),category=classifySourceTactic(item.task,item.link);
 const link=url(p.sourceUrl);
 const isYouTube=!!link&&(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(new URL(link).hostname));
 const youtubePanel=isYouTube?'<section class="youtube-paste"><details><summary>YouTube 설명란 · 일본어 택틱 직접 대조</summary>'
  +'<p class="muted">원본 영상을 열어 설명란을 복사해 붙여넣으세요. 이 작업은 이 브라우저 화면에서만 진행되며 서버에 저장하지 않습니다.</p>'
  +'<textarea data-youtube-input rows="7" maxlength="10000" placeholder="유튜브 영상의 일본어 설명란을 여기에 붙여넣으세요."></textarea>'
  +'<div class="youtube-actions"><button type="button" data-youtube="preview">붙여넣은 TL 변환</button><button type="button" data-youtube="clear">비우기</button></div>'
  +'<div data-youtube-output aria-live="polite"></div></details></section>':'';
 const notes=p.notes?'<details><summary>육성·전투 조건 원문 ('+p.notes.split('\n').length+'행)</summary><pre>'+esc(p.notes)+'</pre></details>':'';
 const issues=[...p.issues.map(i=>i.message+(i.count?' ('+i.count+'건)':'')),...p.warnings];
 const unique=[...new Set(issues)];
 const warn=unique.length
  ?'<details class="warnings" open><summary>검토가 필요한 항목 '+unique.length+'건</summary><ul>'+unique.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul>'
   +(p.unmappedActors.length?'<p><strong>행동 대상 확인:</strong> '+esc(p.unmappedActors.join(', '))+'</p>':'')+'</details>'
  :'<p class="notice">기계적으로 검출된 오류는 없지만 조작 정확도는 미검증입니다. 원문과 대조하세요.</p>';
 const party='<div class="party">'+p.originalLineup.map((c,i)=>'<div><strong>'+esc(p.matchedKoreanNames?.[i]||c.unitName||'미확인')+'</strong><small>'
  +esc(c.stars??'?')+'★ · R'+esc(c.rank??'?')+'</small><small>ID '+esc(c.prefabId??'—')+'</small></div>').join('')+'</div>';
 const rows=p.rows.length?p.rows.map((r,i)=>'<div class="step '+(r.instruction?.includes('[원문 확인:')?'step-warning':'')+'"><div class="step-head">'
  +'<span class="step-text">'+esc(r.text)+'</span><span class="state">'+state(r.checked)+'</span></div>'
  +'<div class="source-line"><span>원문 근거 '+(i+1)+'</span> '+esc(r.source||'원문 근거 없음')+'</div></div>').join('')
  :'<p class="muted">변환 가능한 조작문이 없습니다. 원본 설명을 확인해 주세요.</p>';
 const raw=esc(p.sourceText||'원본 설명 없음');
 detail.innerHTML='<div class="detail-heading"><div><h2>'+esc(item.boss.index)+'넴 · '+esc(item.boss.unitName)+'</h2><p class="muted">택틱 #'+esc(item.task.id)+' · 원본 링크 '+esc(item.link.index??'—')+' · '+esc(s.text)+'</p></div>'
  +'<div class="nav-actions"><button type="button" data-nav="prev" aria-label="이전 택틱">이전</button><button type="button" data-nav="next" aria-label="다음 택틱">다음</button></div></div>'
  +'<div class="data-grid">'
  +detailPair('원본 출처',p.sourceTitle||'aikurumi')+detailPair('원본 딜 수치 · 만 단위',('수동 '+number(p.damageRaw.manual)+' / 오토 '+number(p.damageRaw.auto)))
  +detailPair('캐릭터 매칭',p.characterMatchSource==='korean-unit-id'?'5명 ID 매칭':'추가 확인 필요')
  +detailPair('원본 택틱 유형',OPERATION_LABELS[category.operation]+(category.carry?' · 이월용':'')+' ('+category.confidence+')')
  +'<div class="stat"><span class="label">원본 영상 · 페이지</span><strong>'+(link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">원본 열기</a>':'링크 없음')+'</strong></div></div>'
  +'<span class="label">편성 / 성급 / 랭크 (일본 서버 원본)</span>'+party+warn
  +'<div class="compare-grid"><section><h3>한국어 변환 결과 · '+p.rows.length+'행</h3><div class="steps">'+rows+'</div></section>'
  +'<section><h3>원문 전체 · 대조용</h3><pre class="raw-full">'+raw+'</pre>'+notes+'</section></div>'
  +youtubePanel
  +'<p class="muted">위 조작문은 검토용 변환 결과입니다. 관리자 확인 없이 택틱 등록이나 기존 자료 변경은 수행되지 않습니다.</p>';
}

function showStage3Composer(){
 const output=el('compose-output');
 if(!sourceData||Number(sourceData.stage)!==3){composePanel.hidden=true;return;}
 composePanel.hidden=false;
 const setting=el('compose-mode')?.value||'full-auto';
 const result=findNonOverlappingStage3(sourceData,{operation:setting,limit:3});
 if(!result.solutions.length){
   output.innerHTML='<p class="warnings">해당 유형에서 1~5넴 캐릭터가 한 명도 겹치지 않는 조합을 찾지 못했습니다. 조합 유형을 변경해 주세요.</p>'
   +'<p class="muted">보스별 후보: '+result.eligiblePerBoss.map(row=>row.boss+'넴 '+row.count+'개').join(' / ')+'</p>';
   return;
 }
 output.innerHTML=result.solutions.map((solution,i)=>
   '<div class="compose-result"><h3>'+(i===0?'우선 추천':'대체 조합 '+(i+1))
   +' · 캐릭터 25명 전원 중복 없음 · 원본 피해량 합계 '+number(solution.totalDamage)+'</h3>'
   +'<div class="compose-list">'+solution.lineup.map(row=>'<div class="compose-boss"><b>'+esc(row.boss)+'넴 · '+esc(row.bossName)+'</b>'
    +'<small>'+esc(row.characterNames.join(' / '))+'</small>'
    +'<small>'+esc(OPERATION_LABELS[row.operation])+' · 원본 딜 '+number(row.score)+'</small>'
    +'<button type="button" data-compose-task="'+esc(row.taskId)+'" data-compose-boss="'+esc(row.boss)+'">#'+esc(row.taskId)+' 검토하기</button></div>').join('')+'</div></div>'
 ).join('')+'<p class="stage3-notice">캐릭터 중복 0명을 우선하고, 조건을 만족하는 후보 내에서 원본 피해량 합계로 정렬합니다. 원본 수치는 보장 피해량이 아니며 육성 조건·이월 적용 여부를 별도 검토해야 합니다.</p>';
}
el('compose-button')?.addEventListener('click',showStage3Composer);
el('compose-output')?.addEventListener('click',event=>{
 const btn=event.target.closest('button[data-compose-task]');if(!btn)return;
 const found=items.find(x=>Number(x.task.id)===Number(btn.dataset.composeTask)&&
   Number(x.boss.index)===Number(btn.dataset.composeBoss));
 if(!found)return;
 boss.value='all';filter.value='all';operationFilter.value='all';query.value='';
 selected=found.id;drawList();
 detail.scrollIntoView?.({behavior:'smooth',block:'start'});
});

list.addEventListener('click',event=>{
 const button=event.target.closest('button[data-item]');if(!button)return;
 selected=button.dataset.item;drawList();
});
detail.addEventListener('click',event=>{
 const youtubeButton=event.target.closest('button[data-youtube]');
 if(youtubeButton){
   const entry=visible().find(x=>x.id===selected);
   const input=detail.querySelector('textarea[data-youtube-input]');
   const output=detail.querySelector('[data-youtube-output]');
   if(!entry||!input||!output)return;
   if(youtubeButton.dataset.youtube==='clear'){input.value='';output.innerHTML='';return;}
   if(youtubeButton.dataset.youtube!=='preview')return;
   const original=input.value.trim();
   if(!original){output.textContent='먼저 유튜브 영상 설명란을 붙여넣어 주세요.';return;}
   const data=items.find(x=>x.id===selected);
   const local=previewAikurumiTactic(data.task,{...data.link,remarks:original,name:'YouTube 설명란 (수동 입력)'},{
     unitMap:windowSafeUnitMap(),positionUnits:windowSafePositions(),
     stage:data.preview.stage,bossSlot:data.boss.index,bossNames:bossNames()
   });
   const findings=[...new Set([...local.issues.map(i=>i.message),...local.warnings])];
   output.innerHTML='<h4>YouTube 설명란 변환 · '+local.rows.length+'행 (미검증)</h4>'
     +(findings.length?'<p class="review">검토 필요: '+esc(findings.slice(0,8).join(' / '))+'</p>':'<p class="muted">형식 오류는 감지되지 않았지만 원문 대조가 필요합니다.</p>')
     +(local.rows.length?local.rows.map((r,i)=>'<div class="step"><div class="step-head"><span class="step-text">'+esc(r.text)+'</span><span class="state">'+state(r.checked)+'</span></div><div class="source-line">원문 근거 '+(i+1)+' '+esc(r.source||'')+'</div></div>').join(''):'<p class="muted">조작문이 없거나 해석할 수 없습니다.</p>')
     +'<p class="muted">저장·공유·자동 등록되지 않습니다.</p>';
   return;
 }
 const button=event.target.closest('button[data-nav]');if(!button)return;
 const results=visible(),i=results.findIndex(x=>x.id===selected);
 if(i<0)return;
 selected=results[(i+(button.dataset.nav==='next'?1:-1)+results.length)%results.length]?.id??null;
 drawList();
});
[boss,filter,operationFilter].forEach(x=>x.addEventListener('change',()=>{list.scrollTop=0;drawList();}));
stagePicker.addEventListener('change',()=>loadStage(Number(stagePicker.value)));
query.addEventListener('input',()=>{list.scrollTop=0;drawList();});
async function loadStage(stage){
 list.innerHTML='<p class="empty">선택한 단계의 자료를 불러오는 중입니다.</p>';
 try{
  const path=stage===3?'./aikurumi-snapshot-stage3.json':'./aikurumi-snapshot.json';
  let data=sourceCache.get(stage);
  if(!data){
    const res=await fetch(path,{cache:'no-store'});
    if(!res.ok)throw Error('선택한 단계의 외부 수집 자료를 읽지 못했습니다. HTTP '+res.status);
    data=await res.json();
    if(data.readOnly!==true||Number(data.stage)!==stage||!Array.isArray(data.bosses)||!data.characterData)
      throw Error('검증되지 않은 단계별 자료 형식입니다.');
    sourceCache.set(stage,data);
  }
  sourceData=data;items=[];selected=null;
  boss.value='all';filter.value='all';operationFilter.value='all';query.value='';
  const koreanStage=stage===3?'3단계':'4단계';
  stagePicker.value=String(stage);
  for(const opt of stagePicker.options||[]){
    if(Number(opt.value)===stage)opt.textContent=data.krMonth+' 한섭 · '+koreanStage+' (일섭 stage '+stage+')';
  }
  boss.innerHTML='<option value="all">전체 보스</option>'+
    data.bosses.map(b=>'<option value="'+esc(b.index)+'">'+esc(b.index)+'넴 · '+esc(b.unitName)+'</option>').join('');
  for(const b of data.bosses)for(const t of b.tasks||[]){
    const links=t.links?.length?t.links:[{index:0,name:'원본 링크 없음',remarks:''}];
    for(const [i,link] of links.entries()){
      const preview=previewAikurumiTactic(t,link,{unitMap:data.characterData.names,
        positionUnits:data.characterData.positionUnits,stage:data.stage,bossSlot:b.index,
        bossNames:data.bosses.map(boss=>boss.unitName)});
      items.push({id:[b.index,t.id,link.index??i,i].join(':'),boss:b,task:t,link,preview});
    }
  }
  composePanel.hidden=stage!==3;
  el('compose-output').innerHTML='<p class="muted">중복 없는 조합 찾기를 누르면 이 단계의 실제 외부 편성을 계산합니다.</p>';
  drawList();
 }catch(e){
  items=[];composePanel.hidden=true;
  list.innerHTML='<p class="empty">'+esc(e.message)+'</p>';
  detail.innerHTML='<p class="empty">다른 단계로 변경하거나 수집 자료 상태를 확인하세요.</p>';
 }
}
loadStage(6);
