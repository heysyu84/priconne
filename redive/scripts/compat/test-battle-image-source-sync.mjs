import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../../'+path,import.meta.url),'utf8');
const source=read('redive/src/retained-tools.js');
const alias=source.slice(source.indexOf('// Match the OCR parser'),source.indexOf('batchImportPage='));
for(const path of ['redive/public/app.js','docs/compact/app.js'])assert.ok(read(path).includes(alias),path+' must include source alias handlers');
for(const name of ['battle-image-import.mjs','battle-image-ocr.mjs','battle-image-readings.mjs']){
 assert.equal(read('redive/public/compat/'+name),read('docs/compact/compat/'+name),name+' deployment copy');
}
const version='20261026-ocr-regions09';
for(const path of ['redive/public/app.js','docs/compact/app.js','redive/public/legacy-tools.mjs','docs/compact/legacy-tools.mjs','redive/scripts/build.mjs'])assert.ok(read(path).includes('?v='+version),path+' must invalidate cached OCR imports');
for(const path of ['redive/public/index.html','docs/index.html'])assert.match(read(path),/app\.js\?v=[^\"]+/,path+' must invalidate the application entrypoint');
console.log('PASS: source and deployment modules, alias handlers and OCR cache versions are synchronized');
