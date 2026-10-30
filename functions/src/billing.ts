import { stagingGuard, readAccess } from './access';
const runtimeOptions = { region: 'europe-west1' as const, maxInstances: 3, serviceAccount: 'skill-builder-staging-runtime@leadership-skill-builder-stg.iam.gserviceaccount.com' };
import { randomUUID } from 'node:crypto';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { accessFor, BillingAccount, nextMonth, OFFER, validPlan } from './billingDomain';

const stripeKey = defineSecret('STRIPE_SECRET_KEY');
const webhookKey = defineSecret('STRIPE_WEBHOOK_SECRET');
const region = 'europe-west1' as const;
const billingOptions = { ...runtimeOptions, region, secrets: [stripeKey] };
export const commercialEnabled = () => process.env.BILLING_ENABLED === 'true';
function billingGuard() {
  stagingGuard();
  if (process.env.GCLOUD_PROJECT !== 'leadership-skill-builder-stg' && process.env.FUNCTIONS_EMULATOR !== 'true') throw new HttpsError('failed-precondition', 'Billing is currently restricted to staging.');
}
export function requireUser(request: any): string {
  billingGuard();
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  if (request.auth.token.email_verified !== true) throw new HttpsError('permission-denied', 'Please verify your email first.');
  return request.auth.uid;
}
export function commercialDb() {
  billingGuard();
  if (process.env.FUNCTIONS_EMULATOR === 'true' && !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new HttpsError('failed-precondition', 'Start the Firestore emulator before testing billing or commercial usage.');
  }
  return getFirestore();
}
function stripeClient() {
  billingGuard();
  if (process.env.STRIPE_MODE !== 'test') throw new HttpsError('failed-precondition', 'Skill Builder payments are currently restricted to test mode.');
  const key = stripeKey.value();
  if (process.env.STRIPE_MODE === 'test' && !/^(sk|rk)_test_/.test(key || '')) throw new HttpsError('failed-precondition', 'Staging accepts only Stripe sandbox credentials.');
  if (!key) throw new HttpsError('failed-precondition', 'Payments are not configured yet.');
  if (process.env.FUNCTIONS_EMULATOR === 'true' && !key.startsWith('sk_test_') && !key.startsWith('rk_test_')) {
    throw new HttpsError('failed-precondition', 'Local billing requires a Stripe test key.');
  }
  const fixturePort = process.env.FUNCTIONS_EMULATOR === 'true' ? Number(process.env.STRIPE_TEST_API_PORT || 0) : 0;
  return new Stripe(key, { maxNetworkRetries: 2, ...(fixturePort > 1024 && fixturePort < 65536 ? { host: '127.0.0.1', port: fixturePort, protocol: 'http' as const } : {}) });
}
function baseUrl() {
  const url = new URL(process.env.APP_BASE_URL || 'https://leadership-skill-builder-staging-600309447137.europe-west1.run.app');
  if (process.env.FUNCTIONS_EMULATOR !== 'true' && url.origin !== 'https://leadership-skill-builder-staging-600309447137.europe-west1.run.app') throw new HttpsError('failed-precondition', 'The staging return URL is invalid.');
  if (process.env.FUNCTIONS_EMULATOR !== 'true' && url.protocol !== 'https:') {
    throw new HttpsError('failed-precondition', 'Set the HTTPS application URL before enabling payments.');
  }
  return url.origin;
}
function priceMap() {
  return { month_pass: process.env.STRIPE_PRICE_MONTH_PASS || '', monthly: process.env.STRIPE_PRICE_MONTHLY || '', annual: process.env.STRIPE_PRICE_ANNUAL || '' };
}
async function ensureAccount(uid: string): Promise<BillingAccount> {
  const ref = commercialDb().collection('commercialAccounts').doc(uid);
  return commercialDb().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.data() as BillingAccount;
    const account = { uid, createdAt: Date.now() };
    tx.create(ref, account);
    return account;
  });
}
export async function accountState(uid: string) {
  const account = await ensureAccount(uid);
  const now = Date.now();
  return { enabled: true, ...accessFor(account, now), testMode: true, offers: OFFER,
    paymentStatus: account.subscriptionStatus || null,
    paymentsReady: Object.values(priceMap()).every(Boolean) && !!process.env.STRIPE_PORTAL_CONFIGURATION,
    hadPaidAccess: !!(account.passUntil || account.paidThrough),
    hasCustomer: !!account.customerId,
    hasSubscription: !!account.subscriptionId && !['canceled', 'unpaid', 'incomplete_expired'].includes(account.subscriptionStatus || ''),
    subscriptionPlan: account.subscriptionPlan || null,
    subscriptionStartsAt: account.subscriptionStartsAt || null };
}
export const getBillingAccount = onCall({ ...runtimeOptions, region }, async request => {
  const uid = requireUser(request);
  if (!commercialEnabled()) return { enabled: false, paymentsReady: false };
  return accountState(uid);
});

function checkPurchase(account: BillingAccount, plan: string) {
  const access = accessFor(account, Date.now());
  if (account.subscriptionId && !['canceled', 'unpaid', 'incomplete_expired'].includes(account.subscriptionStatus || '')) {
    throw new HttpsError('already-exists', 'Please manage your existing subscription before purchasing another plan.');
  }
  if (access.unlimited && (access.plan !== 'month_pass' || plan === 'month_pass')) {
    throw new HttpsError('already-exists', 'You already have paid access. Manage your current plan instead.');
  }
}

export const createCheckoutSession = onCall(billingOptions, async request => {
  const uid = requireUser(request);
  if (!commercialEnabled()) throw new HttpsError('failed-precondition', 'Payments are not open yet.');
  const access = await readAccess(request);
  if (access.source === 'admin' || access.source === 'organisation') throw new HttpsError('failed-precondition', 'You already have complimentary full access. No purchase is needed.');
  const plan = request.data?.plan;
  if (!validPlan(plan)) throw new HttpsError('invalid-argument', 'Choose a valid plan.');
  const account = await ensureAccount(uid);
  checkPurchase(account, plan);
  const stripe = stripeClient();
  const priceId = priceMap()[plan];
  if (!priceId) throw new HttpsError('failed-precondition', 'This plan is not available yet.');
  const price = await stripe.prices.retrieve(priceId);
  if (price.livemode || !price.active || price.currency !== 'usd' || price.unit_amount !== OFFER[plan].amount
    || (price.recurring?.interval || null) !== OFFER[plan].interval || (price.recurring?.interval_count || 1) !== 1) {
    throw new HttpsError('failed-precondition', 'The payment price does not match the published plan.');
  }
  const ref = commercialDb().collection('commercialAccounts').doc(uid);
  const lock = await commercialDb().runTransaction(async tx => {
    const snap = await tx.get(ref); const data = snap.data()!;
    checkPurchase(data as BillingAccount, plan);
    if (Number(data.checkoutLockUntil || 0) > Date.now()) throw new HttpsError('aborted', 'A checkout is already being prepared. Please try again shortly.');
    const attempt = data.checkoutAttemptPlan === plan && data.checkoutAttempt ? data.checkoutAttempt : randomUUID();
    tx.update(ref, { checkoutLockUntil: Date.now() + 60000, checkoutAttempt: attempt, checkoutAttemptPlan: plan });
    return { pending: data.pendingCheckoutId as string | undefined, attempt: attempt as string };
  });
  try {
    let attempt = lock.attempt;
    if (lock.pending) {
      const pending = await stripe.checkout.sessions.retrieve(lock.pending);
      if (pending.status === 'open' && pending.metadata?.plan === plan && pending.url) return { url: pending.url };
      if (pending.status === 'complete') throw new HttpsError('failed-precondition', 'Your previous payment is being confirmed. Refresh your account before trying again.');
      if (pending.status === 'open') await stripe.checkout.sessions.expire(pending.id);
      attempt = randomUUID();
      await ref.update({ checkoutAttempt: attempt, checkoutAttemptPlan: plan });
    }
    let customerId = account.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: request.auth!.token.email, metadata: { app: 'leadership-skill-builder', firebaseUid: uid } }, { idempotencyKey: `skill-builder-customer-${uid}` });
      customerId = customer.id;
      await ref.update({ customerId });
    }
    // The pass already covers access up to this instant. Waive the initial
    // subscription period so the first charge falls exactly at pass expiry.
    const startsAt = plan !== 'month_pass' && Number(account.passUntil || 0) > Date.now()
      ? Math.ceil(account.passUntil! / 1000) : 0;
    const session = await stripe.checkout.sessions.create({
      branding_settings: { display_name: 'Leadership Skill Builder' },
      customer: customerId, client_reference_id: uid, mode: plan === 'month_pass' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }], allowed_payment_method_types: ['card'],
      metadata: { app: 'leadership-skill-builder', firebaseUid: uid, plan },
      ...(plan === 'month_pass' ? { payment_intent_data: { metadata: { app: 'leadership-skill-builder', firebaseUid: uid, plan } } }
        : { subscription_data: { metadata: { app: 'leadership-skill-builder', firebaseUid: uid, plan, ...(startsAt ? { startsAt: String(startsAt) } : {}) },
          ...(startsAt ? { billing_cycle_anchor: startsAt, proration_behavior: 'none' as const } : {}) } }),
      success_url: `${baseUrl()}/?billing=success&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl()}/?billing=cancelled`,
    }, { idempotencyKey: `skill-builder-checkout-${uid}-${attempt}` });
    await ref.update({ pendingCheckoutId: session.id });
    if (!session.url) throw new HttpsError('internal', 'Checkout could not be opened.');
    return { url: session.url };
  } finally { await ref.update({ checkoutLockUntil: 0 }); }
});
export const createBillingPortalSession = onCall(billingOptions, async request => {
  const uid = requireUser(request); const account = await ensureAccount(uid);
  if (!commercialEnabled()) throw new HttpsError('failed-precondition', 'Payments are not open yet.');
  if (!account.customerId) throw new HttpsError('failed-precondition', 'There is no billing account to manage yet.');
  if (!process.env.STRIPE_PORTAL_CONFIGURATION) throw new HttpsError('failed-precondition', 'The billing portal is not configured yet.');
  const portal = await stripeClient().billingPortal.sessions.create({ customer: account.customerId, ...(process.env.STRIPE_PORTAL_CONFIGURATION ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION } : {}), return_url: `${baseUrl()}/?billing=account` });
  return { url: portal.url };
});

async function syncSubscription(stripe: Stripe, subscriptionId: string, eventCreated = Math.floor(Date.now() / 1000)) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });
  const uid = sub.metadata.firebaseUid;
  if (!uid || sub.metadata.app !== 'leadership-skill-builder') return;
  const ref = commercialDb().collection('commercialAccounts').doc(uid);
  const account = (await ref.get()).data();
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  if (!account || account.customerId !== customer) throw new Error('Customer/account mismatch');
  const item = sub.items.data[0];
  if (sub.livemode || sub.items.data.length !== 1 || item?.quantity !== 1) throw new Error('Unexpected subscription mode or items');
  const plan = Object.entries(priceMap()).find(([key, id]) => key !== 'month_pass' && id && id === item?.price.id)?.[0];
  if (plan !== 'monthly' && plan !== 'annual') throw new Error('Unrecognised subscription price');
  const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null;
  const paidThrough = invoice?.status === 'paid' ? Math.max(...invoice.lines.data.map(line => line.period.end * 1000), 0) : 0;
  await commercialDb().runTransaction(async tx => {
    const current = (await tx.get(ref)).data()!;
    if (Number(current.lastSubscriptionEvent || 0) > eventCreated || Number(current.subscriptionCreatedAt || 0) > sub.created) return;
    tx.update(ref, { lastSubscriptionEvent: eventCreated, subscriptionCreatedAt: sub.created, subscriptionId: sub.id, subscriptionPlan: plan, subscriptionStatus: sub.status,
      subscriptionStartsAt: Number(sub.metadata.startsAt || 0) * 1000,
      periodEnd: item.current_period_end * 1000, cancelAtPeriodEnd: sub.cancel_at_period_end,
      paidThrough: Math.max(Number(current.paidThrough || 0), paidThrough), syncedAt: Date.now() });
  });
}
export const stripeWebhook = onRequest({ ...billingOptions, secrets: [stripeKey, webhookKey] }, async (request, response) => {
  let event: Stripe.Event;
  const stripe = stripeClient();
  try {
    event = stripe.webhooks.constructEvent(request.rawBody, request.headers['stripe-signature'] || '', webhookKey.value());
    if (event.livemode !== /^(sk|rk)_live_/.test(stripeKey.value())) throw new Error('Payment mode mismatch');
  } catch { response.status(400).send('Invalid payment notification'); return; }
  try {
    const db = commercialDb(); const processed = db.collection('commercialStripeEvents').doc(event.id);
    if ((await processed.get()).exists) { response.sendStatus(200); return; }
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id);
      const uid = session.metadata?.firebaseUid; const plan = session.metadata?.plan;
      if (!uid || session.metadata?.app !== 'leadership-skill-builder' || !validPlan(plan) || session.livemode || session.client_reference_id !== uid || (session.payment_status !== 'paid' && !(plan !== 'month_pass' && session.mode === 'subscription' && session.payment_status === 'no_payment_required'))) { response.sendStatus(200); return; }
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const ref = db.collection('commercialAccounts').doc(uid);
      const account = (await ref.get()).data();
      if (!account || account.customerId !== customerId) throw new Error('Checkout/account mismatch');
      if (plan === 'month_pass' && session.mode === 'payment') {
        const items = await stripe.checkout.sessions.listLineItems(session.id);
        if (items.data.length !== 1 || items.data[0].quantity !== 1 || items.data[0].price?.id !== priceMap().month_pass || session.currency !== 'usd' || session.amount_total !== OFFER.month_pass.amount) throw new Error('Unexpected pass price');
        const paymentRef = db.collection('commercialPayments').doc(session.id);
        await db.runTransaction(async tx => {
          const payment = await tx.get(paymentRef); const current = await tx.get(ref);
          if (payment.exists) return;
          const start = Math.max(event.created * 1000, Number(current.data()?.passUntil || 0));
          tx.update(ref, { passUntil: nextMonth(start), pendingCheckoutId: FieldValue.delete() });
          tx.create(paymentRef, { uid, plan, amount: session.amount_total || 0, tax: session.total_details?.amount_tax || 0,
            currency: session.currency, paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null, at: event.created * 1000 });
        });
      } else if (session.subscription) {
        await syncSubscription(stripe, typeof session.subscription === 'string' ? session.subscription : session.subscription.id, event.created);
        await ref.update({ pendingCheckoutId: FieldValue.delete() });
      }
    } else if (event.type.startsWith('customer.subscription.')) {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata.firebaseUid) await syncSubscription(stripe, sub.id, event.created);
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const invoice = await stripe.invoices.retrieve(event.data.object.id);
      const subscription = invoice.parent?.subscription_details?.subscription;
      if (subscription) {
        const id = typeof subscription === 'string' ? subscription : subscription.id;
        const ownedSub = await stripe.subscriptions.retrieve(id);
        if (ownedSub.metadata.app !== 'leadership-skill-builder') { response.sendStatus(200); return; }
        await syncSubscription(stripe, id, event.created);
        if (invoice.status === 'paid') {
          const sub = await stripe.subscriptions.retrieve(id); const uid = sub.metadata.firebaseUid;
          if (uid) await db.collection('commercialPayments').doc(invoice.id).set({ uid, plan: sub.metadata.plan, amount: invoice.amount_paid,
            tax: invoice.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) || 0,
            currency: invoice.currency, at: (invoice.status_transitions.paid_at || event.created) * 1000 });
        }
      }
    } else if (event.type === 'charge.refunded') {
      const charge = await stripe.charges.retrieve(event.data.object.id);
      let owned = charge.metadata.app === 'leadership-skill-builder';
      if (!owned && charge.payment_intent) {
        const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;
        const related = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: intentId }, limit: 100 });
        for (const payment of related.data) {
          const invoice = typeof payment.invoice === 'string' ? await stripe.invoices.retrieve(payment.invoice) : payment.invoice;
          if (!('parent' in invoice)) continue;
          const subscription = invoice.parent?.subscription_details?.subscription;
          if (subscription) {
            const sub = typeof subscription === 'string' ? await stripe.subscriptions.retrieve(subscription) : subscription;
            if (sub.metadata.app === 'leadership-skill-builder') { owned = true; break; }
          }
        }
      }
      if (!owned) { response.sendStatus(200); return; }
      await db.collection('commercialRefunds').doc(charge.id).set({ amount: charge.amount_refunded, currency: charge.currency, at: event.created * 1000 });
      // Refund access decisions are kept explicit; report them for administrator review.
    }
    await processed.set({ type: event.type, at: Date.now() });
    response.sendStatus(200);
  } catch (error: any) {
    console.error('Payment notification could not be processed', { eventId: event.id, type: event.type, message: error.message });
    response.status(500).send('Payment notification will be retried');
  }
});

