const BOSS_ACCENTS=['#c28d9f','#c5b172','#83b5a3','#80afc7','#a79bc7'];
const BOSS_INK=['#985b73','#8a783e','#518573','#4d829d','#756694'];
const tenureMonths=p=>p.tenureMonths??null;
const W=1240,H=1754,PAD=72;
let reportFontsReady;

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
// The personal report uses one A4 sheet, following the original report's
// identity, totals, phase charts, daily trends, boss contributions and summary.
export async function createProfilePdf(data){
  if(typeof FontFace!=='undefined'){
    reportFontsReady??=(async()=>{const face=new FontFace('Nyang Report',`url(${new URL('./fonts/NanumGothic-Regular.ttf',import.meta.url).href})`);await face.load();document.fonts.add(face);})();
    await reportFontsReady;
  }
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d'),ink='#3b3350',purple='#8062b0',muted='#7a6e87',bodyWidth=W-PAD*2;
  const copy=value=>typeof value==='string'&&data.copy?data.copy(value):String(value);
  const text=(value,x,y,size=20,bold=false,color=ink,align='left',maxWidth=Infinity)=>{ctx.fillStyle=color;ctx.font=`${bold?700:400} ${size}px "Nyang Report", sans-serif`;ctx.textAlign=align;const label=copy(value);if(Number.isFinite(maxWidth))ctx.fillText(label,x,y,maxWidth);else ctx.fillText(label,x,y);ctx.textAlign='left';};
  const rule=(x,y,width)=>{ctx.fillStyle='#e7e0ef';ctx.fillRect(x,y,width,1);};
  const heading=(label,x,y)=>text(label,x,y,22,true,purple);
  const tableRow=(cells,widths,x,y,height=33,header=false,tint=null,size=17)=>{
    const width=widths.reduce((sum,v)=>sum+v,0);if(header){ctx.fillStyle='#f2edf8';ctx.fillRect(x,y,width,height);}else if(tint){ctx.fillStyle=tint;ctx.fillRect(x,y,widths[0],height);}
    cells.forEach((cell,i)=>{const value=cell?.text??cell,right=!!cell?.right;text(value,x+(right?widths[i]-10:9),y+height*.7,size,header||i===0,ink,right?'right':'left',widths[i]-18);x+=widths[i];});rule(x-width,y+height,width);
  };
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.fillStyle=purple;ctx.fillRect(0,0,W,12);
  text('냥냥클랜 리리다이브',PAD,61,25,true,purple);text(data.month+(data.all?(data.coverage==='personal'?' · 보관 개인 기록':' · 클랜 전체 기록'):' · 개인 이력서'),W-PAD,61,22,false,muted,'right');rule(PAD,83,bodyWidth);
  text(data.p?.name||data.summary.name,PAD,137,36,true);text(data.all?(data.coverage==='personal'?'월 전체 · 보관 개인 기록 합계':'월 전체 · 클랜 합계'):`UID ${data.p?.uid||'미기재'}   |   월 전체`,PAD,174,18,false,muted);
  if(!data.all){text(`소속 ${tenureMonths(data.p||{})??'미상'}개월`,W-PAD,137,20,false,muted,'right');const period=data.p?.joined?data.p.joined.slice(0,7).replace('-','.')+'–'+(data.p.left?data.p.left.slice(0,7).replace('-','.'):'현재'):'';if(period)text(period,W-PAD,174,17,false,muted,'right');}
  [['실제 피해량',data.summary.damage],['기여도',data.summary.contribution],['인게임 스코어',data.summary.game]].forEach(([label,value],i)=>{const width=(bodyWidth-24)/3,x=PAD+i*(width+12);ctx.fillStyle='#f7f3fc';ctx.fillRect(x,198,width,86);text(label,x+15,228,18);text(label==='기여도'?formatContribution(value):nf(value),x+15,264,25,true,purple,'left',width-30);});
  heading('보스별 공격 비중 · 실제 피해량 기준',PAD,322);
  const phaseEntries=[['종합',data.events],...[...new Set(data.events.map(e=>Number(e.stage)).filter(Boolean))].sort((a,b)=>a-b).map(stage=>[stage+'단계',data.events.filter(e=>e.stage===stage)])];
  phaseEntries.forEach(([label,events],i)=>{
    const width=bodyWidth/phaseEntries.length,x=PAD+i*width,cx=x+width/2,cy=437,radius=Math.min(62,width*.25),values=data.bosses.map(b=>events.filter(e=>e.boss===b.id).reduce((sum,e)=>sum+e.actual,0)),sum=values.reduce((a,b)=>a+b,0);text(label,cx,357,20,true,ink,'center');let angle=-Math.PI/2;ctx.lineWidth=29;
    if(!sum){ctx.strokeStyle='#eeeaf4';ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();}
    values.forEach((value,j)=>{const end=angle+(sum?value/sum:0)*Math.PI*2;if(value&&sum){ctx.strokeStyle=BOSS_ACCENTS[j];ctx.beginPath();ctx.arc(cx,cy,radius,angle,end);ctx.stroke();}angle=end;});text(events.length+'타',cx,cy+8,20,true,purple,'center');
    values.forEach((value,j)=>{const top=535+j*23;ctx.fillStyle=BOSS_ACCENTS[j];ctx.fillRect(x+26,top-13,13,13);text((j+1)+'넴',x+47,top,16);text((sum?value/sum*100:0).toFixed(1)+'%',x+width-24,top,16,true,BOSS_INK[j],'right');});
  });
  const gap=26,leftWidth=(bodyWidth-gap)/2,rightX=PAD+leftWidth+gap,dailyWidths=[65,157,157,leftWidth-379],bossWidths=[166,47,164,leftWidth-377],tableTop=704,rowHeight=33;
  heading(data.dayDetailAvailable===false?'월 누적 기록':'일차별 기록',PAD,683);heading('보스별 기록',rightX,683);
  tableRow(['일차','실제 피해량','기여도','기본 / 이월'],dailyWidths,PAD,tableTop,rowHeight,true,null,16);
  if(data.dayDetailAvailable===false)tableRow(['월 합계',{text:nf(data.summary.damage),right:true},{text:formatContribution(data.summary.contribution),right:true},data.events.filter(e=>!e.carry).length+' / '+data.events.filter(e=>e.carry).length],dailyWidths,PAD,tableTop+rowHeight,rowHeight,false,null,16);
  for(let day=1;day<=data.days;day++){const events=data.events.filter(e=>e.day===day);tableRow([day+'일차',{text:nf(events.reduce((sum,e)=>sum+e.actual,0)),right:true},{text:formatContribution(events.reduce((sum,e)=>sum+data.contribution(e),0)),right:true},events.filter(e=>!e.carry).length+' / '+events.filter(e=>e.carry).length],dailyWidths,PAD,tableTop+rowHeight*day,rowHeight,false,null,16);}
  tableRow(['보스','타수','피해량 합계','평균 피해량'],bossWidths,rightX,tableTop,rowHeight,true,null,16);
  data.bosses.forEach((boss,i)=>{const events=data.events.filter(e=>e.boss===boss.id),sum=events.reduce((total,e)=>total+e.actual,0);tableRow([boss.id+'넴 · '+boss.name,events.length,{text:nf(sum),right:true},{text:nf(events.length?sum/events.length:0),right:true}],bossWidths,rightX,tableTop+rowHeight*(i+1),rowHeight,false,BOSS_ACCENTS[i],16);});
  const compact=n=>Math.abs(n)>=100000000?(n/100000000).toFixed(1)+'억':Math.abs(n)>=10000?nf(Math.round(n/10000))+'만':nf(Math.round(n));
  const chartTop=tableTop+rowHeight*(Math.max(data.days,data.bosses.length)+1)+57;
  const daily=data.dayDetailAvailable===false?[{label:'월 누적',damage:data.summary.damage,contribution:data.summary.contribution}]:Array.from({length:data.days},(_,i)=>{const events=data.events.filter(e=>e.day===i+1);return {day:i+1,damage:events.reduce((s,e)=>s+e.actual,0),contribution:events.reduce((s,e)=>s+data.contribution(e),0)};});
  const dailyChart=(label,key,x,color)=>{
    heading(label,x,chartTop);
    const left=x+57,right=x+leftWidth-16,top=chartTop+49,bottom=chartTop+233,height=bottom-top,max=Math.max(1,...daily.map(d=>d[key]));
    for(let i=0;i<=3;i++){const y=bottom-height*i/3;rule(left,y,right-left);text(compact(max*i/3),left-9,y+5,14,false,muted,'right',52);}
    const step=(right-left)/Math.max(1,daily.length),bar=Math.min(46,step*.58);
    daily.forEach((d,i)=>{const cx=left+step*(i+.5),h=Math.max(0,d[key])/max*height;ctx.fillStyle=color;ctx.fillRect(cx-bar/2,bottom-h,bar,h);text(compact(d[key]),cx,bottom-h-11,15,true,ink,'center',step-5);text(d.label||d.day+'일차',cx,bottom+28,16,false,muted,'center');});
  };
  dailyChart(data.dayDetailAvailable===false?'월 누적 피해량':'일차별 피해량','damage',PAD,'#b19bd6');dailyChart(data.dayDetailAvailable===false?'월 누적 기여도':'일차별 기여도','contribution',rightX,'#8eb8be');
  const lowerTop=chartTop+326;
  heading('보스별 기여도',PAD,lowerTop);heading('공격 요약',rightX,lowerTop);
  const bossContributions=data.bosses.map(b=>data.events.filter(e=>e.boss===b.id).reduce((s,e)=>s+data.contribution(e),0)),maxBoss=Math.max(1,...bossContributions);
  data.bosses.forEach((b,i)=>{const y=lowerTop+43+i*43,barX=PAD+51,barWidth=leftWidth-170;ctx.fillStyle='#f2edf8';ctx.fillRect(barX,y-17,barWidth,21);ctx.fillStyle=BOSS_ACCENTS[i];ctx.fillRect(barX,y-17,barWidth*Math.max(0,bossContributions[i])/maxBoss,21);text(b.id+'넴',PAD,y,17,true,BOSS_INK[i]);text(compact(bossContributions[i]),PAD+leftWidth,y,17,true,ink,'right',108);});
  const attacks=data.events.length,basics=data.events.filter(e=>!e.carry).length,carries=data.events.filter(e=>e.carry).length,kills=data.events.filter(e=>e.kill).length;
  [['총 공격',attacks+'타'],['기본 공격',basics+'타'],['이월 사용',carries+'타'],['보스 격파',data.events.some(e=>e.typeKnown===false)?'미보관':kills+'회'],['타당 평균 피해량',compact(attacks?data.summary.damage/attacks:0)],['타당 평균 기여도',compact(attacks?data.summary.contribution/attacks:0)]].forEach(([label,value],i)=>{const width=(leftWidth-14)/2,x=rightX+(i%2)*(width+14),y=lowerTop+24+Math.floor(i/2)*77;ctx.fillStyle='#f7f3fc';ctx.fillRect(x,y,width,65);text(label,x+12,y+24,16,false,muted);text(value,x+12,y+51,23,true,purple,'left',width-24);});
  text('1 / 1',W/2,H-35,16,false,'#9b90a7','center');
  const jpeg=Uint8Array.from(atob(canvas.toDataURL('image/jpeg',.95).split(',')[1]),char=>char.charCodeAt(0)),bytes=pdfFromJpegs([jpeg]);
  return {bytes,filename:`냥냥클랜_리리다이브_${data.month}_${data.p?.name||data.summary.name}_이력서.pdf`,pages:1};
}
function reportDownloadForm(report,data,options={}){
  if(document.querySelector('meta[name="nyang-legacy-api-origin"]')){
    const link=document.createElement('a'),url=URL.createObjectURL(new Blob([report.bytes],{type:'application/pdf'}));link.href=url;link.className='button primary';link.textContent=options.label||data.downloadLabel||'PDF 저장';if(options.inline)link.target=options.target||'_blank';else link.download=report.filename;link.requestSubmit=()=>link.click();setTimeout(()=>URL.revokeObjectURL(url),300000);return link;
  }
  let binary='';for(let i=0;i<report.bytes.length;i+=16384)binary+=String.fromCharCode(...report.bytes.subarray(i,i+16384));
  const form=document.createElement('form');form.method='post';form.action='/api/profile-pdf';form.className='profile-pdf-download';
  for(const [name,value]of [['pdf',btoa(binary)],['filename',report.filename],...(options.inline?[['view','inline']]:[])]){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);}
  const button=document.createElement('button');button.type='submit';button.className='button primary';button.textContent=options.label||data.downloadLabel||'PDF 저장';form.append(button);if(options.target)form.target=options.target;return form;
}
export async function downloadProfilePdf(data){
  const report=await createProfilePdf(data),form=reportDownloadForm(report,data);if(data.target?.isConnected)data.target.replaceWith(form);else document.body.append(form);form.requestSubmit();return report;
}
let previewCounter=0;
export async function previewProfilePdf(data){
  const report=await createProfilePdf(data);document.querySelector('.profile-pdf-preview')?.remove();
  const section=document.createElement('section');section.className='profile-pdf-preview';const controls=document.createElement('div');controls.className='pdf-preview-controls';const title=document.createElement('strong');title.textContent=(data.copy?data.copy('개인 이력 PDF'):'개인 이력 PDF')+' · A4 1장';controls.append(title,reportDownloadForm(report,data));
  controls.append(reportDownloadForm(report,data,{inline:true,target:'_blank',label:data.copy?data.copy('크게 보기'):'크게 보기'}));
  const close=document.createElement('button');close.type='button';close.className='button quiet';close.textContent=data.copy?data.copy('닫기'):'닫기';close.addEventListener('click',()=>section.remove());controls.append(close);
  const frame=document.createElement('iframe');frame.name='nyang-profile-pdf-'+(++previewCounter);frame.title=report.filename;section.append(controls,frame);
  const viewerForm=reportDownloadForm(report,data,{inline:true,target:frame.name});viewerForm.hidden=true;section.append(viewerForm);const toolbar=data.target?.closest('.profile-toolbar');if(toolbar)toolbar.after(section);else document.body.append(section);viewerForm.requestSubmit();section.scrollIntoView({behavior:'smooth',block:'start'});return report;
}

