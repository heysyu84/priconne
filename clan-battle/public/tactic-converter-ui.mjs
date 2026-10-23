import {convertForeignTactic,foreignSuggestions} from './tactic-converter.mjs?v=20261023-emoji02';
import {colorRuns} from './tactics-model.mjs?v=20261023-check-sync01';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const init=(params.get('lineup')||'').split('|').map(s=>s.trim());
for(let i=0;i<5;i++){
 const row=document.createElement('div');row.className='form-row';
 const label=document.createElement('span');label.textContent=String(i+1);
 const from=document.createElement('input');from.placeholder='원문 이름';from.id='from-'+i;from.setAttribute('aria-label',(i+1)+'번 해외 이름');
 const to=document.createElement('input');to.placeholder='한국어 이름';to.id='to-'+i;to.setAttribute('aria-label',(i+1)+'번 사이트 이름');
 to.value=init[i]||'';from.value=foreignSuggestions(to.value);
 row.append(label,from,to);$('lineup').append(row);
}
const sourceNames=()=>Array.from({length:5},(_,i)=>$('from-'+i).value.trim());
const koreanNames=()=>Array.from({length:5},(_,i)=>$('to-'+i).value.trim());
let current=null;
function paint(text){
 const holder=document.createElement('span');
 for(const run of colorRuns(text,koreanNames())){
   const s=document.createElement('span');s.textContent=run.text;
   if(run.color){s.style.color=run.color;s.style.fontWeight='700';}
   holder.append(s);
 }
 return holder;
}
function render(){
 current=convertForeignTactic($('raw').value,koreanNames(),sourceNames());
 const preview=$('preview');preview.replaceChildren();
 if(!current.rows.length){preview.textContent='변환된 내용이 없습니다.';}
 for(const item of current.rows){
   const row=document.createElement('div');row.className='preview-line';
   const state=document.createElement('div');state.className='set-status';state.title='캐릭터 1~5 + AUTO';
   item.checked.forEach(v=>{const s=document.createElement('span');s.textContent=v?'●':'○';s.className=v?'on':'off';state.append(s);});
   const body=document.createElement('div');body.className='preview-text';body.append(paint(item.text));
   row.append(state,body);preview.append(row);
 }
 $('messages').textContent=current.warnings.length?'확인 필요 ('+current.warnings.length+'건)\n'+current.warnings.join('\n'):'변환 완료 · '+current.rows.length+'행 · '+(current.format==='dango'?'당고':'일반 SET')+' 형식';
 $('copy-with-set').disabled=$('copy-text').disabled=!current.rows.length;
}
async function copy(data){
 if(!data)return;
 try{await navigator.clipboard.writeText(data);}
 catch{
   const el=document.createElement('textarea');el.value=data;el.style.position='fixed';el.style.top='-9999px';document.body.append(el);el.select();
   const succeeded=document.execCommand('copy');el.remove();if(!succeeded){alert('클립보드 접근을 허용해 주세요.');return;}
 }
 const msg=$('messages');msg.textContent='복사 완료! 클전 사이트의 첫 번째 빈 택틱 행에 붙여넣으세요.\n'+(current?.warnings?.length?current.warnings.join('\n'):'');
}
$('convert').addEventListener('click',render);
$('clear').addEventListener('click',()=>{$('raw').value='';current=null;$('preview').textContent='원문을 입력하세요.';$('messages').textContent='';$('copy-with-set').disabled=$('copy-text').disabled=true;});
$('copy-with-set').addEventListener('click',()=>copy(current?.pasteText));
$('copy-text').addEventListener('click',()=>copy(current?.text));
document.querySelectorAll('#lineup input').forEach(input=>input.addEventListener('change',()=>{
 if(input.id.startsWith('to-')){const index=Number(input.id.slice(3)),from=$('from-'+index);
   if(!from.value)from.value=foreignSuggestions(input.value);
 }
 if(current)render();
}));
