import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApiClient} from '../public/api-client.mjs';
import {buildPages} from './build-pages.mjs';
import {assetUrl} from '../public/site-paths.mjs';
import {characterPortrait,handlePortraitError} from '../public/character-portraits.mjs';

const backend='https://nyang-clan-manager.heysyu457310.chatgpt.site', calls=[], saved=new Map();
const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
let clock=100, reply={editor:true,token:'a'.repeat(64),expiresAt:1000},status=200;
const client=createApiClient({apiOrigin:backend,pageOrigin:'https://heysyu84.github.io',storage,now:()=>clock,fetcher:async(...args)=>{calls.push(args);return Response.json(reply,{status});}});
await client('/api/editor',{method:'POST',body:'{"pin":"1122"}'});
assert.equal(calls[0][0],backend+'/api/editor');assert.equal(calls[0][1].credentials,'omit');assert.equal(calls[0][1].headers.has('authorization'),false);
assert.equal([...saved.values()].some(v=>v.includes('1122')),false);
await client('/api/state',{method:'PUT',headers:{'X-Nyang-Client':'4'}});
await client('/api/state?since=42');
assert.equal(calls.at(-1)[0],backend+'/api/state?since=42');
await assert.rejects(()=>client('/api/state?unsupported=1'),/지원하지 않는 API/);
await client('/api/state?compact=1&since=42');
assert.equal(calls.at(-1)[0],backend+'/api/state?compact=1&since=42');
await client('/api/archive?month=2026-09');
assert.equal(calls.at(-1)[0],backend+'/api/archive?month=2026-09');
await client('/api/archive?all=1');
assert.equal(calls.at(-1)[0],backend+'/api/archive?all=1');
await client('/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({browserId:'c'.repeat(32)})});
assert.equal(calls.at(-1)[0],backend+'/api/presence');assert.equal(calls.at(-1)[1].credentials,'omit');
assert.equal(calls.at(-1)[1].headers.get('authorization'),'Bearer '+'a'.repeat(64));
clock=1001;await client('/api/state');assert.equal(calls.at(-1)[1].headers.has('authorization'),false);assert.equal(saved.size,0);
clock=100;await client('/api/editor',{method:'POST'});reply={editor:false};await client('/api/editor',{method:'POST'});assert.equal(saved.size,0);
reply={editor:true,token:'b'.repeat(64),expiresAt:1000};await client('/api/editor',{method:'POST'});status=403;await client('/api/state');assert.equal(saved.size,0);
const local=createApiClient({pageOrigin:backend,fetcher:async(...args)=>{calls.push(args);return Response.json({editor:true});}});
await local('/api/editor');assert.equal(calls.at(-1)[0],'/api/editor');assert.equal(calls.at(-1)[1].credentials,'same-origin');

globalThis.document={baseURI:'https://heysyu84.github.io/priconne/'};
assert.equal(assetUrl('/source-library/images/nostar/a.png'),'/priconne/source-library/images/nostar/a.png');
assert.equal(assetUrl('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');
const portrait=characterPortrait([{name:'테스트',portrait:'/source-library/images/nostar/a.png',byStar:{'5':'/source-library/images/nostar/b.png'}}],'테스트',5);
assert.equal(portrait.url,'/priconne/source-library/images/nostar/b.png');
const img={matches:()=>true,dataset:{portraitFallbacks:JSON.stringify(['/source-library/images/nostar/a.png'])}};handlePortraitError({target:img});assert.equal(img.src,'/priconne/source-library/images/nostar/a.png');
delete globalThis.document;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nyang-pages-'));
try {
  buildPages(dir);const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  assert.ok(html.includes(`name="nyang-api-origin" content="${backend}"`));
  assert.ok(fs.existsSync(path.join(dir,'.nojekyll')));
  const shell=html.split('<script id="seed-data"')[0];
  for(const match of shell.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:\?[^"#]*)?"/g))assert.ok(fs.existsSync(path.join(dir,match[1])),match[1]);
  assert.equal(/(?:href|src)="\/(?!\/)/.test(shell),false);
  const script=fs.readFileSync(path.join(dir,'clan.js'),'utf8');
  assert.equal(/import\('\//.test(script),false);assert.equal(/await fetch\('\/api\//.test(script),false);
  for(const name of ['characters.json','bosses.json']) {
    const data=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
    for(const match of JSON.stringify(data).matchAll(/"(\/images\/[^"?]+)"/g))assert.ok(fs.existsSync(path.join(dir,match[1].slice(1))),match[1]);
  }
} finally {fs.rmSync(dir,{recursive:true,force:true});}
console.log('PASS: Pages API client, tab-only expiring sessions, no stored PIN, cookie-free cross-origin requests, prefixed portraits/fallbacks, complete static assets and HTML entrypoint');

// Archive links are gated in the client and may point to a separate read-only D1 store.
const archiveBundle=fs.readFileSync(new URL('../public/clan.js',import.meta.url),'utf8');
assert.ok(archiveBundle.includes('splitStorage=boot.splitStorage===true'));
assert.ok(archiveBundle.includes('api-client.mjs?v='));
assert.ok(archiveBundle.includes('loadArchive(key)'));
assert.ok(archiveBundle.includes("archiveMode:splitStorage?'v1':undefined"));
assert.ok(archiveBundle.includes('data-open-archive'));
const finishCss=fs.readFileSync(new URL('../public/finish.css',import.meta.url),'utf8');
assert.ok(finishCss.includes('Eight desktop destinations use the whole navigation row'));
assert.ok(finishCss.includes('.content{max-width:1360px}'),'Desktop canvas should have a readable cap without squashing tables');
assert.ok(finishCss.includes('grid-template-columns:repeat(8,minmax(0,1fr))'),'Eight desktop destinations should get eight grid cells');
assert.ok(finishCss.includes('.sidebar .nav .symbol {display:inline-flex'),'Mid-width desktop symbols must remain visible');
assert.ok(!finishCss.includes('.sidebar .nav .symbol {display:none}'),'Do not hide nav icons above the mobile breakpoint');
assert.ok(!finishCss.includes('.content{max-width:1100px}'),'1100px desktop cap regressed');
console.log('PASS: bounded but spacious desktop canvas, eight visible navigation icons at tablet widths');

const clanStyle=fs.readFileSync(new URL('../public/finish.css',import.meta.url),'utf8');
const sharedChipRuleStart=clanStyle.indexOf('.db-rate-factors .datatable thead .boss-chip,');
const sharedBossChips=sharedChipRuleStart<0?'':clanStyle.slice(sharedChipRuleStart,clanStyle.indexOf('}',sharedChipRuleStart)+1);
assert.ok(sharedBossChips,'Factor and top-record chips must share one size rule');
assert.ok(sharedBossChips.includes('font-size:11px')&&sharedBossChips.includes('padding:3px 5px'),'Boss chip typography and padding should match');
assert.ok(clanStyle.includes('.db-rate-records .db-top-record-table tbody th{text-align:center'),'Ranking, average and corrected average row titles must be centered');
assert.ok(!clanStyle.includes('.db-top-record-table tbody th{text-align:left'),'No left-aligned ranking headings');
assert.ok(clanStyle.includes('tbody td{text-align:center;vertical-align:middle}'),'Table headers and numbers must be centered');
console.log('PASS: both DB tables share boss-chip dimensions and all top-record headings are centered');


// The collapsed battle-log entry form must not be shown or usable without editor privileges.
assert.ok(battleWorkflow.includes('const canSubmit=()=>canEdit();'),
  'Public battle-log viewers must not see the entry composer');
assert.ok(battleWorkflow.includes("if(!canSubmit())return '';"),
  'The composer must be absent, not just collapsed, when editing is locked');
assert.ok(battleWorkflow.includes('if(!canSubmit()||publicSubmitting)return;'),
  'Submitting must remain gated by the same editor permission');
assert.ok(battleWorkflow.includes('<details class="panel quick-panel"'),
  'The editor should retain a collapsible battle entry form');

// Mobile battle-log table must not inherit oversized desktop column minima.
// Leave exact numeric damage and HP content intact; shrink only its layout.
const battleWorkflow=fs.readFileSync(new URL('../public/workflow.mjs',import.meta.url),'utf8');
assert.match(battleWorkflow,/const mobileWidths=\[/,'Mobile battle log must have independent column widths');
assert.match(battleWorkflow,/--mobile-col-width:/,'Mobile columns must be individually sized');
assert.match(battleWorkflow,/--mobile-battle-width:/,'Mobile table width must be based on its actual columns');
assert.match(finishCss,/\.battle-sheet\.compact-battle-sheet\.with-details\s*\{/,
  'Expanded battle log must override the old 1100px mobile minimum');
assert.match(finishCss,/min-width:var\(--mobile-battle-width\)!important/,
  'Mobile table width must not retain desktop minimums');
assert.match(finishCss,/\.compact-battle-sheet colgroup col\s*\{width:var\(--mobile-col-width\)!important\}/,
  'Mobile colgroup needs independent per-column width');
assert.match(finishCss,/\.compact-battle-sheet \.number[\s\S]*?white-space:nowrap/,
  'Exact damage and remaining HP must not clip or wrap');
console.log('PASS: mobile battle log columns have a compact independent width and preserve exact numeric values');

assert.ok(battleWorkflow.includes('<td class="battle-day-cell">${e.day}일차</td>'), 'Battle log day values must have a stable cell class, with or without sequence');
assert.match(finishCss, /\.battle-sheet\.compact-battle-sheet thead th\s*\{\s*text-align:center!important/, 'Mobile battle log titles must be centered');
assert.match(finishCss, /\.battle-sheet\.compact-battle-sheet tbody td\.battle-day-cell\s*\{\s*text-align:center/, 'Mobile day data should be centered');
console.log('PASS: mobile battle log headers and day-value cells are centered');


// Readability / responsive changes should preserve compact table widths.
const tacticalUi=fs.readFileSync(new URL('../public/tactics-workspace.mjs',import.meta.url),'utf8');
const tacticCss=fs.readFileSync(new URL('../public/tactics-workspace.css',import.meta.url),'utf8');
assert.ok(tacticalUi.includes('id="tw-detail-note"')&&tacticalUi.includes('aria-label="택틱 메모"')&&!tacticalUi.includes('※ 중요 조건'),
  'The detailed tactic should show only the memo itself, without an important-condition label');
assert.ok(tacticalUi.includes('${detailNote(t)}<fieldset'),
  'The memo must appear immediately after the title and before the tactic form');
assert.ok(tacticalUi.includes('X(note)')&&tacticalUi.includes('detailNote.hidden=!note'),
  'The memo text must be escaped and dynamically hidden when empty');
assert.ok(tacticCss.includes('.tw-detail-note-text{flex:1 1 100%')&&tacticCss.includes('font-size:15px'),
  'Long tactic notes must be legible and wrap on desktop/mobile');
const readabilityCss=fs.readFileSync(new URL('../public/readability.css',import.meta.url),'utf8');
const guildUi=fs.readFileSync(new URL('../public/guild-workspace.mjs',import.meta.url),'utf8');
const guildDashboardCss=fs.readFileSync(new URL('../public/guild.css',import.meta.url),'utf8');
const responsiveDashboardCss=fs.readFileSync(new URL('../public/responsive.css',import.meta.url),'utf8');
assert.ok(guildUi.includes("solo=!!slot&&!slot.carry&&!slot.pending")&&guildUi.includes("solo?' is-solo':''"),
  'A normal attack without carry should receive a full-width slot');
assert.ok(guildUi.includes('title="미사용 이월">★')&&guildUi.includes('chip(slot.carry.boss)'),
  'Unused and used carry indicators should remain visible');
assert.ok(guildDashboardCss.includes('.dashboard-table .attack-slot.is-solo .boss-chip')&&responsiveDashboardCss.includes('grid-column:1/-1'),
  'Single-boss attack should occupy both halves on desktop and mobile');
const htmlShell=fs.readFileSync(new URL('../public/clan-shell.html',import.meta.url),'utf8');
assert.ok(!tacticalUi.includes('id="tw-search"'),'Tactic search must be removed from list');
assert.ok(!tacticalUi.includes('state.query'),'Tactic list must not be filtered by the deleted search');
assert.ok(tacticalUi.includes('class="tw-carry-entry"')&&tacticalUi.includes('>초기화</button>'),'Mobile carry field and apply action should be grouped and reset labeled correctly');
assert.ok(battleWorkflow.includes('mini-boss-inline')&&battleWorkflow.includes('mini-boss-progress'),'Mobile boss needs horizontal name, stage and lap');
assert.ok(battleWorkflow.includes('class="pill ${e.carry?')&&battleWorkflow.includes('battle-kind'),'Battle log type must use shared colored pills');
assert.ok(guildUi.includes('daily-stat daily-damage')&&guildUi.includes('daily-stat daily-contribution'),'Daily historical damage and contribution must have separate labels and values');
assert.match(finishCss,/\.datatable thead th,[\s\S]*?table\.tw-grid thead th\s*\{\s*text-align:center!important/,'Data table headings should be centered by default');
assert.match(finishCss,/\.tw-group-tabs \.tw-carry-controls\s*\{\s*display:flex/,'Mobile carry controls should pack together on the right');
assert.match(finishCss,/\.profile-activity-grid \.daily-profile-bars>div>\.daily-damage\s*\{grid-column:2/,'Daily history should separate damage and contribution');
assert.match(readabilityCss,/body\{font-size:15px/,'Readable default desktop font');
assert.match(readabilityCss,/\.battle-sheet\.compact-battle-sheet tbody td\{font-size:11\.5px/,'Improve mobile battle log text size');
assert.ok(htmlShell.includes('readability.css?v='),'Readability stylesheet should load after other presentation styles');
console.log('PASS: tactic library, carry reset, mobile boss progress, colored battle types, historical figures, and global text readability');


// Resume the two nearly-finished Work edits without losing earlier features.
const compactCombos=fs.readFileSync(new URL('../public/combo-workspace.mjs',import.meta.url),'utf8');
assert.ok(compactCombos.includes('isStageFourUnlocked(month)')&&compactCombos.includes("stage4Open?[]:[['3', '3단계']]"),
  'Recommendation stage-3 menu should disappear as soon as stage four opens');
assert.ok(compactCombos.includes("if(stage4Open&&String(state.comboStage)==='3')"),
  'Switch away from the third-stage menu when it becomes hidden');
assert.ok(compactCombos.includes("button.dataset.value==='3'&&isStageFourUnlocked(api.month())"),
  'Prevent stale third-stage navigation after stage four opens');
assert.ok(!compactCombos.includes('내 캐릭터는 하루 1회 · 서포트는 타당 1명'),
  'Redundant basic support rule must not appear in the planner');
assert.ok(!compactCombos.includes('중복을 풀기 위해 꼭 빌릴 캐릭터입니다.'),
  'Redundant borrowed character explanation must not appear');
assert.ok(compactCombos.includes('4단계 3타 분배') && compactCombos.includes("planThreeAttacks("),
  'Planner calculation and heading must remain intact');
const compactCss=fs.readFileSync(new URL('../public/combo.css',import.meta.url),'utf8');
const appClient=fs.readFileSync(new URL('../public/clan.js',import.meta.url),'utf8');
const displayScript=fs.readFileSync(new URL('../public/display-settings.mjs',import.meta.url),'utf8');
assert.ok(!compactCombos.includes("['detail', '상세']") && !compactCombos.includes('savedView()'),
  'Recommendation cards must no longer offer or restore the deleted detailed mode');
assert.ok(compactCombos.includes("['compact', '조합 목록']") && compactCombos.includes("['planner', '3타 분배']"),
  'The 3-attack optimizer remains reachable alongside the single list');
assert.ok(compactCombos.includes('TP ${tpLabel(combo.tp)}') && compactCombos.includes('combo-mini-chip is-tp'),
  'Integer TP values must be displayed with a decimal and fixed width');
assert.ok(compactCss.includes('border-top:5px solid var(--boss-accent') &&
  compactCss.includes('.combo-mini-chip.is-tp') &&
  compactCss.includes('.combo-mini-facts .source-link-box{order:-1'),
  'Compact cards must have visible boss-colored borders, equal TP widths and mobile video beside the boss');
const logStart=appClient.indexOf('function logTable('),logEnd=appClient.indexOf('function battle(){',logStart);
const recentLog=appClient.slice(logStart,logEnd);
assert.ok(recentLog.includes('<th class="member-heading">클랜원</th>'));
assert.ok(recentLog.indexOf('기록 피해량</th>') < recentLog.indexOf('<th>유형</th>') &&
  recentLog.indexOf('<th>유형</th>') < recentLog.indexOf('실제 피해량</th>') &&
  recentLog.indexOf('실제 피해량</th>') < recentLog.indexOf('기여도</th>'),
  'Recent log columns should follow recorded damage, type, actual damage and contribution');
assert.ok(recentLog.indexOf('<td class="number">${nf(e.damage)}</td>') <
  recentLog.indexOf('<td class="carry-cell">') &&
  recentLog.indexOf('<td class="carry-cell">') <
  recentLog.indexOf('<td class="number calculated">${nf(e.actual)}</td>'),
  'Recent log body must follow its column headings');
assert.ok(readabilityCss.includes('white-space:nowrap!important') &&
  readabilityCss.includes('.recent-battle-table .member-heading{width:19%}'),
  'Member names must stay on a single line in mobile battle log');
assert.ok(displayScript.includes('migrateMobileTextScale') && displayScript.includes('readTacticBaseScale'),
  'Legacy mobile preferences retain their tactic-specific size');
await import('./test-display-settings.mjs');
await import('./test-battle-image-import.mjs');
console.log('PASS: unified cards, mobile log order, consistent text scaling, tactic preservation and OCR review actions');

