export const PRODUCTION_PROJECT = 'leadership-skill-builder-7aba5';
export const STAGING_PROJECT = 'leadership-skill-builder-stg';

export function deploymentPolicy(env: NodeJS.ProcessEnv = process.env) {
  if (env.FUNCTIONS_EMULATOR === 'true') {
    if (env.STRIPE_MODE && env.STRIPE_MODE !== 'test') throw new Error('Local billing requires Stripe test mode.');
    return { stripeMode: 'test' as const, origin: 'http://localhost:3100' };
  }
  if (env.GCLOUD_PROJECT === STAGING_PROJECT) return {
    stripeMode: 'test' as const,
    origin: 'https://leadership-skill-builder-staging-600309447137.europe-west1.run.app',
  };
  if (env.GCLOUD_PROJECT === PRODUCTION_PROJECT) return {
    stripeMode: 'live' as const, origin: 'https://leadershipskillbuilder.ai',
  };
  throw new Error('This Firebase project is not an approved Skill Builder deployment.');
}

export function validateStripeMode(key: string, env: NodeJS.ProcessEnv = process.env) {
  const policy = deploymentPolicy(env);
  if (env.STRIPE_MODE !== policy.stripeMode) throw new Error('Stripe mode does not match this deployment.');
  const expected = policy.stripeMode === 'live' ? /^(sk|rk)_live_/ : /^(sk|rk)_test_/;
  if (!expected.test(key)) throw new Error(policy.stripeMode === 'test'
    ? 'This deployment accepts only Stripe sandbox credentials.'
    : 'Production requires Stripe live credentials.');
  return policy;
}

// Production keeps the existing default Functions identity. Staging retains
// its separate restricted identity and can never select the production one.
export const runtimeOptions = {
  region: 'europe-west1' as const,
  maxInstances: 3,
  ...(process.env.GCLOUD_PROJECT === STAGING_PROJECT ? {
    serviceAccount: 'skill-builder-staging-runtime@leadership-skill-builder-stg.iam.gserviceaccount.com',
  } : {}),
};
