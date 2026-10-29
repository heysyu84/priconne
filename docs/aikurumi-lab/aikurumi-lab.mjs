import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs';
import {filterReviewItems,reviewFlags,reviewSummary} from './aikurumi-review-filters.mjs';
import {classifySourceTactic,OPERATION_LABELS} from './aikurumi-operation-types.mjs';
import {findNonOverlappingStage3} from './aikurumi-stage3-composer.mjs';
import {parseStage3CarryTime,carryTimeLabel,formatCarrySeconds} from './aikurumi-stage3-carry.mjs';
import {groupAikurumiVideos,collectionTotals} from './aikurumi-youtube-collections.mjs';

const el=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('ko-KR');
const url=value=>{try{const u=new URL(String(value));return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
const state=flags=>(flags||[]).map((v,i)=>'<span title="'+(i===5?'AUTO':String(i+1)+'번 캐릭터')+'" class="'+(v?'on':'off')+'">'+(i===5?'A':i+1)+(v?'●':'○')+'</span>').join(' ');
const list=el('list'),detail=el('detail'),boss=el('boss'),filter=el('filter'),query=el('search');
const stagePicker=el('month'),operationFilter=el('operation'),composePanel=el('stage3-section');
const viewMode=el('view-mode'),videoPanel=el('youtube-collections'),videoOutput=el('collection-output');
let videoNavigation=[];
let items=[],selected=null,sourceData=null;
const sourceCache=new Map();
let youtubeReview=null,youtubeReviewState='pending',youtubeReviewPromise=null;
function sourceKey(stage,boss,taskId,linkIndex,ordinal){
  return [stage,boss,taskId,linkIndex??ordinal,ordinal].join(':');
}
function youtubePreviewFor(item){
 if(!youtubeReview?.references)return null;
 const id=sourceKey(sourceData?.stage,item.boss.index,item.task.id,item.link?.index,item.ordinal??item.id.split(':').at(-1));
 return youtubeReview._byKey?.get(id)||null;
}
function loadYouTubePreviews(){
 if(youtubeReviewPromise)return youtubeReviewPromise;
 youtubeReviewPromise=fetch('./aikurumi-youtube-candidates.json',{cache:'no-store'}).then(async response=>{
   if(!response.ok)throw Error('자동 수집 결과가 아직 생성되지 않았습니다.');
   const data=await response.json();
   if(data.schema!=='nyang-youtube-tactic-candidates-v1'||data.readOnly!==true||
      data.registrationAllowed!==false||!Array.isArray(data.references))throw Error('안전하지 않은 자동 수집 데이터');
   if(Date.now()>=Date.parse(data.expiresAt))throw Error('자동 수집 결과가 만료되었습니다. 재수집이 필요합니다.');
   data._byKey=new Map(data.references.map(r=>[sourceKey(r.stage,r.boss,r.taskId,r.linkIndex,r.linkOrdinal),r]));
   youtubeReview=data;youtubeReviewState='ready';
 }).catch(e=>{youtubeReviewState=e.message;}).then(()=>{
    if(items.length&&viewMode.value==='tactics')drawList();
 });
 return youtubeReviewPromise;
}
function youtubeAutoPanel(item){
 const source=youtubePreviewFor(item);
 if(youtubeReviewState!=='ready')return '<div class="youtube-auto-status">'+esc(
   youtubeReviewState==='pending'?'API 수집 결과 확인 중…':youtubeReviewState)+'</div>';
 if(!source)return '<div class="youtube-auto-status">이 출처에 해당하는 유튜브 자동 수집 결과가 없습니다.</div>';
 const labels={candidate:'자동 변환 후보',partial:'부분 변환 · 원문 확인 필수',
 'needs-translation-review':'일본어 해석 필요','needs-source-check':'구간 확인 필요',
 'no-parsable-timeline':'조작문 미검출','empty-description':'설명란 비어 있음',
 'video-unavailable':'영상 조회 불가'};
 const reason={ 'shared-video-without-sections':'한 영상에 여러 택틱이 있어 구간을 확정할 수 없음',
 'no-unique-damage-section':'원본 피해량과 일치하는 고유 구간을 찾지 못함',
 'multiple-options-no-damage-marker':'같은 보스의 택틱이 여러 개이며 식별값 부족',
 'boss-section-not-found':'이 영상의 해당 보스 구간을 찾지 못함',
 'multiple-timelines-without-sections':'같은 설명란에 둘 이상의 조작문이 있음',
 'section-contains-multiple-damage-codes':'하나의 구간에 여러 피해량 표기가 존재함',
 'same-damage-multiple-options':'피해량이 같은 택틱들이 있어 편성을 식별할 수 없음'};
 const converted=source.rows?.length?source.rows.map((r,i)=>
   '<div class="step"><div class="step-head"><span class="step-text">'+esc(r.text)+'</span>'
   +'<span class="state">'+state(r.checked)+'</span></div></div>').join(''):'';
 return '<div class="youtube-auto-status"><strong>'+esc(labels[source.status]||'검토 필요')+'</strong>'
   +' · 영상 연결 '+esc(source.videoId)+' · 자동 분리 '+esc(source.matching||'미확인')+'</div>'
   +(reason[source.matching]?'<p class="review">'+esc(reason[source.matching])+'</p>':'')
   +(converted?'<div class="youtube-auto-rows"><h4>일본어 설명란에서 자동 변환한 한국어 조작문 · '+source.rows.length+'행</h4>'
      +converted+'</div>':'<p class="muted">안전하게 대응시킬 수 있는 한국어 조작문이 아직 없습니다.</p>')
   +(source.omittedRows?'<p class="review">미해석·불확실한 원문 '+source.omittedRows+'행은 표시에서 제외했습니다. 영상 원본 확인 필수.</p>':'')
   +(source.issues?.length?'<p class="muted">확인 항목: '+esc(source.issues.join(' / '))+'</p>':'')
   +'<p class="muted">영상 설명란 원문은 공개 저장하지 않습니다. 출처 링크에서 일본어 원문을 확인하세요. 이 결과는 검토 후보이며 자동 등록되지 않습니다.</p>';
}

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
 const carry=Number(sourceData?.stage)===3?parseStage3CarryTime(item.link?.name):null;
 const carryDetail=carry?.seconds===null?'원본에 명시된 이월시간 없음':carry?.status==='full'?'풀 이월 · 1:30 (90초)':carry?'격파 '+formatCarrySeconds(90-carry.remainingSeconds)+' 경과 · 잔여 '+carry.remainingSeconds+'초 + 추가 '+carry.bonusSeconds+'초 = 이월 '+formatCarrySeconds(carry.seconds):'';
 const link=url(p.sourceUrl);
 const isYouTube=!!link&&(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtu.be'].includes(new URL(link).hostname));
 const youtubePanel=isYouTube?'<section class="youtube-paste"><details open><summary>YouTube 설명란 · API 자동 TL 변환 및 원문 대조</summary>'
  +youtubeAutoPanel(item)
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
  +(carry?detailPair('3단계 격파 후 이월',carryDetail):'')
  +'<div class="stat"><span class="label">원본 영상 · 페이지</span><strong>'+(link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">원본 열기</a>':'링크 없음')+'</strong></div></div>'
  +'<span class="label">편성 / 성급 / 랭크 (일본 서버 원본)</span>'+party+warn
  +'<div class="compare-grid"><section><h3>한국어 변환 결과 · '+p.rows.length+'행</h3><div class="steps">'+rows+'</div></section>'
  +'<section><h3>원문 전체 · 대조용</h3><pre class="raw-full">'+raw+'</pre>'+notes+'</section></div>'
  +youtubePanel
  +'<p class="muted">위 조작문은 검토용 변환 결과입니다. 관리자 확인 없이 택틱 등록이나 기존 자료 변경은 수행되지 않습니다.</p>';
}


async function allPreviewSnapshots(){
  return Promise.all([3,6].map(async st=>{
    if(sourceCache.has(st))return sourceCache.get(st);
    const file=st===3?'./aikurumi-snapshot-stage3.json':'./aikurumi-snapshot.json';
    const response=await fetch(file,{cache:'no-store'});
    if(!response.ok)throw Error(st+'단계의 유튜브 원본 데이터를 불러오지 못했습니다. HTTP '+response.status);
    const data=await response.json();
    if(data.readOnly!==true||Number(data.stage)!==st||!Array.isArray(data.bosses))throw Error('검증되지 않은 원본 단계: '+st);
    sourceCache.set(st,data);
    return data;
  }));
}
function updateViewMode(){
 const videos=viewMode.value==='videos';
 videoPanel.hidden=!videos;
 el('tactic-panes').hidden=videos;
 composePanel.hidden=videos||Number(sourceData?.stage)!==3;
 for(const id of ['month','boss','operation','filter','search']){
   const control=el(id);
   if(control)control.disabled=videos;
 }
 if(videos)renderYouTubeCollections();
}
async function renderYouTubeCollections(){
 videoOutput.innerHTML='<p class="muted">3단계와 4단계 유튜브 출처를 비교하는 중…</p>';
 try {
   const snapshots=await allPreviewSnapshots();
   if(viewMode.value!=='videos')return;
   const groups=groupAikurumiVideos(snapshots),totals=collectionTotals(groups);
   const repeatedOnly=el('repeated-only').checked;
   el('collection-status').textContent='유튜버 '+totals.creators+'명 · 서로 다른 영상 '+totals.videos+'개 · 원본 택틱 연결 '+totals.references+'건 · 반복 연결 영상 '+totals.repeatedVideos+'개';
   videoNavigation=[];
   const shown=groups.map(creator=>({...creator,
     videos:creator.videos.filter(v=>!repeatedOnly||v.references.length>1)})).filter(creator=>creator.videos.length);
   videoOutput.innerHTML=shown.length?shown.map((creator,i)=>
      '<details class="video-creator" '+(i<2?'open':'')+'><summary>'+esc(creator.creator)
      +' · 영상 '+creator.videos.length+'개 / 택틱 링크 '+creator.videos.reduce((n,v)=>n+v.references.length,0)+'건</summary>'
      +creator.videos.map(video=>
        '<section class="video-card"><h4>'+esc(video.label)+'</h4><div class="video-meta">영상 ID '+esc(video.videoId)
        +' · '+video.distinctBosses+'개 보스·단계 · '+video.references.length+'개 택틱 링크'
        +(video.creatorNames.length>1?' · 출처 표기: '+esc(video.creatorNames.join(', ')):'')+'</div>'
        +'<a href="https://www.youtube.com/watch?v='+encodeURIComponent(video.videoId)+'" target="_blank" rel="noopener noreferrer">유튜브 원본 영상 열기</a>'
        +'<div class="video-references">'+video.references.map(ref=>{
          const navIndex=videoNavigation.push(ref)-1;
          const originalUrl=url(ref.sourceUrl);
          const safeSource=originalUrl&&new URL(originalUrl).hostname.match(/^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)$/)
            ?originalUrl:'https://www.youtube.com/watch?v='+encodeURIComponent(video.videoId);
          return '<div class="video-reference"><span>'+esc(ref.stage===3?'3단계':'4단계')+' · '+esc(ref.boss)+'넴 · #'+esc(ref.taskId)+'</span>'
            +'<small>'+esc(ref.sourceTitle.replace(/\s+/g,' ').trim())+'</small>'
            +(ref.startSeconds!==null?'<small>영상 시작 '+Math.floor(ref.startSeconds/60)+':'+String(ref.startSeconds%60).padStart(2,'0')+'</small>':'')
            +'<a href="'+esc(safeSource)+'" target="_blank" rel="noopener noreferrer">시간 지정 원본</a>'
            +'<button type="button" data-video-reference="'+navIndex+'">택틱 검토하기</button></div>';
        }).join('')+'</div></section>'
      ).join('')+'</details>'
     ).join(''):'<p class="muted">조건에 맞는 영상 모음이 없습니다.</p>';
 }catch(e){videoOutput.innerHTML='<p class="warnings">'+esc(e.message)+'</p>';}
}
viewMode.addEventListener('change',updateViewMode);
el('repeated-only').addEventListener('change',renderYouTubeCollections);
videoOutput.addEventListener('click',async event=>{
 const btn=event.target.closest('button[data-video-reference]');
 if(!btn)return;
 const idx=Number(btn.dataset.videoReference),ref=videoNavigation[idx];
 if(!Number.isInteger(idx)||!ref)return;
 viewMode.value='tactics';
 // loadStage is intentionally awaited so cross-stage links are selected correctly.
 await loadStage(ref.stage);
 updateViewMode();
 const match=items.find(x=>Number(x.boss.index)===ref.boss&&
   String(x.task.id)===String(ref.taskId)&&
   Number(x.link?.index)===Number(ref.linkIndex)&&
   x.id.endsWith(':'+ref.linkOrdinal));
 if(match){
   selected=match.id;
   boss.value=String(ref.boss);filter.value='all';operationFilter.value='all';query.value='';
   drawList();
   el('tactic-panes').scrollIntoView?.({behavior:'smooth',block:'start'});
 }
});

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
   +' · 캐릭터 25명 전원 중복 없음 · 원본 피해량 합계 '+number(solution.totalDamage)
   +' · 이월 '+solution.knownCarryCount+'/5개 확인 ('+solution.totalCarrySeconds+'초 합계)</h3>'
   +'<div class="compose-list">'+solution.lineup.map(row=>'<div class="compose-boss"><b>'+esc(row.boss)+'넴 · '+esc(row.bossName)+'</b>'
    +'<small>'+esc(row.characterNames.join(' / '))+'</small>'
    +'<small>'+esc(OPERATION_LABELS[row.operation])+' · 원본 딜 '+number(row.score)+'</small>'
    +'<strong class="compose-carry">'+esc(carryTimeLabel(row.carry))+'</strong>'
    +(row.carry?.status==='remaining-plus-bonus'?'<small>잔여 '+row.carry.remainingSeconds+'초 + 추가 '+row.carry.bonusSeconds+'초'
      +' · 격파까지 '+(90-row.carry.remainingSeconds)+'초</small>':'')
    +'<button type="button" data-compose-task="'+esc(row.taskId)+'" data-compose-boss="'+esc(row.boss)+'" data-compose-link="'+esc(row.sourceLinkIndex??'')+'">#'+esc(row.taskId)+' 검토하기</button></div>').join('')+'</div></div>'
 ).join('')+'<p class="stage3-notice">캐릭터 중복 0명을 우선하고, 원본 피해량이 같은 경우 표기된 이월시간이 긴 조합을 우선합니다. 이월시간 합계는 개별 격파의 비교 지표이며 실제로 동시에 보유하는 이월타 합계가 아닙니다. 시간 미표기는 추측하지 않습니다.</p>';
}
el('compose-button')?.addEventListener('click',showStage3Composer);
el('compose-output')?.addEventListener('click',event=>{
 const btn=event.target.closest('button[data-compose-task]');if(!btn)return;
 const found=items.find(x=>Number(x.task.id)===Number(btn.dataset.composeTask)&&
   Number(x.boss.index)===Number(btn.dataset.composeBoss)&&
   String(x.link?.index??'')===String(btn.dataset.composeLink??''));
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
  composePanel.hidden=viewMode.value==='videos'||stage!==3;
  el('compose-output').innerHTML='<p class="muted">중복 없는 조합 찾기를 누르면 이 단계의 실제 외부 편성을 계산합니다.</p>';
  drawList();
  loadYouTubePreviews();
 }catch(e){
  items=[];composePanel.hidden=true;
  list.innerHTML='<p class="empty">'+esc(e.message)+'</p>';
  detail.innerHTML='<p class="empty">다른 단계로 변경하거나 수집 자료 상태를 확인하세요.</p>';
 }
}
loadStage(6);
