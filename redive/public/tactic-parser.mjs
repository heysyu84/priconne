// 해외 클랜전 택틱 변환기: 당고 O/X·〇/ー, 일본식 SET/切 명령을 지원합니다.
const trim=s=>String(s??'').trim();
const reg=s=>s.replace(/[.*+?^$()|[\]{}]/g,'\\$&');
const suggested={
 '네피네라':['ネフィ','ネフィネラ'],'네피':['ネフィ','ネフィネラ'],
 '봉황':['ホウオウ','鳳凰'],'후부키':['フブキ'],'아이라':['アイラ'],
 '수네아':['ネア'],'라비':['ラビリスタ','ラビ'],'리리컬':['リリカル','페리컬']
};
export const foreignSuggestions=name=>(suggested[trim(name)]||[])[0]||'';
export function convertForeignTactic(raw, koreanNames=[], foreignNames=[], bossNames=[], characterNames=[]) {
 const ko=Array.from({length:5},(_,i)=>trim(koreanNames[i])||'캐릭터 '+(i+1));
 const label=ko.map(n=>({'네피네라':'네피'}[n]||n));
 // Slot numbers are meaningful even if real character names were never entered.
 const slotAlias=i=>{
   const n=i+1, circled=['①','②','③','④','⑤'][i];
   return ['캐릭터 '+n,'캐릭터'+n,'캐릭'+n,'キャラ'+n,'キャラ '+n,'角色'+n,'角色 '+n,n+'番',n+'号',n+'번',circled];
 };
 const aliases=ko.map((x,i)=>[...trim(foreignNames[i]).split(/[,，|]/),x,...(suggested[x]||[]),...slotAlias(i)].map(trim).filter(Boolean));
 // Names can be understood without assigning them to a party slot. Never infer
 // the left-to-right party order from UB appearance order in the source text.
 // An explicit "name SET/ON/OFF" also identifies an unregistered source name.
 // Preserve its spelling; it still has no positional SET slot until assigned.
 const sourceNames=[...String(raw).matchAll(/(?<![\p{L}\p{N}_])([\p{L}\p{M}][\p{L}\p{M}\d_・·]{0,23})[ \t]*(?=(?:SET(?:ON|OFF)?|ON|OFF|切|解除|オン|オフ|关|關|开|開)(?![A-Za-z]))/giu)]
   .map(match=>match[1]).filter(name=>
     !/^(?:AUTO|オート|오토|자동|自動|自动|手動|수동|START|시작|初動|초동|ON|OFF|SET|全員|全体|全キャラ|全员|全體|全部|全|전부|전체|전원)$/i.test(name)&&
     !/(?:不足|足り|場合|のみ|なら|たら|以上|以下|未満|必要|条件|조건|필요|부족|경우|이상|이하|미만|대기|지연|秒|초|만$)/.test(name));
 const otherNames=[...characterNames,...sourceNames,...Object.entries(suggested).flatMap(([name,values])=>[name,...values])]
   .flatMap(entry=>typeof entry==='string'?[entry]:[entry?.name,...(entry?.aliases||[])])
   .map(trim).filter(Boolean);
 const dict=[...aliases.flatMap((a,i)=>a.map(name=>({name,i}))),
   ...[...new Set(otherNames)].filter(name=>!aliases.some(names=>names.includes(name))).map(name=>({name,i:-1}))]
   .sort((a,b)=>b.name.length-a.name.length);
 const dictPattern='(?:'+[...new Set(dict.map(x=>reg(x.name)))].join('|')+')';
 const find=s=>dict.find(x=>x.name===trim(s))?.i??-1;
 const actorStart=s=>{
   const v=trim(s);
   const hit=dict.find(x=>v===x.name||v.startsWith(x.name+' ')||v.startsWith(x.name+'s1')||v.startsWith(x.name+'(')||v.startsWith(x.name+'（'));
   return hit?{name:hit.name,rest:trim(v.slice(hit.name.length))}:null;
 };
 const warn=[];const warning=s=>{if(!warn.includes(s))warn.push(s);};
 const unmappedActors=new Set();
 // Indices 1..5 follow the source left-to-right; unsorted output goes 5..1.
 const ordered=xs=>[...new Set(xs)].sort((a,b)=>b-a).map(i=>label[i]).join(', ');
 const cleanActor=s=>trim(s).replace(/[(（]\s*(?:AUTO|오토|オート|자동|自動|수동|手動|SET)\s*[)）]/gi,'')
   .replace(/^[\s'"‘’]+|[\s'"‘’]+$/g,'');
 // Use the site's complete boss name and alias catalog, not only the word "보스".
 // A small known-current fallback applies until the asynchronous catalog loads.
 const knownBosses=[{name:'번 사우르스',aliases:['번사우르스','バーンサウルス']},...bossNames];
 const bossTokens=[...new Set(knownBosses.flatMap(entry=>
   typeof entry==='string'?[entry]:[entry?.name,...(entry?.aliases||[])]
 ).map(x=>trim(x)).filter(Boolean))].sort((a,b)=>b.replace(/\s+/g,'').length-a.replace(/\s+/g,'').length);
 const bossNameStart=text=>{
   const source=trim(text);
   for(const token of bossTokens){
     // Allow whitespace variants, but avoid matching a shorter boss prefix.
     const pattern=new RegExp('^'+reg(token).replace(/\s+/g,'\\s*')+'(?=$|[\\s\\[\\]()（）,:：、，])','i');
     const match=source.match(pattern);
     if(match)return {name:token,rest:trim(source.slice(match[0].length))};
   }
   return null;
 };
 const autoOnly=/^(.*?)\s*['"‘’]?\s*((?:AUTO|オート|오토|자동|自動)\s*(?:ON|OFF|온|오프|オン|オフ|切|关|關|开|開|开启))\s*['"‘’]?\s*$/i;
 const orderPriority=s=>/한번만$/.test(s)?-1:/^AUTO 온$/.test(s)?1:/^AUTO 오프$/.test(s)?3:
   /(?:\sON|\sSET)$/.test(s)?0:/\sOFF$/.test(s)?2:4;
 const prioritize=(commands,initial=false)=>[...commands].sort((a,b)=>
   (initial&&/^AUTO /.test(a)?-2:orderPriority(a))-(initial&&/^AUTO /.test(b)?-2:orderPriority(b)));
 let src=trim(raw).replace(/\[(\d{1,2}:[0-5]\d)\]\(https?:\/\/[^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'');
 const section=src.search(/【\s*(?:お団子|団子|당고)\s*(?:ver\.?|版)?\s*】/i);
 if(section>=0 && /(?:SET|セット|切)/.test(src.slice(0,section)))src=src.slice(0,section);
 src=src.replace(/[\uFE0E\uFE0F\u200D]/g,'');
 const dango=/[OX〇○◯●⭕❌ー－—-]{5}/i.test(src);
 const format=dango?'dango':'commands';
 src=src.replace(/\u00a0/g,' ').replace(/[ \u3000]+(\d{1,2}:[0-5]\d)(?=[ \u3000\t]|$)/g,'\n$1 ');
 const rows=[],state=[false,false,false,false,false];let auto=false,time='',lastTime='',sourceLine='';
 const append=(actor,cmds,condition='')=>{
   if(!cmds.length&&!actor)return;
   const head=time?(rows.length&&time===lastTime?'ㄴ ':time+' '):'';
   const name=actor?(find(actor)>=0?label[find(actor)]:actor)+(condition?' '+condition+' ':' 후 '):'';
   const text=trim(head+name+(cmds.join(', ')||'(SET 변경 없음)'));
   rows.push({text,checked:[...state,auto],source:sourceLine,time,actor,instruction:cmds.join(', ')});lastTime=time;
 };
 const actorsIn=s=>{
   const result=[],seen=new Set();
   for(const match of s.matchAll(new RegExp(dictPattern,'g'))){
     const name=match[0],i=find(name),key=i>=0?'slot:'+i:'name:'+name;
     if(!seen.has(key)){seen.add(key);result.push({name,i});}
   }
   return result;
 };
 const applyActors=(actors,enable)=>{
   for(const actor of actors){if(actor.i>=0)state[actor.i]=enable;else unmappedActors.add(actor.name);}
 };
 const actorList=(actors,inOrder=false)=>inOrder||actors.some(actor=>actor.i<0)
   ?actors.map(actor=>actor.i>=0?label[actor.i]:actor.name).join(', ')
   :ordered(actors.map(actor=>actor.i));
 const autoState=rawText=>{
   let changed=null;const events=[];
   const rest=rawText.replace(/(?:AUTO|オート|오토|자동|自动|自動)\s*(?:ON|OFF|온|오프|オン|オフ|切|关|關|开|開|开启)/gi,(t,index)=>{
     changed=/(?:ON|온|オン|开|開|开启)$/i.test(t);events.push({index,text:'AUTO '+(changed?'온':'오프')});return ' '.repeat(t.length);
   });
   return {rest,changed,events};
 };
 const onceCommands = commands => {
   const result=[];
   for(let i=0;i<commands.length;i++){
     const on=commands[i].match(/^(.+?) ON$/);
     if(on && commands[i+1]===on[1]+' OFF'){result.push(on[1]+' 한번만');i++;}
     else result.push(commands[i]);
   }
   return result;
 };
 const act=(payload,actor='',initial=false)=>{
   // Some Japanese lines put the character in one column and only ON/OFF
   // in another. Apply the action to the actor rather than treating it as text.
   const actorSlot=find(actor);
   const namedActor=actor&&dict.some(entry=>entry.name===trim(actor));
   const bare=trim(payload).match(/^(SET(?:ON|OFF)?|ON|OFF|切|解除|オン|オフ|关|關|开|開)$/i);
   if(namedActor&&bare){
     const enable=/^(?:SET|SETON|ON|オン|开|開)$/i.test(bare[1]);
     applyActors([{name:actor,i:actorSlot}],enable);
     append('',[(actorSlot>=0?label[actorSlot]:actor)+(enable?(initial?' SET':' ON'):' OFF')]);
     return;
   }
   const a=autoState(payload),before=auto;
   let rest=a.rest;
   if(namedActor)rest=rest.replace(/^\s*(?:(?:UB|유버|ユニオンバースト)\s*)?(?:후|직후|이후|後に|の後|後|直後)\s*/i,'');
   const skill=rest.match(/(?:s1|1スキル|技能1)\s*(?:开始后|開始後|スタート後)/i);
   if(skill)rest=rest.replace(skill[0],' ');
   const commands=[];
   let leadingActorAction=false;
   if(a.changed!==null)auto=a.changed;
   const symbols=rest.match(/[OX〇○◯●⭕❌ー－—-]{5}/i);
   if(symbols){
     commands.push(...a.events.map(e=>e.text));
     const on=[],off=[];
     [...symbols[0].toUpperCase()].forEach((mark,i)=>{
       const next=/[O〇○◯●⭕]/.test(mark);
       if(next!==state[i]){state[i]=next;(next?on:off).push(i);}
     });
     rest=rest.replace(symbols[0],' ');
     if(a.changed===null){
       rest=rest.replace(/(?:^|[\s、,，])(ON|OFF|切|オン|オフ)(?=$|[\s、,，])/i,(_,bare)=>{
         auto=/^(?:ON|オン)$/i.test(bare);commands.push('AUTO '+(auto?'온':'오프'));return ' ';
       });
     }
     if(on.length)commands.push(on.length===5?(initial?'전부 SET':'전부 ON'):ordered(on)+(initial?' SET':' ON'));
     if(off.length)commands.push(off.length===5?'전부 OFF':ordered(off)+' OFF');
   }else{
     // A leading bare ON/OFF targets the source actor, even if other commands
     // (including AUTO) follow on the same line.
     const leading=namedActor?rest.match(/^\s*(SET(?:ON|OFF)?|ON|OFF|切|解除|オン|オフ|关|關|开|開)(?=$|[\s、,，])/i):null;
     if(leading){
       leadingActorAction=true;
       const enable=/^(?:SET|SETON|ON|オン|开|開)$/i.test(leading[1]);
       applyActors([{name:actor,i:actorSlot}],enable);
       commands.push((actorSlot>=0?label[actorSlot]:actor)+(enable?(initial?' SET':' ON'):' OFF'));
       rest=rest.slice(leading[0].length);
     }
     // Consume commands in source order. Arrows inside a subject list mean
     // ordered actions; arrows between commands must never reorder ON/OFF.
     // Whole-party SET is commonly written as 全SET / 全部SET in Aikurumi notes.
     // Match whole-party commands before character names; never treat 全 as a character.
     const subject='(?:全キャラ|全員|全体|全员|全體|全部|전부|전체|전원|全|'+dictPattern+')';
     const regex=new RegExp('(?<![\\p{L}\\p{N}_])((?:'+subject+'[\\s、,，]*(?:(?:➡|→|➜|⇒|⟶)[\\s]*)?)+)\\s*(?:順に|順番に|순으로|순서대로)?\\s*(SET(?:ON|OFF)?|ON|OFF|切|解除|オン|オフ|关|關|开|開)','giu');
     let matched=false;const events=[...a.events];
     rest=rest.replace(regex,(whole,names,command,index)=>{
       matched=true;
       const enable=/^(?:SET|SETON|ON|オン|开|開)$/i.test(command);
       const all=/^(?:全キャラ|全員|全体|全员|全體|全部|전부|전체|전원|全)$/.test(names.trim());
       const actors=all?[0,1,2,3,4].map(i=>({name:label[i],i})):actorsIn(names);
       // Explicit instructions also matter when SET state is unchanged.
       applyActors(actors,enable);
       const orderedAction=/[➡→➜⇒⟶]|順に|順番に|순으로|순서대로/.test(whole)&&actors.length>1;
       events.push({index,text:(all?'전부':actorList(actors,orderedAction))+(orderedAction?' 순으로':'')+(enable?(initial?' SET':' ON'):' OFF')});
       return ' ';
     });
     commands.push(...events.sort((a,b)=>a.index-b.index).map(e=>e.text));
     if(initial&&!matched){
       const actors=actorsIn(rest);
       applyActors(actors,true);
       if(actors.length){commands.push(actors.length===5&&actors.every(actor=>actor.i>=0)?'전부 SET':actorList(actors)+' SET');rest=rest.replace(new RegExp(dictPattern,'g'),' ');}
     }
   }
   const leftover=trim(rest.replace(/(?:初動|UBセット|お団子|시작|초동|開始|开局|初始|START)/gi,'').replace(/[\s、,，:：;；\/'‘’\"()[\]（）➡→➜⇒⟶]+/g,' '));
   if(leftover){warning('미해석 원문·조건 확인: '+leftover);commands.push('[원문 확인: '+leftover+']');}
   // A fully OFF initial row still establishes the initial time/state.
   if(initial&&!commands.length&&!actor)commands.push('전부 OFF');
   const combined=onceCommands(commands);
   const explicitSequence=/[➡→➜⇒⟶]/.test(payload)&&!symbols;
   append(leadingActorAction?'':actor,explicitSequence?combined:prioritize(combined,initial),skill?'1스킬 시작 후':'');
 };
 const arrowDango=merged=>{
   const segments=merged.split(/\s*(?:➡|→|➜|⇒|⟶)\s*/);
   if(segments.length<2||!segments.every(x=>/[OX〇○◯●⭕❌ー－—-]{5}/i.test(x)))return false;
   const first=segments[0].match(/[OX〇○◯●⭕❌ー－—-]{5}/i);
   const rawActor=cleanActor(segments[0].slice(0,first.index)).replace(/[\[\]]/g,' ').trim();
   const actor=actorStart(rawActor)?.name||rawActor;
   const previousTime=lastTime;
   const actions=[],autoActions=[],unresolved=[];
   const initial=!rows.length&&(!time||time==='1:30');
   for(let j=0;j<segments.length;j++){
     const segment=segments[j],symbol=segment.match(/[OX〇○◯●⭕❌ー－—-]{5}/i);
     const before=[...state],prevAuto=auto,rowStart=rows.length;
     // Later actor labels describe the second trigger. Do not interpret them
     // as a character number or an unknown error in the joined output.
     act(segment.slice(symbol.index),'',initial&&j===0);
     const produced=rows.splice(rowStart);
     for(let i=0;i<5;i++)if(state[i]!==before[i])actions.push({i,on:state[i],step:j});
     for(const item of produced){
       if(/AUTO 온/.test(item.instruction))autoActions.push('AUTO 온');
       if(/AUTO 오프/.test(item.instruction))autoActions.push('AUTO 오프');
       for(const m of item.instruction.matchAll(/\[원문 확인: [^\]]+\]/g))unresolved.push(m[0]);
     }
     if(prevAuto!==auto&&!produced.some(r=>/AUTO (?:온|오프)/.test(r.instruction)))
       autoActions.push('AUTO '+(auto?'온':'오프'));
   }
   // Keep the final state, but a rapid ON -> OFF is a one-shot action.
   const on=[],off=[],once=[];
   const finalAction=[];
   for(let i=4;i>=0;i--){
     const events=actions.filter(e=>e.i===i);
     if(!events.length)continue;
     if(events.length===2&&events[0].on&&!events[1].on)once.push(label[i]+' 한번만');
     else{
       const latest=events.at(-1);
       (latest.on?on:off).push(i);
       finalAction.push(latest);
     }
   }
   // Arrow-separated stages are explicitly ordered. Keep their ON order,
   // but use the usual reverse-slot order within a single stage.
   const stepsOf=on.map(i=>finalAction.find(e=>e.i===i)?.step??0);
   const sequentialOn=on.length>1&&new Set(stepsOf).size>1;
   const onOrder=sequentialOn?[...on].sort((a,b)=>{
     const sa=finalAction.find(e=>e.i===a).step,sb=finalAction.find(e=>e.i===b).step;
     return sa-sb||b-a;
   }):on;
   const commands=[...once];
   if(on.length)commands.push(onOrder.map(i=>label[i]).join(', ')+(sequentialOn?' 순으로':'')+(initial?' SET':' ON'));
   if(off.length)commands.push(ordered(off)+' OFF');
   commands.push(...[...new Set(autoActions)]);
   commands.push(...[...new Set(unresolved)]);
   const instruction=prioritize(commands,initial).join(', ')||'(SET 변경 없음)';
   const head=time?(rows.length&&time===previousTime?'ㄴ ':time+' '):'';
   const named=actor?(find(actor)>=0?label[find(actor)]:actor)+' 후 ':'';
   rows.push({text:trim(head+named+instruction),checked:[...state,auto],source:sourceLine,time,actor,instruction});
   lastTime=time;
   return true;
 };
 // Boss cues are timing conditions, not sixth-party character names.
 // Preserve explicit boss names (including untranslated ones) as written.
 const bossAlias=value=>/^(?:보스|ボス|BOSS|首领|首領|敵|敌)$/i.test(trim(value));
 const bossCue=value=>{
   const text=trim(value);
   const named=bossNameStart(text);
   if(named){
     const cue=named.rest.match(/^(?:의|の)?\s*(UB|유버|ユニオンバースト|유니온버스트|스킬|スキル|공격|攻撃|평타|通常攻撃)\s*(?:후|後|직후|直後)?\s*(.*)$/i);
     const kind=cue?/(?:UB|유버|유니온버스트|ユニオンバースト)/i.test(cue[1])?' UB':
       /(?:공격|攻撃|평타)/.test(cue[1])?' 공격':' 스킬':'';
     return {context:'보스'+kind,rest:cue?trim(cue[2]):named.rest,after:!!(cue||named.rest)};
   }
   const action=text.match(/^(.{1,42}?)\s*(?:の|의|が|가)?\s*(ユニオンバースト|유니온버스트|UB|유버|필살기|必殺技|奥義|오의|通常攻撃|평타|공격|攻撃|スキル|스킬)\s*(後に|の後|後|후|이후|뒤에|뒤|直後|직후|を見て)?\s*(?:[,，、:：→➡➜⇒⟶]\s*)?(.*)$/i);
   if(action){
     const who=trim(action[1]);
     if(find(who)>=0)return null;
     const kind=/^(?:UB|유버|유니온버스트|ユニオンバースト|필살기|必殺技|奥義|오의)$/i.test(action[2])?'UB':
       /(?:공격|攻撃|평타)/.test(action[2])?'공격':'스킬';
     const rest=trim(action[4]);
     return {context:(bossAlias(who)?'보스':who)+' '+kind,rest,after:!!(action[3]||rest)};
   }
   const general=text.match(/^(보스|ボス|BOSS|首领|首領|敵|敌)\s*(?:[,，、:：→➡➜⇒⟶]\s*)?(.*)$/i);
   if(general)return {context:'보스',rest:trim(general[2]),after:!!trim(general[2])};
   return null;
 };
 const actBoss=cue=>{
   const start=rows.length;
   if(cue.rest)act(cue.rest,'',!rows.length&&(!time||time==='1:30'));
   if(rows.length>start){
     for(const row of rows.slice(start)){
       const prefix=row.text.match(/^(?:(?:\d{1,2}:[0-5]\d|ㄴ)\s*)/)?.[0]||'';
       row.text=prefix+cue.context+(cue.after?' 후 ':' ')+row.text.slice(prefix.length);
     }
   }else append('',[cue.context+(cue.after?' 후':'')]);
 };
 const processLine=input=>{
   sourceLine=trim(input);let line=sourceLine;if(!line)return;
   const t=line.match(/^(\d{1,2}:[0-5]\d)\s*/);
   if(t){time=t[1];line=trim(line.slice(t[0].length));}
   const autoLine=line.match(autoOnly);
   if(autoLine&&!/[OX〇○◯●⭕❌ー－—-]{5}/i.test(line)&&cleanActor(autoLine[1])&&
      !/(?:\b(?:SET(?:ON|OFF)?|ON|OFF)\b|切|解除|オン|オフ|关|關|开|開)/i.test(autoLine[1])){
     const rawActor=cleanActor(autoLine[1]);
     if(/(?:되자마자|보자마자|직후|즉시|見えたら|直後|すぐ)/.test(rawActor)){
       const cue=rawActor.replace(/^⭐+\s*(?:\d{1,2}:[0-5]\d)?\s*/,'');
       const enabled=/(?:ON|온|オン|开|開|开启)$/i.test(autoLine[2]);
       auto=enabled;
       append('',[cue+' AUTO '+(enabled?'온':'오프')]);
     }else{
       const actor=actorStart(rawActor);
       act(autoLine[2],actor?.name||rawActor,false);
     }
     return;
   }
   const boss=bossCue(line);
   if(boss){actBoss(boss);return;}
   const parts=line.replace(/(?:[ ]{2,}|[\u3000]+)/g,'\t').split(/\t+/).map(trim).filter(Boolean);
   if(!parts.length)return;
   if(dango){
     const merged=parts.join(' ');
     if(arrowDango(merged))return;
     const s=merged.match(/[OX〇○◯●⭕❌ー－—-]{5}/i);
     if(s){
       const rawActor=cleanActor(merged.slice(0,s.index)).replace(/[\[\]]/g,' ').trim().replace(/^(?:시작|초동|初動|開始|开局|初始|START)$/i,'');
       const a=actorStart(rawActor);
       const actor=a?.name||rawActor;
       if(!rows.length&&!actor&&(time==='1:30'||!t))time='';
       act(merged.slice(s.index),actor,!rows.length&&(!time||time==='1:30'));
     }else{
       const match=merged.match(autoOnly);
       if(match&&cleanActor(match[1])){
         const rawActor=cleanActor(match[1]),a=actorStart(rawActor);
         act(match[2],a?.name||rawActor,!rows.length&&(!time||time==='1:30'));
       }else{
         const a=actorStart(merged);
         act(a?.rest||merged,a?.name||'',!rows.length&&(!time||time==='1:30'));
       }
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
 // Same-time ON then OFF is one UB, with final SET disabled.
 for(let i=0;i<rows.length-1;i++){
   const a=rows[i],b=rows[i+1],on=a.instruction.match(/^([^,]+) ON$/);
   if(on&&a.time===b.time&&a.actor===b.actor&&b.instruction===on[1]+' OFF'){
     const instruction=on[1]+' 한번만';
     rows.splice(i,2,{...b,text:a.text.slice(0,-a.instruction.length)+instruction,instruction,source:[a.source,b.source].join('\n')});i--;
   }
 }
 // Missing initial AUTO means OFF. A later timed AUTO command is not
 // a starting-state declaration, so retain it after a separate initial row.
 if(rows.length){
   const first=rows[0],initial=!first.time||first.time==='1:30';
   if(!initial){
     rows.unshift({text:'AUTO 오프',instruction:'AUTO 오프',checked:[false,false,false,false,false,false],time:'',actor:'',source:'시작 AUTO 설정 미기재 → AUTO 오프 기본 적용'});
   }else if(!/AUTO (?:온|오프)/.test(first.instruction)){
     first.text='AUTO 오프, '+first.text;
     first.instruction='AUTO 오프, '+first.instruction;
     first.checked[5]=false;
   }
 }
 if(!rows.length)warning('변환 가능한 행을 찾지 못했습니다.');
 // Positional placeholders are intentionally valid for anonymous transfers.
 return {format,rows,warnings:warn,unmappedActors:[...unmappedActors],text:rows.map(x=>x.text).join('\n'),
 pasteText:rows.map(x=>x.checked.map(b=>b?'TRUE':'FALSE').join('\t')+'\t'+x.text).join('\n')};
}

