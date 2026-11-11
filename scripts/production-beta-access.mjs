import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const project='leadership-skill-builder-7aba5';
const policy=process.argv.find(a=>a.startsWith('--policy='))?.split('=')[1];
if(!['complimentary','trial30','free'].includes(policy))throw Error('Choose --policy=complimentary, trial30 or free after confirming the beta-user policy.');
const apply=process.argv.includes('--apply');
const snapshotPath=process.argv.find(a=>a.startsWith('--snapshot='))?.slice('--snapshot='.length);
if(apply&&!snapshotPath)throw Error('Apply requires the reviewed --snapshot path.');
const token=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
async function request(path,data){
 const r=await fetch(path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,'x-goog-user-project':project,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 if(!r.ok)throw Error('Production access request failed: HTTP '+r.status);
 return r.json();
}
let snapshot;
if(snapshotPath){snapshot=JSON.parse(readFileSync(snapshotPath,'utf8'));if(snapshot.project!==project||snapshot.policy!==policy)throw Error('Snapshot project or policy mismatch.');}
else{
 let users=[],page='';
 do{const result=await request('https://identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:batchGet?maxResults=1000&fields=users(localId,email,disabled,createdAt),nextPageToken'+(page?'&nextPageToken='+encodeURIComponent(page):''));users.push(...(result.users||[]));page=result.nextPageToken||'';}while(page);
 const now=Date.now();
 const emails=[...new Set(users.filter(u=>!u.disabled&&u.email).map(u=>u.email.trim().toLowerCase()))].sort();
 snapshot={project,policy,createdAt:now,expiresAt:policy==='trial30'?now+30*86400000:null,authUserCount:users.length,uidDigest:createHash('sha256').update(users.map(u=>u.localId).sort().join('\n')).digest('hex'),emails};
 const file='/private/tmp/skill-builder-beta-access-'+now+'.json';
 writeFileSync(file,JSON.stringify(snapshot,null,2),{mode:0o600});
 console.log('Review snapshot saved with owner-only permissions:',file);
}
console.log(JSON.stringify({project,policy,accounts:snapshot.authUserCount,approvedAddresses:snapshot.emails.length,expiresAt:snapshot.expiresAt,uidDigest:snapshot.uidDigest,apply},null,2));
if(!apply)process.exit(0);
function recordPreparation(){writeFileSync('config/launch.production.json',JSON.stringify({betaPolicy:policy,authUserCount:snapshot.authUserCount,uidDigest:snapshot.uidDigest,accessPreparedAt:Date.now()},null,2)+'\n');}
if(policy==='free'){recordPreparation();console.log('Free policy selected: no complimentary grants written. Existing account and learning records are untouched.');process.exit(0);}
if(snapshot.emails.length>200)throw Error('Review a batched migration before applying more than 200 beta addresses.');
const root='projects/'+project+'/databases/(default)/documents/';
const org='launch-beta-'+new Date(snapshot.createdAt).toISOString().slice(0,10).replaceAll('-','');
const existing=await fetch('https://firestore.googleapis.com/v1/'+root+'organisations/'+org,{headers:{Authorization:'Bearer '+token}});
if(existing.status!==404)throw Error('The migration grant already exists or could not be checked. Review it before changing access.');
const integer=n=>({integerValue:String(n)}),text=s=>({stringValue:s});
const writes=[{update:{name:root+'organisations/'+org,fields:{name:text('Existing beta users'),expiresAt:snapshot.expiresAt===null?{nullValue:null}:integer(snapshot.expiresAt),revokedAt:{nullValue:null},approvedCount:integer(snapshot.emails.length),memberLimit:integer(snapshot.emails.length),createdAt:integer(Date.now()),launchMigration:text(snapshot.uidDigest),migrationPolicy:text(policy),domains:{arrayValue:{values:[]}}}},currentDocument:{exists:false}}];
for(const email of snapshot.emails){
 const hash=createHash('sha256').update(email).digest('hex');
 writes.push({update:{name:root+'organisations/'+org+'/approvedMembers/'+hash,fields:{email:text(email),addedAt:integer(Date.now()),addedBy:text('production-launch')}},currentDocument:{exists:false}});
 writes.push({update:{name:root+'organisationApprovals/'+hash,fields:{email:text(email)}},updateMask:{fieldPaths:['email']},updateTransforms:[{fieldPath:'organisationIds',appendMissingElements:{values:[text(org)]}}]});
}
await request('https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents:commit',{writes});
recordPreparation();
console.log('Applied the reviewed beta grant atomically. No Auth, profile, catalogue or learning-history records were modified.');
