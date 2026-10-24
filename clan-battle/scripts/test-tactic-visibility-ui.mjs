import assert from 'node:assert/strict';
import { createTacticWorkspace } from '../public/tactics-workspace.mjs';
import { syncTacticRecommendations, visibleTacticRecommendations } from '../public/tactic-combo-sync.mjs';

const listeners = new Map();
globalThis.document = {
  activeElement: null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(listener);
  },
};

const tactic = (id, hidden = false) => ({
  id, hidden, group: '택틱정리', boss: 1,
  characters: ['라비', '파오이', '게무기', '리리컬', '수셰피'],
  stars: ['5', '5', '5', '5', '5'], expectedDamage: '3.1', note: '',
  rows: [{ id: id + '-row', text: '1:30 AUTO 온, 전부 SET', checked: [true, true, true, true, true, true] }],
});
const visible = tactic('a-visible');
const hidden = tactic('b-hidden', true);
const month = {
  options: { battleSeconds: 90, carryMaxSeconds: 90 },
  bosses: [{ id: 1, name: '테스트 보스' }],
  tactics: [visible, hidden], recommendations: [],
  events: [{ id: 'existing-attack', damage: 12345 }],
};
const originalRows = JSON.stringify(month.tactics.map(t => t.rows));
const originalEvents = JSON.stringify(month.events);
let editable = true, saves = 0, unlocks = 0, rendered;
let workspace;
workspace = createTacticWorkspace({
  getApp: () => ({ active: '2026-10' }), getMonth: () => month,
  canEdit: () => editable, catalog: [],
  section: (title, description, actions = '') => `<h1>${title}</h1>${actions}`,
  persist: () => { saves++; syncTacticRecommendations(month); },
  render: () => { rendered = workspace.view(); },
  notify: () => {}, navigate: () => {}, copyText: () => {},
  unlock: () => { unlocks++; },
});
const click = action => {
  const button = {
    dataset: { tw: action },
    closest: selector => selector === '[data-tw]' ? button : null,
  };
  for (const listener of listeners.get('click') || []) {
    listener({ target: button, preventDefault() {} });
  }
};
const visibilityButton = html => html.match(/<button\b[^>]*data-tw="toggle-hidden"[^>]*>[\s\S]*?<\/button>/)?.[0];

syncTacticRecommendations(month);
rendered = workspace.view();
assert.match(visibilityButton(rendered), /aria-pressed="false"/);
assert.match(visibilityButton(rendered), />숨기기<\/button>/);
assert.ok(rendered.includes('data-tw-id="b-hidden"'), 'editors retain access to hidden tactics');

click('toggle-hidden');
assert.equal(visible.hidden, true);
assert.match(visibilityButton(rendered), /aria-pressed="true"/);
assert.match(visibilityButton(rendered), />다시 표시<\/button>/);
assert.deepEqual(visibleTacticRecommendations(month), []);

click('toggle-hidden');
assert.equal(visible.hidden, false);
assert.match(visibilityButton(rendered), />숨기기<\/button>/);
assert.deepEqual(visibleTacticRecommendations(month).map(r => r.sourceTacticId), ['a-visible']);
assert.equal(saves, 2);
assert.equal(JSON.stringify(month.tactics.map(t => t.rows)), originalRows);
assert.equal(JSON.stringify(month.events), originalEvents);

editable = false;
rendered = workspace.view();
assert.equal(visibilityButton(rendered), undefined);
assert.ok(rendered.includes('data-tw-id="a-visible"'));
assert.ok(!rendered.includes('data-tw-id="b-hidden"'), 'hidden tactics stay out of the public library');
click('toggle-hidden');
assert.equal(unlocks, 1);
assert.equal(saves, 2, 'non-editors cannot change tactic visibility');
assert.equal(visible.hidden, false);

console.log('PASS: workspace module loads; hide/restore labels, permissions and recommendations work; tactic rows and battle records remain intact.');
