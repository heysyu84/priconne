import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as engine from '../public/battle-engine.mjs';
import * as parser from '../public/tactic-parser.mjs';
import * as partyTools from '../public/party-tools.mjs';
import * as logOrder from '../public/log-order.mjs';
import * as legacyTools from '../public/legacy-tools.mjs';

export function runtimeFixture(storage=new Map()){
  const node=()=>({innerHTML:'',value:'',open:false,dataset:{},classList:{toggle(){},add(){},remove(){}},style:{values:{},setProperty(key,value){this.values[key]=value;}},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;},focus(){},showModal(){this.open=true;},show(){this.open=true;},close(){this.open=false;},setAttribute(){},removeAttribute(){}});
  const elements={app:node(),drawer:node(),toast:node()},listeners={};
  class FixtureFormData{constructor(values){this.values=values;}get(name){return this.values[name]??null;}has(name){return Object.hasOwn(this.values,name);}}
  const context={console,Date,Math,Number,String,Array,Object,Set,Map,JSON,RegExp,URL,structuredClone,TextEncoder,FormData:FixtureFormData,crypto:{randomUUID:crypto.randomUUID},setTimeout(){},clearTimeout(){},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},document:{getElementById:id=>elements[id]||(elements[id]=node()),querySelector(){return null;},querySelectorAll(){return [];},documentElement:node(),body:node(),addEventListener(type,handler){(listeners[type]??=[]).push(handler);}},window:{addEventListener(){},scrollTo(){}},location:{hash:'',origin:'https://priconne.pages.dev'},history:{replaceState(){},pushState(){}},engineReplay:engine.replayMonth,engineProgress:engine.bossProgress,engineContribution:engine.contribution,engineEstimate:engine.estimateCarry,partyTools,logOrder,legacyTools,...parser};
  const filename=fileURLToPath(new URL('../public/app.js',import.meta.url));
  const code=fs.readFileSync(filename,'utf8').replace(/^import[^\n]+\n/gm,'');
  const exposed='\nthis.fixture={get:()=>data,ui,ext,sync:syncState,sharedDocument,applySharedDocument,renderPage,fullTactics,fullClan,fullRecords,completeHistory,completeHall,completeRates,completeRoster,completeLogTable,battleLogContent,saveCompleteLog,moveLogRecord,deleteCompleteLog,logPositionContext,recalculateSeason,sealResult,awardRows,textScale,setTextScale,portraitHtml,defaultCharacterStars,ensureCharacterReference,parseCompatiblePaste,prepareCompatibleBackup,findPlans,applyFoundPlan,selectedParties,entryMatches,richInstruction,videoButton,recommendationRows,selectionControls,clearRecommendedPlan,settingsRules,readCoefficientDraft,fullOverview,winnerText,attackSlot,positionSource:CHARACTER_POSITION_SOURCE};';
  vm.runInNewContext(code+exposed,context,{filename,timeout:20000,importModuleDynamically:vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER});
  return {...context.fixture,document:context.document,elements,listeners,storage};
}
