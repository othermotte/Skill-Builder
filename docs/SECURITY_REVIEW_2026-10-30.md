# Skill Builder staging security review, 30 October 2026

## Scope and result

This review covers the commercial staging branch, its installed browser/backend/static-server dependencies, source handling of authentication and entitlements, deployed staging Firestore access controls, model-cost controls, Stripe ownership/signature handling, public HTTP configuration and staging runtime IAM. Production was inspected only to confirm its website revision remained unchanged. No production data or live payments were modified. This is an application review and targeted regression exercise, not an independent penetration-test certificate or a guarantee that no vulnerabilities exist.

## Findings and remediation

| Finding | Evidence | Action |
| --- | --- | --- |
| Outdated dependencies | Initial npm audits: browser tree 4 high entries; Functions tree 1 critical, 3 high and 10 moderate entries. These are package advisories, not proof that each vulnerability was exploitable in this app. | Updated Firebase Admin/Functions to supported current releases; refreshed compatible dependencies and pinned patched gRPC and qs. Both final audits report zero advisories. |
| Static server dependency outside the app lockfile | A separate audit of serve 14.2.6 reported its vulnerable compression dependency. The old Dockerfile installed an unpinned global server. | Added a dedicated runtime package/lockfile with patched compression. Runtime audit reports zero advisories. Docker now installs from that lock and runs as the node user. |
| Assessment requests had no per-user daily AI quota | getFeedbackForTranscript checked sign-in and scenario access but did not call recordGeminiUsage. | Added the existing helper allowance of 12 assessment requests per verified account per UTC day. An owner-seeded disposable staging counter at the boundary caused HTTP 429 before any AI request. |
| Large or malformed model requests | Some analysis endpoints accepted arbitrary transcript arrays and supporting text sizes. | Added a 256,000-byte model request cap, validated transcript roles/messages, 300-entry and 120,000-character transcript limits, and an 8,000-character individual message limit. Hosted malformed/oversized tests return HTTP 400 before provider work. |
| Parallel or repeated continuation calls could increase AI spend within one text session | turnCount was recorded but not enforced or atomically reserved. | Added a 30-turn conversation limit and a transactional processing lock. Failed provider requests consume their reserved turn; the processing lock is cleared on completion or expires after two minutes. |
| An unpaid subscription could be treated as absent during a new purchase | Purchase and account-state code excluded unpaid from existing subscriptions, although Stripe unpaid subscriptions remain in place and can reactivate. | Keep payment management available and block a new subscription until the existing one is ended. The billing integration test covers this transition. |
| Billing project guard depended on the freemium flag | Disabling the flag could bypass a general staging guard. | Added an unconditional staging-project or local-emulator guard for billing. Live Stripe credentials remain rejected. |
| Browser defence headers absent | Initial hosted response lacked CSP, anti-framing and other explicit browser security headers. | Added CSP, frame denial, nosniff, referrer policy, HSTS, microphone-only permissions and a Google-popup-compatible opener policy. Verified the complete configured header set on the public staging response; the signed-in dashboard and both signed-out homepage variants loaded without console CSP errors. Gary confirmed Google sign-in and voice working on 31 October, before the subsequent App Check rollout. |
| Privacy text overstated non-disclosure | Existing modal said no generated data was shared with any organisation, despite Google processing and administrator access. | Replaced it with a description of Firebase storage, Gemini processing, authorised administrator access and Stripe payment processing. No unsupported absolute security or TLS-version promises remain. Formal privacy/retention/terms review remains separate. |

## Verification

- 17 local unit tests pass, including input bounds and text-turn policy.
- TypeScript checks and the staging frontend/Functions builds pass.
- Firestore-emulator billing tests pass after the SDK upgrade: paid expiry, cancellation, duplicate notifications, deferred first charge, fixed prices, complimentary-account purchase prevention, live-key rejection and unpaid-subscription duplicate prevention.
- Deployed staging checks use two disposable verified learners and clean their profiles, Auth accounts, seeded quota/session records and generated test logs afterwards.
- Unauthenticated model, billing and roster operations return 401; unverified accounts cannot obtain access.
- Client access to entitlement, commercial, organisation and model-session collections is denied, including a forged fullAccess write.
- Role escalation and cross-user profile reads are denied.
- A learner can read their own practice record; another learner cannot read or delete it; the owner cannot transfer its ownership.
- Ordinary users cannot list, create or change organisations or approved rosters. Disabled legacy redemption codes fail.
- A free scenario choice is permanent; starting an unchosen scenario is denied by the server.
- Cross-user text-session continuation is denied.
- An unsigned Stripe notification returns 400 and cannot activate access.
- Tracked files were scanned for live Stripe/restricted-key, webhook-secret and private-key patterns without printing values; no matches were found. Firebase browser configuration is intentionally public and is not treated as a private key.
- Staging IAM shows no project-level permissions for the static website identity and datastore.user for the backend identity. Function mounts contain only the relevant named Gemini/Stripe secrets. The backend identity is shared across app functions; separation into identities per function group would further reduce the impact of any future backend compromise.
- Firebase browser key API restrictions and the separate Gemini API restriction were inspected. An empty browser restriction object is not counted as evidence of HTTP-referrer enforcement.

## Limits and release work

The 30 October review identified App Check as a follow-up. On 31 October the staging branch added reCAPTCHA Enterprise attestation, callable enforcement and separate Firestore enforcement. See [the App Check rollout record](APP_CHECK_STAGING.md) for current verification and limits. Existing verified-email, per-user quotas, server-owned entitlements and instance caps remain necessary: App Check does not eliminate multi-account abuse. Review provider/billing budgets before the commercial release.

The review does not certify production, Google/Stripe infrastructure, the OS/container base-image CVE inventory, operational backup/restore, data retention compliance, or complete browser microphone/audio behaviour. Full refunds are recorded for explicit administrator review; automatic refund-driven entitlement revocation remains a business-policy decision. Re-run dependency and deployed access checks at the actual release date, alongside real-browser Google sign-in, text/voice practice, live Stripe configuration and the normal UNC migration checks.

Sources used to assess package reachability and subscription behaviour:

- https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j
- https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h
- https://github.com/advisories/GHSA-vc2v-76pw-4v95
- https://docs.stripe.com/billing/subscriptions/overview

## Deployment evidence

Staging website revision `leadership-skill-builder-staging-00007-l86` serves 100% of traffic from build `ae0b8437-648a-4bb1-913c-109dba8fe68b`, website source `d42e079`. The unpaid-subscription correction and audit documentation follow in commit `433906e`; the two affected billing functions were deployed separately. All 18 staging functions are ACTIVE. Production remains `leadership-skill-builder-00024-lhd`. The superseded build was cancelled before deployment. Both public homepage variants and the signed-in paid dashboard were inspected after release. No CSP errors appeared in the browser console. The automated browser did not complete a fresh Google popup. Gary subsequently confirmed Google sign-in and voice working on 31 October. These confirmations preceded App Check enforcement; post-enforcement results are recorded separately in APP_CHECK_STAGING.md.
