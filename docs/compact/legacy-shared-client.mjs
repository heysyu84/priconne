import {createApiClient} from './compat/api-client.mjs';
import {decodeLegacy,encodeLegacy} from './legacy-codec.mjs?v=20261030-dango03';

export function createLegacySharedClient({apiOrigin,pageOrigin,storage,fetcher,reference,selectedMonth=()=>null,now=Date.now}){
  const client=createApiClient({apiOrigin,pageOrigin,storage,fetcher,now});
  let root=null,archives={},revision=0,editor=false,roleAt=0;
  const archiveRevisions=new Map();
  async function json(path,options={}){
    const response=await client(path,{cache:'no-store',signal:AbortSignal.timeout(20000),...options});
    let body;try{body=await response.json();}catch{throw Object.assign(Error('공용 서버 응답을 확인하지 못했습니다.'),{status:response.status});}
    if(!response.ok)throw Object.assign(Error(body.error||'저장에 실패했습니다.'),{status:response.status,body});
    return body;
  }
  async function refreshRole(){editor=!!(await json('/api/editor')).editor;roleAt=now();return editor;}
  async function allArchives(atRevision){
    archives=(await json('/api/archive?all=1')).months||{};
    archiveRevisions.clear();for(const month of Object.keys(archives))archiveRevisions.set(month,atRevision);
  }
  async function request(path,options={}){
    if(options.method==='PUT'){
      if(!root)throw Error('최신 자료를 먼저 불러오세요.');
      const input=JSON.parse(options.body),payload=encodeLegacy(input.document,root,archives,reference);
      const result=await json('/api/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Nyang-Client':'4'},body:JSON.stringify({revision:input.revision,...payload})});
      revision=result.revision;
      const active=Object.keys(payload.data.months).sort().at(-1);
      for(const [month,data]of Object.entries(payload.data.months))if(month!==active){archives[month]=structuredClone(data);archiveRevisions.set(month,revision);}
      root={...payload.data,active,months:{[active]:payload.data.months[active]},storageVersion:2};
      return {...result,canEdit:true,authenticated:true};
    }
    if(!roleAt||now()-roleAt>10000)await refreshRole();
    const since=new URL(path,pageOrigin).searchParams.get('since');
    const result=await json('/api/state?compact=1'+(since?'&since='+since:''));
    revision=result.revision;
    let changed=!!result.data;
    if(result.data){
      const first=!root,rolled=root&&root.active!==result.data.active;
      root=result.data;
      if(first||rolled)await allArchives(revision);
    }
    if(!root)throw Error('공용 자료가 비어 있습니다.');
    const month=selectedMonth();
    if(month&&month!==root.active&&(archives[month]||(root.archivedMonths||[]).includes(month))&&archiveRevisions.get(month)!==revision){
      const archive=await json('/api/archive?month='+month);if(archive.data){archives[month]=archive.data;archiveRevisions.set(month,revision);changed=true;}
    }
    return {...result,canEdit:editor,authenticated:true,...(changed?{document:decodeLegacy(root,archives,reference)}:{})};
  }
  async function login(pin){
    const result=await json('/api/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});
    if(!result.editor)throw Error('작성 비밀번호를 확인하세요.');editor=true;roleAt=now();return result;
  }
  async function lock(){await json('/api/editor',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'lock'})});editor=false;roleAt=now();}
  return {request,login,lock,refreshRole};
}
