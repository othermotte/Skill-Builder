// Explicit staging-only opt-in. All users, analytics and Stripe objects belong to this run.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {stagingAppCheck} from './stagingAppCheck.mjs';
if(process.env.ALLOW_DISPOSABLE_STAGING_TESTS!=='true')throw Error('Disposable staging test opt-in required.');
const config=Object.fromEntries(readFileSync('.env.staging','utf8').trim().split('\n').map(l=>l.split('=')));
assert.equal(config.VITE_FIREBASE_PROJECT_ID,'leadership-skill-builder-stg');
const project='leadership-skill-builder-stg',owner=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim();
const prefix='commercial-'+Date.now(),actors=[],paths=new Set(),customers=new Set();
const require=createRequire(process.cwd()+'/functions/package.json'),Stripe=require('stripe');
const key=execFileSync('gcloud',['secrets','versions','access','latest','--secret=STRIPE_SECRET_KEY','--project='+project],{encoding:'utf8'}).trim();
assert.match(key,/^(sk|rk)_test_/);const stripe=new Stripe(key);
const attestation=await stagingAppCheck(config,owner);
const root='https://firestore.googleapis.com/v1/projects/'+project+'/databases/(default)/documents/';
const base='https://europe-west1-'+project+'.cloudfunctions.net/';
function encode(v){if(v===null)return{nullValue:null};if(typeof v==='number')return{integerValue:String(v)};if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='string')return{stringValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(encode)}};return{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,v])=>[k,encode(v)]))}};}
function decode(v){if(v.mapValue)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));if(v.arrayValue)return(v.arrayValue.values||[]).map(decode);if(v.integerValue!==undefined)return Number(v.integerValue);if(v.booleanValue!==undefined)return v.booleanValue;return v.stringValue??null;}
async function request(url,{method='GET',data,token=owner,appCheck=attestation.token}={}){const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(token===owner?{'x-goog-user-project':project}:{}),...(appCheck?{'X-Firebase-AppCheck':appCheck}:{})},...(data?{body:JSON.stringify(data)}:{})});const b=await r.text();let body;try{body=JSON.parse(b)}catch{body=b}return{status:r.status,body};}
const call=(a,name,data={})=>request(base+name,{method:'POST',data:{data},token:a?.token||null});
async function ok(a,name,data={}){const r=await call(a,name,data);assert.equal(r.status,200,name+' failed');return r.body.result;}
async function seed(path,data){paths.add(path);const r=await request(root+path,{method:'PATCH',data:encode(data).mapValue});assert.equal(r.status,200);}
async function read(path){const r=await request(root+path);assert.equal(r.status,200);return decode({mapValue:{fields:r.body.fields}});}
async function actor(n){const email=prefix+'-'+n+'@example.org',password=randomBytes(24).toString('base64url');const a=await request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+config.VITE_FIREBASE_API_KEY,{method:'POST',token:null,data:{email,password,returnSecureToken:true}});assert.equal(a.status,200);const out={uid:a.body.localId,token:a.body.idToken};actors.push(out);assert.equal((await request('https://identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:update',{method:'POST',data:{localId:out.uid,emailVerified:true}})).status,200);const b=await request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+config.VITE_FIREBASE_API_KEY,{method:'POST',token:null,data:{email,password,returnSecureToken:true}});assert.equal(b.status,200);out.token=b.body.idToken;paths.add('accessAccounts/'+out.uid);paths.add('commercialAccounts/'+out.uid);return out;}
try{
 const a=await actor('new'),b=await actor('legacy');
 assert.equal((await ok(a,'getAccessAccount')).freeMicroSkillLimit,3);
 await ok(a,'chooseFreeScenario',{scenarioId:'lsb-explorer-1'});
 const recommendations=await ok(a,'getMicroSkillSuggestions',{scenarioId:'lsb-explorer-1',transcript:[{speaker:'user',text:'I would ask the team to explain their concerns and test our assumptions about fairness before committing to launch.'}],feedback:{summary:{overall_summary:'You considered fairness and stakeholder concerns, but should make decision criteria and revisit triggers explicit.'}}});
 assert.equal(recommendations.length,3);assert.deepEqual(await ok(a,'getMicroSkillSuggestions',{scenarioId:'lsb-explorer-1'}),recommendations);
 const library=await read('system_logic/skillLibrary');const legacy=[];
 for(const g of library.skill_groups)for(const s of g.skills)for(const m of s.micro_skills)if(legacy.length<5)legacy.push({groupId:g.id,groupLabel:g.label,skillId:s.id,skillLabel:s.name||s.label,microSkillId:m.id,microSkillLabel:m.label,reason:'Disposable existing grant'});
 await seed('accessAccounts/'+b.uid,{freeScenarioId:'lsb-explorer-1',freeMicroSkills:legacy});
 assert.equal((await ok(b,'getAccessAccount')).freeMicroSkillLimit,5);
 assert.deepEqual(await ok(b,'getMicroSkillSuggestions',{scenarioId:'lsb-explorer-1'}),legacy);
 assert.ok((await ok(b,'getGeminiLiveToken',{mode:'tutorial',scenarioId:'lsb-explorer-1',microSkillId:legacy[4].microSkillId})).token);
 console.log('PASS new accounts receive three frozen skills; an existing five-skill grant and fifth-skill practice remain authorised.');
 const visitorId=randomUUID(),event={experiment:'commercial-landing-v1',visitorId,variant:'a',event:'landing_view',campaign:{utm_source:'disposable-test',transcript:'must not be stored',utm_term:'person@example.org'}};
 const path='experimentVisitors/commercial-landing-v1_'+visitorId;paths.add(path);paths.add('experimentAccounts/'+a.uid);
 await ok(null,'recordExperimentEvent',event);await ok(null,'recordExperimentEvent',event);
 const visit=await read(path);assert.deepEqual(visit.campaign,{utm_source:'disposable-test'});assert.equal(Object.keys(visit.milestones).length,1);
 await ok(a,'recordExperimentEvent',{...event,event:'identify'});await ok(a,'recordExperimentEvent',{...event,event:'scenario_completed'});
 const account=await read('experimentAccounts/'+a.uid);assert.equal(account.visitorId,visitorId);assert.ok(account.milestones.registration_completed);assert.ok(account.milestones.scenario_completed);
 assert.equal((await call(a,'getExperimentReport')).status,403);
 assert.equal((await request(root+path,{token:a.token})).status,403);
 assert.equal((await call(null,'recordExperimentEvent',{...event,event:'paid_conversion'})).status,400);
 console.log('PASS consented visitor deduplication, sanitised attribution, verified account linkage, private reporting and rejection of client-invented paid conversions.');
 for(const plan of ['month_pass','monthly','annual']){
   const checkout=await ok(a,'createCheckoutSession',{plan});const id=new URL(checkout.url).pathname.split('/').pop();assert.match(id,/^cs_test_/);
   const session=await stripe.checkout.sessions.retrieve(id);assert.equal(session.metadata.firebaseUid,a.uid);assert.equal(session.metadata.plan,plan);assert.equal(session.livemode,false);customers.add(session.customer);
   const items=await stripe.checkout.sessions.listLineItems(id);assert.equal(items.data[0].price.unit_amount,plan==='month_pass'?1499:plan==='monthly'?999:9900);
   await stripe.checkout.sessions.expire(id);
 }
 assert.ok((await read('experimentAccounts/'+a.uid)).milestones.checkout_started);
 assert.equal((await ok(a,'getAccessAccount')).fullAccess,false);
 await ok(null,'recordExperimentEvent',{...event,event:'withdraw'});
 assert.equal((await read(path)).excluded,true);assert.equal((await request(root+'experimentAccounts/'+a.uid)).status,404);
 console.log('PASS all three hosted test checkout plans keep agreed prices; checkout alone grants no access; analytics withdrawal removes account attribution.');
}finally{
 try{
 for(const a of actors)for(const col of ['geminiUsageDaily','geminiUsageLogs','geminiUsageAlerts','geminiTextSessions']){
 const q=await request(root.slice(0,-1)+':runQuery',{method:'POST',data:{structuredQuery:{from:[{collectionId:col}],where:{fieldFilter:{field:{fieldPath:'uid'},op:'EQUAL',value:{stringValue:a.uid}}}}}});if(q.status===200)for(const row of q.body)if(row.document)await request('https://firestore.googleapis.com/v1/'+row.document.name,{method:'DELETE'});
 }
 for(const path of paths)assert.ok([200,404].includes((await request(root+path,{method:'DELETE'})).status));
 for(const a of actors)assert.equal((await request('https://identitytoolkit.googleapis.com/v1/projects/'+project+'/accounts:delete',{method:'POST',data:{localId:a.uid}})).status,200);
 for(const id of customers){const c=await stripe.customers.retrieve(id);if(!c.deleted&&actors.some(a=>a.uid===c.metadata.firebaseUid)&&c.metadata.app==='leadership-skill-builder')await stripe.customers.del(id);}
 }finally{await attestation.cleanup();}
 console.log('Removed only this run’s disposable accounts, analytics, usage records, Stripe test customers and debug registration.');
}
