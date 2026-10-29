import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs';
import {filterReviewItems,reviewFlags,reviewSummary} from './aikurumi-review-filters.mjs';

const el=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('ko-KR');
const url=value=>{try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
const state=flags=>(flags||[]).map((v,i)=>'<span title="'+(i===5?'AUTO':String(i+1)+'번 캐릭터')+'" class="'+(v?'on':'off')+'">'+(i===5?'A':i+1)+(v?'●':'○')+'</span>').join(' ');
const list=el('list'),detail=el('detail'),boss=el('boss'),filter=el('filter'),query=el('search');
let items=[],selected=null;

function visible(){
 return filterReviewItems(items,{boss:boss.value,mode:filter.value,query:query.value});
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
  return '<button type="button" class="item '+(x.id===selected?'selected':'')+'" data-item="'+esc(x.id)+'" aria-current="'+(x.id===selected?'true':'false')+'">'
   +'<div class="item-title"><span>'+esc(x.boss.index)+'넴 · '+esc(party.join(' / '))+'</span><span class="'+s.style+' item-status">'+s.text+'</span></div>'
   +'<small>#'+esc(x.task.id)+' · '+esc(x.link.name||'원본 링크 없음')+' · '+(p.rows.length?p.rows.length+'행':'조작문 없음')+'</small></button>';
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
 const p=item.preview,f=reviewFlags(p),s=statusLabel(p);
 const link=url(p.sourceUrl);
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
  +'<div class="stat"><span class="label">원본 영상 · 페이지</span><strong>'+(link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">원본 열기</a>':'링크 없음')+'</strong></div></div>'
  +'<span class="label">편성 / 성급 / 랭크 (일본 서버 원본)</span>'+party+warn
  +'<div class="compare-grid"><section><h3>한국어 변환 결과 · '+p.rows.length+'행</h3><div class="steps">'+rows+'</div></section>'
  +'<section><h3>원문 전체 · 대조용</h3><pre class="raw-full">'+raw+'</pre>'+notes+'</section></div>'
  +'<p class="muted">위 조작문은 검토용 변환 결과입니다. 관리자 확인 없이 택틱 등록이나 기존 자료 변경은 수행되지 않습니다.</p>';
}
list.addEventListener('click',event=>{
 const button=event.target.closest('button[data-item]');if(!button)return;
 selected=button.dataset.item;drawList();
});
detail.addEventListener('click',event=>{
 const button=event.target.closest('button[data-nav]');if(!button)return;
 const results=visible(),i=results.findIndex(x=>x.id===selected);
 if(i<0)return;
 selected=results[(i+(button.dataset.nav==='next'?1:-1)+results.length)%results.length]?.id??null;
 drawList();
});
[boss,filter].forEach(x=>x.addEventListener('change',()=>{list.scrollTop=0;drawList();}));
query.addEventListener('input',()=>{list.scrollTop=0;drawList();});
async function init(){
 try{
  const res=await fetch('./aikurumi-snapshot.json',{cache:'no-store'});
  if(!res.ok)throw Error('외부 수집 자료를 읽지 못했습니다. HTTP '+res.status);
  const data=await res.json();
  if(data.readOnly!==true||!Array.isArray(data.bosses)||!data.characterData)
    throw Error('검증되지 않은 자료 형식입니다.');
  el('month').innerHTML='<option>'+esc(data.krMonth)+' 한섭 / '+esc(data.jpMonth)+' 일섭 / stage '+esc(data.stage)+'</option>';
  boss.innerHTML='<option value="all">전체 보스</option>'+data.bosses.map(x=>'<option value="'+esc(x.index)+'">'+esc(x.index)+'넴 · '+esc(x.unitName)+'</option>').join('');
  for(const b of data.bosses)for(const t of b.tasks||[]){
    const links=t.links?.length?t.links:[{index:0,name:'원본 링크 없음',remarks:''}];
    for(const [i,link] of links.entries()){
      const preview=previewAikurumiTactic(t,link,{unitMap:data.characterData.names,
        positionUnits:data.characterData.positionUnits,stage:data.stage,bossSlot:b.index,
        bossNames:data.bosses.map(boss=>boss.unitName)});
      items.push({id:[b.index,t.id,link.index??i,i].join(':'),boss:b,task:t,link,preview});
    }
  }
  drawList();
 }catch(e){
  list.innerHTML='<p class="empty">'+esc(e.message)+'</p>';
  detail.innerHTML='<p class="empty">테스트 자료를 정상적으로 불러오지 못했습니다. 해당 브랜치의 수집 상태를 확인하세요.</p>';
 }
}
init();
