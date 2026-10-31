const {test} = require('node:test');
const assert = require('node:assert/strict');
const {accessFor,nextMonth,validPlan,OFFER}=require('../functions/lib/billingDomain.js');
test('a calendar month clamps month end without losing the time of day',()=>{
assert.equal(new Date(nextMonth(Date.UTC(2027,0,31,12,30))).toISOString(),'2027-02-28T12:30:00.000Z');
assert.equal(new Date(nextMonth(Date.UTC(2028,0,31))).toISOString(),'2028-02-29T00:00:00.000Z');
});
test('paid access expires at its boundary and cancellation retains only the paid period',()=>{
const a={uid:'test',createdAt:0,subscriptionPlan:'monthly',subscriptionStatus:'canceled',paidThrough:100,cancelAtPeriodEnd:true};
assert.equal(accessFor(a,99).unlimited,true);assert.equal(accessFor(a,100).unlimited,false);assert.equal(accessFor(a,99).renewalDate,null);
assert.equal(accessFor({...a,subscriptionStatus:'unpaid'},99).unlimited,false);
assert.equal(accessFor({...a,subscriptionStatus:'unpaid',passUntil:150},100).plan,'month_pass');
});
test('the agreed offers accept only explicit plan names',()=>{
assert.deepEqual(Object.values(OFFER).map(p=>p.amount),[1499,999,9900]);
for(const v of ['__proto__','constructor','free','price_anything',null])assert.equal(validPlan(v),false);
assert.equal(validPlan('monthly'),true);
});
