// Aikurumi notes often mix equipment/class prerequisites with action timelines.
// Keep *all* original source text. Never convert preamble specs into SET instructions.
const mask=/[OX〇○◯●⭕❌✕×✖✗ー－—-]{5}/i;
const timed=/^(?:[（(]?\s*)?\d{1,2}:[0-5]\d(?=$|[\s\t)）:：\-－～~、,，])/;
const setup=/^(?:初動|初始|开局|開始|START|全キャラ|全員|全体|全员|全體|全部|全|전부|전체|전원)\s*(?:SET|セット|セツト)\b/i;
const auto=/^(?:(?:AUTO|オート|오토|自动|自動|자동)\s*(?:ON|OFF|オン|オフ|온|오프|開|关|關)|[OX〇○◯●⭕❌✕×✖✗ー－—-]{5})/i;
const header=/^[◆■▼●#]+\s*(?:TL|タイムライン|时间轴|時間軸|操作|UB(?:发动|発動|发動|發動)?(?:时间|時間)?|開始|注意|配置|育成|职阶|職階)/i;
const comment=/^(?:---+|===+|\s*◆\s*(?:备注|備考|注意))/i;

// Some sources omit the colon in 1:13 or mark a time with a leading star.
// Apply these conversions only to actionable timeline lines; never to notes.
const shorthand=/^([01])([0-5][0-9])(?=[ \t、，:：])/;
const starTime=/^[☆⭐★✩]+\s*(?=\d{1,2}:[0-5]\d|[01][0-5][0-9](?=[ \t、，:：]))/;
export function normalizeAikurumiActionLine(line) {
  const input=String(line??'');
  const leading=input.match(/^\s*/)?.[0]||'';
  const raw=input.slice(leading.length);
  const withoutStar=raw.replace(starTime,'');
  const canonical=withoutStar.replace(shorthand,(_,minute,seconds)=>minute+':'+seconds);
  return leading+canonical;
}

export function splitAikurumiTimeline(raw){
  const original=String(raw??'').replace(/\r\n?/g,'\n');
  const lines=original.split('\n');
  const isAction=line=>{
    const t=line.trim();
    return timed.test(t)||setup.test(t)||auto.test(t)||mask.test(t)&&!/[★☆]\s*[0-9]/.test(t);
  };
  const start=lines.findIndex(isAction);
  if(start<0) return {original,timeline:'',notes:original.trim(),hasAction:false,firstActionLine:null};
  const notes=lines.slice(0,start);
  const actions=[];
  for(const line of lines.slice(start)){
    if(header.test(line.trim())||comment.test(line.trim())) notes.push(line);
    else actions.push(normalizeAikurumiActionLine(line));
  }
  return {
    original,
    timeline:actions.join('\n').trim(),
    notes:notes.join('\n').trim(),
    hasAction:true,
    firstActionLine:start+1
  };
}
