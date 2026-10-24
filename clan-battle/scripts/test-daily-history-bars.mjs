import assert from 'node:assert/strict';
import {dailyHistoryBars} from '../public/daily-history-bars.mjs';

const a = {memberId:'a',byDay:{1:{damage:80,contribution:80},2:{damage:150,contribution:150},3:{damage:100,contribution:100}}};
const b = {memberId:'b',byDay:{1:{damage:120,contribution:120},2:{damage:50,contribution:50},3:{damage:100,contribution:100}}};
const rows = dailyHistoryBars({summary:a,members:[a,b],through:3});
assert.deepEqual(rows.slice(0,3).map(r=>r.averageContribution),[100,100,100]);
assert.equal(rows[0].shortfall,20);
assert.equal(rows[0].excess,0);
assert.equal(rows[1].base,100);
assert.equal(rows[1].excess,50);
assert.equal(rows[1].shortfall,0);
assert.equal(rows[2].base,100);
assert.equal(rows[2].shortfall,0);
assert.equal(rows[2].excess,0);
assert.equal(rows[1].damageWidth,100);
assert.ok(Math.abs(rows[0].baseWidth+rows[0].shortfallWidth-rows[1].baseWidth)<1e-9);
assert.ok(Math.abs(rows[1].baseWidth+rows[1].excessWidth-100)<1e-9);
assert.ok(rows.slice(3).every(r=>r.damageWidth===0&&r.baseWidth===0&&r.shortfallWidth===0&&r.excessWidth===0));

const joining = {memberId:'c',byDay:{}};
const withReplacement = dailyHistoryBars({summary:a,members:[a,b,joining],membership:{c:{fromDay:2}},through:3});
assert.equal(withReplacement[0].averageContribution,100,'members who have not joined yet do not lower the daily average');
assert.equal(withReplacement[1].averageContribution,200/3,'eligible members without attacks count as zero');

const clan = dailyHistoryBars({summary:{byDay:{1:{damage:200,contribution:200}}},members:[a,b],clanView:true});
assert.equal(clan[0].base,200);
assert.equal(clan[0].shortfall,0);
assert.equal(clan[0].excess,0,'clan totals must not be compared with a per-person average');
const empty = dailyHistoryBars({summary:{byDay:{1:{damage:NaN,contribution:Infinity}}}});
assert.ok(empty.every(r=>Object.values(r).every(Number.isFinite)));
console.log('PASS: daily damage/contribution scales, average deficits/surpluses, membership dates, zero-attack members and empty days.');

const listeners = {};
globalThis.document = {addEventListener(type,fn){(listeners[type]||=[]).push(fn);},querySelector:()=>null,querySelectorAll:()=>[]};
globalThis.window = {addEventListener(){}};
const {createGuildWorkspace} = await import('../public/guild-workspace.mjs');
const people = [a,b].map((p,index)=>({...p,name:['테스트A','테스트B'][index],
  damage:Object.values(p.byDay).reduce((sum,d)=>sum+d.damage,0),
  contribution:Object.values(p.byDay).reduce((sum,d)=>sum+d.contribution,0),game:0}));
const events = people.flatMap(p=>Object.entries(p.byDay).map(([day,v])=>({day:Number(day),memberId:p.memberId,boss:1,stage:4,actual:v.damage,contribution:v.contribution})));
const month = {options:{days:5},events,bosses:[{id:1,name:'테스트 보스',game:{4:1}}],membership:{}};
const app = {active:'2026-10',roster:people.map(p=>({id:p.memberId,name:p.name})),months:{'2026-10':month}};
let rendered;
const guild = createGuildWorkspace({getApp:()=>app,getMonth:()=>month,canEdit:()=>false,
  section:heading=>`<h1>${heading}</h1>`,nf:n=>Number(n||0).toLocaleString('ko-KR'),
  formatContribution:n=>String(Math.round(n||0)),escapeHtml:s=>String(s??''),
  contribution:e=>e.contribution,aggregates:()=>people,render:()=>{rendered=guild.profile();},
  persist(){throw Error('Rendering charts must not save records');},notify(){},characters:[]});
rendered = guild.profile();
assert.equal((rendered.match(/class="track daily-damage-track"/g)||[]).length,5);
assert.equal((rendered.match(/class="track daily-contribution-track"/g)||[]).length,5);
assert.ok(!rendered.includes('class="daily-contribution-excess"'));
for(const fn of listeners.change||[])fn({target:{id:'guild-profile',value:'a'}});
assert.equal((rendered.match(/class="daily-contribution-shortfall"/g)||[]).length,1);
assert.equal((rendered.match(/class="daily-contribution-excess"/g)||[]).length,1);
const dailyMarkup=rendered.slice(rendered.indexOf('<div class="daily-profile-bars">'),rendered.indexOf('<h2>보스별 통계</h2>'));
const visibleText=dailyMarkup.replace(/<[^>]*>/g,'');
assert.ok(!/부족|초과|클랜 평균/.test(visibleText),'comparison explanations must not be shown beside the chart');
assert.equal(month.events.length,6);
console.log('PASS: profile renders two bars per day, compares individual contributions by color only, and does not modify battle records.');
