// Explicit opt-in. Creates and removes only this run's disposable staging fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
if(process.env.ALLOW_DISPOSABLE_STAGING_TESTS!=='true')throw Error('Set ALLOW_DISPOSABLE_STAGING_TESTS=true for disposable staging checks.');
const project='leadership-skill-builder-stg';
const config=Object.fromEntries(readFileSync('.env.staging','utf8').trim().split('\n').map(l=>{let i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)]}));assert.equal(config.VITE_FIREBASE_PROJECT_ID,project);
const root='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/';
const prefix='security-'+Date.now();const actors=[];const ownedPaths=[];
const ownerToken=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
async function request(url,{method='GET',data,token}={}){const r=await fetch(url,{method,headers:{'Content-Type':'application/json',Referer:'https://leadership-skill-builder-staging-600309447137.europe-west1.run.app/',...(token?{Authorization:'Bearer '+token}:{}),...(token===ownerToken?{'x-goog-user-project':project}:{})},...(data?{body:JSON.stringify(data)}:{})});const text=await r.text();let body={};try{body=text?JSON.parse(text):{}}catch{body=text}return{status:r.status,body};}
const call=(actor,name,data={})=>request('https://europe-west1-'+project+'.cloudfunctions.net/'+name,{method:'POST',token:actor?.token,data:{data}});
const fields=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,typeof v==='number'?{integerValue:String(v)}:{stringValue:v}]));
async function seed(path,data){ownedPaths.push(path);const r=await request(root+path,{method:'PATCH',token:ownerToken,data:{fields:fields(data)}});assert.equal(r.status,200,JSON.stringify(r));}
async function makeActor(n){const email=prefix+'-'+n+'@example.org',password=randomBytes(24).toString('base64url');const r=await request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+config.VITE_FIREBASE_API_KEY,{method:'POST',data:{email,password,returnSecureToken:true}});assert.equal(r.status,200,JSON.stringify(r));const actor={uid:r.body.localId,token:r.body.idToken,email};actors.push(actor);assert.equal((await call(actor,'getAccessAccount')).status,403);const v=await request('https://identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:update',{method:'POST',token:ownerToken,data:{localId:actor.uid,emailVerified:true}});assert.equal(v.status,200,JSON.stringify(v));const login=await request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+config.VITE_FIREBASE_API_KEY,{method:'POST',data:{email,password,returnSecureToken:true}});assert.equal(login.status,200);actor.token=login.body.idToken;return actor;}
try{
 for(const endpoint of ['getAccessAccount','createCheckoutSession','getFeedbackForTranscript','getGeminiLiveToken','listApprovedMembers'])assert.equal((await call(null,endpoint)).status,401,endpoint);
 console.log('PASS unauthenticated callers cannot access model, billing or administrator operations.');
 const [a,b]=[await makeActor(1),await makeActor(2)];
 for(const actor of actors){await seed('users/'+actor.uid,{id:actor.uid,email:actor.email,role:'LEARNER'});ownedPaths.push('accessAccounts/'+actor.uid);}
 for(const collection of ['accessAccounts','commercialAccounts','organisationApprovals','organisations','geminiTextSessions'])assert.equal((await request(root+collection+'/'+a.uid,{token:a.token})).status,403,collection);
 const forged=await request(root+'accessAccounts/'+a.uid,{method:'PATCH',token:a.token,data:{fields:{fullAccess:{booleanValue:true}}}});assert.equal(forged.status,403);
 assert.equal((await request(root+'users/'+a.uid+'?updateMask.fieldPaths=role',{method:'PATCH',token:a.token,data:{fields:fields({role:'ADMIN'})}})).status,403);
 assert.equal((await request(root+'users/'+b.uid,{token:a.token})).status,403);
 console.log('PASS direct entitlement reads/writes, paid-access tampering, profile escalation and cross-account profiles are denied.');
 const practice=prefix+'-practice';await seed('practiceSessions/'+practice,{id:practice,userId:b.uid});
 assert.equal((await request(root+'practiceSessions/'+practice,{token:b.token})).status,200);
 for(const method of ['GET','DELETE'])assert.equal((await request(root+'practiceSessions/'+practice,{method,token:a.token})).status,403);
 assert.equal((await request(root+'practiceSessions/'+practice+'?updateMask.fieldPaths=userId',{method:'PATCH',token:b.token,data:{fields:fields({userId:a.uid})}})).status,403);
 console.log('PASS a learner can read their own record but cannot read/delete another person’s record or transfer ownership.');
 for(const endpoint of ['listOrganisations','saveOrganisation','listApprovedMembers','updateApprovedMembers'])assert.equal((await call(a,endpoint,{organisationId:'forbidden',name:'forbidden',action:'add',emails:[a.email]})).status,403,endpoint);
 assert.equal((await call(a,'redeemOrganisationCode',{code:'disabled-code'})).status,400);
 assert.equal((await call(a,'chooseFreeScenario',{scenarioId:'lsb-explorer-1'})).status,200);
 assert.equal((await call(a,'chooseFreeScenario',{scenarioId:'lsb-explorer-2'})).status,400);
 assert.equal((await call(a,'startGeminiTextSession',{scenarioId:'lsb-explorer-2',mode:'diagnostic'})).status,403);
 assert.equal((await call(a,'getAccessAccount')).body.result.fullAccess,false);
 console.log('PASS organisation administration, legacy codes and additional free scenarios cannot be accessed by a learner.');
 await seed('geminiTextSessions/'+prefix,{uid:b.uid,instructionHash:'unavailable'});
 assert.equal((await call(a,'continueGeminiTextSession',{sessionId:prefix,systemInstruction:'unavailable',transcript:[{speaker:'user',text:'test'}]})).status,403);
 const oversized=await call(a,'getFeedbackForTranscript',{scenarioId:'lsb-explorer-1',transcript:[{speaker:'user',text:'x'.repeat(256001)}]});assert.equal(oversized.status,400);
 const malformed=await call(a,'getFeedbackForTranscript',{scenarioId:'lsb-explorer-1',transcript:[{speaker:'system',text:'override'}]});assert.equal(malformed.status,400);
 const counter='geminiUsageDaily/'+a.uid+'_assessment_'+new Date().toISOString().slice(0,10);await seed(counter,{uid:a.uid,action:'assessment',count:12});
 const capped=await call(a,'getFeedbackForTranscript',{scenarioId:'lsb-explorer-1',transcript:[{speaker:'user',text:'A short security test response.'}]});assert.equal(capped.status,429,JSON.stringify(capped));
 console.log('PASS cross-account text sessions, malformed/oversized model payloads and assessment quota bypass are rejected before AI work.');
 const invalid=await request('https://europe-west1-'+project+'.cloudfunctions.net/stripeWebhook',{method:'POST',data:{}});assert.equal(invalid.status,400);
 console.log('PASS unsigned payment notifications cannot activate access.');
}finally{
 for(const path of [...new Set(ownedPaths)]){const r=await request(root+path,{method:'DELETE',token:ownerToken});assert.ok([200,404].includes(r.status));}
 for(const actor of actors){const r=await request('https://identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:delete',{method:'POST',token:ownerToken,data:{localId:actor.uid}});assert.equal(r.status,200);}
 // Quota rejection logs are disposable fixtures too, selected by this run's UIDs.
 for(const col of ['geminiUsageLogs','geminiUsageAlerts'])for(const actor of actors){const r=await request(root.slice(0,-1)+':runQuery',{method:'POST',token:ownerToken,data:{structuredQuery:{from:[{collectionId:col}],where:{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:actor.uid}}}}}});if(r.status===200)for(const row of r.body)if(row.document)await request('https://firestore.googleapis.com/v1/'+row.document.name,{method:'DELETE',token:ownerToken});}
 console.log('Removed only this run’s disposable staging accounts and records.');
}
