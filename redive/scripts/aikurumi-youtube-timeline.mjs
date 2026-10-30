import {resolveAikurumiParty} from '../public/aikurumi-character-matcher.mjs';
// Normalize operative vocabulary only. Unrecognized trigger conditions remain
// explicitly marked in the review rows, never removed or guessed.
const terms=[
 [/ユニオンバースト/g,'UB'],[/通常攻撃/g,'평타'],[/オート/g,'AUTO'],[/セット/g,'SET'],
 [/フルAUTO/gi,'全SET AUTO ON'],[/セミAUTO/gi,'세미오토'],[/最速/g,'최속'],[/連打/g,'연타'],
 [/目押し/g,'직접 발동'],[/微ディレイ/g,'살짝 지연'],[/ディレイ/g,'지연'],[/キャンセル/g,'캔슬'],
 [/モーション/g,'모션'],[/クリティカル/g,'크리티컬'],[/クリティ/g,'크리티컬'],[/着弾/g,'명중'],[/被弾/g,'피격'],
 [/吹き出し|吹出し/g,'말풍선'],[/バフ/g,'버프'],[/デバフ/g,'디버프'],[/ダメージ/g,'피해량'],
 [/スキル\s*([12])/g,'$1스킬'],[/S([12])/g,'$1스킬'],[/スキル/g,'스킬'],[/発動/g,'발동'],
 [/直後/g,'직후'],[/直前/g,'직전'],[/開始/g,'시작'],[/終了/g,'종료'],[/確認/g,'확인'],[/即座に|即時|即/g,'즉시'],
 [/手動/g,'수동'],[/切り替え/g,'전환'],[/タップ/g,'탭'],[/ボス/g,'보스'],[/秒/g,'초']
];
const translate=text=>terms.reduce((s,[pattern,replacement])=>s.replace(pattern,replacement),text);
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function normalizeYouTubeTimeline(text,{task,snapshot}={}){
 const source=String(text??'').normalize('NFKC').replace(/\r\n?/g,'\n');
 const party=task&&snapshot?resolveAikurumiParty(task.charas,snapshot.characterData?.names,snapshot.characterData?.positionUnits):null;
 const pairs=(party?.rows||[]).flatMap(r=>r.aliases.map(name=>({name:name.normalize('NFKC'),ko:r.koreanName}))).filter(r=>r.name&&r.ko).sort((a,b)=>b.name.length-a.name.length);
 const names=new Map(pairs.map(r=>[r.name,r.ko]));
 const aliasPattern=names.size?new RegExp([...names.keys()].map(escapeRegex).join('|'),'gu'):null;
 const lines=[];
 for(const raw of source.split('\n')){
  const line=raw.trim();
  if(/^(?:https?:\/\/|#|©|```|[-=━─]{3,}$|チャンネル|ご視聴|Twitter|メンバーシップ|使用楽曲|音源|BGM|お借り|撮影環境)/i.test(line))continue;
  let value=raw.replace(/^\s*(\d{1,2}):([0-5]\d)\s+/, (whole,m,s)=>Number(m)*60+Number(s)>90?'':whole)
   .replace(/^\s*([01]):([0-5]\d)(?=\S)/,'$1:$2 ')
   .replace(/^\s*0([01]):([0-5]\d)/,'$1:$2').replace(/全(?:キャラ|員|体)?\s*セット/gi,'全SET');
  if(aliasPattern)value=value.replace(aliasPattern,name=>names.get(name));
  value=translate(value);
  if(!/^\s*(?:0?[01]):[0-5]\d/.test(value)&&/全(?:キャラ|員|体)?\s*SET/i.test(value)&&value.trim().length<180
    &&!/^\s*全(?:キャラ|員|体)?\s*SET\s*(?:AUTO\s*(?:ON|OFF))?\s*$/i.test(value)){
   lines.push('조건 '+value);lines.push('全SET'+(/AUTO\s*ON/i.test(value)?' AUTO ON':/AUTO\s*OFF/i.test(value)?' AUTO OFF':''));continue;
  }
  // Preserve every instruction, including continuation lines, for the parser.
  lines.push(value);
 }
 return lines.join('\n');
}
export function translateYouTubeRow(row){
 let text=translate(String(row.text||''));
 const unresolved=/\[원문 확인:|[\u3040-\u30ff\u3400-\u9fff]/u.test(text);
 return {time:row.time||null,text,checked:Array.from({length:6},(_,i)=>!!row.checked?.[i]),needsReview:unresolved};
}
