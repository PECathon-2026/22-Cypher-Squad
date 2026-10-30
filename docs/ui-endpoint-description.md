# Small Web Reader: UI and Endpoint Description

This document describes the current Small Web Reader application as a prompt for generating or redesigning its UI. It covers the visual language, screens, controls, user flows, content types, local persistence, and the Vercel serverless endpoints used by the interface.

## Product character

Small Web Reader is a quiet, offline-first RSS and Atom reader for people who want a focused reading queue instead of an algorithmic social feed. The interface should feel editorial, calm, tactile, and privacy-conscious:

- Warm paper background rather than bright white.
- Dark green-black ink for primary text.
- Muted sage, ochre, and clay accents.
- Serif display typography for article titles and reading content.
- Sans-serif utility typography for metadata, navigation, controls, and status.
- Thin borders, restrained shadows, generous whitespace, and no aggressive gradients.
- The product should feel like a personal reading room, not a dashboard.

Current typography:

- Display and article text: `Fraunces`.
- Interface text: `DM Sans`.

Current palette:

| Token | Use | Value |
|---|---|---|
| Ink | Primary text, dark buttons | `#18221f` |
| Muted | Secondary text and metadata | `#6f7871` |
| Paper | Main background | `#f5f1e8` |
| Paper deep | Selected navigation and soft panels | `#ebe5d8` |
| Sage | Positive/status accent | `#9eb4a3` |
| Ochre | Attention and discovery accent | `#d7a646` |
| Clay | Offline/error/destructive accent | `#c97058` |
| Mist | Timeline rail and subtle fills | `#dde3dd` |
| White | Feed/recommendation cards | `#fcfaf4` |

## Application shell

### Desktop

Use a two-column layout:

1. Fixed left sidebar, approximately 248px wide.
2. Flexible main content area centered within a readable maximum width.

The sidebar contains:

- Feather logo mark.
- Wordmark: `small web reader`.
- Caption: `a quiet queue for the open web`.
- Section label: `Your room`.
- Primary navigation:
  - Timeline
  - Subscriptions
  - Discover
  - Settings
- Timeline unread badge.
- Privacy note: `Your reading state stays on this device.`
- Connection status button.

### Mobile

Use a compact top header:

- Menu icon on the left.
- Centered wordmark.
- Online/offline status on the right.

The menu opens a left drawer with the same navigation links. Clicking outside or using the close icon dismisses it.

### Global connection status

Display a compact status control:

- Online: Wi-Fi icon and `Online · synced`.
- Offline: crossed Wi-Fi icon and `Offline · cached`.

The status control reflects browser connectivity and is also currently clickable as a local UI toggle. Offline mode must make it clear that the app is showing locally saved content and that network actions are unavailable or queued.

## Routes and screens

## 1. Timeline `/`

### Purpose

The home screen is the user’s chronological reading queue. It displays saved feed posts, prioritizing unread posts and then sorting by publication time, newest first.

### Header

Eyebrow: `Your reading queue`

Title: `Make room for good things.`

Description: `A single, unhurried place for the independent blogs you choose to follow.`

Primary action:

- `Add a feed`
- Plus icon.
- Opens the add-feed modal.

### Queue toolbar

Include:

- Feed filter select:
  - `All feeds`
  - One option per subscribed feed.
- Unread filter button:
  - Displays `{count} unread`.
  - When active, displays `Unread only`.
  - Uses a small circle indicator.
- Offline note when applicable:
  - `Showing your saved queue`.

### Post row

Each post is a horizontal editorial row with:

- Colored marker:
  - Sage, ochre, or clay.
  - Empty dot for unread.
  - Check icon for read.
- Feed name.
- Relative publication time such as `12 minutes ago`, `Yesterday`, or `2 days ago`.
- Estimated reading time such as `8 min read`.
- Post title in serif type.
- One-line summary excerpt.
- Actions:
  - `Read story` with external-arrow icon.
  - `Mark read` or `Mark unread`.
- More-actions icon on desktop. It is currently visual-only and should not be treated as an active feature unless implemented later.

Read posts are visually reduced with lower opacity.

### Empty state

When filters return no posts:

- Book icon.
- Heading: `Nothing waiting here.`
- Message: `Try another feed or return when the web has brought you something new.`

### Footer controls

Left side:

- Download icon.
- `Saved locally for offline reading`.

Right side:

- `Refresh feeds`.
- While refreshing: `Refreshing feeds…`.
- Offline: `Offline`.
- Disabled while offline or while a refresh is running.

### Add-feed modal

Opening `Add a feed` displays a centered modal over a dark translucent backdrop.

Modal content:

- Eyebrow: `New subscription`.
- Heading: `Bring a feed into your room.`
- Explanation: `Paste a blog URL or a direct RSS/Atom URL. We’ll find the feed, validate it, and save its posts locally.`
- Label: `Feed or blog URL`.
- Globe icon input.
- Placeholder: `https://example.com/feed.xml`.
- Validation error text in clay.
- Submit button:
  - Default: `Add feed`.
  - Loading: `Finding feed…`.
- Close icon in the top-right.
- Clicking the backdrop closes the modal.

The input accepts either a website URL or a direct RSS/Atom URL. Feed resolution supports autodiscovery through HTML alternate links and common paths including `/feed`, `/feed.xml`, `/rss.xml`, and `/atom.xml`.

## 2. Subscriptions `/subscriptions`

### Purpose

Manage locally saved subscriptions. The subscription list is device-local by default.

### Header

Eyebrow: `Your subscriptions`

Title: `Keep the good ones close.`

Description: `Feeds live on this device, so your list stays yours.`

### Follow form

Include:

- Globe icon.
- Input placeholder: `Paste a blog or feed URL`.
- Button:
  - Default: `Follow feed`.
  - Loading: `Finding feed…`.

The form accepts a blog page or direct feed URL. On success, show:

- Check icon.
- `Feed found and saved locally.`

On failure, show an error message in clay.

### Feed list item

Each subscription row contains:

- Radio/feed icon in a soft paper-deep square.
- Feed title in serif type.
- Status dot.
- Feed description.
- Resolved feed URL in small muted text.
- Optional error text.
- Number of saved posts.
- Label: `posts saved`.
- `Unfollow` action.

Status categories and visual meanings:

| Status | Meaning | Visual |
|---|---|---|
| `synced` | Feed fetched successfully | Green |
| `attention` | Feed needs attention | Ochre |
| `empty` | Valid feed with no entries | Ochre |
| `offline` | Could not refresh because the app is offline | Clay |
| `temporary-error` | Temporary upstream/network failure | Clay |
| `malformed` | Feed XML is malformed | Purple |
| `access-challenge` | Site returned an access or bot challenge | Purple |

## 3. Discover `/discover`

### Purpose

Help readers find feeds using anonymous aggregate signals without creating a user profile. Discovery is private by default.

### Header

Eyebrow: `A wider reading room`

Title: `Find another good corner.`

Description: `Recommendations are based on anonymous aggregate signals, never on a profile of you.`

### Privacy strip

Use a soft sage panel with a shield icon.

Default copy:

- Bold: `Private by default.`
- Detail: `Your subscriptions stay here until you choose otherwise.`
- Action: `Learn about this`.

Enabled personalized-discovery copy:

- Detail: `Eligible feed URLs may be sent transiently for ranking.`
- Action: `Turn off`.

Enabling personalized discovery persists the choice locally. It allows followed feed URLs to be sent transiently to the recommendations endpoint; it does not create an account or permanently store a personal reading profile.

### Discovery section

When personalized discovery is disabled:

- Eyebrow: `Aggregate signals`.
- Heading: `Popular with other readers`.
- Data source: `GET /api/discovery/popular`.

When enabled:

- Eyebrow: `For this reading room`.
- Heading: `Feeds linked to yours`.
- Data source: `POST /api/discovery/recommendations`.

Controls:

- `Refresh`.
- While loading: `Loading…`.
- Disabled while loading.

### Recommendation card

Each card contains:

- Narrow colored swatch on the left.
- Signal metadata:
  - `{score} aggregate signals`, or `Suggested feed`.
  - Live/seed signal counts when available.
- Feed name or URL.
- Reason text.
- `Follow feed` button with plus icon.

Already-followed feeds must be filtered out of the visible recommendations.

### Contribution panel

Use a separated panel below recommendations.

Eyebrow: `Optional contribution`

Heading: `Help the room get smarter.`

Description: `Share up to 20 selected feeds in one anonymous batch. This is separate from asking for recommendations and never creates an account.`

Actions:

- `Contribute selected feeds`.
- Shield icon.
- Disabled when personalized discovery is disabled.
- Supporting text when disabled: `Enable personalized discovery first`.
- Offline state: `Queued until you are online`.

### Contribution confirmation modal

The modal must clearly explain the privacy boundary before sending:

- Eyebrow: `Review before sending`.
- Heading: `These feeds will be included.`
- Text explaining:
  - No account is created.
  - No permanent reader ID is created.
  - Contributions update aggregate counts.
  - Contributions cannot later be attributed to one person.
- Review list of up to 20 feed names, each with a check icon.
- Primary action: `Confirm contribution`.
- Close icon and backdrop dismissal.

Feedback states:

- `Sending contribution…`
- `Contribution accepted.`
- `Contribution could not be sent. Try again when the backend is available.`

The client stores unsent contributions in an IndexedDB outbox and retries them when connectivity returns.

## 4. Settings `/settings`

### Header

Eyebrow: `Preferences and privacy`

Title: `Keep the edges simple.`

Description: `Small controls for a reading room that belongs to you.`

### Settings rows

#### Offline reading

- Wi-Fi-off icon.
- Heading: `Offline reading`.
- Online copy: `Your queue and opened articles are kept locally for offline reading.`
- Offline copy: `You are viewing saved content. New feeds will wait until the connection returns.`
- Value: `On`.

#### Local cache

- Download icon.
- Heading: `Local cache`.
- Description: `Keep the newest 100 posts per feed and up to 200 opened article bodies.`
- Action: `Clear cache`.

Clearing the cache removes locally saved posts/articles from the reader cache and should produce an immediate visible change.

#### Anonymous discovery

- Shield icon.
- Heading: `Anonymous discovery`.
- Description: `Off by default. Recommendations and contributions are separate actions.`
- Value: `Off`.

### Privacy card

Use a soft sage panel with an information icon.

Heading: `What never leaves this device`

Copy: `Reading state, opened article content, and your subscription list stay local unless you explicitly opt in to a discovery request or contribution.`

## 5. Reader `/read?post=<encoded-post-id>`

### Purpose

Display a saved post in a focused reading layout. The reader first uses a locally cached sanitized article, then attempts browser-side extraction through the fetch proxy, then falls back to full feed-provided HTML, and finally to the feed summary.

### Missing-story state

If the query does not resolve to a saved post:

- Back button: `Back to queue`.
- Book icon.
- Heading: `This story is no longer saved.`
- Message: `Return to your queue and choose another post.`

### Article header

Include:

- Back button: `Back to queue`.
- Feed name.
- Relative publication date.
- Reading time.
- Offline indicator: `Saved copy`.
- Article title in large serif type.
- Article deck/excerpt in muted larger text.
- Short horizontal rule.

### Article body

Content may be:

1. Sanitized Readability extraction from the original article page.
2. Sanitized full HTML from the RSS/Atom feed’s content field.
3. Plain summary fallback.

Never render unsanitized remote HTML.

When only the summary is available, show:

- `The full article could not be extracted, so the feed summary is shown instead.`
- The summary text.

Below the article:

- Link: `Open original source`.
- External-arrow icon.
- Opens the original article/feed URL in a new tab.

### Related discovery

When personalized discovery is enabled and recommendations are available, add a discovery section after the article:

- Eyebrow: `Discovery`.
- Heading: `Blogs like {feed name}`.
- Explanation: `Discovered through anonymous co-subscription patterns with this blog.`
- Up to four related feed cards.
- Each card shows signal count, live/seed counts, feed name, reason, and `Follow blog`.
- After following, show a check message such as `Followed {feed name}` and remove that card.

## Content data types

### Feed

```ts
type Feed = {
  id: string;
  name: string;
  url: string;
  description: string;
  posts: number;
  status:
    | "synced"
    | "attention"
    | "offline"
    | "temporary-error"
    | "malformed"
    | "empty"
    | "access-challenge";
  error?: string;
  lastFetchedAt?: string;
};
```

### Post

```ts
type Post = {
  id: string;
  feed: string;
  feedUrl: string;
  title: string;
  summary: string;
  contentHtml?: string;
  minutes: number;
  published: string;
  publishedAt: string;
  viewed: boolean;
  accent: "sage" | "ochre" | "clay";
  articleUrl?: string;
  articleHtml?: string;
  articleSource?: "extracted" | "feed-content" | "summary-fallback";
};
```

### Discovery feed item

```ts
type DiscoveryFeedItem = {
  url: string;
  name?: string;
  description?: string;
  score?: number;
  reason?: string;
  liveSignals?: number;
  seededSignals?: number;
  livePopularityCount?: number;
  seededPopularityCount?: number;
};
```

## Endpoint contract and UI usage

All endpoints are same-origin `/api/*` routes in production. The browser sends Firebase App Check headers when configured. API responses are non-cacheable and the server applies rate limiting and URL validation.

## `POST /api/fetch`

### Purpose

Fetch raw feed XML or article HTML from an upstream website while avoiding browser CORS limitations. The server returns raw content only; parsing, Readability extraction, sanitization, and caching remain browser-side.

### Request

```json
{
  "url": "https://example.com/feed.xml"
}
```

The endpoint also supports `GET /api/fetch?url=...` for compatibility.

### UI callers

- Feed autodiscovery.
- RSS/Atom refresh.
- Article extraction.
- Legacy post feed-content recovery.

### Success response

- HTTP status follows the upstream response where applicable.
- `Content-Type` is the upstream content type.
- Body is raw XML or HTML.

### Error states

| Status | UI meaning |
|---|---|
| `400` | Missing URL or invalid JSON |
| `403` | Invalid/unsupported URL, private address, credentials, or unsafe redirect |
| `413` | Upstream response exceeds 2 MiB |
| `429` | Rate limit exceeded |
| `502` | Upstream fetch failed |
| `504` | Upstream request timed out |

The UI should convert failures into feed status/error messages rather than exposing stack traces.

## `GET /api/discovery/popular`

### Purpose

Return globally popular feed records based on seeded and live aggregate counts. It does not receive subscription URLs and does not increment counters.

### Request

```http
GET /api/discovery/popular
```

### Response

```json
{
  "feeds": [
    {
      "id": "hash",
      "name": "Cloudflare Blog",
      "normalizedUrl": "https://blog.cloudflare.com/rss/",
      "description": "Internet infrastructure and security.",
      "seededPopularityCount": 1,
      "livePopularityCount": 0
    }
  ]
}
```

The client maps `normalizedUrl` to `url` and popularity fields to discovery signal fields when rendering cards.

### UI behavior

- Called when Discover is private/default mode.
- Triggered by the Discover `Refresh` button.
- Do not show followed feeds.
- Show loading, empty, offline, and temporary-unavailable states.

## `POST /api/discovery/recommendations`

### Purpose

Return feeds associated with the current followed feeds using anonymous co-subscription and popularity signals. This endpoint is called only after the user enables personalized discovery.

### Request

```json
{
  "feedUrls": [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://hnrss.org/frontpage"
  ],
  "contextFeed": "https://example.com/feed.xml"
}
```

`feedUrls` is capped at 100 and is filtered for safe HTTP/HTTPS URLs without credentials, secret-like query parameters, or non-standard ports. `contextFeed` is optional and is used by reader-level related-blog discovery.

### Response

```json
{
  "feeds": [
    {
      "url": "https://example.com/feed.xml",
      "name": "Example Blog",
      "description": "A useful independent publication.",
      "score": 7,
      "reason": "Frequently read alongside your subscriptions",
      "liveSignals": 4,
      "seededSignals": 1
    }
  ]
}
```

### UI behavior

- Never imply that a permanent profile was created.
- Explain transient URL sharing in the privacy strip.
- Filter already-followed feeds.
- Use results for both the main Discover page and the Reader’s related-blog section.

## `POST /api/discovery/submit`

### Purpose

Accept an explicit anonymous contribution of 1–20 feed URLs and update Firestore aggregate popularity and pair counters.

### Request

```json
{
  "requestId": "stable-client-request-id",
  "feedUrls": [
    "https://feeds.bbci.co.uk/news/rss.xml",
    "https://hnrss.org/frontpage"
  ]
}
```

The client creates a stable request ID, stores the contribution in IndexedDB, retries queued records, and marks the record sent after a successful response.

### Response

```json
{
  "accepted": true,
  "requestId": "stable-client-request-id"
}
```

### UI behavior

- Require explicit confirmation.
- Clearly state that no account or permanent reader ID is created.
- Allow up to 20 feeds.
- Show queued/offline status.
- Treat repeated request IDs as safe and idempotent.
- Show success or retryable failure feedback.

### Error states

| Status | Meaning |
|---|---|
| `400` | Invalid JSON, invalid request ID, invalid URL, or wrong batch size |
| `429` | Contribution rate limit exceeded |
| `200` | Contribution accepted or already processed idempotently |

## Feed parsing and content formats

The UI must support:

- RSS 2.0.
- RSS 1.0/RDF.
- Atom.
- HTML pages with autodiscovery links.
- Direct feed URLs.
- Common feed paths:
  - `/feed`
  - `/feed.xml`
  - `/rss.xml`
  - `/atom.xml`

Feed entries can contain:

- Title.
- Article URL.
- Summary.
- Full HTML content.
- Publication date.
- Author.

Use the full feed HTML when original article extraction fails. Sanitize all remote HTML before rendering.

## Local-first behavior

Persist locally:

- Feeds.
- Posts.
- Viewed/unviewed state.
- Sanitized opened articles.
- Discovery preference.
- Queued contribution batches.

Retention policy:

- Newest 100 posts per feed.
- Up to 200 opened article bodies.

When offline:

- Show saved posts and saved articles.
- Disable feed refresh.
- Avoid discovery requests.
- Queue contribution batches.
- Flush queued contributions when the browser returns online.

## UI state requirements

Every network-backed action should have these states where applicable:

- Idle.
- Loading.
- Success.
- Empty.
- Offline.
- Temporary failure.
- Validation failure.
- Permission/privacy-disabled.

Errors should be short, human-readable, and placed next to the action that caused them. Avoid exposing raw backend traces, credentials, or internal implementation details.

## Accessibility and interaction requirements

- Every icon-only button needs an accessible label.
- Inputs need visible labels or meaningful `aria-label` values.
- Modals need `role="dialog"` and `aria-modal="true"`.
- Keyboard focus must be visible.
- Modal close controls must work through the close button and backdrop.
- Buttons must show disabled/loading states.
- Respect `prefers-reduced-motion`.
- Preserve readable line lengths and sufficient contrast.

## Implementation guidance for a new UI

Preserve the application’s information architecture:

1. Timeline for the queue.
2. Subscriptions for feed management.
3. Discover for aggregate recommendations and explicit contribution.
4. Settings for offline/cache/privacy explanation.
5. Reader for focused article consumption.

Do not turn this into a generic analytics dashboard. Keep the primary visual hierarchy editorial: title, summary, feed identity, publication time, and reading action first; technical statuses and endpoint details second.
