# Reader Lifecycle Batch — Design

## Intent

Complete the first five remaining PS-003 reader problems as one coherent
offline-first lifecycle:

1. Refresh followed feeds on startup, manually, and when connectivity returns.
2. Preserve actionable feed failure classifications.
3. Cache sanitized extracted article bodies in browser Dexie only.
4. Enforce bounded post/article retention.
5. Use real browser connectivity instead of a display-only offline toggle.

## Goals

- Refresh each followed feed independently so one failure does not block others.
- Keep existing viewed state when refreshed posts are merged.
- Persist feed status, last refresh time, posts, and sanitized article bodies
  locally in the browser only; never store feed/article content in Functions or
  Firestore.
- Read cached article content without network access.
- Use the summary and original link when extraction fails.
- Keep at most 100 newest posts per feed and 200 article bodies globally.
- Expose loading, synced, offline, temporary failure, malformed, empty, and
  access-challenge states in the existing UI.

## Non-goals

This batch does not add App Check, rate limiting, discovery ranking, seed
auditing, or the contribution outbox. It also does not change the protected
proxy’s security policy.

## Approach

Use one browser-owned refresh service around the existing `resolveFeedUrl`
pipeline. It will return a typed result rather than throwing generic errors,
merge entries into existing Dexie posts, and preserve local `viewed` and
article fields. React will load Dexie immediately, observe `navigator.onLine`
and browser `online`/`offline` events, and invoke refresh only when online.
Manual refresh will use the same service.

Add an `articles` Dexie table keyed by `postId`. The reader checks this table
before fetching, stores only DOMPurify-sanitized HTML after successful
Readability extraction, and evicts oldest article bodies above 200. This is
client-only storage required by the PDF's offline-reading requirement; the
raw-fetch Function returns content but never parses, extracts, stores, or
caches it. Feed refresh evicts posts older than the newest 100 per feed without
resetting viewed state on retained records.

## Failure model

Each feed records one of:

- `synced`
- `offline`
- `temporary-error`
- `malformed`
- `empty`
- `access-challenge`

The UI shows the feed name, last successful refresh, and a concise recovery
message. Network/timeout/429/5xx failures remain temporary; HTML/login/CAPTCHA
responses are access challenges; valid zero-entry RSS/Atom is empty; invalid
XML or unsupported roots are malformed.

## Acceptance

- Startup loads cached Dexie data before attempting online refresh.
- Manual refresh updates real feeds and visibly reports per-feed outcomes.
- Returning online triggers one refresh attempt without resubmitting discovery.
- Opening an article uses cached sanitized HTML when available.
- Reloading offline still shows cached timeline and opened article content.
- Retention limits are enforced after feed refresh and article caching.
- `npm run build` and Functions build pass.
