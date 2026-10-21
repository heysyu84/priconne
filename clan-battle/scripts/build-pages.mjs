import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export function buildPages(output = path.join(root, 'out/pages')) {
  const source = path.join(root, 'public');
  fs.mkdirSync(output, {recursive: true});
  fs.cpSync(source, output, {recursive: true});
  const shell = fs.readFileSync(path.join(source, 'clan-shell.html'), 'utf8');
  const config = '<meta name="nyang-api-origin" content="https://nyang-clan-manager.heysyu457310.chatgpt.site">';
  fs.writeFileSync(path.join(output, 'index.html'), shell.replace('<head>', '<head>' + config));
  fs.writeFileSync(path.join(output, '.nojekyll'), '');
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`GitHub Pages files: ${buildPages(process.argv[2])}`);
