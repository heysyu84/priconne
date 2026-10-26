// Locate the game's log labels before OCR. All coordinates returned are fractions:
// frame coordinates refer to the image, field coordinates refer to that frame.
// No nickname, damage or date is inferred from the coloured labels.
const pixelKind=(r,g,b)=>r>=150&&g<=135&&b<=190&&r>g*1.4&&r>b*1.15?1:
  b>=145&&g>=65&&r<=165&&b>r*1.2&&b>g*1.08?2:0;

function components({width,height,data}){
 const step=Math.max(1,Math.ceil(Math.max(width/1600,height/1200)));
 const w=Math.ceil(width/step),h=Math.ceil(height/step),mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(Math.min(height-1,y*step)*width+Math.min(width-1,x*step))*4;
  if(data[i+3]>=128)mask[y*w+x]=pixelKind(data[i],data[i+1],data[i+2]);
 }
 const result=[];
 for(let start=0;start<mask.length;start++){
  const kind=mask[start];if(!kind)continue;
  let head=0,tail=1,count=0,left=w,right=0,top=h,bottom=0;queue[0]=start;mask[start]=0;
  while(head<tail){
   const p=queue[head++],x=p%w,y=Math.floor(p/w);count++;
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   // Row boundaries matter: the last pixel of a row is not adjacent to the next row's first pixel.
   for(const next of [x?p-1:-1,x+1<w?p+1:-1,y?p-w:-1,y+1<h?p+w:-1]){
    if(next>=0&&mask[next]===kind){mask[next]=0;queue[tail++]=next;}
   }
  }
  const cw=right-left+1,ch=bottom-top+1,aspect=cw/ch;
  if(ch<4||cw<12||aspect<1.6||aspect>9||count/(cw*ch)<.42)continue;
  result.push({kind,x:left*step,y:top*step,w:Math.min(width,(right+1)*step)-left*step,
   h:Math.min(height,(bottom+1)*step)-top*step});
 }
 return result;
}
const end=box=>box.x+box.w;
const middle=box=>box.y+box.h/2;
const aligned=(a,b)=>Math.abs(middle(a)-middle(b))<=Math.max(a.h,b.h)*.25&&
  a.h/b.h>=.65&&a.h/b.h<=1.55;
const relative=(box,frame)=>({x:(box.x-frame.x)/frame.w,y:(box.y-frame.y)/frame.h,w:box.w/frame.w,h:box.h/frame.h});

export function detectBattleLogFrames(image){
 const {width,height,data}=image||{};
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||!data||data.length<width*height*4)return [];
 const labels=components(image),reds=labels.filter(c=>c.kind===1),blues=labels.filter(c=>c.kind===2&&c.w/c.h>=3.4&&c.w/c.h<=6.8);
 const rows=[];
 for(const blue of blues){
  const stages=reds.filter(red=>red.w/red.h>=1.8&&red.w/red.h<=4.4&&aligned(red,blue)&&
   blue.x-end(red)>=0&&blue.x-end(red)<=blue.h*1.7);
  const candidates=[];
  for(const stage of stages)for(const kind of reds){
   if(kind===stage||kind.w/kind.h<3.5||kind.w/kind.h>7.5||!aligned(kind,blue)||!aligned(kind,stage))continue;
   const gap=stage.x-end(kind);
   if(gap<0||gap>blue.h*.8||kind.w<stage.w*1.15||kind.w/blue.w<.75||kind.w/blue.w>1.5)continue;
   // A battle log has a wide battle-type pill, a narrower stage pill, then the damage label.
   const score=Math.abs(kind.w/blue.w-1.08)+Math.abs(stage.w/blue.w-.58)+Math.abs(middle(kind)-middle(blue))/blue.h;
   candidates.push({kind,stage,score});
  }
  candidates.sort((a,b)=>a.score-b.score);
  const match=candidates[0];if(!match)continue;
  const {kind,stage}=match,h=blue.h;
  const frame={x:kind.x-kind.w*1.55,y:Math.min(kind.y,blue.y)-h*.25,
   w:end(blue)+blue.w*1.18-(kind.x-kind.w*1.55),h:h*4.2};
  const boxes={
   member:{x:kind.x+kind.w*.16,y:blue.y+h*1.35,w:end(stage)-(kind.x+kind.w*.16),h:h*1.05},
   damage:{x:end(blue)+blue.w*.025,y:blue.y-h*.12,w:blue.w*1.155,h:h*1.05},
   date:{x:kind.x+kind.w*.34,y:blue.y+h*2.45,w:end(stage)-(kind.x+kind.w*.34),h:h*1.05},
   kind:{x:kind.x,y:kind.y,w:kind.w,h:kind.h},
   stage:{x:stage.x,y:stage.y,w:stage.w,h:stage.h},
   boss:{x:frame.x+kind.w*.08,y:blue.y+h*2.65,w:kind.x-kind.w*.055-(frame.x+kind.w*.08),h:h*1.05}
  };
  // A clipped row cannot supply complete evidence. Leave it to the manual crop workflow.
  if(frame.x<0||frame.y<0||frame.x+frame.w>width||frame.y+frame.h>height||
   Object.values(boxes).some(b=>b.w<=0||b.h<=0||b.x<0||b.y<0||b.x+b.w>width||b.y+b.h>height))continue;
  rows.push({...relative(frame,{x:0,y:0,w:width,h:height}),
   fields:Object.fromEntries(Object.entries(boxes).map(([name,box])=>[name,relative(box,frame)]))});
 }
 return rows.sort((a,b)=>a.y-b.y);
}
