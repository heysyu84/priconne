import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import {ensureRoster} from '../public/roster.mjs';

// The actual production routes run only against this in-memory SQLite adapter.
export const sqlite=new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE clan_state(id TEXT PRIMARY KEY,revision INTEGER,payload TEXT,updated_at TEXT); CREATE TABLE clan_archive_months(month TEXT PRIMARY KEY,payload TEXT,updated_at TEXT); CREATE TABLE clan_revisions(revision INTEGER PRIMARY KEY,payload TEXT,created_at TEXT);');
export const control={beforeBatch:null};
function statement(sql,args=[]){return {
  bind(...values){return statement(sql,values);},
  async first(){return sqlite.prepare(sql).get(...args)||null;},
  async all(){return {results:sqlite.prepare(sql).all(...args)};},
  async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};},
};}
globalThis.__clanApiTestEnv={DB:{prepare:statement,async batch(statements){
  if(control.beforeBatch){const callback=control.beforeBatch;control.beforeBatch=null;callback();}
  sqlite.exec('BEGIN');
  try{const results=[];for(const query of statements)results.push(await query.run());sqlite.exec('COMMIT');return results;}
  catch(error){sqlite.exec('ROLLBACK');throw error;}
}}};
registerHooks({resolve(specifier,context,next){
  if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export const env=globalThis.__clanApiTestEnv',shortCircuit:true};
  if(specifier.endsWith('/editor-access'))return {url:'data:text/javascript,export const hasEditor=async request=>request.headers.get("x-test-editor")==="yes"',shortCircuit:true};
  if(specifier.endsWith('/api-access'))return next(specifier+'.ts',context);
  return next(specifier,context);
}});
export function initialState(){
  const html=fs.readFileSync(new URL('../public/clan-shell.html',import.meta.url),'utf8');
  const state=JSON.parse(html.match(/<script id="seed-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  ensureRoster(state,state.rosterSeed);
  state.active=Object.keys(state.months).sort().at(-1);
  state.months={[state.active]:state.months[state.active]};state.storageVersion=2;
  return state;
}
export function reset(state=initialState()){
  control.beforeBatch=null;
  sqlite.exec('DELETE FROM clan_state; DELETE FROM clan_archive_months; DELETE FROM clan_revisions;');
  sqlite.prepare('INSERT INTO clan_state VALUES(?,?,?,?)').run('main',1,JSON.stringify(state),'original');
  return state;
}
export const savedState=()=>sqlite.prepare('SELECT * FROM clan_state WHERE id=?').get('main');
export const request=(path,body,headers={})=>new Request('https://fixture.test'+path,{method:'POST',headers:{Origin:'https://priconne.pages.dev','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
