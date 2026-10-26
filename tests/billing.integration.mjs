// Requires only the Firestore emulator on 127.0.0.1:8180. Stripe is a local fixture.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const require = createRequire(process.cwd() + '/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8180';
process.env.GCLOUD_PROJECT = 'demo-skill-builder-billing';
process.env.FUNCTIONS_EMULATOR = 'true';
process.env.BILLING_ENABLED = 'true';
process.env.FREEMIUM_ENABLED = 'true';
process.env.STRIPE_SECRET_KEY = 'sk_test_localfixture';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_localfixture';
process.env.STRIPE_TEST_API_PORT = '9444';
process.env.STRIPE_PRICE_MONTH_PASS = 'price_pass';
process.env.STRIPE_PRICE_MONTHLY = 'price_monthly';
process.env.STRIPE_PRICE_ANNUAL = 'price_annual';
process.env.STRIPE_PORTAL_CONFIGURATION = 'bpc_fixture';
process.env.APP_BASE_URL = 'http://localhost:3100';
const { initializeApp } = require('firebase-admin/app');
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const { getFirestore } = require('firebase-admin/firestore');
const Stripe = require('stripe'); const stripe = new Stripe('sk_test_localfixture');
const billing = require('../functions/lib/billing.js');
const db = getFirestore();
const prefix = 'test' + Date.now();
const auth = id => ({ auth: { uid: id, token: { email_verified: true, email: 'buyer@example.org' } }, data: {} });
let subStatus = 'active'; let cancel = false; let checkoutUid; let checkoutForm; let deferred = false; let startsAt = 0;
const until = Math.floor(Date.now() / 1000) + 3600;
const fixture = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const form = new URLSearchParams(body); const path = new URL(req.url, 'http://localhost').pathname;
  let data;
  if (path.startsWith('/v1/prices/')) {
    const id = path.split('/').pop(); data = { id, active: true, currency: 'usd', unit_amount: id === 'price_pass' ? 1499 : id === 'price_monthly' ? 999 : 9900, recurring: id === 'price_pass' ? null : { interval: id === 'price_monthly' ? 'month' : 'year', interval_count: 1 } };
  } else if (path === '/v1/customers') data = { id: 'cus_' + checkoutUid };
  else if (path === '/v1/checkout/sessions') { checkoutForm = form; data = { id: 'cs_' + checkoutUid, url: 'https://checkout.stripe.com/test-fixture' }; }
  else if (path.endsWith('/line_items')) data = { data: [{ quantity: 1, price: { id: 'price_pass' } }] };
  else if (path.startsWith('/v1/checkout/sessions/')) data = { id: 'cs_' + checkoutUid, livemode: false, client_reference_id: checkoutUid, status: 'complete', payment_status: deferred ? 'no_payment_required' : 'paid', mode: deferred ? 'subscription' : 'payment', subscription: deferred ? 'sub_fixture' : null, customer: 'cus_' + checkoutUid, metadata: { app: 'leadership-skill-builder', firebaseUid: checkoutUid, plan: deferred ? 'monthly' : 'month_pass' }, amount_total: 1499, currency: 'usd', payment_intent: 'pi_fixture', total_details: { amount_tax: 0 } };
  else if (path === '/v1/subscriptions/sub_fixture') data = { id: 'sub_fixture', livemode: false, created: Math.floor(Date.now() / 1000) - 10, customer: 'cus_' + checkoutUid, metadata: { app: 'leadership-skill-builder', firebaseUid: checkoutUid, plan: 'monthly', startsAt: String(startsAt) }, status: subStatus, cancel_at_period_end: cancel, items: { data: [{ quantity: 1, price: { id: 'price_monthly' }, current_period_end: deferred ? startsAt : until }] }, latest_invoice: deferred ? null : { status: 'paid', lines: { data: [{ period: { end: until } }] } } };
  else if (path === '/v1/billing_portal/sessions') data = { url: 'https://billing.stripe.com/test-fixture' };
  else { res.statusCode = 404; data = { error: { message: 'Unknown fixture path: ' + path } }; }
  res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data));
});
await new Promise(resolve => fixture.listen(9444, '127.0.0.1', resolve));
const event = (id, type, object) => ({ id, object: 'event', type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object } });
async function webhook(payload, valid = true) {
  const raw = JSON.stringify(payload);
  const signature = stripe.webhooks.generateTestHeaderString({ payload: raw, secret: valid ? 'whsec_localfixture' : 'whsec_wrong' });
  let status = 200;
  let finish;
  const done = new Promise(resolve => finish = resolve);
  const res = { status(code) { status = code; return this; }, send() { finish(); return this; }, sendStatus(code) { status = code; finish(); return this; } };
  await billing.stripeWebhook({ rawBody: Buffer.from(raw), headers: { 'stripe-signature': signature } }, res);
  await done; return status;
}
try {
  checkoutUid = prefix + 'buyer';
  process.env.STRIPE_MODE = 'test';
  process.env.STRIPE_SECRET_KEY = 'sk_live_rejected_fixture';
  await assert.rejects(billing.createCheckoutSession.run({ ...auth(checkoutUid), data: { plan: 'monthly' } }), /only Stripe sandbox credentials/);
  process.env.STRIPE_SECRET_KEY = 'sk_test_localfixture';
  console.log('PASS hosted staging rejects live Stripe credentials before any Stripe request');
  const access = require('../functions/lib/access.js');
  const free = {freeScenarioId: 'chosen-before-payment', freeMicroSkills: [{id:'saved-skill'}]};
  await db.doc('accessAccounts/'+checkoutUid).set(free);
  assert.equal((await access.readAccess(auth(checkoutUid))).fullAccess,false);
  await assert.rejects(billing.createCheckoutSession.run({auth: {uid: checkoutUid,token:{email_verified:false,email:'buyer@example.org'}},data:{plan:'monthly'}}),/verify/);
  await assert.rejects(billing.createCheckoutSession.run({auth: {uid: checkoutUid,token:{email_verified:true,email:'gary@gardenersnotmechanics.com'}},data:{plan:'monthly'}}),/complimentary/);
  await assert.rejects(billing.createCheckoutSession.run({...auth(checkoutUid),data:{plan:'__proto__'}}),/valid plan/);
  await billing.accountState(checkoutUid);
  const checkout = await billing.createCheckoutSession.run({ ...auth(checkoutUid), data: { plan: 'month_pass' } });
  assert.match(checkout.url, /^https:\/\/checkout.stripe.com/);
  assert.equal(checkoutForm.get('branding_settings[display_name]'),'Leadership Skill Builder');
  assert.equal(await webhook(event(prefix + 'invalid', 'checkout.session.completed', { id: 'cs_' + checkoutUid }), false), 400);
  const purchase = event(prefix + 'purchase', 'checkout.session.completed', { id: 'cs_' + checkoutUid });
  assert.equal(await webhook(purchase), 200);
  assert.equal((await access.readAccess(auth(checkoutUid))).source,'paid');
  assert.equal((await access.readAccess(auth(checkoutUid))).freeScenarioId,free.freeScenarioId);
  const expires = (await billing.accountState(checkoutUid)).accessUntil;
  assert.equal(await webhook(purchase), 200);
  assert.equal(await webhook(event(prefix + 'purchase-redelivery', 'checkout.session.completed', { id: 'cs_' + checkoutUid })), 200);
  assert.equal((await billing.accountState(checkoutUid)).accessUntil, expires);
  const payments = await db.collection('commercialPayments').where('uid', '==', checkoutUid).get();
  assert.equal(payments.size, 1);
  await assert.rejects(billing.createCheckoutSession.run({ ...auth(checkoutUid), data: { plan: 'month_pass' } }), /already have paid access/);
  startsAt = Math.ceil(expires / 1000);
  for (const plan of ['monthly', 'annual']) {
    await billing.createCheckoutSession.run({ ...auth(checkoutUid), data: { plan } });
    assert.equal(checkoutForm.get('subscription_data[billing_cycle_anchor]'), String(startsAt));
    assert.equal(checkoutForm.get('subscription_data[proration_behavior]'), 'none');
    assert.equal(checkoutForm.get('subscription_data[metadata][startsAt]'), String(startsAt));
    // Reset only the fixture pending session to exercise both choices.
    await db.collection('commercialAccounts').doc(checkoutUid).update({ pendingCheckoutId: null });
  }
  deferred = true;
  assert.equal(await webhook(event(prefix + 'scheduled', 'checkout.session.completed', { id: 'cs_' + checkoutUid })), 200);
  const scheduled = await billing.accountState(checkoutUid);
  assert.equal(scheduled.hasSubscription, true);
  assert.equal(scheduled.subscriptionStartsAt, startsAt * 1000);
  assert.equal(scheduled.plan, 'month_pass');
  assert.equal(scheduled.accessUntil, expires);
  await assert.rejects(billing.createCheckoutSession.run({ ...auth(checkoutUid), data: { plan: 'annual' } }), /existing subscription/);
  assert.equal((await db.collection('commercialPayments').where('uid', '==', checkoutUid).get()).size, 1);
  assert.equal((await db.collection('commercialAccounts').doc(checkoutUid).get()).data().pendingCheckoutId, undefined);
  console.log('PASS pass to subscription: both plans defer first charge to expiry, no prorations or duplicate subscription, no unpaid extension or extra revenue');
  cancel = true;
  assert.equal(await webhook(event(prefix + 'cancel-before-first-charge', 'customer.subscription.updated', { id: 'sub_fixture', metadata: { firebaseUid: checkoutUid, app: 'leadership-skill-builder' } })), 200);
  assert.equal((await billing.accountState(checkoutUid)).accessUntil, expires);
  assert.equal((await billing.accountState(checkoutUid)).cancelAtPeriodEnd, true);
  deferred = false; startsAt = 0; cancel = false;
  assert.match((await billing.createBillingPortalSession.run(auth(checkoutUid))).url, /billing.stripe.com/);
  console.log('PASS Checkout and webhooks: fixed price, valid signatures, duplicate delivery cannot extend a pass or duplicate revenue, portal ownership');
  await db.collection('commercialAccounts').doc(checkoutUid).update({ passUntil: 0 });
  const subscription = () => event(prefix + 'sub' + Date.now(), 'customer.subscription.updated', { id: 'sub_fixture', metadata: { firebaseUid: checkoutUid, app: 'leadership-skill-builder' } });
  assert.equal(await webhook(subscription()), 200);
  assert.equal((await billing.accountState(checkoutUid)).plan, 'monthly');
  cancel = true; assert.equal(await webhook(subscription()), 200);
  assert.equal((await billing.accountState(checkoutUid)).cancelAtPeriodEnd, true);
  assert.equal((await billing.accountState(checkoutUid)).unlimited, true);
  subStatus = 'canceled'; assert.equal(await webhook(subscription()), 200);
  assert.equal((await billing.accountState(checkoutUid)).unlimited, true);
  await db.collection('commercialAccounts').doc(checkoutUid).update({ paidThrough: Date.now() - 1 });
  assert.equal((await billing.accountState(checkoutUid)).plan, 'free');
  const expired = await access.readAccess(auth(checkoutUid));
  assert.equal(expired.fullAccess,false);assert.equal(expired.freeScenarioId,free.freeScenarioId);assert.deepEqual(expired.freeMicroSkills,free.freeMicroSkills);
  console.log('PASS subscription lifecycle: cancellation stops renewal, preserves paid access, and expiry returns to free');

} finally { await new Promise(resolve => fixture.close(resolve)); await db.terminate(); }
