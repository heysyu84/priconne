function visibleTactics(){const source=ext.stage===3?[...new Map([...data.tactics.filter(t=>t.stage===3),...(data.recommendations||[])].map(t=>[t.id,t])).values()]:data.tactics;return source.filter(t=>!t.deletedAt&&!t.hidden&&t.boss>0&&t.category!=='carry'&&t.stage===ext.stage&&(!ui.boss||t.boss===ui.boss)).sort((a,b)=>a.boss-b.boss||b.damage-a.damage);}
function completeBossFilter(){const values=[0,1,2,3,4,5,...(ui.section==='tactics'&&ui.tabs.tactics==='workspace'&&ext.stage===4?[-1]:[])];return `<div class="filter-group boss-filter" role="group" aria-label="보스 필터">${values.map(n=>`<button data-action="boss-filter" data-value="${n}" class="${ui.boss===n?'active':''}" style="${n>0?bossStyle(n):''}" aria-pressed="${ui.boss===n}">${n===0?'전체':n===-1?'미분류':n+'넴'}</button>`).join('')}</div>`;}
function parseDelimited(text,delimiter=','){const rows=[],row=[];let cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()))rows.push([...row]);row.length=0;cell='';}else cell+=c;}row.push(cell);if(row.some(v=>String(v).trim()))rows.push(row);return rows;}
function tacticStarString(t){return t.stars.map(n=>`<span class="${rarityClass(n)}">${n||'?'}</span>`).join('');}
function tacticRows(t){if(!t.rows){let previous=Array(6).fill(false);t.rows=t.text.split('\n').filter(Boolean).map(text=>{const checked=inferChecked(text,previous,t);previous=checked;return {id:uid(),text,checked};});}return t.rows;}
function activeTactic(){const t=tacticById(ui.selectedTactic);return t&&!t.deletedAt?t:null;}
const CARRY_TIME_RANGES=[['all','전체'],['20','20초대'],['30','30초대'],['40','40초대'],['50','50초+']];
function carryTimeRange(){return CARRY_TIME_RANGES.some(([key])=>key===ext.carryTimeRange)?ext.carryTimeRange:'all';}
function matchesCarryTimeRange(t){
 const range=carryTimeRange();if(range==='all')return true;
 const seconds=minimumCarry(t),start=Number(range);
 return Number.isFinite(seconds)&&seconds>=start&&(range==='50'||seconds<start+10);
}
function carryTimeFilter(){
 if(ext.workGroup!=='carry')return '';
 return `<select id="carry-time-range" class="carry-time-filter" data-input="v2-carry-time-range" aria-label="필요 이월시간으로 택틱 찾기">${CARRY_TIME_RANGES.map(([key,label])=>`<option value="${key}" ${carryTimeRange()===key?'selected':''}>${label}</option>`).join('')}</select>`;
}
function normalizeWorkspace(){
  if(ext.stage===3&&!thirdStageVisible()){ext.stage=4;ext.workGroup='main';ext.workEditing=false;}
  if((ext.workGroup==='hidden'&&!adminMode())||(ext.workGroup==='carry'&&!data.rules.carryVisible))ext.workGroup='main';
}
function workspaceGroups(archive){
  return [['main','택틱정리'],['tabi','타비비토'],['carry','이월 택틱'],['hidden','숨김']].filter(([key])=>
    (key!=='carry'||data.rules.carryVisible)&&(key!=='hidden'||!archive&&adminMode()));
}
function workspaceTactics(group,stage=ext.stage){
  const early=stage===3;
  const source=early?[...new Map(stage3RecommendationRecords().map(t=>[t.id,t])).values()]:data.tactics;
  return source.filter(t=>{
    if(t.deletedAt)return false;
    if(early)return !t.hidden&&t.category!=='carry';
    if(group==='hidden')return t.stage===4&&t.hidden;
    if(t.hidden)return false;
    if(group==='carry')return t.category==='carry';
    return t.stage===4&&(group==='all'?t.category!=='carry':t.category===group);
  });
}
function workspaceList(){
  normalizeWorkspace();
  const group=ext.workGroup;
  return workspaceTactics(group).filter(t=>(ext.stage===3||!ui.boss||(ui.boss===-1?!t.boss:t.boss===ui.boss))
    &&(group!=='carry'||matchesCarryTimeRange(t)))
    .sort((a,b)=>a.boss-b.boss||b.damage-a.damage);
}
function completeWorkspace(archive=false){
  normalizeWorkspace();
  const early=ext.stage===3;
  if(archive&&ext.workGroup==='hidden')ext.workGroup='main';
  const list=workspaceList(),groups=early?[]:workspaceGroups(archive);
  const tools=workspaceTools(archive);
  const navigation=early?(tools?`<div class="tactic-controls">${tools}</div>`:''):`<div class="tactic-controls">${tools}<div class="workspace-toolbar">${groups.length?`<div class="workspace-navigation" role="group" aria-label="택틱 분류">${groups.map(([key,name])=>`<button type="button" class="button ${ext.workGroup===key?'selected':''}" data-action="v2-work-group" data-value="${key}" aria-pressed="${ext.workGroup===key}">${name}<span class="count">${workspaceTactics(key).length}</span></button>`).join('')}</div>`:''}<div class="workspace-boss-filters">${bossFilter()}</div></div></div>`;
  if(early)return navigation+stage3Lineups(list,archive);
  const t=list.find(t=>t.id===ui.selectedTactic)||list[0];
  if(t&&ui.selectedTactic!==t.id){ui.selectedTactic=t.id;ui.carry=defaultReceivedTime(t);}
  const emptyMessage=ext.workGroup==='carry'&&carryTimeRange()!=='all'?'해당 시간대의 이월 택틱이 없습니다.':'등록된 택틱이 없습니다.';
  return navigation+recommendationDistribution()+`<div class="workbench workspace-restored"><aside class="work-library ${ui.libraryOpen?'expanded':''}"><div class="sheet-heading"><h2>택틱 목록 <small>${list.length}개</small></h2>${carryTimeFilter()}<button class="text-button mobile-only" data-action="toggle-library" aria-expanded="${ui.libraryOpen}">${ui.libraryOpen?'목록 닫기':'목록 열기'}</button></div><div class="work-list-reference-head" aria-hidden="true"><span>파티 · 전투 정보</span><span>기대딜</span></div><div class="work-list"><div class="work-list-column-heads" aria-hidden="true"><div class="work-list-fields"><span>보스</span><span>캐릭터명</span><span>성급</span><span>손컨</span><span>TP</span><span>기대딜</span></div><span>영상</span></div>${list.map(item=>workspaceListItem(item,t?.id)).join('')||'<p class="no-rows">택틱 없음</p>'}</div></aside><section class="work-editor" style="${t?.boss?bossStyle(t.boss):'--boss:#aeb5c1'}">${t?(archive?readOnlyWorkspaceTactic(t):workEditor(t)):`<p class="no-rows">${emptyMessage}</p>`}</section></div>`;
}
function stage3Lineups(list,archive){
  const groups=new Map();
  for(const t of list){
    if(!groups.has(t.boss))groups.set(t.boss,[]);
    groups.get(t.boss).push(t);
  }
  if(!groups.size)return '<p class="no-rows workspace-empty">등록된 3단계 조합이 없습니다.</p>';
  return `<div class="stage-lineups">${[...groups].map(([id,tactics])=>`<section class="stage-lineup-group" style="${id?bossStyle(id):''}"><h2><span>${id?id+'넴':'미분류'}</span>${id?X(bossBy(id).name):''}</h2>${tactics.map(t=>stage3Lineup(t,!archive&&adminMode())).join('')}</section>`).join('')}</div>`;
}
function stage3Lineup(t,canDelete=false){
  const time=value=>value==null?'—':X(value)+'초';
  const note=displayTacticNote(t);
  return `<article class="stage-lineup" data-lineup-id="${X(t.id)}"><div class="stage-lineup-party">${party(t)}</div><dl class="stage-lineup-stats"><div><dt>TP</dt><dd class="${tacticTpClass(t.tp)}">${X(t.tp||'—')}</dd></div><div><dt>필요 시간</dt><dd>${time(t.requiredSeconds)}</dd></div><div><dt>예상 이월</dt><dd>${time(t.remainingSeconds)}</dd></div></dl>${canDelete?`<div class="stage-lineup-links">${simpleButton('삭제','stage3-delete',t.id,'quiet danger')}</div>`:''}${note?`<p class="tactic-note">${X(note).replace(/\n/g,'<br>')}</p>`:''}</article>`;
}
function richInstruction(text){return X(text).replace(/(AUTO\s*(?:ON|온)|\bON\b|\bSET\b)/g,'<span class="action-on">$1</span>').replace(/(AUTO\s*(?:OFF|오프)|\bOFF\b)/g,'<span class="action-off">$1</span>').replace(/(한번만)/g,'<span class="action-once">$1</span>');}
function tacticInstructionMarkup(row,t,remaining=ui.carry){
  const base=t.duration||90;
  const prefix=/^\s*(\d{1,2}:\d{2}(?:\s*[~～–-]\s*\d{1,2}:\d{2})?)\s*/.exec(row.text);
  if(!prefix)return `<span class="tactic-time" aria-hidden="true">—</span><span class="tactic-instruction">${legacyTools.richLine(row,t.party,data.characters,remaining,base)}</span>`;
  const start=prefix[0].length;
  const body={text:row.text.slice(start)};
  if(row.runs?.map(run=>run.text).join('')===row.text){
    let offset=0;
    body.runs=row.runs.flatMap(run=>{
      const text=run.text.slice(Math.max(0,start-offset));
      offset+=run.text.length;
      return text?[{...run,text}]:[];
    });
  }
  const time=prefix[1].replace(/\s*([~～–-])\s*/g,'$1');
  return `<span class="tactic-time">${legacyTools.richLine({text:time},t.party,data.characters,remaining,base).replace(/([~～–-])/g,'$1<wbr>')}</span><span class="tactic-instruction">${legacyTools.richLine(body,t.party,data.characters,remaining,base)}</span>`;
}
function renderTacticGrid(t,editing=false){
  tacticProgress();
  const rows=tacticRows(t);
  const portraits=t.party.map((name,i)=>`<th scope="col" title="${X(name)}" aria-label="${X(name)} SET"><span class="set-character-face">${portraitHtml(name,t.stars[i])}</span></th>`).join('');
  const cells=rows.map((row,i)=>{
    const active=ext.tacticCursor?.[t.id]===row.id;
    const checks=Array.from({length:6},(_,j)=>`<td class="set-check ${j===5?'auto-cell':''}"><input type="checkbox" aria-label="${i+1}행 ${j===5?'AUTO':X(t.party[j])+' SET'}" data-input="v2-row-check" data-row="${X(row.id)}" data-column="${j}" ${row.checked[j]?'checked':''} ${!editing||!data.settings.editable?'disabled':''}></td>`).join('');
    const instruction=editing?`<textarea aria-label="${i+1}행 택틱" data-input="v2-row-text" data-row="${X(row.id)}" rows="1">${X(row.text)}</textarea>`:`<div class="tactic-instruction-line">${tacticInstructionMarkup(row,t)}</div>`;
    return `<tr data-row="${X(row.id)}" class="${active?'tactic-active-row':''}" aria-selected="${active}">${checks}<td class="instruction-cell">${instruction}</td>${editing?`<td><button type="button" data-action="v2-delete-row" data-id="${X(row.id)}" aria-label="${i+1}행 삭제">×</button></td>`:''}</tr>`;
  }).join('');
  return `<div class="table-wrap tactic-grid-wrap tactic-layout-inline workspace-timeline"><table class="set-grid" data-tactic-id="${X(t.id)}" tabindex="0" aria-label="택틱 본문"><colgroup>${Array(6).fill('<col class="set-check-col">').join('')}<col>${editing?'<col class="set-tools-col">':''}</colgroup><thead><tr>${portraits}<th class="set-auto" scope="col" title="AUTO" aria-label="AUTO"><span>A</span></th><th scope="col" class="instruction-heading">${editing?'시간 · 조작':'<span>시간</span><span>조작</span>'}</th>${editing?'<th scope="col" aria-label="행 관리"></th>':''}</tr></thead><tbody>${cells}</tbody></table></div>`;
}
function tacticReadingHeader(t,canEdit=adminMode(),controls=''){
  const note=displayTacticNote(t);
  const links=(t.links||[]).filter(link=>/^https?:\/\//i.test(link.url||''));
  const sources=links.length?`<div class="tactic-intro-links">${links.map(link=>`<a class="button source-link" href="${X(link.url)}" target="_blank" rel="noopener noreferrer">${X(link.label)}</a>`).join('')}</div>`:'';
  return `<div class="work-editor-head tactic-reading-head tactic-reference-head"><div class="tactic-reference-top"><div class="tactic-identity"><div class="tactic-title-line"><div class="tactic-reference-title">${t.boss?bossFace(t.boss,'tactic-reference-boss'):'' }<h2>${t.boss?X(t.boss+'넴 · '+bossBy(t.boss).name):'미분류'}</h2><span class="tactic-stage-badge">${t.stage}단계</span></div></div><dl class="tactic-specs"><div><dt>기대딜</dt><dd>${tacticDamageLabel(t)}<small>억</small></dd></div><div><dt>손컨</dt><dd class="${t.hands?'danger':''}">${tacticHands(t)}</dd></div><div><dt>TP</dt><dd class="${tacticTpClass(t.tp)}">${X(t.tp||'—')}</dd></div></dl></div><div class="tactic-header-party">${newParty(t,true)}</div>${sources}${note?`<div class="tactic-note tactic-reading-note">${X(note).replace(/\n/g,'<br>')}</div>`:''}${canEdit?`<div class="work-actions">${simpleButton('편성 수정','edit-tactic',t.id)}${simpleButton(t.hidden?'다시 표시':'숨기기','hide-tactic',t.id)}${simpleButton('복제','duplicate-tactic',t.id)}${simpleButton('삭제','delete-tactic',t.id,'danger')}</div>`:''}</div>${controls}</div>`;
}
function defaultReceivedTime(t){return t?.category==='carry'?90:t?.duration||90;}
function tacticCopyButtons(t,editable){
  return `<button type="button" class="button tactic-icon-button" data-action="copy-tactic" data-id="${X(t.id)}" aria-label="본문 복사" title="본문 복사">${icon('copy')}</button>${editable?`<button type="button" class="button tactic-set-copy" data-action="v2-copy-set" data-id="${X(t.id)}" aria-label="SET 포함 복사" title="SET 포함 복사">${icon('copy')}<span>SET</span></button>`:''}`;
}
function tacticControlBar(t,editable){
  const needed=t.category==='carry'?minimumCarry(t):null;
  const short=needed!==null&&ui.carry<needed;
  return `<div class="work-control-row tactic-control-bar"><div class="tactic-time-controls">${t.category==='carry'?`<span class="tactic-required-time">필요 <strong>${needed===null?'—':needed+'초'}</strong></span>`:''}<label class="tactic-received-time" for="workspace-carry">이월 시간 <input id="workspace-carry" type="text" data-input="v2-work-carry" value="${fmtTime(ui.carry)}" aria-label="이월 받은 시간" placeholder="1:10 / 70" title="분:초 또는 초로 입력" inputmode="text" autocapitalize="off" spellcheck="false"></label><button type="button" class="button tactic-icon-button" data-action="v2-carry-original" aria-label="이월 시간 초기화" title="이월 시간 초기화">${icon('reset')}</button></div><div class="tactic-copy-controls">${videoButton(t,false,'tactic-header')}${tacticCopyButtons(t,editable)}${editable?simpleButton(ext.workEditing?'편집 완료':'표 편집','v2-edit-grid','','primary'):''}</div>${t.category==='carry'?`<p class="carry-warning danger" ${short?'':'hidden'}>필요 이월보다 짧습니다.</p>`:''}</div>`;
}
function readOnlyWorkspaceTactic(t){return workEditor(t,true);}
function workEditor(t,archive=false){
  const editable=!archive&&adminMode(),editing=editable&&ext.workEditing;
  return tacticReadingHeader(t,editable,tacticControlBar(t,editable))
    +renderTacticGrid(t,editing)
    +(editable?`<div class="work-bottom"><div>${editing?simpleButton('행 추가','v2-add-row')+simpleButton('여러 행 붙여넣기','v2-paste-rows')+simpleButton('문장으로 SET 다시 계산','v2-restate'):''}${simpleButton('실행 취소','v2-row-undo')}${simpleButton('다시 실행','v2-row-redo')}</div><span id="tactic-save-state">${editing?'Enter 다음 행 · Shift+Enter 줄바꿈':''}</span></div>`:'')
    +(!archive&&ext.workGroup==='carry'&&adminMode()?`<div class="work-bottom">${simpleButton('이월 시트 가져오기','v2-import-carry')}</div>`:'');
}

function adjustedWithBase(text,remaining,base=90){return String(text).replace(/\b(\d{1,2}):(\d{2})\b/g,(all,m,s)=>{const time=Number(m)*60+Number(s);if(time>base||Number(s)>=60)return all;const shifted=time+remaining-base;return shifted>0?fmtTime(shifted):'—';});}
function fullTacticDetail(id){const t=tacticById(id);if(!t)return;ui.selectedTactic=t.id;openDrawer(`${t.boss}넴 ${tacticDamageLabel(t)}`,`${party(t)}<div class="tactic-metadata"><span class="${t.hands?'danger':''}">손컨 ${tacticHands(t)}</span> · <span class="${tacticTpClass(t.tp)}">TP ${X(t.tp||'—')}</span></div><div class="carry-inline"><label for="detail-carry">이월 받은 시간</label><input id="detail-carry" data-input="v2-detail-carry" value="${fmtTime(ui.carry)}" data-id="${t.id}"></div><div id="detail-timeline">${simpleTacticTimeline(t)}</div>${t.note?`<p class="tactic-note">${X(displayTacticNote(t))}</p>`:''}${t.video?`<a href="${X(t.video)}" class="plain-link" target="_blank" rel="noopener noreferrer">원본 영상</a>`:''}`,simpleButton('복사','copy-tactic',t.id)+(t.recommendationOnly?simpleButton('닫기','close-drawer'):simpleButton('작업실에서 열기','v2-open-workspace',t.id,'primary')),'',true);}

function simpleTacticTimeline(t){return rowTable(['남은 시간','조작'],tacticRows(t).map(r=>{const line=adjustedWithBase(r.text,ui.carry,t.duration||90),match=line.match(/^(\d+:\d{2}|—)\s*(.*)$/);return `<tr><td class="mono">${match?match[1]:'—'}</td><td>${richInstruction(match?match[2]:line)}</td></tr>`;}),'timeline-table');}
function editCompleteTactic(id=null){
 if(!ensureEdit())return;
 const t=data.tactics.find(t=>t.id===id)||{id:'',boss:ui.boss>0?ui.boss:0,stage:4,damage:0,hands:0,tp:'',party:data.characters.slice(0,5).map(c=>c.name),stars:[5,5,5,5,5],support:-1,category:ext.workGroup==='tabi'?'tabi':ext.workGroup==='carry'?'carry':'main',duration:90,text:'',note:'',video:'',links:[]};
 openDrawer(t.id?'택틱 설정':'택틱 추가',`<input name="tacticId" type="hidden" value="${t.id}"><input name="stage" type="hidden" value="4"><div class="carry-tactic-fields" ${t.category==='carry'?'':'hidden'}><div class="field"><label for="tactic-required-carry">필요 이월 · 초</label><input id="tactic-required-carry" name="requiredCarrySeconds" type="number" min="1" max="90" step="1" value="${minimumCarry(t)??''}" inputmode="numeric"></div><div class="field"><label for="tactic-duration">원문 시작시간</label><input id="tactic-duration" name="duration" value="${fmtTime(t.duration||90)}" inputmode="numeric"></div></div><div class="field-row"><div class="field"><label for="tactic-boss">보스</label><select id="tactic-boss" name="boss"><option value="0">미분류</option>${data.bossSettings.map(b=>`<option value="${b.id}" ${t.boss===b.id?'selected':''}>${b.id}넴 · ${X(b.name)}</option>`).join('')}</select></div><div class="field"><label for="tactic-category">분류</label><select id="tactic-category" name="category">${[['main','택틱정리'],['tabi','타비비토'],['carry','이월 택틱']].map(([key,label])=>`<option value="${key}" ${t.category===key?'selected':''}>${label}</option>`).join('')}</select></div></div><div class="tactic-condition-fields"><div class="field"><label for="tactic-damage">기대딜</label><input type="hidden" name="damageUnit" value="100000000"><input id="tactic-damage" name="damage" type="number" step="0.1" value="${t.damage}" required></div><div class="field"><label for="tactic-hands">손컨</label><input id="tactic-hands" name="hands" type="number" min="0" step="0.5" value="${t.hands??''}"></div><div class="field"><label for="tactic-tp">TP</label><input id="tactic-tp" name="tp" value="${X(t.tp)}"></div></div><div class="tactic-lineup-form">${Array.from({length:5},(_,i)=>`<div><label for="party-${i}">${i+1}번</label><select id="party-${i}" name="party-${i}">${data.characters.map(c=>`<option value="${X(c.name)}" ${c.name===t.party[i]?'selected':''}>${X(c.name)}</option>`).join('')}</select><select name="star-${i}" aria-label="${i+1}번 성급">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${n===Number(t.stars[i])?'selected':''}>${n}성</option>`).join('')}</select></div>`).join('')}</div><details class="form-fold" open><summary>본문 붙여넣기</summary><textarea id="tactic-text" name="text" aria-label="택틱 본문" rows="10">${X(t.text)}</textarea></details><details class="form-fold"><summary>메모·영상·서포트</summary><div class="field"><label for="tactic-note">육성 조건·메모</label><textarea id="tactic-note" name="note" rows="3">${X(displayTacticNote(t))}</textarea></div><div class="field"><label for="tactic-video">원본 영상</label><input id="tactic-video" name="video" type="url" value="${X(t.video||'')}"></div><div class="field"><label for="tactic-support">서포트 캐릭터</label><select id="tactic-support" name="support"><option value="-1" ${t.support<0?'selected':''}>없음</option>${[0,1,2,3,4].map(i=>`<option value="${i}" ${i===t.support?'selected':''}>${i+1}번째</option>`).join('')}</select></div></details>`,`<button type="button" class="button" data-action="close-drawer">취소</button><button type="submit" class="button primary">저장</button>`,'',true,'v2-tactic');
}

function saveCompleteTactic(form){const fd=new FormData(form),id=fd.get('tacticId'),duration=timeToSec(fd.get('duration'));if(!Number.isFinite(Number(fd.get('damage')))||Number(fd.get('damage'))<0){toast('기대딜은 0 이상으로 입력하세요.');return;}if(!Number.isFinite(duration)||duration<=0||duration>130){toast('원본 전투시간을 확인하세요.');return;}checkpoint();const old=data.tactics.find(t=>t.id===id),text=String(fd.get('text')),value={id:id||uid(),boss:Number(fd.get('boss')),stage:4,category:String(fd.get('category')),duration,requiredCarrySeconds:fd.get('requiredCarrySeconds')?Number(fd.get('requiredCarrySeconds')):null,damage:Number(fd.get('damage'))/(fd.get('damageUnit')==='1'?100000000:1),hands:Number(fd.get('hands')||0),tp:String(fd.get('tp')),party:Array.from({length:5},(_,i)=>String(fd.get('party-'+i))),stars:Array.from({length:5},(_,i)=>Number(fd.get('star-'+i))),support:Number(fd.get('support')),text,note:String(fd.get('note')),video:String(fd.get('video')),hidden:old?.hidden||false,links:old?.links||[],rows:old?.text===text?old.rows:null};value.title=value.party.join(' ');if(!value.rows)value.rows=pasteRows(value.text,value);if(old)Object.assign(old,value);else data.tactics.push(value);ui.selectedTactic=value.id;ext.stage=value.stage;ext.workGroup=value.category;ext.carryTimeRange='all';ui.carry=defaultReceivedTime(value);ui.boss=0;persist();closeDrawer();nav('tactics','workspace');toast('택틱 저장',true);}

// Keep the number input's step base aligned with manual decimal input.
document.addEventListener('input',event=>{const field=event.target;if(field?.id==='tactic-damage'&&field.value!==''&&Number.isFinite(Number(field.value)))field.setAttribute('value',field.value);},true);
function completeTrash(){const trashed=data.tactics.filter(t=>t.deletedAt);return `<div class="toolbar"><h2>삭제한 택틱 ${trashed.length}</h2>${simpleButton('작업실','v2-back-workspace')}</div>`+rowTable(['보스','편성','분류','삭제일','복원'],trashed.map(t=>`<tr><td>${t.boss?t.boss+'넴':'미분류'}</td><td>${X(t.party.join(' '))}</td><td>${t.category==='carry'?'이월 택틱':t.category==='tabi'?'타비비토':'택틱정리'}</td><td>${new Date(t.deletedAt).toLocaleDateString('ko-KR')}</td><td>${simpleButton('복원','v2-restore-tactic',t.id)}</td></tr>`));}
function completeCarry(){const b=bossBy(activeTactic()?.boss||ui.boss||1),fields=[['estimate-hp','보스 남은 HP',b.hp],['estimate-first','선통 예상 피해량',0],['estimate-second','후통 예상 피해량',300000000],['estimate-seconds','후통 전투시간 · 초',90]];return `<section class="carry-calculation "><div class="sheet-heading"><h2>선통·후통 예상 이월</h2></div><div class="estimate-fields">${fields.map(([id,label,val])=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" data-input="v2-estimate" value="${nf(ext.estimatorInputs?.[id]??val)}" inputmode="numeric"></div>`).join('')}</div><div class="estimate-result carry-estimate-summary"><div class="carry-estimate-metric" title="후통에서 보스 HP보다 초과한 피해량"><span>이월 보전 필요딜</span><strong id="estimate-break-even" class="mono">—</strong></div><div class="carry-estimate-metric"><span>예상 이월 시간</span><strong id="estimate-result" class="mono">—</strong></div>${simpleButton('택틱에 적용','v2-apply-estimate','','primary')}<span id="estimate-error" role="status"></span></div></section><section class="carry-calculation"><h2>격파 순간 남은 시간으로 계산</h2><div class="remaining-calculation"><label for="carry-remaining">남은 시간</label><input id="carry-remaining" data-input="v2-remaining-calculator" value="0:36" inputmode="numeric"><span>+ 20초 =</span><strong class="mono" id="carry-result">0:56</strong>${simpleButton('적용','v2-apply-remaining')}</div></section>`;}
function estimateResult(){const values=Object.fromEntries(['hp','first','second','seconds'].map(key=>[key,numberValue(document.getElementById('estimate-'+key)?.value)]));return engineEstimate(values);}
function carryDamageLabel(value){if(value>=100000000)return Number((value/100000000).toFixed(3)).toLocaleString('ko-KR')+'억';if(value>=10000)return Number((value/10000).toFixed(2)).toLocaleString('ko-KR')+'만';return nf(value);}
function updateEstimator(){const resultEl=document.getElementById('estimate-result');if(!resultEl)return;const result=estimateResult();resultEl.textContent=result.error?'—':fmtTime(result.seconds);document.getElementById('estimate-error').textContent=result.error||'';
const output=document.getElementById('estimate-break-even');if(!output)return;const hp=numberValue(document.getElementById('estimate-hp')?.value),first=numberValue(document.getElementById('estimate-first')?.value),second=numberValue(document.getElementById('estimate-second')?.value);
const damage=!result.error&&[hp,first,second].every(Number.isSafeInteger)&&hp>first&&second>=hp-first?Math.max(0,second-(hp-first)):null;output.textContent=damage===null?'—':carryDamageLabel(damage);output.title=damage===null?'':nf(damage)+' 피해량 · 이월 공격에서 이 이상 달성하면 후통 예상딜 보전';}
function completeExternal(){return `<div class="external-controls"><div class="field"><label for="external-carry">이월 받은 시간</label><input id="external-carry" data-input="v2-external" value="${fmtTime(ext.externalSeconds||90)}" inputmode="numeric"></div>${simpleButton('초기화','v2-external-reset')}${simpleButton('복사','copy-external')}</div><div class="external-columns"><div class="field"><label for="external-text">원문</label><textarea id="external-text" data-input="v2-external" rows="18" spellcheck="false">${X(ext.externalText||'')}</textarea></div><div class="field"><label>이월 적용</label><pre id="external-output" class="code-output"></pre></div></div><p class="field-help">행동·순서·줄바꿈은 유지하며 시간만 변경합니다. 전투가 끝난 뒤의 시각은 —로 표시합니다.</p>`;}
function updateExternal(){const source=document.getElementById('external-text'),output=document.getElementById('external-output');if(!source||!output)return;ext.externalText=source.value;ext.externalBase=90;ext.externalSeconds=timeToSec(document.getElementById('external-carry').value);if(!(ext.externalBase>0&&ext.externalSeconds>0&&ext.externalSeconds<=ext.externalBase)){output.textContent='입력한 시간을 확인하세요.';return;}output.textContent=adjustedWithBase(source.value,ext.externalSeconds,ext.externalBase);}
function completeConverter(){return `<div class="converter-lineup">${Array.from({length:5},(_,i)=>`<div><label for="convert-name-${i}">${i+1}번 캐릭터</label><select id="convert-name-${i}" data-input="v2-converter"><option value="">선택</option>${data.characters.map(c=>`<option value="${X(c.name)}" ${ext.converterNames[i]===c.name?'selected':''}>${X(c.name)}</option>`).join('')}</select><input id="convert-alias-${i}" data-input="v2-converter" aria-label="${i+1}번 원문 이름" placeholder="원문 이름·별칭" value="${X(ext.converterAliases[i]||'')}"></div>`).join('')}</div><div class="external-columns"><div class="field"><label for="converter-source">해외 택틱 원문</label><textarea id="converter-source" data-input="v2-converter" rows="16" spellcheck="false">${X(ext.converterRaw)}</textarea></div><div class="field"><label>정리 결과</label><pre id="converter-output" class="code-output"></pre><div id="converter-warnings"></div></div></div><div class="toolbar"><div class="toolbar-left">${simpleButton('결과 복사','v2-copy-converted')}${simpleButton('SET 포함 복사','v2-copy-converted-set')}${simpleButton('작업실에 등록','v2-save-converted','','primary')}</div><div class="toolbar-right">${simpleButton('초기화','v2-reset-converter')}</div></div>`;}
function refreshConverter(){const source=document.getElementById('converter-source');if(!source)return;ext.converterRaw=source.value;ext.converterNames=Array.from({length:5},(_,i)=>document.getElementById('convert-name-'+i).value);ext.converterAliases=Array.from({length:5},(_,i)=>document.getElementById('convert-alias-'+i).value);if(!source.value.trim()){document.getElementById('converter-output').textContent='';document.getElementById('converter-warnings').innerHTML='';return;}const result=convertForeignTactic(source.value,ext.converterNames,ext.converterAliases,data.bossSettings.map(b=>b.name),data.characters.map(c=>c.name));ext.converterResult=result;document.getElementById('converter-output').textContent=result.text;document.getElementById('converter-warnings').innerHTML=(result.warnings||[]).map(w=>`<p class="field-help danger">${X(w)}</p>`).join('');}
function saveGridText(t){t.text=tacticRows(t).map(r=>r.text).join('\n');t.title=t.party.join(' ');persist();const status=document.getElementById('tactic-save-state');if(status)status.textContent='저장됨';}
function rememberRows(t){ext.rowUndo.push({id:t.id,rows:structuredClone(tacticRows(t))});if(ext.rowUndo.length>60)ext.rowUndo.shift();ext.rowRedo=[];}
function inferChecked(text,previous,t){return legacyTools.commandState(text,previous,t.party,data.characters);}
function pasteRows(text,t){const lines=String(text).replace(/\r/g,'').split('\n').filter(Boolean),rows=[];let previous=Array(6).fill(false);for(const line of lines){const cells=line.split('\t');let checked,body;if(cells.length>=7&&cells.slice(0,6).every(v=>/^(true|false|0|1|o|x|⭕|❌)$/i.test(v.trim()))){checked=cells.slice(0,6).map(v=>/^(true|1|o|⭕)$/i.test(v.trim()));body=cells.slice(6).join('\t');}else{body=line;checked=inferChecked(line,previous,t);}rows.push({id:uid(),text:body,checked});previous=checked;}return rows;}
function openPasteRows(){if(!ensureEdit())return;openDrawer('여러 행 붙여넣기',`<div class="field"><label for="paste-grid-source">택틱 또는 SET 6칸이 포함된 표</label><textarea id="paste-grid-source" rows="13"></textarea></div><label class="inline-check"><input id="paste-grid-replace" type="checkbox">현재 본문 교체</label>`,simpleButton('취소','close-drawer')+simpleButton('적용','v2-commit-paste','','primary'),'',true);}
async function xlsxRows(file){const zip=await JSZip.loadAsync(file),parser=new DOMParser(),sharedFile=zip.file('xl/sharedStrings.xml');let shared=[];if(sharedFile){const xml=parser.parseFromString(await sharedFile.async('string'),'application/xml');shared=[...xml.getElementsByTagName('si')].map(si=>[...si.getElementsByTagName('t')].map(t=>t.textContent).join(''));}const sheets=Object.keys(zip.files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();if(!sheets.length)throw new Error('시트 없음');const xml=parser.parseFromString(await zip.file(sheets[0]).async('string'),'application/xml');return [...xml.getElementsByTagName('row')].map(row=>{const values=[];for(const c of row.getElementsByTagName('c')){const ref=c.getAttribute('r')||'A1',letters=ref.match(/[A-Z]+/)[0];let col=0;for(const char of letters)col=col*26+char.charCodeAt(0)-64;const type=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent||'';values[col-1]=type==='s'?shared[Number(v)]||'':type==='inlineStr'?[...c.getElementsByTagName('t')].map(t=>t.textContent).join(''):v;}return values;});}
function parseCarrySheet(rows){const header=rows[0].map(v=>String(v||'').trim().replace(/\s/g,'')),index=names=>header.findIndex(h=>names.includes(h)),bossCol=index(['보스','네임드','넴']),partyCol=index(['편성','캐릭터','조합']),bodyCol=index(['본문','택틱','내용']);if(bossCol<0||partyCol<0||bodyCol<0)throw new Error('첫 행에 보스·편성·본문 열이 필요합니다.');const cell=(row,names)=>{const i=index(names);return i<0?'':String(row[i]||'');};return rows.slice(1).filter(row=>row[bodyCol]).map(row=>({boss:Number(String(row[bossCol]).replace(/\D/g,''))||0,party:String(row[partyCol]).split(/[,/·\s]+/).filter(Boolean).slice(0,5),text:String(row[bodyCol]),stars:cell(row,['성급']).replace(/\D/g,'').split('').slice(0,5).map(Number),damage:parseFloat(cell(row,['기대딜','피해량']))||0,hands:parseFloat(cell(row,['손컨','손컨횟수']))||0,tp:cell(row,['TP','TP조건']),duration:timeToSec(cell(row,['시간','원본시간','전투시간'])||'1:00'),video:cell(row,['영상','원본영상']),note:cell(row,['비고','메모'])}));}
function carryImportDialog(){openDrawer('이월 시트 가져오기',`<div class="field"><label for="carry-sheet-file">Excel·CSV·TSV</label><input type="file" id="carry-sheet-file" accept=".xlsx,.csv,.tsv" data-input="v2-carry-sheet"></div><div class="field"><label for="carry-sheet-paste">또는 표 붙여넣기</label><textarea id="carry-sheet-paste" rows="8" placeholder="보스&#9;편성&#9;성급&#9;기대딜&#9;본문"></textarea></div><div id="carry-import-preview"></div>`,simpleButton('붙여넣기 확인','v2-preview-carry')+simpleButton('등록','v2-commit-carry','','primary'),'',true);}

