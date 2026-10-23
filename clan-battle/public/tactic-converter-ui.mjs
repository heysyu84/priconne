import {convertForeignTactic,foreignSuggestions} from './tactic-converter.mjs?v=20261023-autolineup03';
import {colorRuns} from './tactics-model.mjs?v=20261023-check-sync01';
import {serializeTacticTransfer,validTacticLineup} from './tactic-transfer.mjs?v=20261023-autolineup03';

const $=id=>document.getElementById(id);
const normalize=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
const preferred={'페리컬':'리리컬','네피네라':'네피','ネフィ':'네피','ネフィネラ':'네피','ホウオウ':'봉황','フブキ':'후부키','アイラ':'아이라','ネア':'수네아','ラビリスタ':'라비','ラビ':'라비','リリカル':'리리컬'};
const foreignPairs=Object.entries(preferred);
let catalog=[],current=null;
const params=new URLSearchParams(location.search);
const init=(params.get('lineup')||'').split('|').map(s=>s.trim());
let confirmed=init.length===5&&init.every(Boolean);
function canonical(name){
 const requested=String(name??'').trim();
 const named=preferred[requested]||requested;
 const official=catalog.find(p=>normalize(p.name)===normalize(named)||p.aliases?.some(alias=>normalize(alias)===normalize(named)));
 return official?.name||named;
}
for(let i=0;i<5;i++){
 const row=document.createElement('div');row.className='form-row';
 const label=document.createElement('span');label.textContent=String(i+1);
 const from=document.createElement('input');from.placeholder='원문 이름';from.id='from-'+i;from.setAttribute('aria-label',(i+1)+'번 해외 이름');
 const to=document.createElement('input');to.placeholder='사이트 캐릭터 이름';to.id='to-'+i;to.setAttribute('aria-label',(i+1)+'번 사이트 이름');
 to.value=canonical(init[i]||'');to.setAttribute('list','lineup-names');
 from.value=foreignSuggestions(to.value);
 row.append(label,from,to);$('lineup').append(row);
}
$('lineup-confirm').checked=confirmed;
const sourceNames=()=>Array.from({length:5},(_,i)=>$('from-'+i).value.trim());
const koreanNames=()=>Array.from({length:5},(_,i)=>canonical($('to-'+i).value));
const lineupReady=()=>validTacticLineup(koreanNames())
  && (!catalog.length||koreanNames().every(n=>catalog.some(c=>normalize(c.name)===normalize(n))));
function setConfirmation(value){
 confirmed=!!value;
 $('lineup-confirm').checked=confirmed;
 if(current)render();
}
function notice(text){
 $('lineup-note').textContent=text;
}
fetch('./characters.json').then(r=>{if(!r.ok)throw new Error('캐릭터 DB');return r.json();})
 .then(data=>{
   catalog=Array.isArray(data.characters)?data.characters:[];
   for(let i=0;i<5;i++){$('to-'+i).value=canonical($('to-'+i).value);}
   $('lineup-names').replaceChildren(...catalog.map(p=>{
     const option=document.createElement('option');option.value=p.name;return option;
   }));
   if(current)render();
 }).catch(()=>notice('캐릭터 목록을 자동으로 불러오지 못했습니다. 이름과 순서를 확인해 주세요.'));
function detectNames(){
 const input=$('raw').value;
 if(!input.trim()){notice('먼저 택틱 원본을 붙여넣으세요.');return;}
 const candidates=[
   ...catalog.flatMap(c=>[c.name,...(c.aliases||[])].map(alias=>({alias,name:c.name}))),
   ...foreignPairs.map(([alias,name])=>({alias,name:canonical(name)}))
 ].filter(x=>x.alias.length>1).sort((a,b)=>b.alias.length-a.alias.length);
 const map=new Map();for(const candidate of candidates)if(!map.has(candidate.alias))map.set(candidate.alias,candidate);
 const combined=new RegExp([...map.keys()].map(x=>x.replace(/[.*+?^$()|[\]{}]/g,'\\$&')).join('|'),'g');
 const detected=[];let match;
 while((match=combined.exec(input))!==null){
   const item=map.get(match[0]);if(!item)continue;
   const name=canonical(item.name);
   if(!detected.some(x=>x.name===name))detected.push({name,raw:match[0]});
 }
 if(detected.length!==5){
   notice('원문에서 '+detected.length+'명의 이름을 찾았습니다. 당고 배치 순서를 확정할 수 없으므로 빈 슬롯을 직접 지정해 주세요.');
   return;
 }
 detected.forEach((entry,i)=>{
   $('to-'+i).value=entry.name;
   $('from-'+i).value=entry.raw!==entry.name?entry.raw:foreignSuggestions(entry.name);
 });
 setConfirmation(false);
 notice('캐릭터 5명을 찾았습니다. 현재 나열 순서는 원문 등장 순서일 뿐 덱 편성 순서가 아닐 수 있습니다. 반드시 1~5번을 맞춘 뒤 아래 순서 확인을 체크하세요.');
}
function paint(text){
 const holder=document.createElement('span');
 for(const run of colorRuns(text,koreanNames(),catalog)){
   const span=document.createElement('span');span.textContent=run.text;
   if(run.color){span.style.color=run.color;span.style.fontWeight='700';}
   holder.append(span);
 }
 return holder;
}
function render(){
 current=convertForeignTactic($('raw').value,koreanNames(),sourceNames());
 const preview=$('preview');preview.replaceChildren();
 if(!current.rows.length)preview.textContent='변환된 내용이 없습니다.';
 for(const item of current.rows){
   const row=document.createElement('div');row.className='preview-line';
   const state=document.createElement('div');state.className='set-status';state.title='캐릭터 1~5 + AUTO';
   item.checked.forEach(value=>{
     const dot=document.createElement('span');dot.textContent=value?'●':'○';dot.className=value?'on':'off';state.append(dot);
   });
   const body=document.createElement('div');body.className='preview-text';body.append(paint(item.text));
   row.append(state,body);preview.append(row);
 }
 const problems=[];
 if(!lineupReady())problems.push('캐릭터 5명 모두 사이트 DB에 있는 이름으로 지정해야 합니다.');
 if(!confirmed)problems.push('당고 슬롯 순서를 확인한 뒤 체크해 주세요.');
 problems.push(...current.warnings);
 $('messages').textContent=problems.length?'확인 필요 ('+problems.length+'건)\n'+problems.join('\n'):
   '변환 완료 · '+current.rows.length+'행 · '+(current.format==='dango'?'당고':'일반 SET')+' 형식';
 const enabled=lineupReady()&&confirmed&&current.rows.length>0;
 $('copy-with-set').disabled=$('copy-text').disabled=!enabled;
}
async function copy(text){
 if(!text)return;
 try{await navigator.clipboard.writeText(text);}
 catch{
   const field=document.createElement('textarea');field.value=text;field.style.position='fixed';field.style.top='-9999px';
   document.body.append(field);field.select();
   const ok=document.execCommand('copy');field.remove();
   if(!ok){alert('클립보드 접근을 허용해 주세요.');return;}
 }
 $('messages').textContent='복사 완료! 클전 사이트 택틱 작업실의 빈 택틱 행에 붙여넣으세요.\n'+
 (current?.warnings?.length?current.warnings.join('\n'):'');
}
$('convert').addEventListener('click',render);
$('detect-lineup').addEventListener('click',detectNames);
$('lineup-confirm').addEventListener('change',event=>setConfirmation(event.target.checked));
$('clear').addEventListener('click',()=>{
 $('raw').value='';current=null;$('preview').textContent='원문을 입력하세요.';
 $('messages').textContent='';$('copy-with-set').disabled=$('copy-text').disabled=true;
});
$('copy-with-set').addEventListener('click',()=>{
 if(!lineupReady()||!confirmed||!current?.rows.length)return;
 try{copy(serializeTacticTransfer(koreanNames(),current.pasteText));}
 catch(error){$('messages').textContent=error.message;}
});
$('copy-text').addEventListener('click',()=>{
 if(!lineupReady()||!confirmed||!current?.rows.length)return;
 copy(current.text);
});
document.querySelectorAll('#lineup input').forEach(input=>input.addEventListener('change',()=>{
 if(input.id.startsWith('to-')){
   const i=Number(input.id.slice(3));input.value=canonical(input.value);
   if(!$('from-'+i).value)$('from-'+i).value=foreignSuggestions(input.value);
 }
 setConfirmation(false);
 notice('배치나 이름이 바뀌었습니다. 1~5번 순서를 다시 확인해 주세요.');
 if(current)render();
}));
