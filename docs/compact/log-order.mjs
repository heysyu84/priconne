const ordered=records=>[...records].sort((a,b)=>a.seq-b.seq);
export function insertRecord(records,record,anchorId=null,side='after'){
  const next=ordered(records);let index=next.length;
  if(anchorId){index=next.findIndex(row=>row.id===anchorId);if(index<0)throw Error('기준 기록을 찾지 못했습니다.');if(next[index].day!==record.day)throw Error('같은 일차 안에서 추가하세요.');if(side==='after')index++;}
  else if(next.some(row=>row.day>record.day))index=next.findIndex(row=>row.day>record.day);
  next.splice(index,0,record);
  return next.map((row,i)=>({...row,seq:i+1}));
}
export function moveRecord(records,id,anchorId,side='before'){
  if(id===anchorId)return ordered(records);
  const source=records.find(row=>row.id===id),anchor=records.find(row=>row.id===anchorId);
  if(!source||!anchor)throw Error('이동할 기록을 찾지 못했습니다.');
  if(source.day!==anchor.day)throw Error('같은 일차 안에서 이동하세요.');
  return insertRecord(records.filter(row=>row.id!==id),source,anchorId,side);
}
export function refreshClosures(closures,records){
  return closures.map(boundary=>{
    const day=boundary.day??boundary.nextDay-1,count=records.filter(row=>row.day<=day).length;
    return {...boundary,day,count,afterSeq:Math.max(0,...records.filter(row=>row.day<=day).map(row=>row.seq)),nextDay:day+1};
  });
}
