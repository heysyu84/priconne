// 해외 클랜전 택틱 변환기: 당고 O/X·〇/ー, 일본식 SET/切 명령을 지원합니다.
const trim=s=>String(s??'').trim();
const reg=s=>s.replace(/[.*+?^$()|[\]{}]/g,'\\$&');
const suggested={
 '네피네라':['ネフィ','ネフィネラ'],'네피':['ネフィ'],
 '봉황':['ホウオウ','鳳凰'],'후부키':['フブキ'],'아이라':['アイラ'],
 '수네아':['ネア'],'라비':['ラビリスタ','ラビ'],'리리컬':['リリカル']
};
export const foreignSuggestions=name=>(suggested[trim(name)]||[])[0]||'';
export function convertForeignTactic(raw, koreanNames=[], foreignNames=[]) {
 const ko=Array.from({length:5},(_,i)=>trim(koreanNames[i])||'캐릭터'+(i+1));
 const label=ko.map(n=>({'네피네라':'네피'}[n]||n));
 const aliases=ko.map((x,i)=>[trim(foreignNames[i]),x,...(suggested[x]||[])].filter(Boolean));
 const dict=aliases.flatMap((a,i)=>a.map(name=>({name,i}))).sort((a,b)=>b.name.length-a.name.length);
 const dictPattern='(?:'+[...new Set(dict.map(x=>reg(x.name)))].join('|')+')';
 const find=s=>dict.find(x=>x.name===trim(s))?.i??-1;
 const actorStart=s=>{
   const v=trim(s);
   const hit=dict.find(x=>v===x.name||v.startsWith(x.name+' ')||v.startsWith(x.name+'s1'));
   return hit?{name:hit.name,rest:trim(v.slice(hit.name.length))}:null;
 };
 const warn=[];const warning=s=>{if(!warn.includes(s))warn.push(s);};
 let src=trim(raw).replace(/\[(\d{1,2}:[0-5]\d)\]\(https?:\/\/[^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'');
 const section=src.search(/【\s*(?:お団子|団子|당고)\s*(?:ver\.?|版)?\s*】/i);
 if(section>=0 && /(?:SET|セット|切)/.test(src.slice(0,section)))src=src.slice(0,section);
 const dango=/[OX〇○◯●ー－—-]{5}/i.test(src);
 const format=dango?'dango':'commands';
 src=src.replace(/\u00a0/g,' ').replace(/[ \u3000]*(\d{1,2}:[0-5]\d)(?=[ \u3000\t]|$)/g,'\n$1 ');
 const rows=[],state=[false,false,false,false,false];let auto=false,time='',lastTime='';
 const append=(actor,cmds,condition='')=>{
   if(!cmds.length&&!actor)return;
   const head=time?(rows.length&&time===lastTime?'ㄴ ':time+' '):'';
   const name=actor?(find(actor)>=0?label[find(actor)]:actor)+(condition?' '+condition+' ':' 후 '):'';
   if(actor&&find(actor)<0)warning('행동 캐릭터 명칭 확인: '+actor);
   const text=trim(head+name+(cmds.join(', ')||'(SET 변경 없음)'));
   rows.push({text,checked:[...state,auto]});lastTime=time;
 };
 const namesIn=s=>{
   const p=new RegExp(dictPattern,'g'),result=[]; let m;
   while((m=p.exec(s))!==null){const i=find(m[0]);if(i>=0&&!result.includes(i))result.push(i);}
   return result;
 };
 const autoState=rawText=>{
   let changed=null;
   const rest=rawText.replace(/(?:AUTO|オート|自动|自動)\s*(?:ON|OFF|オン|オフ|切|关|關|开|開|开启)/gi,t=>{
     changed=/(?:ON|オン|开|開|开启)$/i.test(t);return ' ';
   });
   return {rest,changed};
 };
 const act=(payload,actor='',initial=false)=>{
   const a=autoState(payload);const before=auto;
   const skill=a.rest.match(/(?:s1|1スキル|技能1)\s*(?:开始后|開始後|スタート後)/i);
   if(skill)a.rest=a.rest.replace(skill[0],' ');
   if(a.changed!==null)auto=a.changed;
   const on=[],off=[];
   const symbols=a.rest.match(/[OX〇○◯●ー－—-]{5}/i);
   if(symbols && a.changed===null){
     const suffix=a.rest.slice(symbols.index+symbols[0].length);
     const bare=suffix.match(/(?:^|[\s、,，])(ON|OFF|切|オン|オフ)(?=$|[\s、,，])/i);
     if(bare){a.changed=/^(?:ON|オン)$/i.test(bare[1]);auto=a.changed;}
   }
   if(symbols){
     [...symbols[0].toUpperCase()].forEach((mark,i)=>{
       const next=/[O〇○◯●]/.test(mark);
       if(next!==state[i]){state[i]=next;(next?on:off).push(i);}
     });
   }else{
     const regex=new RegExp('((?:'+dictPattern+'[\\s、,，]*)+)\\s*(SET(?:ON|OFF)?|ON|OFF|切|解除|オン|オフ|关|關|开|開)','gi');
     let m,matched=false;
     while((m=regex.exec(a.rest))!==null){
       matched=true;const enable=/^(?:SET|SETON|ON|オン|开|開)$/i.test(m[2]);
       for(const i of namesIn(m[1]))if(state[i]!==enable){state[i]=enable;(enable?on:off).push(i);}
     }
     if(initial&&!matched){
       for(const i of namesIn(a.rest))if(!state[i]){state[i]=true;on.push(i);}
     }else if(!matched&&trim(a.rest).replace(/[、,，\s]/g,'')&&!/^(?:初動|お団子)/.test(trim(a.rest))){
       warning('명령 확인 필요: '+trim(a.rest).slice(0,70));
     }
   }
   const order=xs=>[...new Set(xs)].sort((a,b)=>b-a).map(i=>label[i]).join(', ');
   const cmds=[];
   if(on.length)cmds.push(on.length>=2&&state.every(Boolean)?(initial?'전부 SET':'전부 ON'):order(on)+(initial?' SET':' ON'));
   if(off.length)cmds.push(off.length>=3&&state.every(x=>!x)?'전부 OFF':order(off)+' OFF');
   if(a.changed!==null && (auto!==before||initial||!rows.length))cmds.push('AUTO '+(auto?'온':'오프'));
   if(!rows.length && !actor && initial){cmds.sort((x,y)=>x.startsWith('AUTO')?-1:y.startsWith('AUTO')?1:0);}
   append(actor,cmds,skill?'1스킬 시작 후':'');
 };
 const processLine=input=>{
   let line=trim(input);if(!line)return;
   const t=line.match(/^(\d{1,2}:[0-5]\d)\s*/);
   if(t){time=t[1];line=trim(line.slice(t[0].length));}
   const parts=line.replace(/[ \u3000]{2,}/g,'\t').split(/\t+/).map(trim).filter(Boolean);
   if(!parts.length)return;
   if(dango){
     const merged=parts.join(' ');
     const s=merged.match(/[OX〇○◯●ー－—-]{5}/i);
     if(s){
       const rawActor=trim(merged.slice(0,s.index));
       const a=actorStart(rawActor);
       let actor=a?.name||rawActor;
       if(!rows.length&&!actor&&(time==='1:30'||!t))time='';
       act(merged.slice(s.index),actor,!rows.length);
     }else{
       const a=actorStart(merged);
       act(a?.rest||merged,a?.name||'',!rows.length);
     }
   }else{
     if(!t&&!rows.length&&/(?:初動|UBセット|开局|初始)/i.test(line)){act(line,'',true);return;}
     for(let i=0;i<parts.length;){
       const a=actorStart(parts[i]);
       if(a){
         const next=i+1<parts.length&&!actorStart(parts[i+1])?parts[i+1]:'';
         act([a.rest,next].filter(Boolean).join(' '),a.name);
         i+=next?2:1;
       }else if(i+1<parts.length){
         act(parts[i+1],parts[i]);i+=2;
       }else{act(parts[i]);i++;}
     }
   }
 };
 for(const line of src.replace(/\r\n?/g,'\n').split('\n'))processLine(line);
 if(!rows.length)warning('변환 가능한 행을 찾지 못했습니다.');
 if(ko.some(x=>/^캐릭터[1-5]$/.test(x)))warning('캐릭터 5명의 한국어 이름을 먼저 지정해 주세요.');
 return {format,rows,warnings:warn,text:rows.map(x=>x.text).join('\n'),
 pasteText:rows.map(x=>x.checked.map(b=>b?'TRUE':'FALSE').join('\t')+'\t'+x.text).join('\n')};
}
