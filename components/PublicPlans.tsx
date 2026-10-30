import React from 'react';
import { OFFER, PaidPlan } from '../functions/src/billingDomain';
export const PublicPlans: React.FC<{onFree:()=>void;onPlan:(plan:PaidPlan)=>void}> = ({onFree,onPlan}) => <section aria-label="Free and paid access" className="space-y-6">
  <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 space-y-3">
    <h3 className="text-xl font-bold">Start with a free scenario</h3>
    <p className="text-sm text-gray-700 leading-relaxed">Choose one scenario to keep and return to. Your assessment guides your practice in up to five relevant micro skills, presented in focused sets.</p>
    <p className="text-sm text-gray-600">No card needed. Your scenario choice is permanent.</p>
    <button onClick={onFree} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-3">Start free</button>
  </div>
  <div className="space-y-3"><h3 className="text-xl font-bold">Full access when you want more</h3><p className="text-sm text-gray-600">Every scenario and the full micro skill library. Your learning history stays with your account.</p>
    <div className="grid sm:grid-cols-3 gap-3">{(Object.keys(OFFER) as PaidPlan[]).map(plan=><article key={plan} className="border border-gray-200 rounded-2xl p-4 space-y-3 flex flex-col"><h4 className="font-bold text-sm">{OFFER[plan].label}</h4><p className="text-xl font-bold">US${(OFFER[plan].amount/100).toFixed(2)}</p><p className="text-xs text-gray-600 flex-grow">{plan==='month_pass'?'One calendar month. No automatic renewal.':plan==='monthly'?'Renews monthly. Cancel renewal any time.':'Renews annually. Cancel renewal any time.'}</p><button onClick={()=>onPlan(plan)} className="border border-indigo-600 text-indigo-700 hover:bg-indigo-50 rounded-xl p-3 text-sm font-semibold">Choose {plan==='month_pass'?'one month':plan==='monthly'?'monthly':'annual'}</button></article>)}</div>
    <p className="text-xs text-gray-500">Staging preview: checkout uses Stripe test mode. No real payments are taken. You will sign in before continuing to checkout.</p>
  </div>
</section>;
