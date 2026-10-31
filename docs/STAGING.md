# Skill Builder freemium staging

Staging: https://leadership-skill-builder-staging-600309447137.europe-west1.run.app

Branch: `codex/freemium-staging`. Project: `leadership-skill-builder-stg`. Production remains on its existing main branch, Firebase project and Cloud Run service. No UNC accounts, activity or access have been migrated or changed.

## Test the experience

Sign in with Google, or create a separate staging account using email and password and verify the email. Google sign-in creates a separate staging profile; production accounts and their history are not copied. Sign in as the verified `gary@gardenersnotmechanics.com` account to see Admin Panel → organisations.

Homepage previews: `?homepage=a` and `?homepage=b`. These are messaging variants for review, with the same free offer. Assignment lasts for a browser session; no visitor tracking or automatic winner selection is enabled.

A free learner browses all scenarios and confirms one permanent choice before starting it. The first set of five valid, distinct micro skills is generated from the scenario evaluation and saved on the server. Repeating the evaluation or requesting more suggestions does not expand or reset this free allocation. Existing session and helper daily limits still apply.

Organisation grants provide full catalogue access independently of any future payment plan. Create a grant with one week, 30 days, a custom expiry or no expiry, and an optional limit of up to 5,000 approved addresses. Paste email addresses separated by commas, semicolons or new lines, or upload a CSV/text file. CSV headers such as Email and Email Address select the correct column. Review the recognised addresses, duplicates and invalid entries before applying the valid addresses. Imports add to the existing list; they never silently replace it. Larger lists are applied in batches of 200 with a clear partial-success message if a batch fails.

Only an exact, verified address match grants access. A university domain does not grant access to anyone outside the approved list. Addresses can be approved before accounts exist; signing in with Google or a verified email account automatically picks up active organisation access. Removing an address removes only that organisation's access. Other active grants, the permanent free choice and learning history are retained. Extending, revoking or expiring an organisation applies to everyone on its list. Existing redemption codes are disabled, and there is no public redemption field. No organisation grant provides administrator access.

The administrator account retains full catalogue access. The dashboard labels the signed-in email and access type; use another, unapproved email address to test as a free user. Before selection, the catalogue explains that one scenario is a permanent free choice. Afterwards, the chosen scenario is shown first and the others are labelled as requiring full access. There is no administrator preview mode.

Stripe test-mode checkout and customer billing are configured in the existing Gardenersnotmechanics account. Skill Builder has its own product, prices, portal configuration, customers and signed webhook. Agreed prices are US$14.99 for one calendar month without renewal, US$9.99 monthly and US$99 annually. There is no live payment connection in this branch. No UNC grant has been created yet.

## Isolation and deployment

The frontend rejects a staging build pointing at the production Firebase project. The backend refuses freemium operations outside staging. The `STAGING_ONLY` marker and production build guard prevent this branch from being deployed to production accidentally. The staging site has a visible banner and noindex/robots exclusions.

The website runtime has no database or secret permissions. The Functions runtime has database access and access to its one separate staging Gemini secret. Builds and deployments use the existing authorised build identity and operator permissions; no broad new deployment role grants are required.

The public browser configuration is in `.env.staging`. The private Gemini key remains in the staging Secret Manager. The Functions environment file is generated and ignored by Git.

```sh
npm ci
npm --prefix functions ci
npm run typecheck
npm test
npm run build -- --mode staging
```

`node scripts/prepare-staging.mjs leadership-skill-builder-stg /path/to/staging-web-config.json` writes the guarded staging configuration. `node scripts/seed-staging.mjs leadership-skill-builder-stg` seeds only the bundled scenario, skill and instruction catalogue using the current gcloud authentication. It never copies production users or activity.

After checking the target, deploy Functions and rules with `firebase deploy --config firebase.staging.json --project leadership-skill-builder-stg --only firestore:rules,functions --non-interactive`. Build the container with `gcloud builds submit --project leadership-skill-builder-stg --config cloudbuild.staging.yaml`. Deploy the resulting image only to service `leadership-skill-builder-staging` in `europe-west1`, using service account `skill-builder-staging-web@leadership-skill-builder-stg.iam.gserviceaccount.com` and maximum two instances.

The deployed integration harness (`ALLOW_DISPOSABLE_STAGING_TESTS=true node tests/staging.integration.mjs`) requires owner/operator gcloud credentials. It creates disposable verified accounts and organisation grants, makes real model calls, checks privilege boundaries, then removes its user and grant fixtures. It preserves an existing staging administrator. If one exists, automated admin checks require an operator-provided short-lived STAGING_ADMIN_ID_TOKEN; alternatively test the roster controls in the browser and use disposable learners for access-boundary checks. It does not request additional IAM signing permissions. Disposable learner accounts and grants are removed after the checks. Browser smoke checks cover the homepage and admin controls; listen to a real voice assessment and coaching session before treating voice UX as fully tested.

Production promotion requires a separate authorisation after UNC testing is finished. Preserve existing users and their history, and establish the complimentary organisation grant before any commercial cutover.

## Stripe staging integration

Non-secret Stripe configuration is in `config/stripe.staging.json`; prepare-staging preserves these settings. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are stored only in staging Secret Manager and mounted only into payment functions. The runtime rejects live Stripe keys and a non-test mode. The separate test endpoint receives only the eight selected checkout, subscription, invoice and refund events, verifies the raw-body signature and test mode, then checks app metadata, customer ownership and configured price IDs. Browser return parameters never grant access. Duplicate checkout notifications cannot extend a pass or record payment twice.

Paid access is combined with administrator and exact-email organisation access. Expiry retains the permanent free scenario, saved micro skills and learning history. Complimentary accounts are prevented from purchasing unnecessarily. Cancellation stops renewal while preserving already paid access. A pass holder can schedule a subscription with its first charge at pass expiry and no prorations. A failed invoice does not extend the paid period. Full refunds are recorded for administrator review; automatic refund-driven revocation is not implemented.

`npm test` includes calendar-month, expiry and plan-validation checks. Start a Firestore emulator with project `demo-skill-builder-billing` on 127.0.0.1:8180 and run `node tests/billing.integration.mjs` for signed webhook, duplicate notification, complimentary-account, checkout, cancellation and free-choice retention tests. The Stripe API is a local fixture in that test. Hosted sandbox payment verification is separate. Use Stripe dummy cards only; never test using real card details.

Live release still needs separate approval after UNC, including production Stripe product/price/portal configuration, signed receiver, payment terms and tax treatment. No live catalogue or payment setting was changed here.

Hosted sandbox verification on 26 October 2026: all three Checkout sessions opened at the agreed amounts without granting access before payment. A genuine hosted one-month dummy-card payment activated full access through the signed receiver. Actual monthly and annual sandbox subscription invoices activated access; signed cancellation retained the paid period and duplicate subscriptions were blocked. The browser confirmed paid account status, billing expiry, the portal redirect, and a deferred monthly checkout showing zero due today and its first charge at pass expiry. Skill Builder Checkout uses its own display name. On 30 October, Gary approved the shared customer-facing Stripe name Gardeners not Mechanics; it was saved in Stripe and verified in the billing portal. The product-specific Skill Builder headline remains underneath. Disposable learner logins were removed and all recurring test subscriptions cancelled. Test transaction records remain for audit.

## App Check

See [App Check staging](APP_CHECK_STAGING.md) for the restricted Enterprise key, callable and Firestore enforcement, disposable test attestation and recovery steps. Google sign-in and voice were confirmed by Gary on 31 October before this additional protection was introduced; the rollout record distinguishes fresh checks after enforcement.
