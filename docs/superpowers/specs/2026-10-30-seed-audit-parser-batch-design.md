# Seed Audit, URL Normalization, and Feed Parser Batch — Design

## Intent

Complete the next five PS-003 tasks by making feed identity and feed validity
deterministic, testable, and auditable. The app needs a real seed set so
Discover works before live contributions exist, while the audit must preserve
the original seed URLs and distinguish duplicates, malformed feeds, and
temporary failures without unsafe fetching.

## Goals

- Add a curated 10–15 URL seed dataset with explicit original URLs and feed
  metadata suitable for local/demo discovery.
- Add one conservative URL normalization contract for comparisons and IDs.
- Harden RSS, RSS 1.0/RDF, and Atom parsing for namespaces, BOMs, missing
  optional fields, duplicate entries, and valid-empty feeds.
- Add explicit fetch/parse classifications for the seed audit.
- Add a repeatable `npm run audit:seed-feeds` command with bounded concurrency,
  timeout, redirect, body-size, and URL-safety protections.
- Add focused fixture-based automated tests for normalization, parsing, and
  classification.

## Non-goals

- No automatic merging of feeds based only on hostnames, titles, or one
  matching article.
- No server-side storage of feed or article content.
- No broad parser rewrite or support for JSON Feed in this batch.
- No production Firebase deployment.

## Approaches

1. **Audit-first shared modules (selected):** create shared contracts and
   fixtures first, then use them from the seed auditor and app-facing parser.
   This gives reproducible evidence and prevents browser/server drift.
2. **Runtime-first:** improve the app parser first and derive audit behavior
   afterward. This gives faster UI impact but weaker reproducibility.
3. **Data-first:** add seed and Firestore data first, then validate it. This is
   fastest for a demo but risks embedding duplicate or invalid entries.

The audit-first approach is selected because the problem statement requires
evidence-based feed identity and separate malformed versus temporary failure
classification.

## Design

### Shared URL contract

Accept only absolute HTTP(S) URLs without credentials, unsupported ports, or
secret-like query keys for outbound discovery and audit requests. Normalize
scheme/hostname casing, remove default ports and fragments, preserve query
parameters exactly, and ensure an empty path becomes `/`. Do not equate HTTP
with HTTPS, `www` with apex domains, path case, or trailing-slash variants.

### Feed parsing

Keep parsing in the browser for product content. Extract a reusable pure
normalization/parsing contract that the audit can exercise against fixtures.
Recognize RSS 2.0, RSS 1.0/RDF, and Atom. Preserve feed URL, site URL,
self-identifier, entry IDs/links, title, summary, author, and publication date.
Report valid-empty separately from malformed or unsupported content.

The audit runs in Node, using the same pure parser and normalizer modules as
the browser. Its HTTP adapter manually follows redirects, re-checks DNS and
private/reserved-address policy at every hop, applies an 8-second total
timeout, and enforces the 2 MiB limit on decoded response bytes.

Classification precedence is deterministic: unsafe URL; redirect/body-limit
failure; access challenge; temporary network failure, 429, or 5xx; other HTTP
error; non-feed HTML; malformed or unsupported XML; valid-empty feed; valid
feed.

### Seed data and audit

Store the authoritative 12-feed seed list in a source-controlled TypeScript/JSON
data file. Seeded Firestore records use `seededPopularityCount: 1`; live audit
failures are reported but do not make the command fail.
The audit records original URL, normalized URL, HTTP status, redirect chain,
content type, parser classification, feed metadata, and sample stable entry
identifiers. Fetch at most three URLs concurrently with the same 8-second,
2 MiB, three-redirect safety limits. Pairwise identity checks use exact URL,
final URL, self link, site URL, and bounded entry overlap as evidence; ambiguous
results remain candidates rather than merges.

Identity is report-only in this batch. Three or more sampled stable IDs or
canonical links with at least 60% overlap are high-confidence feed identity;
one or two matching entries are only possible aliases. No persistent alias
mapping or feed-ID rewrite is performed.

### Tests

Use local XML/HTML/network-result fixtures. Cover normalization idempotence,
query preservation, credential/secret rejection, RSS/Atom/RDF parsing,
valid-empty feeds, malformed XML, HTML challenge responses, duplicate entry
removal, and transient HTTP failures. Tests must not require network access.

## Builder decisions

- Seed records will include the original feed URL and display metadata; live
  Firestore seed loading will use normalized feed IDs and separate seeded
  counts.
- The audit command will emit `seed-audit-report.md` locally and will not
  modify the source seed list.
- The browser parser remains the source of truth for product feed parsing;
  shared pure helpers will avoid duplicating identity and classification rules.
- Network audit failures remain temporary/unavailable unless body evidence
  proves an access challenge or non-feed HTML response.
- Unsafe seed records are represented by a stable hash and rejection reason,
  never the original unsafe value.

## Acceptance

- `npm run audit:seed-feeds` completes safely or reports bounded failures.
- A real 10–15 feed dataset exists and can populate demo discovery data.
- URL normalization and parser fixtures pass automated tests.
- Audit output distinguishes exact duplicates, likely aliases, malformed/not-a-
  feed responses, valid-empty feeds, and temporary failures.
- Frontend and Functions builds remain green.
