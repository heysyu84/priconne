import { BOSS_ACCENTS, BOSS_INK, tenureMonths } from './guild-model.mjs?v=20261022-ui14';
const W=1240,H=1754,PAD=72;
let reportFontsReady=null;
const nf=n=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:2}):'산정 대기';
const formatContribution=n=>Number.isFinite(n)?Math.round(n).toLocaleString('ko-KR'):'산정 대기';
export function pdfFromJpegs(pages){
  const encoder=new TextEncoder(),chunks=[],offsets=[0];let length=0;
  const write=value=>{const b=typeof value==='string'?encoder.encode(value):value;chunks.push(b);length+=b.length;};
  write('%PDF-1.4\n% binary\n');
  const object=(id,body)=>{offsets[id]=length;write(`${id} 0 obj\n`);write(body);write('\nendobj\n');};
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  pages.forEach((page,i)=>{const id=3+i*3;object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);offsets[id+1]=length;write(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.length} >>\nstream\n`);write(page);write('\nendstream\nendobj\n');const content=`q 595.28 0 0 841.89 0 0 cm /Im${i} Do Q`;object(id+2,`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);});
  const xref=length;write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(let i=1;i<offsets.length;i++)write(String(offsets[i]).padStart(10,'0')+' 00000 n \n');write(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return bytes;
}
export async function downloadProfilePdf(data){
  if(typeof FontFace!=='undefined'){reportFontsReady||=Promise.all([['400','Regular'],['700','SemiBold']].map(async([weight,file])=>{const face=new FontFace('Nyang Report',`url(${new URL(`./fonts/Pretendard-${file}.ttf`,import.meta.url).href})`,{weight});await face.load();document.fonts.add(face);}));await reportFontsReady;}
  await document.fonts.ready;
  const pages=[],canvases=[];let canvas,ctx,y,page=0;
  const text=(value,x,top,size=22,bold=false,color='#3b3350',align='left')=>{ctx.fillStyle=color;ctx.font=`${bold?700:400} ${size}px "Nyang Report", "Noto Sans KR", "Arial", sans-serif`;ctx.textAlign=align;ctx.fillText(String(value),x,top);ctx.textAlign='left';};
  const line=top=>{ctx.fillStyle='#e7e0ef';ctx.fillRect(PAD,top,W-PAD*2,2);};
  function start(){canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.fillStyle='#8062b0';ctx.fillRect(0,0,W,14);text('냥냥클랜 리리다이브',PAD,75,25,true,'#8062b0');text(data.month+(data.all?' · 클랜 전체 기록':' · 개인 이력서'),W-PAD,75,22,false,'#6e627e','right');line(100);page++;text(`${data.p?.name||data.summary.name}`,PAD,165,42,true);text(data.all?`${data.day}일차까지 · 클랜 전체 합계`:`UID ${data.p?.uid||'미기재'}   |   ${data.day}일차까지`,PAD,205,20,false,'#6e627e');if(!data.all)text(`소속 ${tenureMonths(data.p||{})??'미상'}개월`,W-PAD,165,21,false,'#6e627e','right');text(String(page),W/2,H-38,18,false,'#9b90a7','center');y=245;canvases.push(canvas);}
  function need(height){if(y+height>H-85)start();}
  function heading(label){need(95);text(label,PAD,y+35,26,true);y+=64;}
  function row(cells,widths,header=false,colors=null){need(52);if(header){ctx.fillStyle='#f2edf8';ctx.fillRect(PAD,y,W-PAD*2,48);}let x=PAD;cells.forEach((cell,i)=>{if(colors?.[i]){ctx.fillStyle=colors[i];ctx.fillRect(x+3,y+5,widths[i]-6,38);}const right=!!cell?.right,value=cell?.text??cell;text(value,x+(right?widths[i]-15:12),y+32,20,header||i===0,'#3b3350',right?'right':'left');x+=widths[i];});y+=48;line(y);}
  function donuts(events,label,x,top){
    text(label,x+120,top,22,true,'#3b3350','center');const values=data.bosses.map(b=>events.filter(e=>e.boss===b.id).reduce((s,e)=>s+e.actual,0)),sum=values.reduce((s,v)=>s+v,0);let a=-Math.PI/2;
    ctx.lineWidth=40;values.forEach((v,i)=>{const b=a+(sum?v/sum:0)*Math.PI*2;if(v&&sum){ctx.strokeStyle=BOSS_ACCENTS[i];ctx.beginPath();ctx.arc(x+120,top+135,82,a,b);ctx.stroke();}a=b;});if(!sum){ctx.strokeStyle='#eeeaf4';ctx.beginPath();ctx.arc(x+120,top+135,82,0,Math.PI*2);ctx.stroke();}text(sum?events.length+'타':'기록 없음',x+120,top+143,22,true,'#695682','center');
    values.forEach((v,i)=>{ctx.fillStyle=BOSS_ACCENTS[i];ctx.fillRect(x+12,top+255+i*30,16,16);text(`${i+1}넴`,x+38,top+270+i*30,18);text(`${sum?(v/sum*100).toFixed(1):'0.0'}%`,x+226,top+270+i*30,18,true,BOSS_INK[i],'right');});
  }
  start();
  [['실제 피해량',data.summary.damage],['기여도',data.summary.contribution],['인게임 스코어',data.summary.game]].forEach(([label,value],i)=>{const x=PAD+i*365;ctx.fillStyle='#f7f3fc';ctx.fillRect(x,y,350,105);text(label,x+18,y+32,20);text(label==='기여도'?formatContribution(value):nf(value),x+18,y+78,25,true,'#6a4d94');});y+=140;
  heading('보스별 공격 비중 · 실제 피해량 기준');
  [['종합',data.events],...[2,3,4].map(s=>[s+'단계',data.events.filter(e=>e.stage===s)])].forEach(([label,events],i)=>donuts(events,label,PAD+i*274,y));y+=435;
  heading('일차별 기록');row(['일차','실제 피해량','기여도','기본 / 이월'],[150,340,340,266],true);
  for(let day=1;day<=data.days;day++){const events=data.events.filter(e=>e.day===day);row([day+'일차',{text:nf(events.reduce((s,e)=>s+e.actual,0)),right:true},{text:formatContribution(events.reduce((s,e)=>s+data.contribution(e),0)),right:true},events.filter(e=>!e.carry).length+' / '+events.filter(e=>e.carry).length],[150,340,340,266]);}
  heading('보스별 기록');row(['보스','공격 수','실제 피해량 합계','평균 피해량'],[260,130,360,346],true);
  for(const boss of data.bosses){const rows=data.events.filter(e=>e.boss===boss.id),sum=rows.reduce((s,e)=>s+e.actual,0);row([boss.id+'넴 · '+boss.name,rows.length,{text:nf(sum),right:true},{text:nf(rows.length?sum/rows.length:0),right:true}],[260,130,360,346],false,[BOSS_ACCENTS[boss.id-1]]);}
  if(!data.all){heading('공격 상세');
  const widths=[100,210,210,290,286];row(['일차','보스 · 단계','일반 / 이월','실제 피해량','기여도'],widths,true);
  for(const e of data.events){if(y+52>H-85){start();heading('공격 상세 · 계속');row(['일차','보스 · 단계','일반 / 이월','실제 피해량','기여도'],widths,true);}row([e.day+'일',`${e.boss}넴 · ${e.stage}단계`,e.carry?'이월':'일반',{text:nf(e.actual),right:true},{text:formatContribution(data.contribution(e)),right:true}],widths,false,[null,BOSS_ACCENTS[e.boss-1]]);}
  }
  for(const c of canvases){const encoded=c.toDataURL('image/jpeg',.94).split(',')[1];pages.push(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));}
  const blob=new Blob([pdfFromJpegs(pages)],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`냥냥클랜_리리다이브_${data.month}_${data.p?.name||data.summary.name}_이력서.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
