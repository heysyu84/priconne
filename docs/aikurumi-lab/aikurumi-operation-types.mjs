// Aikurumi source categories are preserved separately from the carry flag.
// Link "type" is a source-provided operation code, not inferred from the TL.
export const SOURCE_OPERATION_TYPES=Object.freeze({
  10:'manual',
  20:'full-auto',
  40:'semi-auto',
  50:'easy-manual'
});
export const OPERATION_LABELS=Object.freeze({
  'manual':'손컨',
  'easy-manual':'간단손컨',
  'semi-auto':'세미오토',
  'full-auto':'풀오토',
  'carry':'이월용',
  'unknown':'미분류'
});
export function classifySourceTactic(task,link){
  const code=Number(link?.type);
  const sourceModes=Array.isArray(task?.canAuto)?task.canAuto.map(Number):[];
  // Never infer a specific operation mode if the individual source link is ambiguous.
  const operation=Object.hasOwn(SOURCE_OPERATION_TYPES,code)?SOURCE_OPERATION_TYPES[code]:
    sourceModes.length===1&&Object.hasOwn(SOURCE_OPERATION_TYPES,sourceModes[0])
      ?SOURCE_OPERATION_TYPES[sourceModes[0]]:'unknown';
  const carry=Number(task?.type)===1;
  return {
    operation,carry,
    categories:[operation,...(carry?['carry']:[])],
    sourceOperationCode:Number.isFinite(code)?code:null,
    confidence:Object.hasOwn(SOURCE_OPERATION_TYPES,code)?'source-link':
      sourceModes.length===1?'single-source-mode':'unclassified'
  };
}
export function sourceDamage(task,mode='full-auto',link=null){
  const fields={'manual':'damage','easy-manual':'easyManualDamage',
    'semi-auto':'halfAutoDamage','full-auto':'autoDamage'};
  const n=Number(task?.[fields[mode]||'autoDamage']);
  const viaLink=Number(link?.damage);
  // Link-specific value takes precedence only when present and positive.
  return Number.isFinite(viaLink)&&viaLink>0?viaLink:Number.isFinite(n)&&n>0?n:0;
}
