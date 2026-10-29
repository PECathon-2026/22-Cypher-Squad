# Small Web Reader — PS-003 Design

## Intent

Build an offline-first RSS/Atom reader for people who follow independent blogs.
The primary job is to make a calm, readable reading queue from scattered feeds,
then offer transparent, anonymous discovery without accounts or reader profiles.

The implementation follows `IMPLEMENTATION_PLAN.md` and the selected
milestone-driven vertical approach. The repository currently contains only the
project README and implementation plan, so the application will be scaffolded
from the agreed stack rather than migrated from an existing UI.

## Goals

- Add RSS and Atom feeds through autodiscovery or direct feed URLs.
- Show one unified, unviewed-first timeline with feed filtering.
- Open extracted full-text articles, with a summary and original-link fallback.
- Persist subscriptions, posts, article content, and per-post viewed state locally.
- Keep previously cached content readable offline through a PWA shell and Dexie.
- Provide global popular feeds and opt-in personalized recommendations.
- Keep feed parsing, extraction, sanitization, and content caching in the browser.
- Keep aggregate writes behind trusted Firebase Functions with explicit consent,
  validation, rate limits, App Check checks, and idempotent request receipts.

## Non-goals

No accounts, persistent reader IDs, cloud-synced subscriptions, article-level
behavior tracking, AI recommendations, graph visualization, or OPML support in
the first version.

## Anti-goals

Do not ship mock recommendations, fake offline behavior, an open fetch proxy,
client-writable aggregate counters, silent URL truncation, or copy that implies
aggregate counts represent unique people.

## Constraints

- Stack: Vite, React, TypeScript, Tailwind, shadcn/ui, Firebase Hosting,
  Firebase Functions 2nd gen on Node 22, Firestore, Dexie, PWA tooling, Zod,
  Vitest, React Testing Library, and Playwright.
- The requested deployment target is Firebase Hosting with Firebase Functions
  using the team's available free-tier allowance. The implementation must stay
  emulator-compatible and keep backend deployment as a verification gate; if
  the target project rejects Functions deployment without billing, stop before
  production backend work and report the blocker rather than silently replacing
  the server behavior.
- Raw fetch responses are limited, timed out, redirect-checked, and SSRF-safe.
- Discovery write batches contain at most 20 selected feeds and use a random
  request ID for retry idempotency.
- Seed/demo aggregate fields remain separate from live contribution fields.
- Browser UI must explain opt-in recommendation requests separately from the
  explicit one-time contribution action.
- API responses and content must not be cached by the service worker.
- Keep the newest 100 posts per feed; cache full article bodies only when
  opened, cap article bodies at 200, and let users clear local cache.

## Approaches

1. **Milestone-driven vertical build — selected.** Implement the plan in order:
   scaffold and app shell, protected raw fetch, feed reader, local reader/cache,
   PWA, discovery core, opt-in/outbox integrity, abuse protection, and Discover
   UI. This preserves the plan's contracts and keeps each milestone runnable.
2. **Frontend-first shell.** Build visual screens and local behavior before
   Functions and Firestore. This creates a faster visual demo but risks contract
   churn and encourages fake discovery states.
3. **Backend-first infrastructure.** Build Functions, Firestore, seed data, and
   security tests before the reader UI. This reduces backend uncertainty but
   delays the main user experience and visual feedback.

The selected approach is the smallest path that can demonstrate real behavior
without violating the plan's privacy and security boundaries.

## Product structure

### Routes

- `/` — Timeline
- `/subscriptions` — followed feeds and add/unfollow actions
- `/discover` — popular and personalized discovery
- `/read/:postId` — article reader
- `/settings` — cache, privacy, and discovery consent

### Data ownership

The browser owns subscriptions, normalized posts, article extraction, sanitized
HTML, viewed state, local consent, and the contribution outbox. Functions own
raw upstream fetching, discovery validation, aggregate updates, ranking, rate
limits, and short-lived idempotency records. Firestore stores only feed metadata,
seed/live aggregate counters, pairs, and short-lived control records.

Feed failures are isolated per subscription. The UI distinguishes temporary
network/HTTP failures, malformed or non-feed responses, valid empty feeds, and
authentication/anti-bot challenges. A post always remains usable with its feed
summary and original link when full-text extraction fails.

Personalized discovery uses the currently selected eligible feed URLs and,
when relevant, one context feed only after explicit opt-in. It is transient
ranking input and never increments counters. Aggregate updates require the
separate contribution confirmation and submit one reviewed batch of up to 20
selected feeds.

## Visual design plan

### Design point of view

The product should feel like a personal reading room assembled from independent
voices, not a social feed or a generic SaaS dashboard. The memorable element is
the timeline's narrow "reading rail": a quiet vertical spine that shows unread
posts as physical slips entering a desk-like queue. Everything else stays
restrained so typography and article content carry the experience.

### Token system

**Color**

- `ink` — `#18221F`, deep green-black for primary text
- `paper` — `#F5F1E8`, warm paper background
- `sage` — `#9EB4A3`, muted discovery and offline accent
- `ochre` — `#D7A646`, unread marker and focused action
- `clay` — `#C97058`, warning/error accent used sparingly
- `mist` — `#DDE3DD`, quiet rules and surfaces

**Type**

- Display and navigation: `Fraunces`, with expressive but readable editorial
  forms for the reading-room identity.
- Body and controls: `DM Sans`, selected for compact UI readability and a
  less default-looking rhythm than system sans.
- Use sentence case. Avoid all-caps eyebrows and decorative label strings.

**Layout**

- Desktop: 12-column shell with a 220px navigation rail, a 640px reading
  column, and a flexible context panel.
- Mobile: single column; navigation becomes a compact top bar and context
  content follows the reading queue.
- Left-align all reading content and controls. Center only the first-run empty
  state where it improves focus.
- Keep text lines under roughly 75 characters; article body gets generous
  leading and no card-within-card treatment.
- Use square or lightly clipped surfaces for hierarchy; reserve rounded corners
  for interactive controls, not every content block.

### Timeline wireframe

```text
┌─────────────────────────────────────────────────────────────────────┐
│ small web reader                         network: online     menu  │
├───────────────┬───────────────────────────────────┬───────────────┤
│ Timeline       │ Your reading queue               │ Today         │
│ Subscriptions  │ [all feeds v] [unread]           │ 3 unread       │
│ Discover       │                                   │               │
│ Settings       │ ┃  Moss & Signal                 │ Saved locally │
│               │ ┃  A field guide to slow tools   │               │
│               │ ┃  8 min · 12 minutes ago        │               │
│               │ ┃  The Long Afternoon             │               │
│               │ ┃  Notes from a shared workshop  │               │
│               │ ┃  6 min · yesterday              │               │
└───────────────┴───────────────────────────────────┴───────────────┘
```

### Discovery wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Discover                                                     │
│ Find another good corner of the web.                         │
│                                                              │
│ Popular with readers                               [refresh]  │
│ ──────────────────────────────────────────────────────────── │
│ The Marginalia Project     14 live contributions   [Follow]  │
│ Signal & Craft              9 demo / 3 live        [Follow]  │
│                                                              │
│ Personalized discovery                                     │
│ [off] Feed URLs stay here until you turn this on.             │
│ [Enable personalized discovery]                              │
│                                                              │
│ Privacy: recommendations do not count as contributions.      │
│ [Contribute selected feeds]                                  │
└──────────────────────────────────────────────────────────────┘
```

### Principles

1. **Reading is the hero.** The home screen opens on real post titles,
   provenance, and reading state rather than a marketing hero.
2. **Evidence stays visible.** Discovery cards distinguish demo and live
   signals and explain pair hits without implying unique readers.
3. **Offline is a state, not a badge.** Show cached freshness and what remains
   available; do not decorate every surface with status pills.
4. **One bold gesture.** The reading rail is the distinctive visual device.
   Avoid gradients, repeated floating cards, and ornamental number markers.
5. **Motion answers change.** Use one restrained first-load rail reveal and
   state-change motion for follow/read actions; respect reduced motion.

## Implementation sequence

1. Scaffold the selected stack, routes, shared types, and empty states.
2. Add the raw-fetch function with App Check, SSRF, timeout, redirect, and
   response-size protections; verify billing/deployment prerequisites.
3. Add browser autodiscovery, RSS/Atom parsing, subscriptions, timeline
   ordering, filters, and per-post viewed state.
4. Add Dexie persistence, Readability extraction, DOMPurify sanitization,
   summary fallback, and reader view.
5. Add PWA shell caching while excluding API responses and bounded local
   retention.
6. Add Firestore discovery aggregates, seed data, normalization, pair math,
   popular feeds, and current-feed recommendations.
7. Add consent, contribution confirmation, outbox, retries, cancellation, and
   idempotent receipts.
8. Add abuse protection and complete Discover UI states.
9. Run focused unit/component/e2e/security checks, then complete README,
   threat-model, seed-audit, and demo documentation.

## Builder calls

- The builder may choose exact component boundaries, icon set, parser library,
  and Firebase project identifiers while preserving the data boundaries above.
- The builder may use a local development fallback for unavailable Firebase
  services only when it is explicit, testable, and never presented as
  production security or discovery data.
- The builder should prioritize the reader milestones before lower-value
  polish, while keeping the visual tokens and route structure stable.
- Target current evergreen desktop and mobile browsers supported by Vite,
  including Chrome, Safari, and Firefox; exact Playwright projects are a
  builder decision.
- Use the Firebase Emulator Suite for local development and tests, with one
  production Firebase Hosting/Functions/Firestore environment unless the team
  later requests staging.

## Deployment assumption

The product is intended to be a client-led Firebase Hosting application with
the real Functions backend retained for raw fetching and discovery. The client
must remain useful locally and in the Emulator Suite even if deployment
quotas or billing configuration prevent production Functions deployment. Do
not replace the server routes with fake client-side counters or an open browser
proxy; surface deployment failure as an explicit release blocker.
