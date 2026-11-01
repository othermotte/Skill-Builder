import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';
import {callableAppCheck} from './appCheck';
import {readAccess} from './access';
import {EXPERIMENT,ATTRIBUTION_MS,validJourney,experimentReport} from './experimentDomain';
const options={region:'europe-west1' as const,maxInstances:2,serviceAccount:'skill-builder-staging-runtime@leadership-skill-builder-stg.iam.gserviceaccount.com',...callableAppCheck};
function staging(){if(process.env.GCLOUD_PROJECT!=='leadership-skill-builder-stg'&&process.env.FUNCTIONS_EMULATOR!=='true')throw new HttpsError('failed-precondition','Experiment reporting is restricted to staging.');}
export const recordExperimentEvent=onCall(options,async request=>{
  staging();let data;try{data=validJourney(request.data);}catch{throw new HttpsError('invalid-argument','Invalid journey event.');}
  const {visitorId,variant,event,campaign}=data;const db=getFirestore(),now=Date.now();
  const signed=!!request.auth&&request.auth.token.email_verified===true;
  if(!signed && !['landing_view','primary_cta','registration_started','plan_selected','withdraw'].includes(event))throw new HttpsError('unauthenticated','Sign in to record this milestone.');
  const uid=signed?request.auth!.uid:null;
  let eligible=true,createdAt=0;
  if(uid){const access=await readAccess(request);eligible=!['admin','organisation'].includes(access.source);createdAt=Date.parse((await getAuth().getUser(uid)).metadata.creationTime);}
  return db.runTransaction(async tx=>{
    const visitor=db.collection('experimentVisitors').doc(EXPERIMENT+'_'+visitorId);
    const saved=await tx.get(visitor);const v=saved.data();
    const account=uid?db.collection('experimentAccounts').doc(uid):null;
    const existing=account?await tx.get(account):null;
    if(event==='withdraw'){
      const linked=v?.uid?db.collection('experimentAccounts').doc(v.uid):null;
      const prior=linked?await tx.get(linked):null;
      if(prior?.data()?.visitorId===visitorId)tx.delete(linked!);
      if(v)tx.update(visitor,{excluded:true});
      return {recorded:true};
    }
    if(v && v.variant!==variant)return {recorded:false};
    // Only a genuine observed public landing can establish a visitor cohort.
    if(!v && event!=='landing_view')return {recorded:false};
    const firstSeen=Number(v?.firstSeen || now);
    if(now>=firstSeen+ATTRIBUTION_MS)return {recorded:false};
    if(uid && (!eligible || createdAt<firstSeen-120000 || (existing?.exists && existing.data()?.visitorId!==visitorId))){
      tx.set(visitor,{excluded:true},{merge:true});return {recorded:false};
    }
    if(uid && v?.uid && v.uid!==uid)return {recorded:false};
    const milestones={...(v?.milestones || {})};
    if(['landing_view','primary_cta','registration_started','plan_selected','withdraw'].includes(event)&&!milestones[event])milestones[event]=now;
    tx.set(visitor,{experiment:EXPERIMENT,variant,firstSeen,campaign:v?.campaign || campaign,milestones,...(uid?{uid}:{})},{merge:true});
    if(account){
      const old=existing?.data();const m={...(old?.milestones || {})};
      if(!old)m.registration_completed=now;
      if(event!=='identify' && !m[event])m[event]=now;
      tx.set(account,{experiment:EXPERIMENT,uid,visitorId,variant,firstSeen,milestones:m},{merge:true});
    }
    return {recorded:true};
  });
});
// Checkout starts are recorded only after Stripe returns a real session.
export async function recordCheckoutMilestone(uid:string) {
  try{const db=getFirestore();const ref=db.collection('experimentAccounts').doc(uid);await db.runTransaction(async tx=>{const snap=await tx.get(ref),a=snap.data();if(a && Date.now()<a.firstSeen+ATTRIBUTION_MS && !a.milestones?.checkout_started)tx.update(ref,{'milestones.checkout_started':Date.now()});});}catch{ /* Never block an authorised purchase for analytics. */ }
}
export const getExperimentReport=onCall(options,async request=>{
  staging();if(request.auth?.token.email_verified!==true || request.auth.token.email?.toLowerCase()!=='gary@gardenersnotmechanics.com')throw new HttpsError('permission-denied','Administrator access is required.');
  const db=getFirestore();const [v,a,p]=await Promise.all([db.collection('experimentVisitors').where('experiment','==',EXPERIMENT).limit(5001).get(),db.collection('experimentAccounts').where('experiment','==',EXPERIMENT).limit(5001).get(),db.collection('commercialPayments').limit(10001).get()]);
  if(v.size>5000||a.size>5000||p.size>10000)throw new HttpsError('resource-exhausted','This report has reached its query limit. Export and analyse the underlying collections before continuing.');
  return experimentReport(v.docs.map(d=>({id:d.id.slice(EXPERIMENT.length+1),...d.data()})),a.docs.map(d=>d.data()),p.docs.map(d=>d.data()));
});
