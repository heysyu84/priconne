import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scope='html[data-text-scale]';
const tacticSelector=/\.(?:tw-grid|tw-text-cell|tw-line-number|tw-check-cell|tw-auto-cell|tw-row-tools|tactic-text|tactic-row|checkstrip|t-on|t-off|t-once)\b|data-tw-text/;
const menuSelector=/\.mobile-nav\b|\.sidebar\b.*\.(?:nav|symbol)\b|\.top-actions\b|\.admin-menu\b/;

// Walk CSS boundaries without treating quoted strings, comments or functions
// as delimiters. The output keeps the source cascade and media queries.
function boundary(text,start,stops){
  let quote='',round=0,square=0;
  for(let i=start;i<text.length;i++){
    const c=text[i];
    if(quote){if(c==='\\')i++;else if(c===quote)quote='';continue;}
    if(c==='/'&&text[i+1]==='*'){const end=text.indexOf('*/',i+2);i=end<0?text.length:end+1;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='(')round++;else if(c===')')round--;else if(c==='[')square++;else if(c===']')square--;
    if(!round&&!square&&stops.includes(c))return i;
  }
  return text.length;
}
function split(text,separator){
  const result=[];let start=0;
  while(start<text.length){const end=boundary(text,start,[separator]);result.push(text.slice(start,end));start=end+1;}
  return result;
}
function clean(text){return text.replace(/\/\*[\s\S]*?\*\//g,'').trim();}
function closeBlock(text,open){
  let depth=1,start=open+1;
  while(depth&&start<text.length){const next=boundary(text,start,['{','}']);if(next===text.length)throw Error('Unclosed CSS block');depth+=text[next]==='{'?1:-1;start=next+1;}
  return start-1;
}
function scaled(value,selector,name='font-size'){
  value=value.replace(/\s*!important\s*$/i,'').trim();
  const tactic=tacticSelector.test(selector),menu=menuSelector.test(selector);
  const variable=tactic?'--tactic-text-scale':menu?'--menu-text-scale':'--ui-text-scale';
  const absolute=/[\d.](?:px|pt|pc|cm|mm|in|vw|vh|vmin|vmax)\b/i.test(value);
  const computed=absolute?`calc((${value}) * var(${variable},1))`:value;
  // The shared table token scales once, when declared. Relative text inherits
  // the already scaled parent. Checkbox marks and tactic text retain precision.
  if(name==='--battle-log-font-size'||tactic)return computed;
  if(!absolute&&!value.includes('--battle-log-font-size'))return value;
  const minimum=menu?'--menu-font-min':/^(?:body|html\b[^ ]* body)$/.test(selector)?'--body-font-min':'--ui-font-min';
  return `max(var(${minimum},0px),round(nearest,${computed},1px))`;
}
function declarations(body,selector){
  const result=[];
  for(const declaration of split(body,';')){
    const colon=boundary(declaration,0,[':']);if(colon===declaration.length)continue;
    const name=clean(declaration.slice(0,colon)).toLowerCase();let value=clean(declaration.slice(colon+1));
    if(name==='font'){
      const size=value.match(/(?:^|\s)(\d*\.?\d+(?:px|pt|pc|cm|mm|in|rem|em|%))(?:\s*\/|\s|$)/i);
      if(size)result.push(`font-size:${scaled(size[1],selector)}!important`);
      else if(/^(inherit|initial|unset|revert)(?:\s*!important)?$/i.test(value))result.push(`font-size:${scaled(value,selector)}!important`);
    }else if(name==='font-size'||name==='--battle-log-font-size')result.push(`${name}:${scaled(value,selector,name)}!important`);
  }
  return result.join(';');
}
function scopedSelector(selector){
  selector=clean(selector);
  // Fixed-size checkbox marks and decorative pseudo elements are not text.
  if(!selector||/::?(?:before|after)\b/.test(selector))return '';
  return /^(?:html|:root)\b/.test(selector)?selector.replace(/^(?:html|:root)/,scope):`${scope} ${selector}`;
}
export function scaleStyles(css){
  const result=[];let start=0;
  while(start<css.length){
    const open=boundary(css,start,['{',';']);if(open===css.length)break;
    if(css[open]===';'){start=open+1;continue;}
    const head=clean(css.slice(start,open)),end=closeBlock(css,open),body=css.slice(open+1,end);start=end+1;
    if(/^@(media|supports|container|layer)\b/i.test(head)){
      const nested=scaleStyles(body);if(nested)result.push(`${head}{\n${nested}\n}`);
    }else if(!head.startsWith('@')){
      // Separate selector groups because navigation, tactic content and ordinary
      // text intentionally use different mobile scales and desktop minimums.
      const groups=new Map();
      for(const selector of split(head,',')){
        const scoped=scopedSelector(selector),rules=declarations(body,clean(selector));
        if(scoped&&rules){if(!groups.has(rules))groups.set(rules,[]);groups.get(rules).push(scoped);}
      }
      for(const [rules,selectors] of groups)result.push(`${selectors.join(',\n')}{${rules}}`);
    }
  }
  return result.join('\n');
}
export function buildDisplayStyles(root=fileURLToPath(new URL('..',import.meta.url))){
  const publicDir=path.join(root,'public'),head=fs.readFileSync(path.join(publicDir,'clan-shell.html'),'utf8').split('<script id="seed-data"')[0];
  const files=[...head.matchAll(/<link rel="stylesheet" href="\.\/([^"?#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]).filter(n=>n!=='display-scale.css');
  const output='/* Generated by scripts/build-display-styles.mjs. Shared baselines, whole-pixel text and desktop minimums. */\n'+files.map(name=>`/* ${name} */\n${scaleStyles(fs.readFileSync(path.join(publicDir,name),'utf8'))}`).join('\n')+'\n';
  fs.writeFileSync(path.join(publicDir,'display-scale.css'),output);
  return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(`Display styles: ${buildDisplayStyles().length} characters`);
