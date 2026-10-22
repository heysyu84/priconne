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
assert.equal(assetUrl('/images/characters/a.png'),'/priconne/images/characters/a.png');
assert.equal(assetUrl('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');
const portrait=characterPortrait([{name:'테스트',portrait:'/images/characters/a.png',byStar:{'5':'/images/characters/b.png'}}],'테스트',5);
assert.equal(portrait.url,'/priconne/images/characters/b.png');
const img={matches:()=>true,dataset:{portraitFallbacks:JSON.stringify(['/images/characters/a.png'])}};handlePortraitError({target:img});assert.equal(img.src,'/priconne/images/characters/a.png');
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
