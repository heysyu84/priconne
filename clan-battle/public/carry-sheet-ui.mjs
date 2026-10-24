import {readCarryWorkbook} from './carry-sheet-xlsx.mjs?v=20261024-carry-sheet01';
import {convertCarryWorkbook,carryTacticBody,carryTacticPaste,carryTacticMetadata} from './carry-sheet-converter.mjs?v=20261024-carry-sheet01';
import {serializeTacticTransfer,validTacticLineup} from './tactic-transfer.mjs?v=20261024-carry-sheet01';
import {commandState} from './tactics-model.mjs?v=20261024-carry-punctuation06';

const $=id=>document.getElementById(id);
const X=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalized=value=>String(value??'').normalize('NFKC').replace(/\s+/g,'').toLowerCase();
let catalog=[],tactics=[],selected=null,bossFilter='all',request=0;
const current=()=>tactics.find(t=>t.id===selected);
const status=text=>{$('carry-status').textContent=text;};
const known=name=>catalog.find(c=>normalized(c.name)===normalized(name))||catalog.find(c=>c.aliases?.some(a=>normalized(a)===normalized(name)));

function menu(mode,focus=false){
  const carry=mode==='carry-sheet';
  $('foreign-panel').hidden=carry;$('carry-sheet-panel').hidden=!carry;
  for(const button of document.querySelectorAll('[data-converter-menu]')){
    const active=button.dataset.converterMenu===mode;
    button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    if(active&&focus)button.focus();
  }
  if(location.hash!=='#'+mode)history.replaceState(null,'','#'+mode);
}
for(const button of document.querySelectorAll('[data-converter-menu]')){
  button.addEventListener('click',()=>menu(button.dataset.converterMenu));
  button.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      event.preventDefault();const next=event.key==='Home'?'foreign':event.key==='End'?'carry-sheet':button.dataset.converterMenu==='foreign'?'carry-sheet':'foreign';menu(next,true);
    }
  });
}
window.addEventListener('hashchange',()=>menu(location.hash==='#carry-sheet'?'carry-sheet':'foreign'));
menu(location.hash==='#carry-sheet'?'carry-sheet':'foreign');
const catalogReady=fetch('./characters.json').then(r=>{if(!r.ok)throw Error('캐릭터 DB를 불러오지 못했습니다.');return r.json();}).then(data=>{
  catalog=Array.isArray(data.characters)?data.characters:[];
  $('carry-character-names').innerHTML=catalog.map(c=>`<option value="${X(c.name)}">${X((c.aliases||[]).join(' · '))}</option>`).join('');
}).catch(error=>status(error.message+' 편성 이름은 직접 수정할 수 있습니다.'));

function renderList(){
  const visible=tactics.filter(t=>bossFilter==='all'||t.boss===Number(bossFilter));
  if(!visible.some(t=>t.id===selected))selected=visible[0]?.id||null;
  $('carry-list-count').textContent=visible.length+'개';
  $('carry-list').innerHTML=visible.map(t=>{
    const reviews=t.warnings.length+t.rows.filter(r=>r.review.length).length;
    return `<button type="button" class="carry-card${t.id===selected?' active':''}" data-carry-select="${X(t.id)}" aria-pressed="${t.id===selected}"><strong>${t.boss}넴 · ${t.carrySeconds||'—'}초 · 기대딜 ${X(t.expectedDamage||'—')}</strong><span>${X(t.characters.join(' '))}</span>${reviews?`<small class="carry-review-label">확인 ${reviews}건</small>`:''}</button>`;
  }).join('')||'<p class="muted">해당 보스의 택틱이 없습니다.</p>';
  renderDetail();
}
function renderDetail(){
  const t=current();$('carry-detail').hidden=!t;
  if(!t)return;
  $('carry-result-title').textContent=t.boss+'넴 · '+t.index+'번째 이월 택틱';
  $('carry-source-range').textContent='원문 기대딜: '+t.damageRange+' · '+t.source.sheet+' '+t.source.cell;
  $('carry-meta').innerHTML=`<div class="carry-meta-grid"><label>보스<select data-carry-meta="boss" id="carry-boss">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===t.boss?'selected':''}>${n}넴</option>`).join('')}</select></label><label>기대딜 (억)<input data-carry-meta="expectedDamage" id="carry-damage" inputmode="decimal" value="${X(t.expectedDamage)}"></label><label>손컨<input data-carry-meta="manualCount" id="carry-manual" type="number" min="0" step="0.5" value="${X(t.manualCount)}"></label><label class="carry-tp-field">TP 조건<input data-carry-meta="tp" id="carry-tp" value="${X(t.tp)}" placeholder="조건 없음"></label></div>
    <details class="carry-lineup-settings"><summary>편성 · 성급 확인</summary><div class="carry-lineup">${t.characters.map((c,i)=>`<label><span>${i+1}번 캐릭터</span><input list="carry-character-names" data-carry-character="${i}" aria-label="이월 ${i+1}번 캐릭터" value="${X(c)}"><select data-carry-star="${i}" aria-label="이월 ${i+1}번 성급">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${String(n)===t.stars[i]?'selected':''}>★ ${n}</option>`).join('')}</select></label>`).join('')}</div><p class="hint">성급은 사이트 초상화의 기본 성급으로 채웁니다. 원본 편성과 다르면 수정해 주세요.</p></details>
    <label class="carry-meta-label">메모<textarea data-carry-meta="note" id="carry-note" rows="2">${X(t.note)}</textarea></label><label class="carry-meta-label">영상<input data-carry-meta="video" id="carry-video" type="url" value="${X(t.video)}" placeholder="영상 링크 없음"></label>`;
  $('carry-tactic-warnings').textContent=t.warnings.join('\n');
  $('carry-copy-help').textContent='편성·SET·정보를 복사한 뒤, 작성 잠금을 해제한 택틱 작업실의 빈 행에 붙여넣으세요. 새 이월 택틱으로 추가됩니다.';
  $('carry-manual-copy').hidden=true;
  renderRows();
}
function renderRows(){
  const t=current();if(!t)return;
  $('carry-rows').innerHTML=t.rows.map((row,i)=>{
    const labels=[...t.characters,'AUTO'];
    const source=[row.source.sheet+' '+row.source.cell,row.source.time||'',row.source.raw,row.source.snapshot,row.source.damage?'딜량 '+row.source.damage:'',...(row.source.continuations||[]).map(s=>(s.time||'')+' '+s.raw+' '+s.snapshot)].filter(Boolean).join('\n');
    return `<div class="carry-preview-line${row.review.length?' needs-review':''}${row.kind==='damage'?' is-checkpoint':''}"><div class="carry-state"><small>${row.kind==='damage'?'딜 확인':row.kind==='control'?'조작':row.kind==='initial'?'시작':'참고'}</small><div>${row.checked.map((on,j)=>`<input type="checkbox" data-carry-check="${i}:${j}" aria-label="${i+1}행 ${X(labels[j])} SET" title="${X(labels[j])}" ${on?'checked':''}>`).join('')}</div></div><div class="carry-row-content"><textarea data-carry-row="${i}" rows="1" aria-label="이월 ${i+1}행 택틱" spellcheck="false">${X(row.text)}</textarea><details class="source-comparison"><summary>${row.review.length?'확인 필요 · ':''}원문 대조</summary><pre>${X(source)}</pre>${row.review.length?`<p class="carry-row-warning">${X(row.review.join(' '))}</p>`:''}</details></div></div>`;
  }).join('');
  resizeRows();
}
function resizeRows(){for(const field of $('carry-rows').querySelectorAll('textarea')){field.style.height='auto';field.style.height=field.scrollHeight+2+'px';}}
window.addEventListener('resize',resizeRows);
$('carry-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  const version=++request;tactics=[];selected=null;$('carry-results').hidden=true;
  if(!/\.xlsx$/i.test(file.name)){status('.xlsx 형식의 엑셀 파일을 선택해 주세요.');return;}
  if(file.size>45_000_000){status('45MB 이하의 .xlsx 파일을 선택해 주세요.');return;}
  status(file.name+' 읽는 중…');$('carry-file').disabled=true;
  try{
    await catalogReady;
    const workbook=await readCarryWorkbook(await file.arrayBuffer());
    let aliases={};try{const saved=JSON.parse(localStorage.getItem('nyang-tactic-preferred-names-v1')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))aliases=saved;}catch{}
    const result=convertCarryWorkbook(workbook,{catalog,aliases});if(version!==request)return;
    if(!result.tactics.length)throw Error(result.errors.join('\n')||'이월 택틱을 찾지 못했습니다. 원본 시트 형식을 확인해 주세요.');
    tactics=result.tactics;bossFilter='all';$('carry-boss-filter').value='all';selected=tactics[0].id;
    status(file.name+' · '+tactics.length+'개 택틱 변환 완료'+(result.errors.length?'\n'+result.errors.join('\n'):''));
    $('carry-results').hidden=false;
    $('carry-notices').hidden=!result.notices.length;
    $('carry-notices-text').textContent=result.notices.map(n=>n.text).join('\n\n');
    renderList();
  }catch(error){if(version===request)status(error.message||'엑셀 파일을 읽지 못했습니다.');}
  finally{if(version===request)$('carry-file').disabled=false;}
});
$('carry-list').addEventListener('click',event=>{const button=event.target.closest('[data-carry-select]');if(button){selected=button.dataset.carrySelect;renderList();}});
$('carry-boss-filter').addEventListener('change',event=>{bossFilter=event.target.value;renderList();});
$('carry-meta').addEventListener('input',event=>{
  const t=current(),field=event.target;if(!t)return;
  if(field.dataset.carryMeta){const key=field.dataset.carryMeta;t[key]=key==='boss'?Number(field.value):field.value;}
  if(field.dataset.carryStar!==undefined)t.stars[Number(field.dataset.carryStar)]=field.value;
});
$('carry-meta').addEventListener('change',event=>{
  const t=current(),field=event.target;if(!t)return;
  if(field.dataset.carryCharacter!==undefined){
    const i=Number(field.dataset.carryCharacter),old=t.characters[i],name=known(field.value.trim())?.name||field.value.trim();
    if(!name){field.value=old;return;}
    t.characters[i]=name;field.value=name;
    if(old!==name){const pattern=new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');for(const row of t.rows)row.text=row.text.replace(pattern,name);renderRows();}
  }
  if(field.dataset.carryMeta==='expectedDamage'){
    const n=Number(field.value);if(field.value.trim()&&Number.isFinite(n)&&n>=0){t.expectedDamage=(Math.floor(n*100+1e-7)/100).toFixed(2);field.value=t.expectedDamage;}
  }
});
$('carry-rows').addEventListener('input',event=>{
  const t=current(),field=event.target;if(!t)return;
  if(field.dataset.carryRow!==undefined){
    const i=Number(field.dataset.carryRow);t.rows[i].text=field.value.replace(/[\r\n\t]+/g,' ');
    for(let j=i;j<t.rows.length;j++)if(!t.rows[j].manualChecks)t.rows[j].checked=commandState(t.rows[j].text,j?t.rows[j-1].checked:[],t.characters,catalog);
    for(const box of $('carry-rows').querySelectorAll('[data-carry-check]')){const [r,c]=box.dataset.carryCheck.split(':').map(Number);box.checked=t.rows[r].checked[c];}
    resizeRows();
  }
  if(field.dataset.carryCheck!==undefined){const [r,c]=field.dataset.carryCheck.split(':').map(Number);t.rows[r].checked[c]=field.checked;t.rows[r].manualChecks=true;}
});
function legacyCopy(text){
  const field=document.createElement('textarea'),previous=document.activeElement;
  field.value=text;field.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';document.body.append(field);
  try{field.focus({preventScroll:true});field.select();field.setSelectionRange(0,text.length);return !!document.execCommand?.('copy');}
  catch{return false;}finally{field.remove();previous?.focus?.({preventScroll:true});}
}
function copy(text){
  const success=()=>{$('carry-manual-copy').hidden=true;$('carry-copy-help').textContent='복사 완료. 택틱 작업실의 빈 행에 붙여넣으면 새 이월 택틱으로 추가됩니다.';};
  const manual=()=>{$('carry-manual-copy').hidden=false;const field=$('carry-manual-copy-text');field.value=text;field.focus();field.select();field.setSelectionRange(0,text.length);$('carry-copy-help').textContent='자동 복사가 제한되어 있습니다. 아래 내용을 전체 선택하여 직접 복사해 주세요.';};
  if(legacyCopy(text)){success();return;}
  try{if(navigator.clipboard?.writeText)Promise.resolve(navigator.clipboard.writeText(text)).then(success,manual);else manual();}catch{manual();}
}
$('carry-copy-all').addEventListener('click',()=>{
  const t=current();if(!t)return;
  try{
    if(!validTacticLineup(t.characters))throw Error('편성에서 서로 다른 캐릭터 5명의 이름을 확인해 주세요.');
    if(catalog.length&&t.characters.some(n=>!known(n)))throw Error('캐릭터 DB에 없는 이름이 있습니다. 편성을 수정해 주세요.');
    const n=Number(t.expectedDamage);if(t.expectedDamage.trim()&&Number.isFinite(n)&&n>=0)t.expectedDamage=(Math.floor(n*100+1e-7)/100).toFixed(2);
    copy(serializeTacticTransfer(t.characters,carryTacticPaste(t),carryTacticMetadata(t)));
  }catch(error){$('carry-copy-help').textContent=error.message;}
});
$('carry-copy-body').addEventListener('click',()=>{const t=current();if(t)copy(carryTacticBody(t));});
