import {buildTextScale} from './build-text-scale.mjs';
import {buildCharacterReference} from './build-character-reference.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
buildCharacterReference(root);
const files=['core','art-catalog','imported-month','roster-reference','future-reference','season','import-current','views','tactics','admin','presentation','refinement','shared','operations','entry-controls','content-editor','interactions','character-reference','usability','log-tools','retained-tools','situation','pages-bridge','history-2025','clan-archive','stage3-recommendations','external-review'];
const imports=`import {replayMonth as engineReplay,bossProgress as engineProgress,contribution as engineContribution,estimateCarry as engineEstimate} from './battle-engine.mjs?v=20261027-carry-link02';\nimport {convertForeignTactic,foreignSuggestions} from './tactic-parser.mjs?v=20261030-except01';\nimport * as partyTools from './party-tools.mjs?v=20261026-log-keys01';\nimport * as logOrder from './log-order.mjs';\nimport * as legacyTools from './legacy-tools.mjs?v=20261030-except02';\n`;
const parts=await Promise.all(files.map(f=>readFile(root+'src/'+f+'.js','utf8')));
await writeFile(root+'public/app.js',imports+parts.join('\n\n')+'\ninitializeCompletePrototype(); if(typeof fetch==="function") initializeSharedSync();\n');
console.log('Built public/app.js');

buildTextScale();


