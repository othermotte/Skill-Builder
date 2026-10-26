import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import { AccessAccount } from '../services/access';
type Plan = 'month_pass' | 'monthly' | 'annual';
interface BillingState {
  enabled: boolean; paymentsReady: boolean; hasCustomer: boolean; hasSubscription: boolean;
  plan: 'free' | Plan; accessUntil: number | null; cancelAtPeriodEnd: boolean;
  renewalDate: number | null; subscriptionStartsAt: number | null; subscriptionPlan: string | null;
  offers: Record<Plan, {amount: number; label: string}>;
}
const call = async <T,>(name: string, data: unknown = {}): Promise<T> => (await httpsCallable<unknown,T>(functions,name)(data)).data;
export const BillingPanel: React.FC<{uid: string; access: AccessAccount; onRefresh: () => Promise<void>}> = ({uid,access,onRefresh}) => {
  const [billing,setBilling] = useState<BillingState|null>(null);
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  useEffect(() => {
    let active = true;
    const status = new URLSearchParams(location.search).get('billing');
    if (status === 'success') {setOpen(true);setNotice('Your checkout is complete. We are checking payment confirmation. Access changes only after payment is confirmed.');}
    if (status === 'cancelled') {setOpen(true);setNotice('Checkout cancelled. Your access has not changed.');}
    const load = async () => {
      try {const state = await call<BillingState>('getBillingAccount');if(active){setBilling(state);if(status === 'success' && state.plan !== 'free') setNotice('Payment confirmed. Your full access is ready.');}}
      catch(e:any){if(active)setError(e.message);}
    };
    void load();
    const timer = status === 'success' ? setInterval(() => {void load();void onRefresh().catch(()=>{});},3000) : null;
    const stop = timer ? setTimeout(()=>clearInterval(timer),60000) : null;
    return () => {active=false;if(timer)clearInterval(timer);if(stop)clearTimeout(stop);};
  },[uid]);
  const refresh = async () => {
    setBusy(true);setError('');
    try {setBilling(await call<BillingState>('getBillingAccount'));await onRefresh();}catch(e:any){setError(e.message);}finally{setBusy(false);}
  };
  const go = async (name:string, plan?:Plan) => {
    setBusy(true);setError('');
    try {const result = await call<{url:string}>(name,plan?{plan}:{});const url=new URL(result.url);if(url.protocol!=='https:' || !['checkout.stripe.com','billing.stripe.com'].includes(url.hostname))throw new Error('The payment link is invalid.');location.assign(url.href);}
    catch(e:any){setError(e.message);setBusy(false);}
  };
  const complimentary = ['admin','organisation'].includes(access.source);
  if (complimentary && !billing?.hasCustomer) return null;
  if (billing && !billing.enabled) return null;
  return <section aria-label="Plans and billing" className="max-w-7xl mx-auto w-full px-5 pt-4">
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{access.source === 'paid' ? 'Your paid access' : 'Full catalogue access'}</h2><p className="text-sm text-gray-600">Stripe test mode. No real payments are taken.</p></div><button className="border rounded-xl px-4 py-2 font-semibold" onClick={()=>setOpen(!open)}>{open?'Close plans':billing?.hasSubscription?'Manage billing':'View plans'}</button></div>
      {notice && <p role="status" className="text-sm text-indigo-700">{notice}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {open && <div className="space-y-4">
        {billing?.accessUntil && <p className="text-sm">Full access until {new Date(billing.accessUntil).toLocaleDateString('en-GB')}.{billing.cancelAtPeriodEnd ? ' Your subscription will not renew.' : billing.renewalDate ? ` Next renewal: ${new Date(billing.renewalDate).toLocaleDateString('en-GB')}.` : ' No automatic renewal for a one-month pass.'}</p>}
        {billing?.subscriptionStartsAt && billing.subscriptionStartsAt>Date.now() && <p className="text-sm">Your {billing.subscriptionPlan} subscription starts on {new Date(billing.subscriptionStartsAt).toLocaleDateString('en-GB')}. Your current pass continues until then.</p>}
        {!complimentary && !billing?.hasSubscription && (!billing || billing.plan==='free' || billing.plan==='month_pass') && <>
          <p className="text-sm text-gray-600">Explore every scenario and the full micro skill library. Your learning history and free scenario choice stay with your account. These are test prices; no real money is charged.</p>
          <div className="grid md:grid-cols-3 gap-4">{(['month_pass','monthly','annual'] as Plan[]).filter(plan=>!(billing?.plan==='month_pass' && plan==='month_pass')).map(plan=><article key={plan} className="border rounded-xl p-5 space-y-3"><h3 className="font-bold">{billing?.offers?.[plan]?.label || (plan==='month_pass'?'One month':plan==='monthly'?'Monthly subscription':'Annual subscription')}</h3><p className="text-xl font-bold">{billing?.offers?.[plan] ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(billing.offers[plan].amount/100) : 'Loading price…'}</p><p className="text-sm text-gray-600">{plan==='month_pass'?'One calendar month. Does not renew.':plan==='monthly'?'Renews monthly. Cancel renewal through your billing account.':'Renews annually. Cancel renewal through your billing account.'}</p>{billing?.plan==='month_pass' && <p className="text-sm">First payment is at the end of your current pass.</p>}<button disabled={busy || !billing?.paymentsReady} onClick={()=>void go('createCheckoutSession',plan)} className="bg-indigo-600 text-white rounded-xl px-4 py-3 disabled:opacity-50">{busy?'Opening…':'Continue to test checkout'}</button></article>)}</div>
        </>}
        {billing && !billing.paymentsReady && <p className="text-sm">Checkout is not configured yet.</p>}
        <div className="flex flex-wrap gap-3">{billing?.hasCustomer && <button disabled={busy} onClick={()=>void go('createBillingPortalSession')} className="border rounded-xl p-3 disabled:opacity-50">Manage payments and subscriptions</button>}<button disabled={busy} onClick={()=>void refresh()} className="underline p-3 disabled:opacity-50">Refresh payment status</button></div>
      </div>}
    </div>
  </section>;
};
