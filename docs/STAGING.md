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

The deployed integration harness (`ALLOW_DISPOSABLE_STAGING_TESTS=true node tests/staging.integration.mjs`) requires owner/operator gcloud credentials. It creates disposable verified accounts and organisation grants, makes real model calls, checks privilege boundaries, then removes its user and grant fixtures. It preserves an existing staging administrator. If one exists, automated admin checks require an operator-provided short-lived STAGING_ADMIN_ID_TOKEN; alternatively test the roster controls in the browser and use disposable learners for access-boundary checks. It does not request additional IAM signing permissions. Disposable learner accounts and grants are removed after the checks. Browser smoke checks cover the homepage and admin controls; listen to a real voice assessment and coaching session before treating voice UX as fully tested.

Production promotion requires a separate authorisation after UNC testing is finished. Preserve existing users and their history, and establish the complimentary organisation grant before any commercial cutover.
