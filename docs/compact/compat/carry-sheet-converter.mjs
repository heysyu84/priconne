// Table-format carry tactics need font color, persistent SET/AUTO state and UB timing together.
const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/\s+/g,'').toLowerCase();
const escape=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const rowNumber=ref=>Number(ref.match(/\d+$/)?.[0]||0);
const preferred={'페리컬':'리리컬'};
const unique=values=>[...new Set(values.filter(v=>v!==undefined&&v!==null&&v!==''))];
const value=(sheet,ref)=>clean(sheet.cells[ref]?.value);
const clock=n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
function damageUnits(input){
  const raw=clean(input).replace(/[,\s]/g,'').replace(/(?:딜량|피해량|대미지|데미지|딜)$/,'');
  if(!raw)return null;
  const number='(\\d+(?:\\.\\d+)?)';
  const m=raw.match(new RegExp('^(?:'+number+'억)?(?:'+number+'만)?(?:'+number+')?$'));
  if(!m||(!m[1]&&!m[2]&&!m[3]))return null;
  const decimal=(text,multiplier)=>{if(!text)return 0n;const [whole,fraction='']=text.split('.');return BigInt(whole+fraction)*multiplier/(10n**BigInt(fraction.length));};
  return decimal(m[1],100000000n)+decimal(m[2],10000n)+decimal(m[3],10000n);
}
export function minimumCarryDamage(input){
  const low=clean(input).split(/[~～〜]/)[0],units=damageUnits(low);
  if(units===null)throw Error('기대딜 범위를 읽지 못했습니다: '+clean(input));
  // Integer arithmetic prevents 0.29 becoming 0.28 through floating-point truncation.
  const hundredths=units/1000000n;
  return hundredths/100n+'.'+String(hundredths%100n).padStart(2,'0');
}
export function checkpointDamage(input){
  const units=damageUnits(input);if(units===null)return clean(input);
  const eok=units/100000000n,man=(units%100000000n)/10000n,rest=units%10000n;
  const tail=man+(rest?'.'+String(rest).padStart(4,'0').replace(/0+$/,''):'');
  return eok?(eok+'억'+(man||rest?' '+tail+'만':'')):tail+'만';
}
export function carrySnapshot(input,previous=Array(6).fill(false)){
  const raw=clean(input).replace(/[\uFE0E\uFE0F\u200D]/g,''),checked=[...previous];
  const match=raw.match(/\[([^\]]+)\]/);
  let explicit=false,invalid=false;
  if(match){
    const tokens=[...match[1].replace(/\s+/g,'')];
    if(tokens.length===5&&tokens.every(s=>/[oOxX〇○◯●⭕❌ー－—-]/.test(s))){
      tokens.forEach((s,i)=>{if(/[oO〇○◯●⭕]/.test(s))checked[i]=true;else if(/[xX❌]/.test(s))checked[i]=false;});explicit=true;
    }else invalid=true;
  }
  const auto=raw.match(/(?:AUTO|오토|자동)\s*[:：]?\s*(ON|OFF|온|오프|⭕|❌|○|〇|O|X)/i);
  const tail=match?clean(raw.slice(match.index+match[0].length)):'';
  if(auto)checked[5]=/^(?:ON|온|⭕|○|〇|O)$/i.test(auto[1]);
  else if(/^[⭕○〇OX❌]$/i.test(tail))checked[5]=/^[⭕○〇O]$/i.test(tail);
  return {checked,explicit,autoExplicit:!!auto||/^[⭕○〇OX❌]$/i.test(tail),invalid};
}
function tpCondition(raw){
  if(!raw)return '';
  if(/(?:부스트|부스터)\s*유닛\s*없음/.test(raw))return '부스터 없음';
  const match=raw.match(/(\d+(?:\.\d+)?)\s*(이상|이하|미만|도\s*가능)/)||raw.match(/(\d+\.\d+)/);
  if(!match)return raw;
  const n=Number(match[1]).toFixed(1),suffix=match[2]==='이상'?'+':match[2]==='이하'?' 이하':match[2]==='미만'?' 미만':'';
  const context=raw.replace(match[0],'').replace(/최소\s*|최대\s*/g,'').replace(/^[\s()]+|[\s()]+$/g,'').trim();
  return n+suffix+(context?' ('+context+')':'');
}
function sourceClock(sheet,row){
  let raw=value(sheet,'B'+row);
  if(!raw&&sheet.cells['B'+row]?.formula){
    const seconds=value(sheet,'W'+row);
    if(/^\d+(?:[~～]\d+)?$/.test(seconds))raw=seconds.split(/[~～]/).map(s=>clock(Number(s))).join('~');
  }
  if(/^\d+(?:\.\d+)?$/.test(raw)){
    let n=Number(raw);if(n>0&&n<1)n=Math.round(n*86400);else n=Math.round(n);
    if(n>=0&&n<=600)raw=clock(n);
  }
  return raw.replace(/\s*([~～])\s*/g,'$1');
}
function nameTools(rawNames,catalog,aliases){
  const official=raw=>{
    const requested=aliases[norm(raw)]||preferred[raw]||raw,key=norm(requested);
    return catalog.find(c=>norm(c.name)===key)?.name||catalog.find(c=>c.aliases?.some(a=>norm(a)===key))?.name||clean(requested);
  };
  const characters=rawNames.map(official);
  const names=characters.map((name,i)=>unique([rawNames[i],name,...(catalog.find(c=>c.name===name)?.aliases||[]),...Object.entries(preferred).filter(([,v])=>v===name).map(([k])=>k)]));
  const dict=names.flatMap((values,i)=>values.map(name=>({name,i}))).sort((a,b)=>b.name.length-a.name.length);
  const regex=new RegExp(dict.map(x=>escape(x.name)).join('|'),'g');
  const replace=text=>String(text).replace(regex,token=>characters[dict.find(d=>d.name===token).i]);
  const actors=text=>unique([...String(text).matchAll(regex)].map(m=>dict.find(d=>d.name===m[0]).i));
  return {characters,replace,actors};
}
const prettySource=text=>clean(text).replace(/^■\s*/,'').replace(/\s+/g,' ');
const cancelTiming=text=>/(?:평타\s*(?:후딜\s*)?캔슬|평타\s*캔|후딜\s*캔(?:슬)?|스킬\s*캔(?:슬)?|평타\s*후|스킬\s*후)/.test(text);
function compileRow({time,raw,snapshot,damage,gray,source,previous,characters,tools}){
  const parsed=carrySnapshot(snapshot,previous),checked=parsed.checked,description=prettySource(tools.replace(raw));
  const actorIndices=tools.actors(raw),actor=actorIndices[0],name=characters[actor];
  const on=[],off=[];for(let i=4;i>=0;i--)if(previous[i]!==checked[i])(checked[i]?on:off).push(i);
  const changes=on.length||off.length||previous[5]!==checked[5];
  const isBoss=/^\s*■|보스\s*(?:유버|범위|광역|공격)/.test(raw);
  const timed=cancelTiming(description),automatic=/오토|AUTO|자동/i.test(description);
  const arrows=/[→➡➜⇒]/.test(raw);
  const warnings=[];if(parsed.invalid)warnings.push('SET 칸의 5개 표시를 확인해 주세요.');
  if(gray&&changes)warnings.push('회색으로 표시된 행에 SET·AUTO 변경이 있어 조작 여부를 확인해 주세요.');
  let kind='reference',body='',once=false,manual=false;
  if(gray&&!changes){
    kind=damage?'damage':'reference';body=damage?'(중간딜 '+checkpointDamage(damage)+')':description+' (자동 진행)';
  }else if(isBoss&&!changes){
    kind=damage?'damage':'reference';body=description;
  }else{
    // A named UB with no persistent SET and no AUTO is a single manual UB.
    // A passive gray checkpoint is handled above and never becomes an action.
    once=actor!==undefined&&!previous[actor]&&!checked[actor]&&(timed||!previous[5])&&!automatic&&!isBoss;
    if(arrows&&!changes&&actorIndices.length>1){
      const manualActors=actorIndices.filter(i=>!previous[i]&&!previous[5]);
      if(manualActors.length>1){warnings.push('화살표로 이어진 수동 유버 순서를 확인해 주세요.');once=false;}
    }
    if(once||changes){
      kind='control';manual=once||timed;
      const commands=[];
      const rest=name?clean(description.replace(name,'')):'';
      if(once)commands.push((rest&&!arrows?rest+' ':'')+name+' 한번만');
      let orderedOn=[...on];
      if(arrows){const explicit=actorIndices.filter(i=>on.includes(i));orderedOn=[...explicit,...on.filter(i=>!explicit.includes(i))];}
      if(orderedOn.length)commands.push(orderedOn.map(i=>characters[i]).join(', ')+(arrows&&orderedOn.length>1?' 순으로':'')+' ON');
      if(!previous[5]&&checked[5])commands.push('AUTO 온');
      if(off.length)commands.push(off.map(i=>characters[i]).join(', ')+' OFF');
      if(previous[5]&&!checked[5])commands.push('AUTO 오프');
      if(once)body=commands.join(', ');
      else if(timed&&actor!==undefined&&on.includes(actor))body=(rest?rest+' ':'')+commands.join(', ');
      else body=(description?description+' 후 ':'')+commands.join(', ');
      if(arrows&&on.length&&actor!==undefined&&!on.includes(actor))body=name+' 후 '+commands.join(', ');
    }else{
      body=description;
      if(timed&&actor!==undefined){warnings.push('캔슬 시점과 현재 SET·AUTO 상태를 함께 확인해 주세요.');kind='review';}
    }
  }
  if(damage&&kind!=='damage')body+=' (중간딜 '+checkpointDamage(damage)+')';
  if(!body)return null;
  return {text:(time?time+' ':'')+body,checked,kind,review:warnings,manual,source:{...source,raw,snapshot,damage,gray},
    _actor:actor,_on:on,_onlyOn:kind==='control'&&!once&&on.length===1&&!off.length&&previous[5]===checked[5],_body:body};
}
function parseBlock(sheet,start,next,index,catalog,aliases){
  const header=start-7,boss=Number(sheet.name.match(/\d/)[0]),rawNames='BCDEF'.split('').map(c=>value(sheet,c+(start-2)));
  if(rawNames.some(n=>!n))return {error:sheet.name+' D'+start+': 캐릭터 5명의 이름을 찾지 못했습니다.'};
  const tools=nameTools(rawNames,catalog,aliases),characters=tools.characters;
  const warnings=[];
  const unknown=characters.filter(n=>!catalog.some(c=>norm(c.name)===norm(n)));
  if(catalog.length&&unknown.length)warnings.push('캐릭터 이름 확인: '+unknown.join(', '));
  const damageRange=value(sheet,'B'+header);let expectedDamage='';
  try{expectedDamage=minimumCarryDamage(damageRange);}catch(error){warnings.push(error.message);}
  const carryText=value(sheet,'E'+header),carrySeconds=Number(carryText.match(/\d+/)?.[0])||null;
  const noteCell=Object.entries(sheet.cells).find(([ref,c])=>ref.startsWith('B')&&rowNumber(ref)>start&&rowNumber(ref)<next&&/유의사항/.test(c.value));
  const note=noteCell?.[1].value||'',noteRow=noteCell?rowNumber(noteCell[0]):next;
  const tpRaw=note.match(/사용[ \t]*TP[ \t]*차지[ \t]*:[ \t]*([^\r\n]*)/i)?.[1]?.trim()||'';
  const noteLines=note.replace(/^[\s✅]*유의사항\s*:[ \t]*/,'').split(/\r?\n/)
    .filter(line=>!/^\s*(?:사용\s*TP\s*차지\s*:|영상\s*$|원본D\d+T\d+\s*$)/i.test(line)).map(clean).filter(Boolean);
  const preparation=value(sheet,'B'+start);if(preparation&&!/Set\s*\[/i.test(preparation))noteLines.unshift('사전 준비: '+tools.replace(preparation));
  const extra=[];
  for(const [ref,c]of Object.entries(sheet.cells)){
    const r=rowNumber(ref),col=ref.replace(/\d+$/,'');
    if(r>=header&&r<noteRow&&col.length===1&&col>='G'&&col<='Q'&&c.value&&/[가-힣a-z]/i.test(c.value)&&c.value.length<600&&!/^https?:/i.test(c.value))extra.push(clean(c.value).replace(/^[\s↑]+/,''));
  }
  const memo=unique([carrySeconds?'필요 이월시간: '+carrySeconds+'초':'',...noteLines,...extra.map(s=>'참고: '+tools.replace(s))]).join(' · ');
  const initialText=value(sheet,'D'+start),initial=carrySnapshot(initialText),rows=[];
  if(!initial.explicit)warnings.push('초기 SET 5칸을 확인해 주세요.');
  const enabled=characters.map((_,i)=>i).reverse().filter(i=>initial.checked[i]);
  rows.push({text:'AUTO '+(initial.checked[5]?'온':'오프')+(enabled.length?', '+(enabled.length===5?'전부':enabled.map(i=>characters[i]).join(', '))+' SET':''),checked:initial.checked,kind:'initial',review:[],manual:false,source:{sheet:sheet.name,cell:'D'+start,raw:initialText,snapshot:initialText,damage:'',gray:false}});
  let checked=initial.checked,lastTime='',lastExplicitTime='';
  for(let r=start+1;r<noteRow;r++){
    const raw=value(sheet,'C'+r),snapshot=value(sheet,'E'+r),damage=value(sheet,'F'+r);
    if(!raw&&!snapshot&&!damage)continue;
    const explicitTime=sourceClock(sheet,r),time=explicitTime||lastTime;
    const entry=compileRow({time,raw,snapshot,damage,gray:!!sheet.cells['C'+r]?.gray,previous:checked,characters,tools,source:{sheet:sheet.name,cell:'C'+r,time:explicitTime}});
    if(!entry)continue;
    const before=rows.at(-1);
    // Untimed continuation rows define an explicit action sequence, not simultaneous targets.
    if(!explicitTime&&entry._onlyOn&&before?._onlyOn&&before._on?.at(-1)===entry._actor&&time===lastTime){
      const targets=unique([...(before._sequence||before._on),...entry._on]);
      const prefix=before._actor!==undefined?characters[before._actor]+' 후 ':'';
      const mid=before.source.damage?' (중간딜 '+checkpointDamage(before.source.damage)+')':'';
      before.text=(time?time+' ':'')+prefix+targets.map(i=>characters[i]).join(', ')+' 순으로 ON'+mid;
      before.checked=entry.checked;before._sequence=targets;before._on=entry._on;before.source.continuations??=[];before.source.continuations.push(entry.source);before.review.push(...entry.review);
    }else{
      if(!explicitTime&&time&&time===lastExplicitTime)entry.text=entry.text.replace(time+' ','ㄴ ');
      rows.push(entry);
    }
    checked=entry.checked;if(explicitTime)lastExplicitTime=explicitTime;lastTime=time;
  }
  const stars=characters.map(name=>{
    const c=catalog.find(c=>c.name===name),available=Object.keys(c?.byStar||{}).filter(s=>/^[1-6]$/.test(s));
    return available.length===1?available[0]:'5';
  });
  return {id:sheet.name+'-'+index,boss,index,characters,stars,expectedDamage,tp:tpCondition(tpRaw),tpRaw,note:memo,video:noteCell?sheet.links[noteCell[0]]||'':'',carrySeconds,damageRange,manualCount:String(rows.filter(r=>r.manual).length),
    rows,warnings,source:{sheet:sheet.name,cell:'D'+start},group:'이월 택틱'};
}
export function convertCarryWorkbook(workbook,{catalog=[],aliases={}}={}){
  const tactics=[],errors=[],notices=[];
  for(const sheet of workbook.sheets){
    if(!/^[1-5]\s*넴$/.test(sheet.name)){
      for(const [cell,c]of Object.entries(sheet.cells))if(clean(c.value))notices.push({sheet:sheet.name,cell,text:clean(c.value)});
      continue;
    }
    const starts=Object.entries(sheet.cells).filter(([ref,c])=>/^D\d+$/.test(ref)&&/^set\s*\[/i.test(clean(c.value))).map(([ref])=>rowNumber(ref)).sort((a,b)=>a-b);
    if(!starts.length){errors.push(sheet.name+': 초기 Set [OOOOO] 형식의 택틱을 찾지 못했습니다.');continue;}
    for(let i=0;i<starts.length;i++){
      const end=i+1<starts.length?starts[i+1]-7:Math.max(...Object.keys(sheet.cells).map(rowNumber))+1;
      const tactic=parseBlock(sheet,starts[i],end,i+1,catalog,aliases);
      if(tactic.error)errors.push(tactic.error);else tactics.push(tactic);
    }
  }
  if(tactics.length>200)throw Error('한 번에 200개 이하의 택틱을 불러올 수 있습니다.');
  return {tactics,errors,notices};
}
export const carryTacticBody=tactic=>tactic.rows.map(row=>row.text.replace(/[\r\n\t]+/g,' ')).join('\n');
export const carryTacticPaste=tactic=>tactic.rows.map(row=>row.checked.map(Boolean).map(v=>v?'TRUE':'FALSE').join('\t')+'\t'+row.text.replace(/[\r\n\t]+/g,' ')).join('\n');
export const carryTacticMetadata=tactic=>({kind:'carry-sheet',group:'이월 택틱',boss:tactic.boss,stars:[...tactic.stars],expectedDamage:tactic.expectedDamage,tp:tactic.tp,manualCount:tactic.manualCount,note:tactic.note,video:tactic.video});
