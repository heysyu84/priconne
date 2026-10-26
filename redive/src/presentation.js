// Game artwork is bundled locally. Shared records are supplied by the site server.
const chartView={metric:'damage',boss:0};
const chartMetricNames={damage:'피해량',contribution:'기여도',game:'인게임 스코어',dayDamage:'일일 피해량',dayContribution:'일일 기여도'};

function initializeVisuals(){
  for(const season of [data,...Object.values(data.seasons)])for(const b of season.bossSettings){
    if(/^예시 보스 \d+$/.test(b.name)){b.name=GAME_ASSETS.bosses[b.id].name;b.portraitKey=String(b.id);}
  }
  recalculateSeason();
}
function bossArt(boss){
  const b=typeof boss==='object'?boss:data.bossSettings.find(b=>b.id===Number(boss));
  if(!b)return null;
  if(b.portraitKey==='none')return null;
  if(b.portraitUrl)return {image:b.portraitUrl,name:b.name};
  // Older shared records may retain a slot's original portrait key after
  // the monthly boss name changes. Resolve the current name before that key.
  const lineups=[selectedFutureLineup(ui.month),...Object.values(data.futureOverrides||{}),...Object.values((ext.futureCatalog||FUTURE_REFERENCE).months)];
  for(const lineup of lineups){
    const reference=lineup?.bosses.find(source=>source.name===b.name);
    const image=reference&&localFuturePortrait(reference);
    if(image)return {image,name:b.name};
  }
  return Object.values(GAME_ASSETS.bosses).find(a=>a.name===b.name)||GAME_ASSETS.bosses[b.portraitKey]||null;
}
function bossFace(boss,cls=''){
  const b=typeof boss==='object'?boss:data.bossSettings.find(b=>b.id===Number(boss)),art=bossArt(b);
  return `<span class="boss-face ${cls}" style="${bossStyle(b?.id||1)}">${art?`<img src="${art.image}" alt="${X(art.name)}" width="128" height="128">`:`<span>${b?.id||'?'}</span>`}</span>`;
}
function gameCompanion(){
  const file={overview:'pecorine',battle:'kyaru-transfer',tactics:'kyoka-gothic',records:'riri-summer',clan:'kyaru-transfer'}[ui.section]||'pecorine';
  return `<img class="page-companion" src="./assets/${file}.webp" alt="" aria-hidden="true" width="88" height="64">`;
}
function chartValue(value,metric='damage'){
  if(Math.abs(value)>=100000000)return (value/100000000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'억';
  if(Math.abs(value)>=10000)return (value/10000).toLocaleString('ko-KR',{maximumFractionDigits:0})+'만';
  return nf(value);
}
function chartEventValue(e,metric){return metric==='contribution'?(e.contribution||0):metric==='game'?e.game||0:e.actual||0;}
function compactChart(){return typeof window.matchMedia==='function'&&window.matchMedia('(max-width:760px)').matches;}
function chartDailyData(events,metric='damage'){
  return Array.from({length:data.rules.days},(_,i)=>{
    const day=i+1,rows=events.filter(e=>e.day===day),values=data.bossSettings.map(b=>rows.filter(e=>e.boss===b.id).reduce((s,e)=>s+chartEventValue(e,metric),0));
    return {day,values,total:values.reduce((a,b)=>a+b,0),count:rows.length,available:day<=ui.day};
  });
}
function niceChartMax(value){if(value<=0)return 1;const power=10**Math.floor(Math.log10(value)),n=value/power;return (n<=1?1:n<=2?2:n<=4?4:n<=5?5:Math.ceil(n))*power;}
function chartGrid(max,w=660,h=232,left=53,right=18,top=20,bottom=36,metric='damage'){
  const plotH=h-top-bottom,plotW=w-left-right;
  return Array.from({length:5},(_,i)=>{const y=top+plotH*i/4,v=max*(1-i/4);return `<g class="chart-gridline"><line x1="${left}" x2="${w-right}" y1="${y}" y2="${y}"></line><text x="${left-10}" y="${y+4}" text-anchor="end">${chartValue(v,metric)}</text></g>`;}).join('');
}
function metricSwitch(context){return `<div class="chart-switch" role="group" aria-label="${context} 지표">${[['damage','피해량'],['contribution','기여도']].map(([key,name])=>`<button data-chart-action="metric" data-value="${key}" class="${chartView.metric===key?'active':''}" aria-pressed="${chartView.metric===key}">${name}</button>`).join('')}</div>`;}
function dailyStackedChart(events){
  const metric=chartView.metric,rows=chartDailyData(events,metric),max=niceChartMax(Math.max(1,...rows.map(d=>d.total))),small=compactChart(),w=small?340:660,h=small?220:232,left=small?46:53,right=small?10:18,top=24,bottom=36,plotH=h-top-bottom,plotW=w-left-right,step=plotW/rows.length,bar=Math.min(52,step*.45);
  let svg=chartGrid(max,w,h,left,right,top,bottom,metric);
  for(const row of rows){
    const x=left+step*(row.day-.5)-bar/2;let used=0;
    if(row.available){for(const [i,value]of row.values.entries())if(value){const height=value/max*plotH,y=h-bottom-used-height;svg+=`<rect class="chart-bar-segment" x="${x}" y="${y}" width="${bar}" height="${height}" fill="var(--b${i+1})"><title>${row.day}일차 · ${i+1}넴 ${chartValue(value,metric)}</title></rect>`;used+=height;}}
    else svg+=`<rect class="chart-future" x="${x}" y="${top+10}" width="${bar}" height="${plotH-10}" rx="3"></rect>`;
    svg+=`<text class="chart-x-label ${row.day===ui.day?'current':''}" x="${x+bar/2}" y="${h-12}" text-anchor="middle">${row.day}일차</text>`;
    if(row.available&&row.total)svg+=`<text class="chart-bar-label" x="${x+bar/2}" y="${h-bottom-used-9}" text-anchor="middle">${chartValue(row.total,metric)}</text>`;
  }
  return `<div class="plot-frame"><svg class="data-chart stacked-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="일차별 ${chartMetricNames[metric]}. ${rows.map(r=>r.day+'일차 '+(r.available?chartValue(r.total,metric):'조회 이후')).join(', ')}">${svg}</svg><div class="chart-day-targets" style="--days:${rows.length};left:${left/w*100}%;right:${right/w*100}%">${rows.map(r=>`<button class="chart-day-target" data-chart-action="day" data-value="${r.day}" aria-label="${r.day}일차 기록 상세" title="${r.day}일차 · ${r.available?chartValue(r.total,metric)+' · '+r.count+'건':'조회 이후'}"></button>`).join('')}</div></div>`;
}
function compactBossLegend(){return `<div class="plot-legend">${data.bossSettings.map(b=>`<span style="${bossStyle(b.id)}"><i></i>${b.id}넴</span>`).join('')}${ui.day<data.rules.days?'<span class="legend-future"><i></i>조회 이후</span>':''}</div>`;}
function overviewCharts(){
  const events=data.logs.filter(e=>e.day<=ui.day),total=events.reduce((s,e)=>s+chartEventValue(e,chartView.metric),0);
  return `<div class="overview-charts"><section class="chart-sheet"><div class="chart-heading"><div><h2>일차별 ${chartMetricNames[chartView.metric]}</h2><span>${ui.day}일차까지 · 합계 <strong>${chartValue(total,chartView.metric)}</strong></span></div>${metricSwitch('클랜 기록')}</div>${dailyStackedChart(events)}${compactBossLegend()}</section><section class="chart-sheet share-sheet"><div class="chart-heading"><h2>보스별 ${chartMetricNames[chartView.metric]}</h2><span>공격 ${events.length}건</span></div>${richBossShare(events,chartView.metric)}</section></div>`;
}
function richBossShare(events,metric='damage'){
  const sums=data.bossSettings.map(b=>({b,value:events.filter(e=>e.boss===b.id).reduce((s,e)=>s+chartEventValue(e,metric),0)})),total=sums.reduce((s,b)=>s+b.value,0),circ=2*Math.PI*66;let start=0;
  const arcs=sums.map(({b,value})=>{const fraction=total?value/total:0,offset=start;start+=fraction;return fraction?`<circle class="share-arc ${chartView.boss&&chartView.boss!==b.id?'dimmed':''}" cx="92" cy="92" r="66" fill="none" stroke="var(--b${b.id})" stroke-width="16" stroke-dasharray="${Math.max(0,circ*fraction-3)} ${circ}" stroke-dashoffset="${-circ*offset}" transform="rotate(-90 92 92)"><title>${b.id}넴 ${X(b.name)} · ${(fraction*100).toFixed(1)}% · ${chartValue(value,metric)}</title></circle>`:'';}).join('');
  const chosen=sums.find(s=>s.b.id===chartView.boss),display=chosen||{value:total};
  return `<div class="rich-share"><div class="share-visual"><svg viewBox="0 0 184 184" class="ring-chart" role="img" aria-label="보스별 ${chartMetricNames[metric]} 비중. ${sums.map(s=>s.b.id+'넴 '+(total?s.value/total*100:0).toFixed(1)+'%').join(', ')}"><circle cx="92" cy="92" r="66" class="ring-base" fill="none" stroke-width="16"></circle>${arcs}</svg><div class="ring-center"><span>${chosen?chosen.b.id+'넴':'합계'}</span><strong class="numeric">${chartValue(display.value,metric)}</strong><small>${chosen?X(chosen.b.name):chartMetricNames[metric]}</small></div></div><div class="boss-share-legend">${sums.map(s=>`<button data-chart-action="share" data-value="${s.b.id}" aria-pressed="${chartView.boss===s.b.id}" class="${chartView.boss===s.b.id?'selected':''}" style="${bossStyle(s.b.id)}">${bossFace(s.b,'tiny')}<span class="share-boss-name"><b>${s.b.id}넴</b><small>${X(s.b.name)}</small></span><span class="share-bar"><i style="width:${total?s.value/total*100:0}%"></i></span><strong class="numeric">${(total?s.value/total*100:0).toFixed(1)}<small>%</small></strong></button>`).join('')}</div></div>`;
}
function dailyProfileChart(all,m){
  const metric=chartView.metric,events=profileEvents(),rows=chartDailyData(events,metric),clanRows=chartDailyData(data.logs.filter(e=>e.day<=ui.day&&(!ext.profileStage||e.stage===ext.profileStage)),metric),averages=clanRows.map(r=>r.total/(allSeasonStats(r.day).filter(s=>s.active).length||1)),max=niceChartMax(Math.max(1,...rows.map(r=>r.total),...(!all?averages:[]))),small=compactChart(),w=small?340:660,h=small?225:240,left=small?46:53,right=small?10:20,top=28,bottom=39,plotH=h-top-bottom,step=(w-left-right)/rows.length,x=day=>left+step*(day-.5),y=v=>h-bottom-v/max*plotH,valid=rows.filter(r=>r.available),points=valid.map(r=>`${x(r.day)},${y(r.total)}`),averagePoints=valid.map(r=>`${x(r.day)},${y(averages[r.day-1])}`);
  let svg=chartGrid(max,w,h,left,right,top,bottom,metric);
  if(points.length){svg+=`<path class="profile-area" d="M${x(valid[0].day)},${h-bottom} L${points.join(' L')} L${x(valid.at(-1).day)},${h-bottom} Z"></path><polyline class="profile-trend" points="${points.join(' ')}"></polyline>`;if(!all)svg+=`<polyline class="average-trend" points="${averagePoints.join(' ')}"></polyline>`;}
  for(const row of rows){svg+=`<text class="chart-x-label ${row.day===ui.day?'current':''}" x="${x(row.day)}" y="${h-12}" text-anchor="middle">${row.day}일차</text>`;if(row.available)svg+=`<circle cx="${x(row.day)}" cy="${y(row.total)}" r="4" class="profile-dot"><title>${row.day}일차 · ${chartValue(row.total,metric)}${!all?' · 클랜 평균 '+chartValue(averages[row.day-1],metric):''}</title></circle><text class="chart-bar-label" x="${x(row.day)}" y="${y(row.total)-12}" text-anchor="middle">${chartValue(row.total,metric)}</text>`;}
  return `<div class="chart-heading"><div><h2>일차별 ${chartMetricNames[metric]}</h2><span>${all?'클랜 전체':X(m.name)} · ${ext.profileStage?ext.profileStage+'단계':'전체 단계'}</span></div>${metricSwitch('개인 기록')}</div><svg class="data-chart profile-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${all?'클랜 전체':X(m.name)} 일차별 ${chartMetricNames[metric]}. ${valid.map(r=>r.day+'일차 '+chartValue(r.total,metric)).join(', ')}">${svg}</svg><div class="plot-legend"><span class="legend-person"><i></i>${all?'클랜 전체':'개인 기록'}</span>${!all?'<span class="legend-average"><i></i>클랜 평균</span>':''}<span class="legend-future">${ui.day}일차까지</span></div>`;
}
function rankingChart(rows){
  const metric=ui.rankSort,top=rows.slice(0,10),max=Math.max(1,...top.map(r=>r[metric]||0));
  return `<section class="ranking-chart chart-sheet"><div class="chart-heading"><h2>${chartMetricNames[metric]||'피해량'} 상위 10명</h2><span>${ui.day}일차까지</span></div><div class="rank-bars">${top.map((s,i)=>`<div class="rank-bar-row"><span class="rank-bar-number">${String(i+1).padStart(2,'0')}</span>${memberLink(s.member)}<div class="rank-bar-track"><i style="width:${(s[metric]||0)/max*100}%"></i></div><strong class="numeric">${chartValue(s[metric]||0,metric)}</strong></div>`).join('')}</div></section>`;
}
function chartDayBreakdown(events,metric){
  const name=chartMetricNames[metric];
  return rowTable(['보스','공격 수',`${name} 합계`,`평균 ${name}`,`최고 ${name}`],data.bossSettings.map(b=>{
    const values=events.filter(e=>e.boss===b.id).map(e=>chartEventValue(e,metric)),sum=values.reduce((a,b)=>a+b,0);
    return `<tr><td><span class="boss-stat-name">${bossFace(b,'tiny')}<span class="boss-tag" style="${bossStyle(b.id)}">${b.id}넴</span></span></td><td class="right">${values.length}</td><td class="right numeric">${nf(sum)}</td><td class="right numeric">${nf(values.length?sum/values.length:0)}</td><td class="right numeric">${nf(Math.max(0,...values))}</td></tr>`;
  }),'boss-statistics');
}

document.addEventListener('click',event=>{
  const b=event.target.closest('[data-chart-action]');if(!b)return;event.preventDefault();
  const action=b.dataset.chartAction;
  if(action==='metric'){chartView.metric=b.dataset.value;render();}
  if(action==='share'){const n=Number(b.dataset.value);chartView.boss=chartView.boss===n?0:n;render();}
  if(action==='day'){
    const day=Number(b.dataset.value),metric=chartView.metric,events=data.logs.filter(e=>e.day===day),total=events.reduce((s,e)=>s+chartEventValue(e,metric),0);
    openDrawer(`${day}일차 ${chartMetricNames[metric]}`,`<div class="chart-detail-total"><span>합계</span><strong class="numeric">${chartValue(total,metric)}</strong><small>공격 ${events.length}건</small></div>${chartDayBreakdown(events,metric)}`,simpleButton('닫기','close-drawer'));
  }
});
let chartCompactLayout=compactChart(),chartResizeTimer;
window.addEventListener('resize',()=>{clearTimeout(chartResizeTimer);chartResizeTimer=setTimeout(()=>{const compact=compactChart();if(compact!==chartCompactLayout){chartCompactLayout=compact;render();}},150);});
