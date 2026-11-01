import { httpsCallable } from 'firebase/functions';
import { functions, freemiumEnabled } from '../firebaseConfig';
import { chooseHomepageVariant, previewVariant, EXPERIMENT_ID, HomepageVariant } from '../utils/homepageExperiment';
const key = 'skillBuilderLandingV1';
interface Assignment { visitorId: string; variant: HomepageVariant; consent: boolean | null; exposed?: boolean; campaign: Record<string,string>; }
let memory: Assignment | null = null;
let qa = false;
let pending: Promise<unknown> = Promise.resolve();
function storageGet(store: Storage, name: string) { try { return store.getItem(name); } catch { return null; } }
function save() { try { localStorage.setItem(key,JSON.stringify(memory)); } catch {} }
export function experiment() {
  if (memory) return { ...memory, shownVariant: previewVariant(location.search) || memory.variant, qa };
  const preview = previewVariant(location.search);
  try { qa = !!preview || sessionStorage.getItem(key+'QA') === 'true'; if (preview) sessionStorage.setItem(key+'QA','true'); } catch { qa=!!preview; }
  let saved: Assignment | null = null;
  try { saved=JSON.parse(storageGet(localStorage,key) || 'null'); } catch {}
  if (!saved || !/^[0-9a-f-]{36}$/.test(saved.visitorId) || !['a','b'].includes(saved.variant)) {
    const campaign: Record<string,string> = {};
    const params=new URLSearchParams(location.search);
    for(const name of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']) {
      const value=params.get(name); if(value && /^[a-zA-Z0-9_. -]{1,80}$/.test(value))campaign[name]=value;
    }
    try { const ref = document.referrer ? new URL(document.referrer).hostname : ''; if(ref && ref !== location.hostname) campaign.referrerHost=ref; } catch {}
    saved={visitorId:crypto.randomUUID(),variant:chooseHomepageVariant('',null,Math.random()),consent:null,campaign};
  }
  memory=saved;
  // Preview sessions never change a saved experiment assignment or create a new one.
  if(!qa)save();
  return {...memory,shownVariant:preview || memory.variant,qa};
}
export function markLandingView() { experiment();memory!.exposed=true;if(!qa)save();void trackExperiment('landing_view'); }
export function setExperimentConsent(consent:boolean) {
  const state=experiment();
  memory!.consent=consent;if(!qa)save();
  if(consent)void trackExperiment('landing_view');
  else if(!qa) { pending=pending.catch(()=>{}).then(()=>httpsCallable(functions,'recordExperimentEvent')({experiment:EXPERIMENT_ID,visitorId:state.visitorId,variant:state.variant,event:'withdraw'})).catch(()=>{}); }
}
export async function trackExperiment(event:string) {
  if(!freemiumEnabled)return;
  const state=experiment();
  if(state.qa || !state.consent || !state.exposed || navigator.doNotTrack === '1')return;
  pending=pending.catch(()=>{}).then(()=>httpsCallable(functions,'recordExperimentEvent')({experiment:EXPERIMENT_ID,visitorId:state.visitorId,variant:state.variant,event,campaign:state.campaign})).catch(()=>{});
  await pending;
}
export async function identifyExperiment() { await trackExperiment('identify'); }
