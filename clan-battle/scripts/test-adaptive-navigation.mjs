import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactNavigation,bottomNavigationColumns} from '../public/adaptive-navigation.mjs';

// The PC navigation remains active for all viewports >= 801px.
assert.equal(compactNavigation(800,900,700),true);
assert.equal(compactNavigation(801,750,900),false);
assert.equal(compactNavigation(1100,1052,1053),false);
assert.equal(compactNavigation(1366,1318,1053),false);
assert.equal(compactNavigation(1100,1052,1000),false);
assert.equal(compactNavigation(1100,1052,1400),false);
assert.equal(compactNavigation(1100,1058,1053,true),false);
assert.equal(compactNavigation(1100,1065,1053,true),false);

// Eight mobile destinations must not collide with enlarged labels.
assert.equal(bottomNavigationColumns(1300,100),8);
assert.equal(bottomNavigationColumns(801,105),4);
assert.equal(bottomNavigationColumns(390,72),4);
assert.equal(bottomNavigationColumns(320,95),2);
assert.equal(bottomNavigationColumns(900,110),8);
assert.equal(bottomNavigationColumns(800,110),4);

// Confirm the complete CSS and DOM implementation is present, not just the math.
const css=readFileSync(new URL('../public/adaptive-navigation.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/adaptive-navigation.mjs',import.meta.url),'utf8');
for(const cols of ['4','2'])assert.match(css,new RegExp('data-nav-columns="'+cols+'"'));
assert.match(js,/createRange\(\)/);
assert.match(js,/ResizeObserver/);
assert.match(js,/data-text-scale/);
console.log('PASS: fixed 800px mobile transition, responsive bottom columns, and scale observers');
