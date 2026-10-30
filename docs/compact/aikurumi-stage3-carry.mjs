// Stage-3 carry time is the time received AFTER defeating the boss.
// It is not the "carry tactic" (持越編成) source category.
export const MAX_CARRY_SECONDS = 90;

export function parseStage3CarryTime(label) {
  const source=String(label??'');
  const full=/(?:满|滿)\s*(?:补|補)/u.test(source);
  const patterns=[...source.matchAll(/(?:余|餘|残り|残)\s*([0-9]{1,3})\s*([+＋])\s*([0-9]{1,3})\s*(?:s|秒|ｓ)(?![a-z])/giu)];
  if(full && patterns.length || patterns.length>1)
    return {status:'ambiguous',seconds:null,remainingSeconds:null,bonusSeconds:null,raw:source,reason:'Conflicting carry-time descriptions'};
  if(full)
    return {status:'full',seconds:MAX_CARRY_SECONDS,remainingSeconds:90,bonusSeconds:0,raw:source,reason:null};
  if(patterns.length===1){
    const remaining=Number(patterns[0][1]),bonus=Number(patterns[0][3]);
    if(remaining>90||bonus>90||bonus<0)
      return {status:'invalid',seconds:null,remainingSeconds:remaining,bonusSeconds:bonus,raw:source,reason:'Carry seconds outside supported combat range'};
    return {status:'remaining-plus-bonus',
      seconds:Math.min(MAX_CARRY_SECONDS,remaining+bonus),
      remainingSeconds:remaining,bonusSeconds:bonus,raw:source,reason:null,
      capped:remaining+bonus>MAX_CARRY_SECONDS};
  }
  return {status:'unknown',seconds:null,remainingSeconds:null,bonusSeconds:null,raw:source,reason:'No explicit carry-time notation'};
}
export function formatCarrySeconds(seconds) {
  if(seconds===null||seconds===undefined||!Number.isInteger(seconds)||seconds<0)return '시간 미확인';
  return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
export function carryTimeLabel(carry){
  if(carry?.seconds===null||carry?.seconds===undefined)return '이월시간 미표기';
  return '이월 '+formatCarrySeconds(carry.seconds)+' ('+carry.seconds+'초)';
}
