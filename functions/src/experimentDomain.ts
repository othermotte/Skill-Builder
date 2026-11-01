export const EXPERIMENT = 'commercial-landing-v1';
export const ATTRIBUTION_MS = 30 * 24 * 60 * 60 * 1000;
export const JOURNEY_EVENTS = ['landing_view','primary_cta','registration_started','registration_completed','scenario_started','scenario_completed','feedback_viewed','micro_started','micro_completed','checkout_started','plan_selected'] as const;
export function validJourney(data:any) {
  if (!data || Buffer.byteLength(JSON.stringify(data),'utf8')>2000 || data.experiment!==EXPERIMENT || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(data.visitorId || '') || !['a','b'].includes(data.variant) || ![...JOURNEY_EVENTS,'identify','withdraw'].includes(data.event)) throw Error('Invalid journey event.');
  const campaign:Record<string,string>={};
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrerHost']) if(typeof data.campaign?.[key]==='string' && /^[a-zA-Z0-9_. -]{1,80}$/.test(data.campaign[key]))campaign[key]=data.campaign[key];
  return {visitorId:data.visitorId as string,variant:data.variant as 'a'|'b',event:String(data.event),campaign};
}
export function experimentReport(visits:any[],accounts:any[],payments:any[],now=Date.now()) {
  const accountByVisitor=new Map(accounts.map(a=>[a.visitorId,a]));
  const rows=(['a','b'] as const).map(variant=>{
    const cohort=visits.filter(v=>v.variant===variant && !v.excluded);
    const row:any={variant,visitors:cohort.length,anonymousVisitors:0,registeredAccounts:0,matureVisitors:0,paidVisitors:0,maturePaidVisitors:0,grossRevenueUsd:0,milestones:Object.fromEntries(JOURNEY_EVENTS.map(e=>[e,0]))};
    for(const v of cohort){
      const a=accountByVisitor.get(v.id);const mature=now-v.firstSeen>=ATTRIBUTION_MS;if(mature)row.matureVisitors++;
      if(a)row.registeredAccounts++;else row.anonymousVisitors++;
      for(const event of JOURNEY_EVENTS){const at=a?.milestones?.[event] || v.milestones?.[event];if(at>=v.firstSeen && at<v.firstSeen+ATTRIBUTION_MS)row.milestones[event]++;}
      const paid=payments.filter(p=>a && p.uid===a.uid && p.currency==='usd' && p.amount>0 && p.at>=v.firstSeen && p.at<v.firstSeen+ATTRIBUTION_MS);
      if(paid.length){row.paidVisitors++;if(mature)row.maturePaidVisitors++;row.grossRevenueUsd+=paid.reduce((n,p)=>n+p.amount,0)/100;}
    }
    row.paidConversionRate=row.visitors?row.paidVisitors/row.visitors:null;
    row.maturePaidConversionRate=row.matureVisitors?row.maturePaidVisitors/row.matureVisitors:null;
    return row;
  });
  const firstSeen=visits.length?Math.min(...visits.map(v=>v.firstSeen)):now;
  const attributable=new Set(accounts.filter(a=>visits.some(v=>v.id===a.visitorId&&!v.excluded)).map(a=>a.uid));
  return {experiment:EXPERIMENT,windowDays:30,generatedAt:now,periodStart:firstSeen,rows,excludedVisitors:visits.filter(v=>v.excluded).length,unattributedPayments:payments.filter(p=>p.amount>0&&p.at>=firstSeen&&!attributable.has(p.uid)).length};
}
