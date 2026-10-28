import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
export const API_ORIGIN='https://nyang-clan-manager.heysyu457310.chatgpt.site';
export const PUBLIC_ORIGIN='https://priconne.pages.dev';
export const RELEASE='20261028-missing-records04';
export function canonicalHead(legacy=false){
  const page=legacy?'/legacy.html':'/';
  return `<link rel="canonical" href="${PUBLIC_ORIGIN}${page}"><script>if(location.hostname==='heysyu84.github.io'&&!new URLSearchParams(location.search).has('github-preview')){location.replace('${PUBLIC_ORIGIN}'+(location.pathname.replace(/^\\/priconne(?=\\/|$)/,'')||'/')+location.search+location.hash)}</script>`;
}
export function activateVersionLink(html){
  return html.replace(/<a class="btn sm version-link"[^>]*>신버전 열기<\/a>/g,`<a class="btn sm version-link" href="${PUBLIC_ORIGIN}/" aria-label="냥냥클랜 새 화면 열기">간편 버전</a>`).replace(/<button[^>]*class="btn sm version-pending"[^>]*>간편 버전[\s\S]*?<\/button>/g,`<a class="btn sm version-link" href="${PUBLIC_ORIGIN}/">간편 버전</a>`);
}
export function buildRedivePages(output,{legacyHtml}={}){
  fs.mkdirSync(output,{recursive:true});
  const compact=path.join(output,'compact');
  fs.rmSync(compact,{recursive:true,force:true});
  fs.cpSync(path.join(root,'public'),compact,{recursive:true,filter:source=>!path.basename(source).startsWith('__qa')});
  let app=fs.readFileSync(path.join(compact,'app.js'),'utf8');
  // HTML image URLs resolve against the root page; JS imports and CSS URLs
  // already resolve against their own compact module/style URL.
  app=app.replaceAll('./assets/','./compact/assets/');
  fs.writeFileSync(path.join(compact,'app.js'),app);
  let html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  html=html.replace('<head>',`<head><meta name="nyang-legacy-api-origin" content="${API_ORIGIN}">${canonicalHead()}`);
  html=html.replace(/((?:src|href)=")\.\/([^"?#]+)(?:\?[^"#]*)?"/g,(_,prefix,file)=>{
    const branding=file.startsWith('images/branding/')||['apple-touch-icon.png','site.webmanifest'].includes(file);
    return `${prefix}./${branding?'':'compact/'}${file}?v=${branding?'20261026-nyang-pink02':RELEASE}"`;
  });
  fs.writeFileSync(path.join(output,'index.html'),html);
  // This is an asset directory, not a second application entry point.
  fs.rmSync(path.join(compact,'index.html'),{force:true});
  if(legacyHtml){
    const api='<meta name="nyang-api-origin" content="'+API_ORIGIN+'">';
    let legacy=activateVersionLink(legacyHtml);
    if(!legacy.includes('name="nyang-api-origin"'))legacy=legacy.replace('<head>','<head>'+api);
    legacy=legacy.replace('<head>','<head>'+canonicalHead(true));
    fs.writeFileSync(path.join(output,'legacy.html'),legacy);
  }
  fs.writeFileSync(path.join(output,'.nojekyll'),'');
  return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=path.resolve(process.argv[2]||path.join(root,'out/pages'));
  const legacy=process.argv[3]?fs.readFileSync(path.resolve(process.argv[3]),'utf8'):undefined;
  console.log('New interface static files: '+buildRedivePages(output,{legacyHtml:legacy}));
}




