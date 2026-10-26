// Regression: the new ReDive screen must send the active page to the retained OCR engine.
// Run with node redive/scripts/compat/test-battle-image-import-mount.mjs from repository root.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sources=[
 'redive/src/retained-tools.js',
 'redive/public/app.js',
 'docs/compact/app.js'
];
const expected="if(ext.importMode&&adminMode())screenshotImporter().mount('battle-import');else imageImportController?.mount(null)";
for(const file of sources){
 const content=await readFile(file,'utf8');
 assert.ok(content.includes(expected),file+': OCR mount must receive page name and cancel when leaving');
 assert.ok(!content.includes('screenshotImporter().mount();'),file+': unsafe OCR mount without argument');
}
const legacy=await readFile('redive/public/compat/battle-image-import.mjs','utf8');
assert.ok(legacy.includes("if(page!=='battle-import'&&state.processing)state.cancel=true;"));
console.log('OK: OCR stays active during new-site renders, but cancels on page exit.');
