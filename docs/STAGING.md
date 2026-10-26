# Skill Builder freemium staging

Staging: https://leadership-skill-builder-staging-600309447137.europe-west1.run.app

Branch: `codex/freemium-staging`. Project: `leadership-skill-builder-stg`. Production remains on its existing main branch, Firebase project and Cloud Run service. No UNC accounts, activity or access have been migrated or changed.

## Test the experience

Create a separate staging account using email and password, then verify the email. Existing production accounts do not sign in to this project. Google sign-in is not enabled on staging. Sign in as the verified `gary@gardenersnotmechanics.com` account to see Admin Panel → organisations.

Homepage previews: `?homepage=a` and `?homepage=b`. These are messaging variants for review, with the same free offer. Assignment lasts for a browser session; no visitor tracking or automatic winner selection is enabled.

A free learner browses all scenarios and confirms one permanent choice before starting it. The first set of five valid, distinct micro skills is generated from the scenario evaluation and saved on the server. Repeating the evaluation or requesting more suggestions does not expand or reset this free allocation. Existing session and helper daily limits still apply.

Organisation grants provide full catalogue access independently of any future payment plan. Create a grant with one week, 30 days, a custom expiry, or no expiry, plus optional exact email domains and member cap. Codes are shown once and stored only as hashes. Replacing a code invalidates the previous invitation without removing members. Redemption is idempotent, with member caps enforced in a transaction. Extending a grant updates access for all members; revocation or expiry removes full access while retaining the free scenario, free micro skills and all history. No organisation can grant administrator access.

Paid pricing, checkout and subscriptions are not configured in this staging foundation. No UNC grant has been created yet.

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

The deployed integration harness (`ALLOW_DISPOSABLE_STAGING_TESTS=true node tests/staging.integration.mjs`) requires owner/operator gcloud credentials. It creates disposable verified accounts and organisation grants, makes real model calls, checks privilege boundaries, then removes its user and grant fixtures. It refuses to overwrite an existing admin identity, so run it before a real staging admin account is created. Browser smoke checks cover the homepage and admin controls; listen to a real voice assessment and coaching session before treating voice UX as fully tested.

Production promotion requires a separate authorisation after UNC testing is finished. Preserve existing users and their history, and establish the complimentary organisation grant before any commercial cutover.
