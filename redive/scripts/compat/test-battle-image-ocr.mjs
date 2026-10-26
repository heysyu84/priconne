import assert from 'node:assert/strict';
import {detectBattleLogFrames} from '../../public/compat/battle-image-ocr.mjs';

function screenshot({width=1280,height=590,scale=1,dx=0,dy=0,rows=[160,267,374],textHoles=true}={}){
 const data=new Uint8ClampedArray(width*height*4);data.fill(255);
 const rect=(x,y,w,h,color)=>{
  const left=Math.round(x*scale+dx),top=Math.round(y*scale+dy),right=Math.round((x+w)*scale+dx),bottom=Math.round((y+h)*scale+dy);
  for(let yy=Math.max(0,top);yy<Math.min(height,bottom);yy++)for(let xx=Math.max(0,left);xx<Math.min(width,right);xx++){
   const i=(yy*width+xx)*4;data.set([...color,255],i);
  }
 };
 const label=(x,y,w,h,color)=>{
  rect(x,y,w,h,color);
  if(textHoles)for(let i=0;i<3;i++)rect(x+12+i*18,y+7,8,h-14,[255,255,255]);
 };
 // The top tabs and each date label are blue too, but must never become damage rows.
 label(179,71,96,27,[74,132,227]);
 label(610,71,120,27,[74,132,227]);
 for(const y of rows){
  label(389,y+1,130,25,[202,35,90]);
  label(524,y+2,69,22,[228,97,107]);
  label(612,y,120,24,[96,154,238]);
  label(389,y+60,43,24,[96,154,238]);
 }
 return {width,height,data};
}
function absoluteField(frame,field,image){
 const box=frame.fields[field];
 return {x:(frame.x+box.x*frame.w)*image.width,y:(frame.y+box.y*frame.h)*image.height,
  w:box.w*frame.w*image.width,h:box.h*frame.h*image.height};
}
function assertNear(actual,expected,tolerance=3){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} should be within ${tolerance} of ${expected}`);}

const sample=screenshot(),frames=detectBattleLogFrames(sample);
assert.equal(frames.length,3);
for(const [i,frame] of frames.entries()){
 const top=[160,267,374][i];
 const damage=absoluteField(frame,'damage',sample),member=absoluteField(frame,'member',sample),date=absoluteField(frame,'date',sample);
 assertNear(damage.x,735);assertNear(damage.y,top-3);assertNear(damage.w,139);
 assert.ok(damage.x>732,'number crop excludes the entire blue damage label');
 assertNear(member.x,410);assertNear(member.y,top+32);assertNear(member.w,183);
 assertNear(date.x,433);assertNear(date.y,top+59);
 assert.ok(member.x>389&&member.x+member.w<=594,'nickname excludes its reset icon and next column');
 assert.ok(frame.fields.kind&&frame.fields.stage&&frame.fields.boss);
 for(const field of Object.values(frame.fields)){
  assert.ok(field.x>=0&&field.y>=0&&field.x+field.w<=1&&field.y+field.h<=1,'every field lies inside the returned frame');
 }
}

for(const config of [
 {width:2560,height:1180,scale:2},
 {width:1920,height:1080,scale:1.25,dx:110,dy:80},
 {width:1000,height:800,scale:.7,dx:37,dy:180},
 {width:3840,height:2160,scale:2,dx:300,dy:200}
]){
 const image=screenshot(config),detected=detectBattleLogFrames(image);
 assert.equal(detected.length,3,JSON.stringify(config));
 const damage=absoluteField(detected[0],'damage',image);
 assertNear(damage.x,735*config.scale+(config.dx||0),6);
 assertNear(damage.y,157*config.scale+(config.dy||0),6);
}

// Complete rows survive at an image edge; a partly clipped last row does not.
assert.equal(detectBattleLogFrames(screenshot({height:420})).length,2);
assert.equal(detectBattleLogFrames(screenshot({rows:[160]})).length,1);
assert.deepEqual(detectBattleLogFrames(screenshot({rows:[]})),[]);
assert.deepEqual(detectBattleLogFrames({width:0,height:0,data:[]}),[]);
assert.deepEqual(detectBattleLogFrames({width:1280,height:590,data:[]}),[]);
// No red stage badge: do not invent a row from unrelated red and blue controls.
const withoutStage=screenshot({rows:[160],textHoles:false});
for(let y=162;y<184;y++)for(let x=524;x<593;x++)withoutStage.data.fill(255,(y*1280+x)*4,(y*1280+x)*4+4);
assert.deepEqual(detectBattleLogFrames(withoutStage),[]);

console.log('PASS: adaptive battle-log crops, scale/margins, label exclusion and incomplete-row rejection');
