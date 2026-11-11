# Skill Builder paid release

Production uses Firebase project `leadership-skill-builder-7aba5`, website service `leadership-skill-builder` in `leadership-skill-builder-codex`, and `https://leadershipskillbuilder.ai`. Staging keeps its separate project, runtime identity, App Check key and Stripe test configuration.

The agreed offers are US$14.99 for one calendar month without renewal, US$9.99 monthly and US$99 annually. The production backend accepts live Stripe objects and live keys only. Staging and local tests continue to reject live credentials. Payment redirects and client-side claims never grant access; only the signed receiver updates paid access.

## Prerequisites

1. Apply the approved 30-day beta access policy before enabling entitlement checks. Preserve existing Firebase Auth UIDs, catalogue customisations and learning records. Checkout uses the advertised final amounts without tax collection, as Gary confirmed on 11 November.
2. Create a separate live Skill Builder product, three prices, billing portal configuration and webhook endpoint. Put their public IDs in `config/stripe.production.json`.
3. Store the live key as `STRIPE_SECRET_KEY` and the production endpoint signing secret as `STRIPE_WEBHOOK_SECRET` in the production Firebase project's Secret Manager. Never put these values in Git or the frontend.
4. Configure the production App Check provider and explicit domain restrictions. Its public site key belongs in `.env.production`; do not enable Firestore enforcement while the old frontend is still serving users.
5. Verify that the production catalogue contains the server-owned `system_logic` instructions required by the new backend. Add missing required documents only, preserving existing configured content.

The reviewed beta-access script defaults to a dry run. Choose the agreed policy with `--policy=complimentary`, `--policy=trial30` or `--policy=free`; it writes an owner-only snapshot outside Git. Apply only that reviewed snapshot using `--apply --snapshot=/private/tmp/...json`. Successful application records a non-personal release marker in `config/launch.production.json`, which the release preflight requires. Existing profile and learning-history collections are never written by this migration.

Gary confirmed on 11 November that existing beta users receive 30 days of full access and the advertised prices are final checkout amounts, and no VAT, sales tax or GST is collected. These choices are recorded in `config/launch-decisions.production.json`; the setup and migration scripts reject conflicting policies. Apply the reviewed `trial30` snapshot before release, then use the same snapshot with `--finalize-launch-at=<verified UTC launch time>` after activation to set expiry exactly 30 days after launch. The pre-release expiry is provisional and must not be treated as the final beta deadline.

Once the live server key is stored, `node scripts/configure-live-stripe.mjs --tax=final` configures the separate product, agreed final prices, portal and webhook idempotently, saves public IDs, and stores the signing secret directly in Secret Manager. Use that option only after Gary confirms final advertised amounts. It never prints secret values and never creates a charge or subscription.

## Release order

Keep this release off main until prerequisites and tests pass. The preparation phase generates a Functions environment with freemium, billing and callable App Check enforcement disabled. This lets the expanded backend retain the old frontend's behaviour while exposing the new account endpoints.

```sh
node scripts/prepare-production.mjs prepare
npm --prefix functions run build
firebase deploy --config firebase.production.json --project leadership-skill-builder-7aba5 --only functions --non-interactive
```

Verify the prepared backend's callable auth boundary and existing voice/text flows. Build the production website and deploy it against that backend. Confirm real browser App Check attestation before activating the backend's live flags and database enforcement. Then run the final phase:

```sh
node scripts/prepare-production.mjs live
firebase deploy --config firebase.production.json --project leadership-skill-builder-7aba5 --only functions,firestore:rules --non-interactive
```

Enable Firestore App Check enforcement only after legitimate production browser requests are confirmed valid. Keep the existing Google sign-in provider and authorised domains intact. Record build IDs, source commits, ready revisions, traffic, live Checkout mode/prices, signed receiver behaviour and user-access preservation before declaring the release complete. Creating a live Checkout session does not require completing a real charge.

The existing main-branch Cloud Build pipeline must be changed to this release order before merging. A rollback must restore compatible backend flags as well as website traffic; simply pointing traffic at the old frontend after enabling new backend requirements can break old clients.
