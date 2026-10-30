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
export function normalizeYouTubeTimeline(text){
 const source=String(text??'').normalize('NFKC').replace(/\r\n?/g,'\n');
 const lines=[];
 for(const raw of source.split('\n')){
  const line=raw.trim();
  if(/^(?:https?:\/\/|#|©|チャンネル|ご視聴|Twitter|メンバーシップ|使用楽曲|音源|BGM|お借り|撮影環境)/i.test(line))continue;
  let value=raw.replace(/^\s*(\d{1,2}):([0-5]\d)\s+/, (whole,m,s)=>Number(m)*60+Number(s)>90?'':whole)
   .replace(/^\s*([01]):([0-5]\d)(?=\S)/,'$1:$2 ')
   .replace(/^\s*0([01]):([0-5]\d)/,'$1:$2').replace(/全(?:キャラ|員|体)?\s*セット/gi,'全SET');
  // Preserve every instruction, including continuation lines, for the parser.
  lines.push(value);
 }
 return lines.join('\n');
}
export function translateYouTubeRow(row){
 let text=String(row.text||'');
 for(const [pattern,replacement]of terms)text=text.replace(pattern,replacement);
 const unresolved=/\[원문 확인:|[\u3040-\u30ff\u3400-\u9fff]/u.test(text);
 return {time:row.time||null,text,checked:Array.from({length:6},(_,i)=>!!row.checked?.[i]),needsReview:unresolved};
}
