# Staging App Check

App Check is restricted to `leadership-skill-builder-stg`. The website uses Firebase's reCAPTCHA Enterprise provider, initialised before other Firebase services, with automatic token refresh. The public key is restricted to `leadership-skill-builder-staging-600309447137.europe-west1.run.app`; no localhost or wildcard domains are registered. The provider uses the recommended 0.5 risk threshold and one-hour token lifetime. It is a real score-based key, not an always-pass testing key.

All 17 callable functions use the `APP_CHECK_ENFORCED` deployment parameter. The staging environment sets it to true; the default is false for other deployments. Local emulator tests bypass external attestation. Firestore enforcement is configured separately through Firebase App Check. Firebase Authentication continues its existing sign-in and verified-email checks; Auth-level App Check enforcement is not part of this change. The Stripe webhook remains outside App Check and verifies Stripe's raw-body signature instead.

App Check supplements authentication, database rules, server-side entitlements, quotas and instance limits. It does not prevent all browser automation, account farming or theft/replay of a valid bearer token. Token consumption/replay protection is not enabled on each conversation turn because it requires fresh attestation and additional provider calls; it can be evaluated separately for selected expensive operations.

## Configuration and rollout

The public configuration is tracked in `config/app-check.staging.json`. `scripts/prepare-staging.mjs` preserves it in the website environment and enables the deployment parameter in the staging Functions environment. Deploy the website first, confirm real reCAPTCHA attestation in a browser, then deploy callable enforcement and enable Firestore enforcement. Existing open tabs should be refreshed after rollout.

The CSP allows the required Google reCAPTCHA script, connection and frame endpoints. The privacy modal explains Google's browser/device signal processing and links to Google's privacy policy and terms. The provider's visible badge is retained. reCAPTCHA assessments beyond Google's free allowance may incur charges; token refresh uses the default one-hour lifetime.

## Verification

`tests/security.integration.mjs` creates disposable staging users and an ephemeral App Check debug registration. It verifies that every callable rejects missing and forged attestation even for a verified signed-in user, and that Firestore rejects missing/invalid attestation. It then repeats the existing access, ownership, payload, quota and unsigned-webhook checks with valid test attestation. The debug credential is removed after the run and is never bundled in the website. This harness does not prove real browser attestation, which must also be checked through the deployed website.

`tests/staging.integration.mjs` also obtains temporary test attestation. Its existing administrator requirement remains unchanged: it preserves the real administrator and requires an operator-supplied short-lived token for automated administrator tests.

On 31 October Gary confirmed Google sign-in and voice worked before App Check was introduced. Fresh post-enforcement checks must be recorded separately.

## Recovery

If legitimate staging browsers are rejected, inspect App Check metrics and browser CSP/provider errors before changing the risk threshold. To revert enforcement temporarily, set staging `APP_CHECK_ENFORCED=false`, redeploy callable functions, and change the `firestore.googleapis.com` App Check service to `UNENFORCED`. Keep existing authentication and database rules intact. Production is not changed by this staging rollout.

## Deployment and verified results, 31 October 2026

- Website Cloud Build `90c20d41-d20a-4039-a8d4-38728fb98ed9` succeeded, including type checks, 17 unit tests and the browser/Functions/static-runtime dependency audit gates. Website source `0447567` is deployed as `leadership-skill-builder-staging-00008-2qt`, serving 100% of traffic.
- All 18 staging functions are ACTIVE. All 17 callable functions enforce App Check; the eighteenth function is the Stripe signature-verified webhook.
- Real website requests logged `app: VALID` and `auth: VALID` before enforcement. The browser then completed text conversation turns and assessment processing under enforcement without CSP or provider errors.
- Firestore enforcement was enabled at 09:56:57 UTC. The first immediate rejection probe still received HTTP 200 during propagation. Subsequent missing/forged-token probes returned HTTP 403 at 10:00 UTC. The complete hosted security suite was then rerun and passed, including both missing and forged token checks against every callable and Firestore, legitimate own-record access, cross-account denial, entitlement protection, quota rejection and unsigned webhook rejection. All its disposable fixtures and debug registrations were removed.
- A complete five-response text assessment produced a valid assessment and personalised canonical micro-skill recommendations in the deployed browser. The browser generated a practice snapshot and opened the first personalised micro-skill text-coaching challenge without console CSP/provider errors. A deliberately short earlier conversation was correctly marked as insufficient evidence.
- A separate real voice probe obtained a token through the enforced function, connected with the single-use token and received Gemini Live audio. This validates token issuance and the Live service path; it does not establish browser microphone/speaker quality.
- Browser fixtures were then signed out and removed: the disposable learner and its 27 owned records were deleted. The App Check debug-token list was checked and contained zero registrations.
- Production remains on `leadership-skill-builder-00024-lhd` and was not deployed.

A fresh manual Google-popup sign-in and microphone/speaker check on the new revision remain the final browser checks. Earlier user confirmations apply to the previous revision. Authentication service-level enforcement is intentionally unchanged; the AI/backend and database protections are enforced.
