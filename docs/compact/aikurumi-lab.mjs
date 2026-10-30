import {createExternalReview} from './aikurumi-review-ui.mjs?v=20261030-dango03';
// Registration is supplied only by the authenticated main application.
let bossNames={};
const review=createExternalReview({getContext:()=>({bossNames})});
review.mount(document.getElementById('external-tactic-review'));
fetch('../future-bosses.json',{cache:'force-cache'}).then(r=>r.ok?r.json():null).then(data=>{
 if(!data?.months)return;
 bossNames=Object.fromEntries(Object.entries(data.months).map(([month,entry])=>[month,
  Object.fromEntries((entry.bosses||[]).map(b=>[b.slot,b.name]))]));
 review.draw();
}).catch(()=>{});
