import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildDisplayStyles} from './build-display-styles.mjs';
import {buildRedivePages} from '../../redive/scripts/build-pages.mjs';
import {preservePublishedSeed} from '../../redive/scripts/published-records.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
export function buildPages(output = path.join(root, 'out/pages')) {
  const published=path.join(root,'../docs');
  const seeds=new Map(['clan-shell.html','legacy.html'].map(name=>{
    const file=path.join(published,name);
    return [name,fs.existsSync(file)?fs.readFileSync(file,'utf8'):null];
  }));
  const bundle=spawnSync(process.execPath,[fileURLToPath(new URL('../../redive/scripts/build.mjs',import.meta.url))],{stdio:'inherit'});
  if(bundle.error)throw bundle.error;
  if(bundle.status!==0)throw new Error('새 화면 소스 빌드에 실패했습니다.');
  buildDisplayStyles(root);
  const source = path.join(root, 'public');
  fs.mkdirSync(output, {recursive: true});
  fs.cpSync(source, output, {recursive: true});
  const shell = fs.readFileSync(path.join(source, 'clan-shell.html'), 'utf8');
  const config = '<meta name="nyang-api-origin" content="https://nyang-clan-manager.heysyu457310.chatgpt.site">';
  buildRedivePages(output, {legacyHtml: shell.replace('<head>', '<head>' + config)});
  for(const [name,previous]of seeds){
    const file=path.join(output,name);
    fs.writeFileSync(file,preservePublishedSeed(fs.readFileSync(file,'utf8'),previous).trimEnd()+'\n');
  }
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`GitHub Pages files: ${buildPages(process.argv[2])}`);

