import {buildReviewItems,reviewDraft,validateReviewDraft,damageLabel,findImportedTactic,safeUrl,isYouTube} from './aikurumi-review-model.mjs';
import {findNonOverlappingStage3} from './aikurumi-stage3-composer.mjs';
import {previewAikurumiTactic} from './aikurumi-tactic-review.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>value===null||value===''||value===undefined?'—':Math.floor(Number(value)/60)+':'+String(Number(value)%60).padStart(2,'0');
const date=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'확인 중';};
const opOptions=[['all','전체 유형'],['full-auto','풀오토'],['semi-auto','세미오토'],['easy-manual','간단손컨'],['manual','손컨'],['carry','이월용']];
const select=(field,value,options,label)=>'<label class="review-filter"><span>'+label+'</span><select data-review-filter="'+field+'" aria-label="'+label+'">'+options.map(([k,v])=>'<option value="'+k+'" '+(String(value)===String(k)?'selected':'')+'>'+escape(v)+'</option>').join('')+'</select></label>';
const button=(label,action,more='')=>'<button type="button" class="review-button" data-review-action="'+action+'" '+more+'>'+label+'</button>';
const field=(label,key,value,extra='')=>'<label class="review-field"><span>'+label+'</span><input data-review-field="'+key+'" value="'+escape(value)+'" '+extra+'></label>';

export function createExternalReview(options={}){return new ReviewWorkspace(options);}
class ReviewWorkspace{
 constructor({getContext=()=>({}),onApply=null,onOpen=null,onCreateMonth=null,renderPortrait=null,fetcher=(...args)=>fetch(...args)}={}){
  Object.assign(this,{getContext,onApply,onOpen,onCreateMonth,renderPortrait,fetcher});
  this.snapshots=[];this.youtube=null;this.items=[];this.drafts=new Map();this.editing=new Set();
  this.stage=4;this.boss='all';this.operation='all';this.status='all';this.query='';this.view='tactics';
  this.selected='';this.listOpen=true;this.message='';this.error='';this.pending=false;this.ready=false;this.loading=null;
 }
 mount(root){
  if(this.root===root)return;
  this.abort?.abort();this.root=root;this.abort=new AbortController();
  for(const kind of ['click','change','input'])root.addEventListener(kind,event=>this.event(event),{signal:this.abort.signal});
  this.draw();if(!this.ready)this.load();
 }
 async load(){
  if(this.loading)return this.loading;
  this.error='';this.loading=(async()=>{
   try{
    const values=await Promise.all(['aikurumi-snapshot-stage3.json','aikurumi-snapshot.json','aikurumi-youtube-candidates.json'].map(async file=>{
     const response=await this.fetcher(new URL('./'+file,import.meta.url),{cache:'no-store'});
     if(!response.ok)throw Error(file.includes('candidates')?'유튜브 수집 자료를 불러오지 못했습니다.':'택틱 자료를 불러오지 못했습니다.');
     return response.json();
    }));
    if(values.slice(0,2).some(s=>s.readOnly!==true||!Array.isArray(s.bosses)||!s.characterData)||values[0].stage!==3||values[1].stage!==6)
     throw Error('택틱 자료를 확인하지 못했습니다.');
    if(values[2].schema!=='nyang-youtube-tactic-candidates-v1'||!Array.isArray(values[2].references))throw Error('유튜브 수집 자료를 확인하지 못했습니다.');
    this.snapshots=values.slice(0,2);this.youtube=values[2];
    this.items=this.snapshots.flatMap(s=>buildReviewItems(s,this.youtube));this.ready=true;
    for(const draft of this.drafts.values())draft.confirmed=false;
    if(!this.items.some(i=>i.key===this.selected))this.selected=this.visible()[0]?.key||'';
   }catch(error){this.error=error.message;}
   finally{this.loading=null;this.draw();}
  })();return this.loading;
 }
 context(){return this.getContext()||{};}
 canApply(){return !!this.onApply&&this.context().canEdit===true;}
 draft(item){if(!this.drafts.has(item.key))this.drafts.set(item.key,reviewDraft(item));return this.drafts.get(item.key);}
 current(){return this.items.find(i=>i.key===this.selected);}
 existing(item){const context=this.context();return findImportedTactic(context.seasons?.[item.month],item);}
 bossName(item){return this.context().bossNames?.[item.month]?.[item.boss]||item.bossName;}
 visible(){
  const query=this.query.trim().toLocaleLowerCase('ko-KR');
  return this.items.filter(item=>item.stage===this.stage&&(this.boss==='all'||String(item.boss)===this.boss)
   &&(this.operation==='all'||this.operation==='carry'&&item.task.type===1||item.operation===this.operation)
   &&(!query||[...item.party,item.creator,item.link.name,this.bossName(item)].join(' ').toLocaleLowerCase('ko-KR').includes(query))
   &&(this.status==='all'||this.status==='youtube'&&item.source==='youtube'||this.status==='check'&&item.problems.length>0
     ||this.status==='reviewed'&&this.draft(item).confirmed||this.status==='applied'&&!!this.existing(item)))
   .sort((a,b)=>a.boss-b.boss||(b.damage.value||0)-(a.damage.value||0)||a.ordinal-b.ordinal);
 }
 badge(item){return this.existing(item)?['applied','적용됨']:this.draft(item).confirmed?['verified','검수 완료']:
  item.problems.length?['check','확인 필요']:['ready','검수 대기'];}
 draw(){
  if(!this.root?.isConnected)return;
  const listScroll=this.root.querySelector('.review-list')?.scrollTop||0;
  const source=this.snapshots.find(s=>(s.stage===3?3:4)===this.stage),month=source?.krMonth?.replace('-','.')||'2026.11';
  const fetched=this.youtube?.videoCount??0,requested=this.youtube?.requestedVideoCount??new Set(this.items.map(i=>i.candidate?.videoId).filter(Boolean)).size;
  this.root.innerHTML='<div class="external-review">'
   +'<div class="review-heading"><div><h2>외부 택틱</h2><p>'+escape(month)+' · '+this.stage+'단계</p></div><div class="review-heading-actions">'
   +button('자료 새로고침','refresh',this.loading?'disabled':'')+'</div></div>'
   +'<div class="review-views" role="group" aria-label="외부 택틱 보기">'+[['tactics','택틱 검수'],['videos','유튜브 모음'],['compose','3단계 조합']].map(([key,label])=>
    '<button type="button" data-review-action="view" data-value="'+key+'" class="'+(this.view===key?'active':'')+'" aria-pressed="'+(this.view===key)+'">'+label+'</button>').join('')+'</div>'
   +(this.error?'<p class="review-error" role="alert">'+escape(this.error)+'</p>':'')
   +(this.message?'<p class="review-message" role="status">'+escape(this.message)+'</p>':'')
   +(!this.ready?'<div class="review-empty" role="status">'+(this.error?'자료를 다시 불러와 주세요.':'택틱을 불러오는 중…')+'</div>':
    '<div class="review-fetch-status"><span class="review-status-dot"></span><span>유튜브 설명란 <strong>'+fetched+(requested?' / '+requested:'')+'개</strong> 수집 · '+escape(date(this.youtube.fetchedAt))+'</span>'
    +(Date.parse(this.youtube.expiresAt)<=Date.now()?'<strong class="review-attention">갱신 필요</strong>':'')+'</div>'
    +(this.view==='videos'?this.videoView():this.view==='compose'?this.composeView():this.tacticsView()))+'</div>';
  const list=this.root.querySelector('.review-list');if(list)list.scrollTop=listScroll;
 }
 tacticsView(){
  const visible=this.visible();
  if(!visible.some(i=>i.key===this.selected))this.selected=visible[0]?.key||'';
  return '<div class="review-filters">'+select('stage',this.stage,[[4,'4단계'],[3,'3단계']],'단계')
   +select('boss',this.boss,[['all','전체 보스'],...[1,2,3,4,5].map(n=>[n,n+'넴'])],'보스')
   +select('operation',this.operation,opOptions,'택틱 유형')
   +select('status',this.status,[['all','전체'],['check','확인 필요'],['youtube','일본어 TL'],['reviewed','검수 완료'],['applied','적용됨']],'검수 상태')
   +'<label class="review-search"><span class="sr-only">캐릭터·제작자 검색</span><input type="search" data-review-search value="'+escape(this.query)+'" placeholder="캐릭터·제작자 검색"></label></div>'
   +'<div class="review-layout '+(this.listOpen?'is-list-open':'')+'"><aside class="review-listpane"><div class="review-list-heading"><strong>택틱 '+visible.length+'개</strong><span>보스 · 기대딜 순</span></div><div class="review-list">'
   +(visible.length?visible.map(item=>this.listItem(item)).join(''):'<p class="review-empty">조건에 맞는 택틱이 없습니다.</p>')+'</div></aside><section class="review-detail" aria-label="택틱 검수">'+this.detailView(this.current())+'</section></div>';
 }
 listItem(item){
  const [state,label]=this.badge(item);
  return '<button type="button" class="review-item '+(item.key===this.selected?'active':'')+'" data-review-action="select" data-key="'+escape(item.key)+'" aria-current="'+(item.key===this.selected)+'">'
   +'<span class="review-item-top"><b class="review-boss review-boss-'+item.boss+'">'+item.boss+'넴</b><strong>'+damageLabel(item.damage.value)+'</strong><span class="review-badge '+state+'">'+label+'</span></span>'
   +'<strong class="review-item-party">'+escape(item.party.join(' · '))+'</strong><span class="review-item-meta">'+escape(item.creator)+' · '+escape(item.operationLabel)
   +(item.stage===3&&item.carry!==null?' · 이월 '+time(item.carry):'')+'</span></button>';
 }
 detailView(item){
  if(!item)return '<p class="review-empty">택틱을 선택해 주세요.</p>';
  const draft=this.draft(item),editing=this.editing.has(item.key),[state,label]=this.badge(item),previous=this.existing(item);
  const context=this.context(),monthExists=!!context.seasons?.[item.month];
  const names=item.party.map((name,i)=>'<div class="review-unit">'+(this.renderPortrait?'<span class="review-unit-face">'+this.renderPortrait(name,draft.stars[i])+'</span>':'')
   +'<strong>'+escape(name)+'</strong><span>'+draft.stars[i]+'성 · R'+(item.conditions.ranks[i]||'—')+'</span></div>').join('');
  const youtube=item.source==='youtube',sourceUrl=safeUrl(item.link.link);
  const conditionFields=item.conditions.fields.map(f=>'<div><dt>'+escape(f.label)+'</dt><dd>'+escape(f.value)+'</dd></div>').join('');
  const sourceNotice=youtube?(item.candidate?.rows?.length?'일본어 TL 자동 수집':'일본어 TL 확인 필요'):
   (isYouTube(item.link.link)?'일본어 TL 없음 · ai쿠루미 TL 사용':'ai쿠루미 TL');
  return '<div class="review-detail-heading"><div><span class="review-badge '+state+'">'+label+'</span><h3>'+item.boss+'넴 · '+escape(this.bossName(item))+'</h3><p>'+escape(item.creator)+' · '+escape(item.operationLabel)+'</p></div><div class="review-detail-nav">'
   +button('목록','list')+button('이전','previous','aria-label="이전 택틱"')+button('다음','next','aria-label="다음 택틱"')+'</div></div>'
   +'<div class="review-party">'+names+'</div>'
   +'<section class="review-metadata"><div class="review-section-heading"><h4>기대딜</h4><span>'+escape(item.damage.basis)+'</span></div>'
   +'<div class="review-damage-entry">'+field('억 단위','damage',draft.damage,'type="number" min="0" max="1000" step="any" placeholder="미표기"')
   +(item.damage.options.length>1?'<div class="review-damage-options">'+item.damage.options.map(value=>button(damageLabel(value),'damage-option','data-value="'+value+'"')).join('')+'</div>':'')+'</div></section>'
   +'<section class="review-conditions"><div class="review-section-heading"><h4>택틱 조건</h4><span>'+(youtube&&item.candidate?.conditions?.tp?'유튜브':'ai쿠루미')+' 기준</span></div>'
   +'<div class="review-condition-inputs">'+field('초동 TP','tp',draft.tp,'placeholder="미표기" maxlength="40"')
   +field('손컨 횟수','hands',draft.hands,'type="number" min="0" max="200" step="1" placeholder="미확인"')
   +(item.stage===3?field('예상 이월 · 초','carry',draft.carry,'type="number" min="0" max="90" placeholder="미표기"'):'')+'</div>'
   +(conditionFields?'<dl class="review-condition-list">'+conditionFields+'</dl>':'')
   +'<details class="review-fold"><summary>육성 조건·메모</summary><label class="review-field"><span>적용할 메모</span><textarea data-review-field="note" rows="3" placeholder="추가 조건">'+escape(draft.note)+'</textarea></label>'
   +(item.preview.notes?'<details><summary>조건 원문</summary><pre>'+escape(item.preview.notes)+'</pre></details>':'')+'</details></section>'
   +'<section class="review-timeline"><div class="review-section-heading"><div><h4>조작문</h4><span>'+sourceNotice+'</span></div><div>'
   +(sourceUrl?'<a class="review-button" href="'+escape(sourceUrl)+'" target="_blank" rel="noopener noreferrer">원본 '+(isYouTube(sourceUrl)?'영상':'자료')+' ↗</a>':'')
   +button(editing?'수정 마침':'TL 수정','edit')+'</div></div>'
   +(item.problems.length?'<div class="review-findings">'+item.problems.map(p=>'<span>'+escape(p)+'</span>').join('')+'</div>':'')
   +this.timeline(item,draft,editing)
   +(editing?'<div class="review-row-actions">'+button('행 추가','add-row')+'</div><details class="review-fold"><summary>설명란 직접 붙여넣기</summary><textarea data-review-paste rows="5" placeholder="해당 택틱의 일본어 TL만 붙여넣으세요."></textarea>'
    +button('TL 변환','convert')+'<p class="review-paste-status" role="status"></p></details>':'')
   +'<details class="review-fold"><summary>ai쿠루미 참고 원문</summary><pre>'+escape(item.preview.sourceText||item.link.name||'본문 없음')+'</pre></details></section>'
   +'<section class="review-apply"><div class="review-section-heading"><h4>사이트에 적용</h4><span>'+item.month.replace('-','.')+' · '+item.stage+'단계</span></div>'
   +(this.canApply()?'<div class="review-apply-options">'+(item.stage===4?'<label class="review-field"><span>분류</span><select data-review-field="category">'+[['main','택틱정리'],['tabi','타비비토'],['carry','이월 택틱']].map(([v,l])=>'<option value="'+v+'" '+(draft.category===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>':'')
    +(item.stage===4&&draft.category==='carry'?field('필요 이월 · 초','requiredCarrySeconds',draft.requiredCarrySeconds,'type="number" min="1" max="90" placeholder="입력"'):'')
    +'<label class="review-field"><span>대여 캐릭터</span><select data-review-field="support"><option value="-1">미지정</option>'+item.party.map((n,i)=>'<option value="'+i+'" '+(Number(draft.support)===i?'selected':'')+'>'+escape(n)+'</option>').join('')+'</select></label></div>'
    +(!monthExists?'<label class="review-confirm"><input type="checkbox" data-review-field="createMonth" '+(draft.createMonth?'checked':'')+'> '+item.month.replace('-','.')+' 월을 새로 만들고 적용</label>':'')
    +'<label class="review-confirm"><input type="checkbox" data-review-field="confirmed" '+(draft.confirmed?'checked':'')+'> 원본의 조작·누락 구간과 조건을 확인했습니다.</label>'
    +(previous?'<p class="review-existing">같은 출처에서 적용한 택틱이 있습니다. 수정한 내용으로 업데이트합니다.</p>':'')
    +'<div class="review-apply-actions"><button type="button" class="review-button primary" data-review-action="apply" '+(this.pending||!draft.confirmed||!draft.rows.length||!monthExists&&!draft.createMonth?'disabled':'')+'>'
     +(this.pending?'저장 중…':previous?'검수 내용 업데이트':item.stage===3?'3단계 조합에 적용':draft.category==='carry'?'이월 택틱에 적용':'4단계 조합·택틱에 적용')+'</button>'
    +(previous?button('적용한 택틱 열기','open-applied'):'')+'</div><p class="review-apply-status" role="status"></p>'
    :'<p>관리자 모드에서 검수한 택틱을 적용할 수 있습니다.</p><a class="review-button" href="../#tactics/review">관리자 화면 열기</a>')+'</section>';
 }
 timeline(item,draft,editing){
  if(!draft.rows.length)return '<div class="review-empty">자동으로 변환된 조작문이 없습니다. 원본을 확인하고 TL을 입력해 주세요.</div>';
  return '<div class="review-grid-wrap"><table class="review-grid"><thead><tr><th class="review-line-number">행</th>'+item.party.map((name,i)=>'<th title="'+escape(name)+'">'+(i+1)+'</th>').join('')
   +'<th class="review-auto">AUTO</th><th class="review-instruction">조작문</th>'+(editing?'<th class="review-remove"><span class="sr-only">삭제</span></th>':'')+'</tr></thead><tbody>'
   +draft.rows.map((row,index)=>'<tr><td class="review-line-number">'+(index+1)+'</td>'+row.checked.map((on,column)=>'<td class="review-set '+(on?'on':'')+'">'
    +(editing?'<input type="checkbox" data-review-row="'+index+'" data-column="'+column+'" aria-label="'+(index+1)+'행 '+escape(column===5?'AUTO':item.party[column])+' SET" '+(on?'checked':'')+'>':
     '<span aria-label="'+(on?'ON':'OFF')+'">'+(on?'●':'·')+'</span>')+'</td>').join('')
    +'<td class="review-instruction">'+(editing?'<textarea rows="1" data-review-row="'+index+'" aria-label="'+(index+1)+'행 조작문">'+escape(row.text)+'</textarea>':escape(row.text))+'</td>'
    +(editing?'<td class="review-remove"><button type="button" data-review-action="remove-row" data-index="'+index+'" aria-label="'+(index+1)+'행 삭제">×</button></td>':'')+'</tr>').join('')+'</tbody></table></div>';
 }
 videoView(){
  const groups=new Map();
  for(const item of this.items){if(!isYouTube(item.link.link))continue;let id=item.candidate?.videoId;
   if(!id){const u=new URL(item.link.link);id=u.searchParams.get('v')||u.pathname.split('/').filter(Boolean)[0];}
   if(!groups.has(item.creator))groups.set(item.creator,new Map());
   const videos=groups.get(item.creator);if(!videos.has(id))videos.set(id,[]);videos.get(id).push(item);
  }
  return '<div class="review-video-groups">'+[...groups].sort((a,b)=>a[0].localeCompare(b[0],'ko')).map(([creator,videos])=>
   '<details class="review-video-creator" open><summary>'+escape(creator)+' <span>'+videos.size+'개 영상</span></summary>'+[...videos].map(([id,items])=>
    '<section class="review-video"><div class="review-section-heading"><h4>택틱 '+items.length+'개</h4><a href="https://www.youtube.com/watch?v='+encodeURIComponent(id)+'" target="_blank" rel="noopener noreferrer">영상 열기 ↗</a></div><div class="review-video-items">'
    +items.map(item=>'<button type="button" data-review-action="select" data-key="'+escape(item.key)+'"><b>'+item.stage+'단계 · '+item.boss+'넴</b><strong>'+escape(item.party.join(' · '))+'</strong><span>'+damageLabel(item.damage.value)+' · '+escape(item.operationLabel)+'</span></button>').join('')+'</div></section>').join('')+'</details>').join('')+'</div>';
 }
 composeView(){
  const snapshot=this.snapshots.find(s=>s.stage===3);if(!snapshot)return '';
  const result=findNonOverlappingStage3(snapshot,{operation:'full-auto',limit:3});this.solutions=[];
  return '<div class="review-compose"><div class="review-section-heading"><h3>풀오토 · 1~5넴 캐릭터 중복 없는 조합</h3></div>'
   +(!result.solutions.length?'<p class="review-empty">풀오토만으로 캐릭터가 겹치지 않는 1~5넴 조합을 찾지 못했습니다.</p>':'')
   +result.solutions.map((solution,index)=>{
    const items=solution.lineup.map(row=>this.items.find(i=>i.stage===3&&i.operation==='full-auto'&&i.boss===row.boss&&i.task.id===row.taskId&&String(i.link.index)===String(row.sourceLinkIndex)&&String(i.link.link||'')===row.sourceLink&&String(i.link.name||'')===row.sourceTitle));
    this.solutions.push(items);const verified=items.filter(i=>i&&this.draft(i).confirmed).length;
    return '<section class="review-compose-result"><div class="review-section-heading"><h4>'+(index?'대체 조합 '+index:'우선 추천')+'</h4><span>검수 '+verified+' / 5</span></div><div class="review-compose-bosses">'
     +solution.lineup.map((row,n)=>'<div><b class="review-boss review-boss-'+row.boss+'">'+row.boss+'넴</b><strong>'+escape(row.characterNames.join(' · '))+'</strong><span>풀오토 · 예상 이월 '+time(row.carry?.seconds)+'</span>'
      +(items[n]?button(this.draft(items[n]).confirmed?'검수 완료':'검수하기','select','data-key="'+escape(items[n].key)+'"'):'')+'</div>').join('')+'</div>'
     +(this.canApply()?(!this.context().seasons?.[snapshot.krMonth]?'<label class="review-confirm"><input type="checkbox" data-review-group-create '+(this.createMonthForGroup?'checked':'')+'> '+snapshot.krMonth.replace('-','.')+' 월을 새로 만들고 적용</label>':'')
      +button('검수한 5개 조합 적용','apply-group','data-index="'+index+'" '+(verified===5&&(this.context().seasons?.[snapshot.krMonth]||this.createMonthForGroup)?'':'disabled')):'')+'</section>';
   }).join('')+'</div>';
 }
 drawDetail(){const root=this.root.querySelector('.review-detail');if(root)root.innerHTML=this.detailView(this.current());}
 updateApplyState(){
  const item=this.current();if(!item)return;const draft=this.draft(item),exists=!!this.context().seasons?.[item.month];
  const apply=this.root.querySelector('[data-review-action="apply"]');if(apply)apply.disabled=this.pending||!draft.confirmed||!draft.rows.length||!exists&&!draft.createMonth;
  const check=this.root.querySelector('[data-review-field="confirmed"]');if(check)check.checked=draft.confirmed;
 }
 async apply(items){
  if(this.pending||!this.canApply())return;
  const entries=items.map(item=>({item,draft:this.draft(item)}));
  const errors=entries.flatMap(({item,draft})=>validateReviewDraft(item,draft));
  const output=this.root.querySelector('.review-apply-status');
  if(errors.length){if(output)output.textContent=errors[0];else{this.message=errors[0];this.draw();}return;}
  this.pending=true;this.updateApplyState();
  try{const result=await this.onApply(entries);this.message=result?.message||'사이트에 적용했습니다.';}
  catch(error){this.message=error.message||'저장하지 못했습니다.';}
  finally{this.pending=false;this.draw();}
 }
 event(event){
  const target=event.target;
  if(event.type==='input'&&target.matches('[data-review-search]')){
   const pos=target.selectionStart;this.query=target.value;this.draw();const search=this.root.querySelector('[data-review-search]');search?.focus();search?.setSelectionRange(pos,pos);return;
  }
  if(event.type==='change'&&target.dataset.reviewFilter){
   this[target.dataset.reviewFilter]=target.dataset.reviewFilter==='stage'?Number(target.value):target.value;this.listOpen=true;this.draw();return;
  }
  if(event.type==='change'&&target.matches('[data-review-group-create]')){this.createMonthForGroup=target.checked;this.draw();return;}
  const item=this.current();
  if((event.type==='input'||event.type==='change')&&item&&(target.dataset.reviewField||target.dataset.reviewRow!==undefined)){
   const draft=this.draft(item),key=target.dataset.reviewField;
   if(key){draft[key]=target.type==='checkbox'?target.checked:target.value;
    if(!['confirmed','createMonth'].includes(key)){draft.confirmed=false;draft.edited=true;}
    if(key==='category'){this.drawDetail();return;}
   }else{
    const row=draft.rows[Number(target.dataset.reviewRow)];if(!row)return;
    if(target.type==='checkbox')row.checked[Number(target.dataset.column)]=target.checked;else row.text=target.value;
    draft.confirmed=false;draft.edited=true;
   }
   this.updateApplyState();return;
  }
  if(event.type!=='click')return;
  const action=target.closest('[data-review-action]');if(!action||action.disabled)return;
  const kind=action.dataset.reviewAction;event.preventDefault();
  if(kind==='refresh'){this.load();return;}
  if(kind==='view'){this.view=action.dataset.value;this.draw();return;}
  if(kind==='select'){
   const next=this.items.find(i=>i.key===action.dataset.key);if(!next)return;
   this.stage=next.stage;this.boss='all';this.status='all';this.operation='all';this.query='';this.selected=next.key;this.view='tactics';this.listOpen=false;this.draw();
   this.root.querySelector('.review-detail')?.scrollIntoView({block:'start',behavior:'smooth'});return;
  }
  if(kind==='list'){this.listOpen=true;this.draw();this.root.querySelector('.review-listpane')?.scrollIntoView({block:'start',behavior:'smooth'});return;}
  if(kind==='previous'||kind==='next'){const list=this.visible(),index=list.findIndex(i=>i.key===this.selected);this.selected=list[(index+(kind==='next'?1:-1)+list.length)%list.length]?.key;this.draw();return;}
  if(kind==='apply-group'){const items=this.solutions?.[Number(action.dataset.index)];if(items?.length===5&&items.every(Boolean)){
   if(this.createMonthForGroup)for(const item of items)this.draft(item).createMonth=true;
   this.apply(items);
  }return;}
  if(!item)return;const draft=this.draft(item);
  if(kind==='edit'){this.editing.has(item.key)?this.editing.delete(item.key):this.editing.add(item.key);this.drawDetail();return;}
  if(kind==='damage-option'){draft.damage=Number(action.dataset.value);draft.confirmed=false;draft.edited=true;this.drawDetail();return;}
  if(kind==='add-row'){draft.rows.push({text:'',checked:[...(draft.rows.at(-1)?.checked||Array(6).fill(false))]});draft.confirmed=false;draft.edited=true;this.drawDetail();return;}
  if(kind==='remove-row'){draft.rows.splice(Number(action.dataset.index),1);draft.confirmed=false;draft.edited=true;this.drawDetail();return;}
  if(kind==='convert'){
   const text=this.root.querySelector('[data-review-paste]')?.value.trim();if(!text)return;
   const snapshot=this.snapshots.find(s=>s.stage===item.sourceStage),preview=previewAikurumiTactic(item.task,{...item.link,remarks:text},{unitMap:snapshot.characterData.names,positionUnits:snapshot.characterData.positionUnits,stage:item.sourceStage,bossSlot:item.boss,bossNames:snapshot.bosses.map(b=>b.unitName)});
   if(!preview.rows.length){this.root.querySelector('.review-paste-status').textContent='변환할 조작문을 찾지 못했습니다.';return;}
   draft.rows=preview.rows.map(r=>({text:r.text,checked:[...r.checked]}));draft.confirmed=false;draft.edited=true;this.drawDetail();return;
  }
  if(kind==='apply')this.apply([item]);
  if(kind==='open-applied'){const existing=this.existing(item);if(existing)this.onOpen?.({month:item.month,stage:item.stage,id:existing.id});}
 }
}
