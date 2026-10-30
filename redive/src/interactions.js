function flushGrid(){if(ext.gridSaveTimer){clearTimeout(ext.gridSaveTimer);ext.gridSaveTimer=null;const t=activeTactic();if(t)saveGridText(t);}}
function exportCurrentTable(){const rows=[['순번','일차','회차','단계','보스','클랜원','기록 피해량','이전 HP','실제 피해량','남은 HP','기여도','인게임','유형','공격 일시','메모'],...getFilteredCompleteLogs().map(e=>[e.seq,e.day,e.lap,e.stage,e.boss,currentMember(e.memberId).name,e.damage,e.before,e.actual,e.after,e.contribution,e.game,e.role,e.gameAt,e.note])];downloadCsv(rows,`배틀로그_${ui.month}_${ext.allDays?'전체':ui.day+'일차'}.csv`);}
function downloadCsv(rows,filename){const protect=v=>{const s=String(v??'');return /^[=+@]/.test(s)?"'"+s:s;};downloadFile('\ufeff'+rows.map(row=>row.map(v=>'"'+protect(v).replace(/"/g,'""')+'"').join(',')).join('\r\n'),filename,'text/csv;charset=utf-8');}
function switchMonthTo(key,archive=true){flushGrid();if(!activateSeason(key))return;ext.bossDraft=null;ext.importMode=false;ext.archiveView='summary';if(archive)ext.allDays=true;if(archive)nav('records','archive');else render();}
function sha256Text(value){const bytes=[...new TextEncoder().encode(value)],length=bytes.length*8;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);for(let i=7;i>=0;i--)bytes.push(i>=4?0:(length>>>(i*8))&255);const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2],h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],rot=(v,n)=>(v>>>n)|(v<<(32-n));for(let p=0;p<bytes.length;p+=64){const w=Array(64).fill(0);for(let i=0;i<16;i++)w[i]=((bytes[p+i*4]<<24)|(bytes[p+i*4+1]<<16)|(bytes[p+i*4+2]<<8)|bytes[p+i*4+3])>>>0;for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rot(a,7)^rot(a,18)^(a>>>3),s1=rot(b,17)^rot(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}let[a,b,c,d,e,f,g,q]=h;for(let i=0;i<64;i++){const s1=rot(e,6)^rot(e,11)^rot(e,25),ch=(e&f)^(~e&g),t1=(q+s1+ch+k[i]+w[i])>>>0,s0=rot(a,2)^rot(a,13)^rot(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)>>>0;q=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,q].forEach((v,i)=>h[i]=(h[i]+v)>>>0);}return h.map(v=>v.toString(16).padStart(8,'0')).join('');}
function toggleWriter(){if(syncState.started){if(!syncState.ready){toast('공용 자료를 불러온 뒤 수정할 수 있습니다.');return;}if(!syncState.canEdit){toast('관리자 로그인 후 수정할 수 있습니다.');return;}flushGrid();data.settings.editable=!data.settings.editable;ext.workEditing=false;persist();render();return;}if(data.settings.editable){data.settings.editable=false;ext.workEditing=false;persist();render();toast('작성 잠금');return;}if(!data.pinHash){data.settings.editable=true;persist();render();return;}openDrawer('작성 잠금 해제','<div class="field"><label for="unlock-pin">작성 비밀번호</label><input id="unlock-pin" name="pin" type="password" autocomplete="current-password" required></div>','<button type="button" class="button" data-action="close-drawer">취소</button><button type="submit" class="button primary">해제</button>','',false,'v2-unlock');}
function openNewMonth(){const last=Object.keys(data.seasons).sort().at(-1),[year,month]=last.split('-').map(Number),next=month===12?(year+1)+'-01':year+'-'+String(month+1).padStart(2,'0');openDrawer('새 월 만들기',`<div class="field"><label for="new-month-key">월</label><input id="new-month-key" name="month" type="month" value="${next}" required></div><label class="inline-check"><input name="copyTactics" type="checkbox" checked>현재 월의 4단계 택틱 복사</label><p class="field-help">3단계 추천조합은 빈 목록으로 시작합니다.</p>`,'<button type="button" class="button" data-action="close-drawer">취소</button><button type="submit" class="button primary">만들기</button>','',false,'v2-new-month');}
function showAwards(id){const rows=[];for(const [month,season]of Object.entries(data.seasons)){if(!season.result.sealed)continue;for(const metric of ['damage','contribution','game'])for(const [i,w]of (season.result.winners?.[metric]||[]).entries())if(w.id===id)rows.push(`<tr><td>${month.replace('-','.')}</td><td>${{damage:'피해량',contribution:'기여도',game:'인게임'}[metric]}</td><td>${i+1}위</td></tr>`);}openDrawer(currentMember(id).name+' 수상 기록',rowTable(['월','항목','순위'],rows),simpleButton('닫기','close-drawer'));}
const capturedActions=new Set(['archive-detail','delete-tactic','confirm-delete-tactic','hide-tactic','duplicate-tactic','copy-tactic','export-json','set-theme','theme','reset-carry']);
document.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const action=button.dataset.action,id=button.dataset.id,value=button.dataset.value;if(action==='nav'||action==='tab'){flushGrid();ext.importMode=false;ext.workEditing=false;if(drawer.open)closeDrawer();return;}if(!action.startsWith('v2-')&&!capturedActions.has(action))return;event.preventDefault();event.stopImmediatePropagation();
 if(action==='set-theme'||action==='theme'){data.settings.theme=action==='theme'?(data.settings.theme==='light'?'dark':'light'):value;persist();render();return;}
 if(action==='archive-detail'||action==='v2-switch-month'){switchMonthTo(id,action==='archive-detail');return;}
 if(action==='v2-settings'){ext.settingsPage='display';nav('clan','settings');return;}if(action==='v2-settings-page'){ext.settingsPage=value;render();return;}if(action==='v2-lock'){toggleWriter();return;}
 if(action==='v2-combo-stage'){ext.stage=Number(value);render();return;}if(action==='v2-toggle-notice'){ext.noticeOpen=!ext.noticeOpen;render();return;}
 if(action==='v2-notice'){if(!ensureEdit())return;openDrawer(ext.stage+'단계 조합 안내',`<div class="field"><label for="combo-notice">안내</label><textarea id="combo-notice" name="notice" rows="10">${X(data.notices[ext.stage]||'')}</textarea></div>`,`<button type="submit" class="button primary">저장</button>`,'',true,'v2-notice');return;}
 if(action==='v2-open-planner'){ext.distributionOpen=true;findPlans();nav('tactics','combos');return;}if(action==='v2-copy-plan'){const text=selectedParties().map((t,i)=>`${i+1}타 ${t.boss}넴 ${t.party.join(' ')} / ${tacticDamageLabel(t)} / 대여 ${t.party[t.support]||'없음'}`).join('\n');await copyText(text);return;}if(action==='v2-find-plans'){findPlans();render();return;}if(action==='v2-use-plan'){applyFoundPlan(Number(id));return;}
 if(action==='v2-work-group'){ext.workGroup=value;ext.carryTimeRange='all';ext.workEditing=false;ui.carry=90;render();return;}if(action==='v2-select-tactic'){flushGrid();ui.selectedTactic=id;ui.libraryOpen=true;ext.rowUndo=[];ext.rowRedo=[];ui.carry=activeTactic()?.duration||90;render();return;}
 if(action==='v2-open-workspace'){const t=data.tactics.find(t=>t.id===id);ext.workGroup=t.hidden?'hidden':t.category;ext.carryTimeRange='all';ext.stage=t.stage;ui.selectedTactic=id;ui.carry=t.duration||90;closeDrawer();nav('tactics','workspace');return;}
 if(action==='v2-tactic-trash'){nav('tactics','trash');return;}if(action==='v2-back-workspace'){nav('tactics','workspace');return;}
 if(action==='delete-tactic'){if(!ensureEdit())return;openDrawer('택틱 삭제','<p>삭제함으로 이동합니다.</p>',simpleButton('취소','close-drawer')+simpleButton('삭제','confirm-delete-tactic',id,'danger'));return;}
 if(action==='confirm-delete-tactic'){if(!ensureEdit())return;checkpoint();const t=data.tactics.find(t=>t.id===id);t.deletedAt=Date.now();ui.picks=ui.picks.filter(i=>i!==id);persist();closeDrawer();render();toast('삭제함으로 이동',true);return;}
 if(action==='v2-restore-tactic'){if(!ensureEdit())return;checkpoint();const t=data.tactics.find(t=>t.id===id);delete t.deletedAt;persist();render();toast('택틱 복원',true);return;}
 if(action==='hide-tactic'){
  if(!ensureEdit())return;
  const matches=data.tactics.filter(t=>t.id===id);
  if(matches.length!==1){toast('택틱을 정확히 확인하지 못했습니다. 최신 목록을 다시 확인하세요.');return;}
  flushGrid();checkpoint();const t=matches[0];t.hidden=!t.hidden;
  ui.picks=ui.picks.filter(i=>i!==id);ext.workEditing=false;
  if(!t.hidden){ext.workGroup=t.category;ext.stage=4;ext.carryTimeRange='all';ui.boss=0;ui.selectedTactic=t.id;ui.libraryOpen=true;ui.carry=t.duration||90;ext.rowUndo=[];ext.rowRedo=[];}
  persist();if(!t.hidden)nav('tactics','workspace');else render();
  toast((t.hidden?'숨김: ':'다시 표시: ')+(t.boss?t.boss+'넴 · ':'미분류 · ')+t.party.join(' '),true);return;
 }
 if(action==='duplicate-tactic'){if(!ensureEdit())return;checkpoint();const t=structuredClone(data.tactics.find(t=>t.id===id));t.id=uid();for(const row of tacticRows(t))row.id=uid();data.tactics.push(t);ui.selectedTactic=t.id;persist();render();toast('택틱 복제',true);return;}
 if(action==='copy-tactic'){const t=tacticById(id);await copyText(adjustedWithBase(tacticRows(t).map(r=>r.text).join('\n'),ui.carry,t.duration||90));return;}
 if(action==='v2-copy-set'){const t=activeTactic();await copyText(tacticRows(t).map(r=>r.checked.map(v=>v?'TRUE':'FALSE').join('\t')+'\t'+adjustedWithBase(r.text,ui.carry,t.duration||90)).join('\n'));return;}
 if(action==='v2-carry-original'||action==='reset-carry'){ui.carry=activeTactic()?.duration||90;render();return;}if(action==='v2-work-estimate'){ext.showEstimator=!ext.showEstimator;render();updateEstimator();return;}
 if(action==='v2-edit-grid'){if(!ensureEdit())return;flushGrid();ext.workEditing=!ext.workEditing;ui.carry=activeTactic()?.duration||90;render();return;}
 if(action==='v2-add-row'){if(!ensureEdit())return;const t=activeTactic();rememberRows(t);t.rows.push({id:uid(),text:'',checked:[...(t.rows.at(-1)?.checked||Array(6).fill(false))]});saveGridText(t);render();return;}
 if(action==='v2-delete-row'){if(!ensureEdit())return;const t=activeTactic();rememberRows(t);t.rows=t.rows.filter(r=>r.id!==id);saveGridText(t);render();return;}
 if(action==='v2-row-undo'||action==='v2-row-redo'){if(!ensureEdit())return;const source=action==='v2-row-undo'?ext.rowUndo:ext.rowRedo,target=action==='v2-row-undo'?ext.rowRedo:ext.rowUndo;const snapshot=source.pop();if(!snapshot)return;const t=data.tactics.find(t=>t.id===snapshot.id);target.push({id:t.id,rows:structuredClone(t.rows)});t.rows=snapshot.rows;saveGridText(t);render();return;}
 if(action==='v2-paste-rows'){openPasteRows();return;}if(action==='v2-commit-paste'){commitPastedRows();return;}
 if(action==='v2-restate'){if(!ensureEdit())return;const t=activeTactic();rememberRows(t);const rows=tacticRows(t);for(const row of rows)row.manualChecks=false;legacyTools.recalculateTacticRows(rows,t.party,data.characters);saveGridText(t);render();return;}
 if(action==='v2-apply-estimate'){const result=estimateResult();if(result.error||!result.seconds){toast(result.error||'적용할 이월 시간이 없습니다.');return;}ui.carry=result.seconds;ext.showEstimator=false;nav('tactics','workspace');return;}
 if(action==='v2-apply-remaining'){const seconds=timeToSec(document.getElementById('carry-remaining').value);if(!(seconds>=0&&seconds<=90)){toast('시간을 확인하세요.');return;}ui.carry=Math.min(90,seconds+20);nav('tactics','workspace');return;}
 if(action==='v2-external-reset'){ext.externalBase=90;ext.externalSeconds=90;render();return;}
 if(action==='v2-copy-converted'||action==='v2-copy-converted-set'){if(!ext.converterResult)return;await copyText(action.endsWith('-set')?ext.converterResult.pasteText:ext.converterResult.text);return;}
 if(action==='v2-reset-converter'){ext.converterRaw='';ext.converterNames=[];ext.converterAliases=[];ext.converterResult=null;render();return;}
 if(action==='v2-save-converted'){if(!ensureEdit()||!ext.converterResult?.rows.length)return;checkpoint();const party=Array.from({length:5},(_,i)=>ext.converterNames[i]||'캐릭터 '+(i+1)),t={id:uid(),boss:ui.boss||0,stage:4,category:'main',title:party.join(' '),party,stars:defaultCharacterStars(party),support:-1,damage:0,hands:0,tp:'',duration:90,hidden:false,video:'',note:'',links:[],text:ext.converterResult.text,rows:ext.converterResult.rows.map(r=>({id:uid(),text:r.text,checked:r.checked}))};data.tactics.push(t);ui.selectedTactic=t.id;ext.workGroup='main';ext.stage=4;ui.boss=0;persist();nav('tactics','workspace');toast('택틱 등록',true);return;}
 if(action==='v2-import-carry'){carryImportDialog();return;}if(action==='v2-carry-template'){downloadCsv([['보스','편성','성급','손컨','TP','기대딜','원본시간','본문','영상','메모'],['1','유이 콧코로 페코린느 레이 사렌','55655','0','4.2','1.8','1:00','1:00 AUTO 오프\n0:30 전원 SET','','']],'이월택틱_양식.csv');return;}
 if(action==='v2-preview-carry'){try{ext.carryImport=parseCarrySheet(document.getElementById('carry-sheet-paste').value.split('\n').filter(Boolean).map(line=>line.split('\t')));renderCarryPreview();}catch(error){toast(error.message);}return;}
 if(action==='v2-commit-carry'){commitCompatibleCarry();return;}
 if(action==='v2-analyze-images'){void v2AnalyzeImages();return;}if(action==='v2-import-images'){ext.importMode=true;render();return;}if(action==='v2-close-import'){if(ext.ocrBusy){toast('OCR 분석 중입니다.');return;}ext.importMode=false;for(const image of ext.images)URL.revokeObjectURL(image.url);ext.images=[];render();return;}if(action==='v2-active-image'){ext.activeImage=Number(value);render();return;}
 if(action==='v2-add-import-row'){ext.importRows.push(newImportRow());render();return;}if(action==='v2-import-delete'){ext.importRows=ext.importRows.filter(r=>r.id!==id);render();return;}
 if(action==='v2-import-up'||action==='v2-import-down'){const i=ext.importRows.findIndex(r=>r.id===id),j=i+(action.endsWith('up')?-1:1);if(j>=0&&j<ext.importRows.length)[ext.importRows[i],ext.importRows[j]]=[ext.importRows[j],ext.importRows[i]];render();return;}
 if(action==='v2-parse-batch'){ext.importRows.push(...parseBatchText(document.getElementById('batch-source-text').value));render();return;}if(action==='v2-commit-batch'){commitBatchRows();return;}
 if(action==='v2-log-order'){ext.logOrder=ext.logOrder==='asc'?'desc':'asc';render();return;}
 if(action==='v2-log-up'||action==='v2-log-down'){if(!ensureEdit())return;const ordered=[...data.logs].sort((a,b)=>a.seq-b.seq),i=ordered.findIndex(e=>e.id===id),j=i+(action.endsWith('up')?-1:1);if(j<0||j>=ordered.length)return;checkpoint();[ordered[i].seq,ordered[j].seq]=[ordered[j].seq,ordered[i].seq];recalculateSeason();persist();render();toast('등록 순서 변경',true);return;}
 if(action==='v2-close-day'){if(!ensureEdit())return;openDrawer(ui.day+'일차 마감',`<p>${ui.day}일차 ${data.logs.filter(e=>e.day===ui.day).length}건을 마감합니다.</p>`,simpleButton('취소','close-drawer')+simpleButton('마감','v2-confirm-close-day','','primary'));return;}
 if(action==='v2-confirm-close-day'){checkpoint();data.dayClosures.push({day:ui.day,count:data.logs.filter(e=>e.day===ui.day).length,at:new Date().toLocaleString('ko-KR')});if(ui.day<data.rules.days)ui.day++;persist();closeDrawer();render();toast('일차 마감',true);return;}
 if(action==='v2-reopen-day'){if(!ensureEdit())return;checkpoint();data.dayClosures=data.dayClosures.filter(d=>d.day!==ui.day);persist();render();toast('마감 취소',true);return;}
 if(action==='v2-undo'){if(!undoState)return;data=undoState;undoState=null;recalculateSeason();persist();render();toast('실행 취소');return;}
 if(action==='v2-archive-view'){ext.archiveView=value;ui.day=data.rules.days;render();return;}
 if(action==='v2-history-rank'){if(!ensureEdit())return;const s=id===ui.month?data:data.seasons[id];openDrawer(id.replace('-','.')+' 클랜 순위',`<input type="hidden" name="month" value="${id}"><div class="field"><label for="clan-rank">클랜 순위</label><input id="clan-rank" name="rank" type="number" min="1" value="${s.result.rank||''}"></div>`,'<button type="submit" class="button primary">저장</button>','',false,'v2-history-rank');return;}
 if(action==='v2-confirm-season'){if(!ensureEdit())return;const s=id===ui.month?data:data.seasons[id];openDrawer(id.replace('-','.')+' 결과 확정',rowTable(['항목','1위·2위'],['damage','contribution','game'].map(metric=>`<tr><th>${{damage:'피해량',contribution:'기여도',game:'인게임'}[metric]}</th><td class="winner-cell">${winnerText(winnersFrom(s.logs),metric)}</td></tr>`)),simpleButton('취소','close-drawer')+simpleButton('확정','v2-seal-season',id,'primary'));return;}
 if(action==='v2-seal-season'){checkpoint();const s=id===ui.month?data:data.seasons[id];s.result={...s.result,sealed:true,confirmedAt:Date.now(),winners:winnersFrom(s.logs),fingerprint:resultFingerprint(s.logs)};persist();closeDrawer();render();toast('월별 결과 확정',true);return;}if(action==='v2-award-detail'){showAwards(id);return;}
 if(action==='v2-dashboard-csv'){downloadCsv([['클랜원','사용','남은 타수','이월','당일 피해량'],...allSeasonStats().map(s=>[s.member.name,s.used,s.remaining,s.carry,s.dayDamage])],`대시보드_${ui.month}_${ui.day}일차.csv`);return;}
 if(action==='v2-ranking-csv'){downloadCsv([['클랜원','인게임','기여도','피해량','일일 피해량','일일 기여도'],...rankedStats().map(s=>[s.member.name,s.game,s.contribution,s.damage,s.dayDamage,s.dayContribution])],`월간순위_${ui.month}.csv`);return;}
 if(action==='v2-factor'){if(!ensureEdit())return;openDrawer('기여도 보정률',`<div class="field"><label for="coefficient-factor">보정률 · %</label><input name="factor" id="coefficient-factor" type="number" min="1" max="200" step="any" value="${data.rules.factor*100}"></div>`,'<button type="submit" class="button primary">저장</button>','',false,'v2-factor');return;}
 if(action==='v2-config-stage'){const form=document.querySelector('form[data-form="v2-rules"]');if(form)collectRulesDraft(form);ext.configStage=Number(value);render();return;}
 if(action==='v2-add-membership-period'){const area=document.getElementById('membership-periods');area.insertAdjacentHTML('beforeend',periodFields({from:ui.month,to:null},area.querySelectorAll('.membership-period').length));return;}
 if(action==='v2-member-status'){if(!ensureEdit())return;checkpoint();const m=currentMember(id);if(m.status==='active'){m.status='graduated';m.left=ui.month+'-01';if(m.periods?.length)m.periods.at(-1).to=ui.month;if(data.memberships[id])data.memberships[id].to=ui.day;}else{m.status='active';m.left='';m.periods??=[];m.periods.push({from:ui.month,to:null});data.memberships[id]={from:ui.day,to:data.rules.days};}persist();render();toast(m.status==='active'?'클랜원 복귀':'탈퇴 처리',true);return;}
 if(action==='v2-new-month'){openNewMonth();return;}if(action==='v2-add-link'){const root=document.getElementById('community-link-fields');root.insertAdjacentHTML('beforeend',linkFields({label:'',url:''},root.querySelectorAll('.link-row').length));return;}
 if(action==='export-json'){snapshotSeason();downloadFile(JSON.stringify(data,null,2),`냥냥클랜_시제품_전체.json`,'application/json');return;}
 if(action==='v2-export-month'){snapshotSeason();downloadFile(JSON.stringify({schema:2,monthExport:true,month:ui.month,season:data.seasons[ui.month],members:data.members},null,2),`냥냥클랜_${ui.month}.json`,'application/json');return;}
 if(action==='v2-reset-confirm'){openDrawer('시제품 초기화','<p>이 브라우저의 편집 내용을 불러온 10월 자료로 되돌립니다.</p>',simpleButton('취소','close-drawer')+simpleButton('초기화','v2-reset-all','','danger'));return;}
 if(action==='v2-reset-all'){if(!ensureEdit())return;checkpoint();const appearance={...data.settings};data=seed();data.settings.theme=appearance.theme;initializeSeasons();applyImportedSnapshot();initializeVisuals();applyGameScope();recalculateSeason();initializeAwards();persist();closeDrawer();nav('overview','bosses');toast('초기화',true);return;}
 if(action==='v2-confirm-restore'){if(!ensureEdit())return;restorePreparedBackup();return;}
 if(action==='v2-add-character'||action==='v2-edit-character'){openCharacter(id||null);return;}if(action==='v2-delete-portrait'){delete ext.pendingImages[document.getElementById('portrait-star').value];ext.cropImage=null;showStoredPortrait();return;}
},true);
function initializeAwards(){for(const season of Object.values(data.seasons))if(season.result.sealed&&!season.result.winners){season.result.winners=winnersFrom(season.logs);season.result.fingerprint=resultFingerprint(season.logs);}}
function renderCarryPreview(){document.getElementById('carry-import-preview').innerHTML=rowTable(['보스','편성','기대딜','행 수'],(ext.carryImport||[]).map(r=>`<tr><td>${r.boss}넴</td><td>${X(r.party.join(' '))}</td><td>${r.damage}억</td><td>${r.text.split('\n').length}</td></tr>`));}

let v2OcrSdk=null;
async function v2LoadOcr(){
 if(globalThis.Tesseract?.createWorker)return globalThis.Tesseract;
 if(!v2OcrSdk)v2OcrSdk=new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';s.async=true;
  s.onload=()=>globalThis.Tesseract?.createWorker?resolve(globalThis.Tesseract):reject(new Error('OCR 엔진 로드 실패'));
  s.onerror=()=>reject(new Error('OCR 엔진 다운로드 실패 · 인터넷 연결을 확인하세요.'));
  document.head.appendChild(s);
 }).catch(e=>{v2OcrSdk=null;throw e;});
 return v2OcrSdk;
}
function v2Crop(bitmap,frame,field=null){
 const f=field?{x:frame.x+frame.w*field.x,y:frame.y+frame.h*field.y,w:frame.w*field.w,h:frame.h*field.h}:frame;
 const w=Math.max(1,Math.floor(bitmap.width*f.w)),h=Math.max(1,Math.floor(bitmap.height*f.h));
 const z=Math.min(field?5:2.5,2100/w,720/h),c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(w*z));c.height=Math.max(1,Math.round(h*z));
 const ctx=c.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('Canvas 생성 실패');
 ctx.imageSmoothingQuality='high';
 ctx.drawImage(bitmap,bitmap.width*f.x,bitmap.height*f.y,w,h,0,0,c.width,c.height);return c;
}
async function v2ReadOcr(worker,bitmap,frame,field){
 const canvas=v2Crop(bitmap,frame,field);
 try{
  await worker.setParameters({tessedit_pageseg_mode:field?'7':'3',tessedit_char_whitelist:''});
  const result=await worker.recognize(canvas);
  return {text:String(result.data?.text||'').trim(),confidence:Number(result.data?.confidence||0)};
 }finally{canvas.width=canvas.height=0;}
}
async function v2AnalyzeImages(force=true){
 if(ext.ocrBusy)return;
 const images=ext.images.filter(item=>item.file&&(force||!item.ocrDone));
 if(!images.length){ext.ocrStatus='새로 분석할 이미지가 없습니다. 이미 선택된 이미지의 결과를 확인하세요.';render();return;}
 const month=ui.month,job=uid();ext.ocrBusy=true;ext.ocrJob=job;ext.ocrErrors=[];ext.ocrStatus='OCR 엔진 및 한국어 모델을 준비 중입니다…';render();
 const progress=value=>{if(ext.ocrJob!==job)return;ext.ocrStatus=value;const el=document.getElementById('v2-ocr-status');if(el)el.textContent=value;};
 let worker=null,found=0;
 try{
  if(typeof createImageBitmap!=='function')throw Error('브라우저가 이미지 OCR을 지원하지 않습니다.');
  const [{parseBattleLogText,parseQuickLogText,matchBossReadings,cleanOcrName},sdk]=await Promise.all([import('./compat/battle-image-parser.mjs'),v2LoadOcr()]);
  const roster=data.members.filter(memberSeasonActive).map(m=>({id:m.id,name:m.name,aliases:Array.isArray(m.aliases)?m.aliases:[]}));
  const bosses=data.bossSettings.map(b=>({id:b.id,name:b.name,aliases:Array.isArray(b.aliases)?b.aliases:[]}));
  progress('한국어 OCR 모델 준비 중…');
  worker=await sdk.createWorker('kor',1,{logger:e=>{if(e.status==='recognizing text')progress('문자 인식 중 '+Math.round(Number(e.progress||0)*100)+'%');}});
  const frames=ext.ocrMode==='quick'?[{x:.711,y:.242,w:.215,h:.565}]:[{x:.133,y:.252,w:.563,h:.176},{x:.133,y:.438,w:.563,h:.172},{x:.133,y:.623,w:.563,h:.165}];
  const fields={member:{x:.33,y:.44,w:.25,h:.19},damage:{x:.72,y:.02,w:.26,h:.30},date:{x:.365,y:.65,w:.225,h:.28},boss:{x:.04,y:.75,w:.25,h:.19}};
  for(let i=0;i<images.length;i++){
   if(ext.ocrJob!==job||month!==ui.month||!ext.importMode)break;
   const item=images[i];
   const oldRows=ext.importRows.filter(r=>r.ocrImageId===item.id);
   if(force&&oldRows.length)ext.importRows=ext.importRows.filter(r=>r.ocrImageId!==item.id);
   progress((i+1)+'/'+images.length+'장 분석 중: '+item.name);
   let bitmap=null;
   try{
    bitmap=await createImageBitmap(item.file);
    for(let j=0;j<frames.length;j++){
     const frame=frames[j],full=await v2ReadOcr(worker,bitmap,frame);
     if(!full.text||/모의\s*전/.test(full.text))continue;
     const opts={roster,bosses,source:item.name+' · '+(j+1)+'행'};
     const parsed=ext.ocrMode==='quick'?parseQuickLogText(full.text,opts):[parseBattleLogText(full.text,opts)].filter(Boolean);
     for(const extracted of parsed){
      if(ext.ocrMode!=='quick'){
       const member=await v2ReadOcr(worker,bitmap,frame,fields.member);
       const candidate=parseBattleLogText(member.text,{roster,bosses:[],memberField:true});
       extracted.ocrName=cleanOcrName(member.text);
       if(candidate?.memberId){extracted.memberId=candidate.memberId;extracted.memberName=candidate.memberName;}
       const damage=await v2ReadOcr(worker,bitmap,frame,fields.damage);
       const d=parseBattleLogText('입힌 데미지 '+damage.text,{roster:[],bosses:[]});
       if(Number.isSafeInteger(d?.damage)&&d.damage>0)extracted.damage=d.damage;
       if(!extracted.gameAt){
        const date=await v2ReadOcr(worker,bitmap,frame,fields.date);
        extracted.gameAt=parseBattleLogText(date.text,{roster:[],bosses:[]})?.gameAt||'';
       }
       if(!extracted.bossId){
        const boss=await v2ReadOcr(worker,bitmap,frame,fields.boss);
        const match=matchBossReadings([boss],bosses);
        if(match)extracted.bossId=match.id;
       }
       extracted.rawText+='\n\n개별 인식\n클랜원: '+member.text+'\n피해량: '+damage.text;
      }
      if(!extracted.memberId&&!extracted.bossId&&!extracted.damage&&!extracted.gameAt)continue;
      const ok=!!extracted.memberId&&!!extracted.bossId&&Number.isSafeInteger(Number(extracted.damage))&&Number(extracted.damage)>0&&!!extracted.gameAt;
      const warnings=[...(!extracted.memberId?['클랜원']:[]),...(!extracted.bossId?['보스']:[]),...(!extracted.damage?['피해량']:[]),...(!extracted.gameAt?['공격 일시']:[])];
      ext.importRows.push({...newImportRow(),memberId:extracted.memberId||'',boss:extracted.bossId||'',damage:extracted.damage||'',gameAt:extracted.gameAt||'',selected:ok,warnings,rawText:extracted.rawText||'',ocrImageId:item.id,ocrName:extracted.ocrName||'',source:extracted.source||''});
      found++;
     }
    }
   item.ocrDone=true;
   }catch(error){ext.ocrErrors.push(item.name+': '+(error.message||String(error)));item.ocrDone=false;}
   finally{bitmap?.close?.();}
   progress((i+1)+'/'+images.length+'장 분석 완료');
  }
  ext.ocrStatus=images.length+'장 OCR 완료 · '+found+'건 인식'+(ext.ocrErrors.length?' · 오류 '+ext.ocrErrors.length+'건':'')+'. 내용을 확인한 뒤 선택한 기록만 등록하세요.';
  if(!found&&!ext.ocrErrors.length)ext.ocrStatus='인식된 기록이 없습니다. 스크린샷 형식 또는 화면 구성을 확인하세요.';
 }catch(error){ext.ocrErrors.push(error.message||String(error));ext.ocrStatus='OCR 분석 실패';}
 finally{if(worker)await worker.terminate().catch(()=>{});if(ext.ocrJob===job){ext.ocrBusy=false;if(ext.importMode)render();}}
}

function commitBatchRows(){if(ext.ocrBusy){toast('OCR 분석이 끝난 뒤 등록하세요.');return;}if(!ensureEdit())return;if(data.dayClosures.some(c=>c.day===ui.day)){toast('마감을 취소한 뒤 등록하세요.');return;}const rows=ext.importRows.filter(r=>r.selected);if(!rows.length){toast('등록할 행을 선택하세요.');return;}if(rows.some(r=>!r.memberId||!data.bossSettings.some(b=>b.id===Number(r.boss))||!Number.isSafeInteger(numberValue(r.damage))||numberValue(r.damage)<=0)){toast('클랜원·보스·피해량을 확인하세요.');return;}if(rows.some(isImportDuplicate)){toast('중복 가능 행은 선택을 해제하거나 내용을 확인하세요.');return;}checkpoint();const before=structuredClone(data.logs);let seq=Math.max(0,...data.logs.map(e=>e.seq));for(const r of (rows.every(r=>r.gameAt)?[...rows].sort((a,b)=>a.gameAt.localeCompare(b.gameAt)):rows))data.logs.push({id:uid(),seq:++seq,day:ui.day,boss:Number(r.boss),memberId:r.memberId,damage:numberValue(r.damage),carry:r.carry,usesCarry:r.carry,gameAt:r.gameAt,note:'',bonus:0});recalculateSeason();const newIds=new Set(data.logs.filter(e=>e.seq>Math.max(0,...before.map(e=>e.seq))).map(e=>e.id));if(data.replayWarnings.some(w=>newIds.has(w.id))){data.logs=before;recalculateSeason();toast('기본 타수 또는 이월 연결을 확인하세요.');return;}persist();ext.importRows=[];ext.importMode=false;render();toast(rows.length+'건 등록',true);}
function backupValid(incoming){return incoming?.schema===2&&(incoming.monthExport?incoming.season?.logs&&incoming.season?.bossSettings:incoming.seasons&&Array.isArray(incoming.members));}
function restorePreparedBackup(){const editable=data.settings.editable;const incoming=ext.pendingRestore;if(!backupValid(incoming))return;checkpoint();const previous=structuredClone(data);try{if(incoming.monthExport){snapshotSeason();data.seasons[incoming.month]=incoming.season;for(const m of incoming.members||[])if(!data.members.some(p=>p.id===m.id))data.members.push(m);activateSeason(incoming.month);}else{data=incoming;if(syncState.started)data.settings.editable=!!(editable&&syncState.canEdit);ui.month=data.activeMonth||Object.keys(data.seasons).sort().at(-1);for(const key of SEASON_KEYS)data[key]=structuredClone(data.seasons[ui.month][key]);recalculateSeason();}persist();closeDrawer();nav('overview','bosses');toast('백업 복원',true);}catch{data=previous;recalculateSeason();toast('백업 형식을 확인하세요.');}}
document.addEventListener('submit',event=>{const form=event.target.closest('form[data-form]');if(!form||!form.dataset.form.startsWith('v2-'))return;event.preventDefault();event.stopImmediatePropagation();const kind=form.dataset.form,fd=new FormData(form);if(kind==='v2-unlock'){if(sha256Text(String(fd.get('pin')))!==data.pinHash){toast('비밀번호가 일치하지 않습니다.');return;}data.settings.editable=true;persist();closeDrawer();render();return;}if(!ensureEdit())return;
 if(kind==='v2-log'||kind==='v2-quick-log'){saveCompleteLog(form);return;}if(kind==='v2-tactic'){saveCompleteTactic(form);return;}if(kind==='v2-member'){saveCompleteMember(form);return;}if(kind==='v2-rules'){saveRulesComplete(form);return;}if(kind==='v2-character'){saveCharacter(form);return;}
 if(kind==='v2-notice'){checkpoint();data.notices[ext.stage]=String(fd.get('notice'));persist();closeDrawer();ext.noticeOpen=true;render();return;}
 if(kind==='v2-history-rank'){checkpoint();const s=fd.get('month')===ui.month?data:data.seasons[fd.get('month')];s.result.rank=fd.get('rank')?Number(fd.get('rank')):null;persist();closeDrawer();render();return;}
 if(kind==='v2-factor'){checkpoint();data.rules.factor=Number(fd.get('factor'))/100;recalculateSeason();persist();closeDrawer();render();toast('보정률 저장',true);return;}
 if(kind==='v2-links'){checkpoint();const links=[];for(let i=0;fd.has('label-'+i);i++){const label=String(fd.get('label-'+i)).trim(),url=String(fd.get('url-'+i)).trim();if(label&&/^https?:\/\//i.test(url))links.push({label,url});}data.communityLinks=links;persist();render();toast('자료 링크 저장',true);return;}
 if(kind==='v2-pin'){if(data.pinHash&&sha256Text(String(fd.get('current')))!==data.pinHash){toast('현재 비밀번호가 일치하지 않습니다.');return;}if(fd.get('next')!==fd.get('confirm')){toast('새 비밀번호 확인이 일치하지 않습니다.');return;}data.pinHash=sha256Text(String(fd.get('next')));persist();render();toast('작성 비밀번호 저장');return;}
 if(kind==='v2-new-month'){const key=String(fd.get('month'));if(data.seasons[key]){toast('이미 있는 월입니다.');return;}checkpoint();snapshotSeason();const next=structuredClone(data.seasons[ui.month]);next.logs=[];next.dayClosures=[];next.result={rank:null,sealed:false,winners:null};next.recommendations=[];next.tactics=fd.has('copyTactics')?next.tactics.filter(t=>!t.deletedAt&&t.stage!==3).map(t=>({...t,id:uid()})):[];next.rules.startDate=key+'-22';applyFutureLineupToSeason(next,key);data.seasons[key]=next;for(const k of SEASON_KEYS)data[k]=structuredClone(next[k]);ui.month=key;data.activeMonth=key;ui.day=1;ui.selectedTactic=data.tactics[0]?.id;recalculateSeason();persist();closeDrawer();nav('overview','bosses');toast('새 월 생성',true);return;}
},true);
let v2SearchTimer;
function refreshSearch(id,apply){const input=document.getElementById(id),pos=input?.selectionStart;apply();clearTimeout(v2SearchTimer);v2SearchTimer=setTimeout(()=>{render();const field=document.getElementById(id);field?.focus();if(typeof pos==='number')field?.setSelectionRange(pos,pos);},150);}
document.addEventListener('input',event=>{const el=event.target,key=el.dataset.input;if(!key?.startsWith('v2-'))return;
 if(key==='v2-log-query')refreshSearch('complete-log-search',()=>{ui.query=el.value;ui.page=1;});if(key==='v2-roster-query')refreshSearch('roster-search',()=>ext.rosterQuery=el.value);if(key==='v2-character-query')refreshSearch('character-query',()=>ext.characterQuery=el.value);
 if(key==='v2-log-preview')completeLogPreview();if(key==='v2-row-text'){const t=activeTactic(),row=tacticRows(t).find(r=>r.id===el.dataset.row);row.text=el.value;el.style.height='auto';el.style.height=Math.max(34,el.scrollHeight)+'px';clearTimeout(ext.gridSaveTimer);ext.gridSaveTimer=setTimeout(()=>{ext.gridSaveTimer=null;saveGridText(t);},400);}
 if(key==='v2-work-carry'||key==='v2-detail-carry'){const sec=timeToSec(el.value);if(!(sec>0&&sec<=130)){el.setAttribute('aria-invalid','true');return;}el.removeAttribute('aria-invalid');ui.carry=sec;
if(key==='v2-detail-carry'){const target=document.getElementById('detail-timeline'),t=tacticById(el.dataset.id);if(target&&t)target.innerHTML=simpleTacticTimeline(t);}
else{const t=activeTactic(),table=document.querySelector('.work-editor .set-grid');if(t&&table){const rows=tacticRows(t);table.querySelectorAll('.instruction-cell>div').forEach((cell,i)=>{if(rows[i])cell.innerHTML=legacyTools.richLine(rows[i],t.party,data.characters,sec,t.duration||90);});}}}
 if(key==='v2-estimate'){ext.estimatorInputs??={};ext.estimatorInputs[el.id]=numberValue(el.value);updateEstimator();}if(key==='v2-remaining-calculator'){const n=timeToSec(el.value);document.getElementById('carry-result').textContent=n>=0&&n<=90?fmtTime(Math.min(90,n+20)):'—';}
 if(key==='v2-external')updateExternal();if(key==='v2-converter')refreshConverter();if(key==='v2-portrait-crop')drawPortraitCrop();
 if(key==='v2-import-field'){const row=ext.importRows.find(r=>r.id===el.dataset.id);if(row)row[el.dataset.field]=el.type==='checkbox'?el.checked:el.dataset.field==='boss'?Number(el.value):el.value;}
});
document.addEventListener('change',async event=>{const el=event.target,key=el.dataset.input;if(!key?.startsWith('v2-'))return;
 if(key==='v2-carry-time-range'){
  if(!CARRY_TIME_RANGES.some(([range])=>range===el.value))return;
  flushGrid();ext.carryTimeRange=el.value;ext.workEditing=false;ext.rowUndo=[];ext.rowRedo=[];ext.rowSelection=null;ui.libraryOpen=true;
  render();document.getElementById('carry-time-range')?.focus({preventScroll:true});return;
 }
 if(key==='v2-month'){switchMonthTo(el.value,el.value!==Object.keys(data.seasons).sort().at(-1));return;}if(key==='v2-archive-month'){switchMonthTo(el.value,true);return;}
 if(key==='v2-all-days'){ext.allDays=el.checked;ui.page=1;render();return;}if(key==='v2-sequence'){ext.sequence=el.checked;render();return;}if(key==='v2-details'){ext.details=el.checked;render();return;}
 if(key==='v2-profile-member'){ui.profile=el.value;render();return;}if(key==='v2-profile-stage'){ext.profileStage=Number(el.value);render();return;}if(key==='v2-work-stage'){ext.stage=Number(el.value);render();return;}
 if(key==='v2-pick-tactic'){const id=el.dataset.id;if(el.checked){if(ui.picks.length>=3){el.checked=false;toast('3개까지 선택할 수 있습니다.');return;}ui.picks.push(id);}else ui.picks=ui.picks.filter(i=>i!==id);render();return;}
 if(key==='v2-row-check'){if(!ensureEdit())return;const t=activeTactic();rememberRows(t);const row=tacticRows(t).find(r=>r.id===el.dataset.row);row.manualChecks=true;row.checked[Number(el.dataset.column)]=el.checked;const rows=tacticRows(t),index=rows.findIndex(r=>r.id===row.id);legacyTools.recalculateTacticRows(rows,t.party,data.characters,index+1);saveGridText(t);document.querySelectorAll('.set-grid [data-input="v2-row-check"]').forEach(input=>{const next=rows.find(r=>r.id===input.dataset.row);if(next)input.checked=!!next.checked[Number(input.dataset.column)];});return;}
 if(key==='v2-editable'){if(syncState.started){el.checked=false;toggleWriter();return;}if(!data.settings.editable&&data.pinHash){el.checked=false;toggleWriter();return;}data.settings.editable=el.checked;persist();render();return;}if(key==='v2-default-day'){data.settings.defaultDay=Number(el.value);data.settings.defaultDayMode=data.settings.defaultDay>0?'manual':'auto';ui.day=defaultBattleDay();persist();render();return;}
 if(key==='v2-carry-sheet'&&el.files[0]){try{const file=el.files[0],rows=file.name.toLowerCase().endsWith('.xlsx')?await xlsxRows(file):parseDelimited(await file.text(),file.name.toLowerCase().endsWith('.tsv')?'\t':',');ext.carryImport=parseCarrySheet(rows);renderCarryPreview();}catch(error){toast(error.message);}return;}
 if(key==='v2-ocr-mode'){ext.ocrMode=el.value;return;}
 if(key==='v2-batch-images'){
  if(ext.ocrBusy){toast('OCR 분석 완료 후 이미지를 추가하세요.');return;}
  const items=Array.from(el.files||[]);
  if(!items.length)return;
  if(ext.images.length+items.length>60||items.some(file=>!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>25*1024*1024)){
    toast('최대 60장, 장당 25MB 이하의 PNG·JPG·WebP만 선택하세요.');return;
  }
  for(const file of items)ext.images.push({id:uid(),url:URL.createObjectURL(file),name:file.name,file,ocrDone:false});
  ext.activeImage=ext.images.length-items.length;
  ext.ocrStatus=ext.images.length+'장 선택됨 · OCR 자동 분석을 시작합니다.';
  render();
  void v2AnalyzeImages(false);
  return;
 }
 if(key==='v2-restore'&&el.files[0]){try{const incoming=await prepareCompatibleBackup(JSON.parse(await el.files[0].text()));if(!backupValid(incoming))throw new Error();ext.pendingRestore=incoming;openDrawer('백업 복원',`<p>${incoming.monthExport?incoming.month.replace('-','.')+'월':Object.keys(incoming.seasons).length+'개월'} 백업으로 복원합니다.</p>`,simpleButton('취소','close-drawer')+simpleButton('복원','v2-confirm-restore','','primary'));}catch(error){toast(error.message||'백업 JSON을 확인하세요.');}return;}
 if(key==='v2-portrait-file'&&el.files[0]){const image=new Image();image.onload=()=>{ext.cropImage=image;document.getElementById('portrait-zoom').value=1;document.getElementById('portrait-x').value=0;document.getElementById('portrait-y').value=0;drawPortraitCrop();};image.src=URL.createObjectURL(el.files[0]);return;}
 if(key==='v2-portrait-star'){if(ext.cropImage){ext.pendingImages[ext.previousPortraitStar||'5']=document.getElementById('portrait-canvas').toDataURL('image/jpeg',.87);ext.cropImage=null;}ext.previousPortraitStar=el.value;showStoredPortrait();return;}
});
document.addEventListener('focusin',event=>{if(event.target.dataset.input==='v2-row-text'){const t=activeTactic();if(t)rememberRows(t);}});
document.addEventListener('keydown',event=>{const el=event.target;if(el.dataset.input!=='v2-row-text')return;const t=activeTactic(),rows=tacticRows(t),i=rows.findIndex(r=>r.id===el.dataset.row);if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();rememberRows(t);const next={id:uid(),text:'',checked:[...rows[i].checked]};rows.splice(i+1,0,next);saveGridText(t);render();document.querySelector(`[data-input="v2-row-text"][data-row="${next.id}"]`)?.focus();}else if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const j=i+(event.key==='ArrowUp'?-1:1);if(j>=0&&j<rows.length){rememberRows(t);[rows[i],rows[j]]=[rows[j],rows[i]];saveGridText(t);render();document.querySelector(`[data-input="v2-row-text"][data-row="${el.dataset.row}"]`)?.focus();}}else if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==='k'){event.preventDefault();rememberRows(t);rows.splice(i,1);saveGridText(t);render();}else if(event.ctrlKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const row=rows[i+(event.key==='ArrowUp'?-1:1)];if(row)document.querySelector(`[data-input="v2-row-text"][data-row="${row.id}"]`)?.focus();}});
document.addEventListener('paste',event=>{if(event.target.dataset.input!=='v2-row-text')return;const text=event.clipboardData?.getData('text/plain')||'';if(!text.includes('\n')&&!text.includes('\t'))return;event.preventDefault();const t=activeTactic(),index=tacticRows(t).findIndex(r=>r.id===event.target.dataset.row);rememberRows(t);t.rows.splice(index,1,...pasteRows(text,t));saveGridText(t);render();});
const unwrappedFullBattle=fullBattle;
fullBattle=()=>ext.importMode?batchImportPage():unwrappedFullBattle();
const originalInitializeSeasons=initializeSeasons;
initializeSeasons=()=>{originalInitializeSeasons();initializeAwards();};

