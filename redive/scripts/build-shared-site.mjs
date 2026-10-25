import './prepare-server.mjs';
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/run-framework.mjs','build'],{stdio:'inherit',env:process.env});
if(result.error)throw result.error;
process.exitCode=result.status??1;
