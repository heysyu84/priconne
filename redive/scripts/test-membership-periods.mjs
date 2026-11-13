import assert from 'node:assert/strict';
import fs from 'node:fs';
import {verifiedMembershipPeriods,verifiedMembershipMonths,verifiedMembershipPeriodLabel} from '../public/membership-periods.mjs';
import {runtimeFixture} from './runtime-fixture.mjs';

const member={uid:'119821969218',joined:'2020-01',left:'2022-06',periods:[{from:'2020-01',to:'2022-06'}]},before=JSON.stringify(member);
assert.deepEqual(verifiedMembershipPeriods(member),[{from:'2020-01',to:'2020-05'},{from:'2022-06',to:'2022-06'}]);
assert.equal(verifiedMembershipMonths(member,'2022-06'),6);
assert.equal(verifiedMembershipPeriodLabel(member),'2020.01–2020.05 / 2022.06–2022.06');
assert.equal(JSON.stringify(member),before);
assert.equal(verifiedMembershipMonths({joined:'2020-01',left:'2020-12',periods:[{from:'2020-01',to:'2020-03'},{from:'2020-03',to:'2020-12'}]},'2020-12'),12);
assert.equal(verifiedMembershipMonths({joined:'2026-01',left:'',periods:[]},'2026-03'),3);
assert.equal(verifiedMembershipMonths({joined:'',left:'',periods:[]},'2026-03'),null);
const app=runtimeFixture();
assert.equal(app.evaluate('memberTenure('+JSON.stringify(member)+',"2022-06")'),6);
assert.equal(app.evaluate('membershipPeriod('+JSON.stringify(member)+')'),verifiedMembershipPeriodLabel(member));
for(const file of ['../public/app.js','../../docs/compact/app.js']){
 const code=fs.readFileSync(new URL(file,import.meta.url),'utf8');assert.match(code,/from '\.\/membership-periods\.mjs/);
}
assert.equal(fs.readFileSync(new URL('../public/membership-periods.mjs',import.meta.url),'utf8'),fs.readFileSync(new URL('../../docs/compact/membership-periods.mjs',import.meta.url),'utf8'));
console.log('PASS membership gaps, overlapping periods, dormancy, unchanged source records and rebuilt module parity');
