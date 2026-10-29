import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs';

const byId=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const int=value=>Number.isFinite(Number(value))?Number(value).toLocaleString('ko-KR'):'—';
const checked=state=>(state||[]).map((on,index)=>'<span class="'+(on?'on':'off')+'">'+(index===5?'A':index+1)+(on?'●':'○')+'</span>').join(' ');
const validLink=value=>{try{const url=new URL(String(value));return /^https?:$/.test(url.protocol)?url.href:null;}catch{return null;}};
const list=byId('list'),details=byId('detail'),bossPicker=byId('boss'),filter=byId('filter'),query=byId('search');
let items=[],selectedId=null,loaded=null;

function current(){
 const boss=bossPicker.value,mode=filter.value,q=query.value.trim().toLocaleLowerCase('ko-KR');
 return items.filter(item=>{
  const p=item.preview;
  if(boss!=='all'&&String(item.boss.index)!==boss)return false;
  if(mode==='timeline'&&!p.timeline)return false;
  if(mode==='clean'&&(p.issues.length||!p.timeline))return false;
  if(mode==='warning'&&!p.issues.length)return false;
  if(mode==='notes'&&p.timeline)return false;
  if(q&&!([item.boss.unitName,item.task.id,item.link.name,...(p.matchedKoreanNames||[]),...p.originalLineup.map(c=>c.unitName)].join(' ').toLocaleLowerCase('ko-KR').includes(q)))return false;
  return true;
 });
}
function paint(){
 const filtered=current();
 byId('list-title').textContent='수집 자료 '+filtered.length+'건 / 전체 '+items.length+'건';
 if(!filtered.some(item=>item.id===selectedId))selectedId=filtered[0]?.id??null;
 list.innerHTML=filtered.length?filtered.map(item=>{
  const p=item.preview,warning=!!p.issues.length;
  return '<button class="item '+(item.id===selectedId?'selected':'')+'" data-item="'+escape(item.id)+'"><div class="item-title"><span>'
   +escape(item.boss.index)+'넴 · '+escape((p.matchedKoreanNames||p.originalLineup.map(c=>c.unitName)).join(' / '))
   +'</span><span class="'+(warning?'review':'ok')+'">'+(warning?'검토':'경고 없음')+'</span></div><small>'
   +'#'+escape(item.task.id)+' · '+escape(item.link.name||'링크 정보 없음')
   +' · '+(p.timeline?p.rows.length+'행':'본문 없음')+'</small></button>';
 }).join(''):'<p class="empty">해당 조건에 맞는 자료가 없습니다.</p>';
 paintDetail(filtered.find(item=>item.id===selectedId));
}
function paintDetail(item){
 if(!item){details.innerHTML='<p class="muted">선택된 택틱이 없습니다.</p>';return;}
 const {preview:p,task,link,boss}=item,source=validLink(p.sourceUrl);
 const notes=p.notes?'<details><summary>육성 조건 · 원문 메모</summary><pre>'+escape(p.notes)+'</pre></details>':'';
 const problems=p.issues.length?'<div class="warnings"><strong>자동 등록 금지 · 검토 필요</strong><ul>'
   +p.issues.map(issue=>'<li>'+escape(issue.message)+(issue.count?' ('+issue.count+')':'')+'</li>').join('')
   +'</ul>'+(p.unmappedActors.length?'<small>미매칭: '+escape(p.unmappedActors.join(', '))+'</small>':'')+'</div>':
   '<div class="notice">형식상의 경고가 없지만 원문의 실제 조작 의미는 사람이 확인해야 합니다. 등록 기능은 비활성입니다.</div>';
 details.innerHTML='<h2>'+escape(boss.index)+'넴 · '+escape(boss.unitName)+'</h2>'
  +'<p class="muted">원본 택틱 #'+escape(task.id)+' · 링크 '+escape(link.index??'—')+'</p>'
  +'<div class="data-grid"><div class="stat"><span class="label">자료 출처</span><strong>'+escape(p.sourceTitle||'aikurumi')+'</strong></div>'
  +'<div class="stat"><span class="label">피해량 (원본 수치)</span><strong>수동 '+int(p.damageRaw.manual)+' · 오토 '+int(p.damageRaw.auto)+'</strong></div>'
  +'<div class="stat"><span class="label">매칭 상태</span><strong>'+escape(p.characterMatchSource==='korean-unit-id'?'캐릭터 ID 정확 일치':'캐릭터 확인 필요')+'</strong></div>'
  +'<div class="stat"><span class="label">원본 링크</span><strong>'+(source?'<a href="'+escape(source)+'" target="_blank" rel="noopener noreferrer">원본 열기</a>':'링크 없음')+'</strong></div></div>'
  +'<span class="label">한국어 편성 · 성급 / 랭크</span><div class="party">'+p.originalLineup.map((c,i)=>
    '<div><strong>'+escape(p.matchedKoreanNames?.[i]||c.unitName||'미확인')+'</strong><small>'+escape(c.stars??'?')+'★ · R'+escape(c.rank??'?')+'</small></div>').join('')+'</div>'
  +problems+notes
  +'<details open><summary>변환된 상세 택틱 · '+p.rows.length+'행</summary><div>'
  +(p.rows.length?p.rows.map(row=>'<div class="step"><header><span class="step-text">'+escape(row.text)+'</span><span class="state">'+checked(row.checked)+'</span></header></div>').join(''):'<p class="muted">원본에 조작 타임라인이 없거나 변환할 수 없습니다.</p>')
  +'</div></details>'
  +'<details><summary>원본 텍스트 · 변환 대조</summary><pre>'+escape(p.sourceText||'원본 설명 없음')+'</pre></details>'
  +'<p class="muted">이 화면은 읽기 전용입니다. 택틱 작업실에 등록하거나 기존 내용을 덮어쓰는 작업은 수행하지 않습니다.</p>';
}
list.addEventListener('click',event=>{
 const target=event.target.closest('button[data-item]');if(!target)return;
 selectedId=target.dataset.item;paint();
});
[bossPicker,filter].forEach(el=>el.addEventListener('change',paint));
query.addEventListener('input',paint);

async function start(){
 try{
  const response=await fetch('./aikurumi-snapshot.json',{cache:'no-store'});
  if(!response.ok)throw Error('수집 스냅샷이 아직 생성되지 않았습니다. ('+response.status+')');
  const data=await response.json();
  if(!data.readOnly||!Array.isArray(data.bosses)||!data.characterData)
    throw Error('검토용 데이터 형식을 확인할 수 없습니다.');
  loaded=data;
  byId('month').innerHTML='<option>'+escape(data.krMonth)+' 한섭 / '+escape(data.jpMonth)+' 일섭 / '+escape(data.stage)+'단계</option>';
  bossPicker.innerHTML='<option value="all">전체 보스</option>'+data.bosses.map(b=>'<option value="'+escape(b.index)+'">'+escape(b.index)+'넴 · '+escape(b.unitName)+'</option>').join('');
  items=[];
  for(const boss of data.bosses){
   for(const task of boss.tasks||[]){
    const links=task.links?.length?task.links:[{index:0,name:'원본 링크 없음',remarks:''}];
    for(const [i,link]of links.entries()){
     const preview=previewAikurumiTactic(task,link,{
       unitMap:data.characterData.names,positionUnits:data.characterData.positionUnits,
       stage:data.stage,bossSlot:boss.index,bossNames:data.bosses.map(b=>b.unitName)
     });
     items.push({id:[boss.index,task.id,link.index??i,i].join(':'),boss,task,link,preview});
    }
   }
  }
  paint();
 }catch(error){list.innerHTML='<p class="empty">'+escape(error.message)+'</p>';details.innerHTML='<p class="empty">GitHub 테스트 브랜치에서 읽기 전용 수집 스냅샷을 만든 다음 확인할 수 있습니다.</p>';}
}
start();
