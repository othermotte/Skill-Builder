# Commercial landing pages and experiment

## Offer and account entry

Both variants use the supplied copy with the agreed three-skill offer: one permanent free scenario, personalised feedback and up to three relevant micro skills with repeat practice. Existing frozen grants containing five skills remain intact and the signed-in allowance copy follows the server-returned limit. Paid and organisational access are unchanged. Prices still come from the single existing billing-domain configuration: US$14.99 for a calendar month without renewal, US$9.99 monthly or US$99 annually.

The public page now leads with the proposition, followed by the free offer, four-stage process, paid plans and account entry. The same components, layout, prices and CTA placements serve both copy versions. Login, signup and password reset have dedicated `/login`, `/signup` and `/reset-password` paths, retaining Google sign-in. Already authenticated users go directly to the application. Paid-plan intent is reviewed after sign-in; choosing a public plan never creates a checkout automatically. Existing authentication, App Check, scenarios, assessment, coaching and history remain in place. The older login layout is retained for the non-commercial production build; no production deployment is included.

## Allocation and QA

A random draw below 0.5 selects A, otherwise B. A browser assignment and random visitor identifier persist in localStorage under `skillBuilderLandingV1`; storage-blocked browsers retain only the in-memory assignment. Removing browser storage, changing browser or using a private session creates a new anonymous visitor. The experiment is `commercial-landing-v1`.

Staging previews accept `?variant=a` and `?variant=b`, retaining the earlier `?homepage=a/b` aliases. Preview selection does not overwrite the saved assignment. It marks that tab session as QA and excludes its entire journey, including later authentication, from experiment collection. A visible preview notice identifies this state. Use a fresh tab session without overrides for a normal allocation test. The commercial branch remains staging-only and all staged routes are noindex with a single canonical root.

## Measurement and privacy

A small optional analytics choice appears below the public content. Declining it does not prevent signup or practice. Journey collection starts only after permission and honours the browser Do Not Track signal. Functional browser assignment remains available without collection. Turning analytics off stops events and removes that visitor's account attribution from the report. This does not delete learning records or payment records.

The existing Firebase infrastructure stores separate, server-only `experimentVisitors` and `experimentAccounts` collections. The new callable is App Check protected and validates a small allowlisted payload. It never receives transcripts, assessment scores, feedback, selection reasons, email addresses or raw URL query strings. Campaign collection accepts only constrained UTM values and a referrer hostname; values containing email-address characters are discarded. A verified account is associated once with the original visitor, where possible. Identified existing users, administrators, organisation users and duplicate account associations are excluded from the eligible cohort. An unauthenticated visitor cannot report learning milestones or invent a paid-conversion event.

Milestones are deduplicated to the first timestamp per visitor/account. Registration completion means a newly created, verified account, not simply a submit click. Learning milestones are app-reported; they are not proof of learning outcomes or independently verified engagement. Checkout starts are recorded server-side only after Stripe creates a session. Paid conversions and revenue are joined from the existing webhook-owned `commercialPayments` records, never a button click or success redirect.

Attribution uses the 30 days following the first recorded landing visit. The administrator comparison appears in the existing Admin Panel. It shows eligible browser visitors, anonymous visitors, associated accounts, first milestones, paying visitors, paid conversion, gross USD revenue and mature-window conversion separately. JSON export contains aggregate counts, not individual learning content. The report also identifies payment records without account attribution since the first recorded visit. Gross revenue includes tax where charged and is not net of refunds. It does not declare a winner. The small-sample and self-selection limits must be considered when interpreting results.

## Limits and production preparation

This is a consented-browser cohort, not a count of every person who sees the page. Declined collection, Do Not Track, blocked storage, changed devices, shared browsers and lost attribution can affect the sample. A/B assignment is not a defence against deliberate experiment poisoning. App Check, bounded payloads, fixed event names, deduplication and function instance limits reduce abuse but do not make public anonymous counts fraud-proof.

The report has explicit read caps of 5,000 visitors, 5,000 associated accounts and 10,000 payment records. It fails clearly when a cap is reached rather than silently returning partial comparisons; extend it with paginated/offline analysis before exceeding these limits. Operational analytics retention, privacy/consent wording and production measurement configuration require review with the wider live-launch preparation. No new external analytics provider was added.

Tests cover allocation boundaries, canonical three-skill limits, preserved five-skill limits, campaign sanitisation, unique paid visitors, repeated payments, attribution expiry, QA/administrator boundaries and the separate paid/complimentary access rules. The hosted commercial harness creates only disposable staging users, analytics records and Stripe test sessions; it verifies both grant versions and every existing price before cleanup. The hosted security suite covers App Check, ownership and privilege boundaries.
