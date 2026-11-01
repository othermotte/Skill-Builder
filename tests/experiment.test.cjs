const {test}=require('node:test');const assert=require('node:assert/strict');
const {validJourney,experimentReport,EXPERIMENT,ATTRIBUTION_MS}=require('../functions/lib/experimentDomain.js');
test('journey input accepts only defined milestones and discards unapproved campaign content',()=>{
const d={experiment:EXPERIMENT,visitorId:'12345678-1234-4123-8123-123456789abc',variant:'a',event:'landing_view',campaign:{utm_source:'newsletter',utm_term:'person@example.org',transcript:'secret'}};
assert.deepEqual(validJourney(d).campaign,{utm_source:'newsletter'});
for(const change of [{visitorId:'invented'},{variant:'c'},{event:'paid_conversion'},{experiment:'other'},{campaign:{utm_term:'x'.repeat(2500)}}])assert.throws(()=>validJourney({...d,...change}));
});
test('conversion counts unique visitors, uses authoritative positive payments within 30 days and separates mature windows',()=>{
const start=1000,now=start+ATTRIBUTION_MS+1;
const visits=[{id:'v1',variant:'a',firstSeen:start,milestones:{landing_view:start}},{id:'v2',variant:'a',firstSeen:now-100,milestones:{primary_cta:now-90}},{id:'qa',variant:'b',firstSeen:start,excluded:true}];
const accounts=[{uid:'u',visitorId:'v1',milestones:{registration_completed:start+1,checkout_started:start+2}}];
const payments=[{uid:'u',amount:1499,currency:'usd',at:start+3},{uid:'u',amount:999,currency:'usd',at:start+4},{uid:'u',amount:999,currency:'usd',at:start+ATTRIBUTION_MS},{uid:'u',amount:0,currency:'usd',at:start+5},{uid:'unknown',amount:999,currency:'usd',at:start+3}];
const report=experimentReport(visits,accounts,payments,now),a=report.rows[0];
assert.equal(a.visitors,2);assert.equal(a.anonymousVisitors,1);assert.equal(a.registeredAccounts,1);assert.equal(a.paidVisitors,1);assert.equal(a.grossRevenueUsd,24.98);assert.equal(a.paidConversionRate,0.5);assert.equal(a.maturePaidConversionRate,1);assert.equal(report.rows[1].visitors,0);assert.equal(report.unattributedPayments,1);
});
