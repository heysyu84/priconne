// Keep the viewed month separate from the current month's editable payload.
export function createMonthView({getApp,fetchMonth,prepare=()=>{},cache=new Map()}) {
  let selected='',selection=0;
  const pending=new Map();
  const latest=()=>Object.keys(getApp().months).sort().at(-1);
  const keys=()=>[...new Set([...Object.keys(getApp().months),...(getApp().archivedMonths||[])])].sort().reverse();
  const key=()=>selected||getApp().active;
  const record=()=>getApp().months[key()]||cache.get(key());
  const isPast=()=>key()!==latest();
  async function load(month) {
    if(!/^\d{4}-\d{2}$/.test(month)||!keys().includes(month))throw Error('조회할 월을 확인해 주세요.');
    if(getApp().months[month])return getApp().months[month];
    if(cache.has(month))return cache.get(month);
    if(!pending.has(month))pending.set(month,(async()=>{
      const data=await fetchMonth(month);
      if(!data||!Array.isArray(data.events)||!Array.isArray(data.bosses))throw Error('보관된 월별 기록 형식을 확인해 주세요.');
      prepare(data);cache.set(month,data);return data;
    })().finally(()=>pending.delete(month)));
    return pending.get(month);
  }
  async function select(month) {
    const request=++selection;
    await load(month);
    if(request!==selection)return false;
    selected=month===latest()?'':month;
    return true;
  }
  return {keys,key,record,isPast,load,select,reset:()=>{selection++;selected='';},app:()=>{
    const app=getApp();
    return selected?{...app,active:key(),months:{...app.months,[key()]:record()}}:app;
  }};
}
