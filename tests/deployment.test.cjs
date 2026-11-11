const {test}=require('node:test');
const assert=require('node:assert/strict');
const {deploymentPolicy,validateStripeMode}=require('../functions/lib/deploymentPolicy.js');
test('production and staging cannot use each other’s Stripe mode or credentials',()=>{
 const prod={GCLOUD_PROJECT:'leadership-skill-builder-7aba5',STRIPE_MODE:'live'};
 const stage={GCLOUD_PROJECT:'leadership-skill-builder-stg',STRIPE_MODE:'test'};
 assert.equal(validateStripeMode('sk_live_fixture',prod).origin,'https://leadershipskillbuilder.ai');
 assert.equal(validateStripeMode('rk_test_fixture',stage).stripeMode,'test');
 assert.throws(()=>validateStripeMode('sk_test_fixture',prod));
 assert.throws(()=>validateStripeMode('sk_live_fixture',stage));
 assert.throws(()=>validateStripeMode('sk_live_fixture',{...stage,STRIPE_MODE:'live'}));
 assert.throws(()=>validateStripeMode('sk_test_fixture',{...prod,STRIPE_MODE:'test'}));
 assert.throws(()=>deploymentPolicy({GCLOUD_PROJECT:'unapproved-project'}));
 assert.throws(()=>deploymentPolicy({FUNCTIONS_EMULATOR:'true',STRIPE_MODE:'live'}));
});
