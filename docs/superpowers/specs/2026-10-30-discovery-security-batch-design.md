# Discovery Security Batch — Design

## Intent

Complete the next five PS-003 problems as one secure discovery lifecycle:

1. Verify Firebase App Check on ordinary HTTP Functions.
2. Enforce backend rate limits without storing raw IPs.
3. Use live popular/recommendation APIs in Discover.
4. Persist contribution requests in a local outbox and retry idempotently.
5. Apply client/server URL safety and exclusion rules consistently.

## Goals

- Reject missing or invalid App Check tokens on discovery and fetch routes.
- Apply endpoint-specific rate limits and return `429` with `Retry-After`.
- Keep only short-lived HMAC-derived limiter keys, never raw IP addresses.
- Load popular and personalized recommendations from Functions rather than
  hardcoded cards.
- Keep personalized requests disabled until explicit local opt-in.
- Queue explicit contributions locally while offline and retry the same random
  request ID after reconnect or a lost response.
- Cancel unsent outbox requests when personalized discovery is disabled.
- Exclude credential-bearing and secret-like URLs before any outbound request,
  explain exclusions, and repeat validation server-side.

## Non-goals

No accounts, persistent reader IDs, reader profiles, raw subscription history,
article tracking, or server-side storage of subscription lists. Signed
single-use submission tokens remain optional and are not required for this
batch.

## Approach

Use shared Functions middleware for App Check and fixed-window rate limiting.
The middleware runs before fetch, popular, recommendation, and contribution
handlers. App Check verification uses the Admin SDK; rate-limit keys are
short-lived HMACs derived from trusted platform request metadata, with a
documented fallback when trusted IP metadata is unavailable.

Use a small client discovery API module and local Dexie `sharingState` and
`outbox` tables. Discover calls `/api/popular` without subscription URLs while
opt-in is off. With opt-in on, eligible feed URLs and an optional context feed
may be sent transiently. Contributions require a separate confirmation,
create one request ID, and are retried with that same ID until acknowledged or
cancelled.

URL eligibility is a shared rule: only HTTP(S), no credentials, no local/private
hosts, and no secret-like query keys. The UI shows excluded feeds and does not
silently rewrite them.

## Confirmed implementation decisions

- Web App Check uses a local debug-token/emulator path and is enforced with
  valid tokens in production.
- Local development uses both Functions and Firestore emulators; local
  discovery must never silently use production Firestore.
- Refactor the public API to the plan-shaped route names and request schemas,
  while keeping a compatibility path only where needed during the transition.
- Disabling opt-in cancels unsent queued requests. In-flight requests retain
  their request ID for server idempotency, but no new retry is initiated after
  cancellation.
- Discovery URL validation includes syntax, credentials, secret-like query
  keys, DNS resolution, and private/reserved-address rejection. Fetch
  redirects remain manually validated and bounded.

## Acceptance

- Missing/invalid App Check is rejected by every ordinary HTTP endpoint.
- Limits return `429` and do not write aggregate data.
- Discover renders live popular/recommendation results and excludes followed
  feeds.
- Opt-in off never sends subscription URLs or context feeds.
- A contribution can queue offline, retry after reconnect, and cannot double
  count after a lost response.
- Disabling opt-in cancels unsent queued contributions.
- Unsafe URLs are excluded client-side and rejected server-side.
- Frontend and Functions builds pass.
