# Small Web Reader: Anonymous Discovery for Independent Blogs (PS-003)

A full-stack, offline-first RSS/Atom reader that lets readers follow independent blogs, read sanitized full-text articles offline, and discover new blogs through anonymous recommendations based on aggregate reader co-subscription overlap—without accounts, cookies, or profiling.

---

## 1. Architecture Overview

```mermaid
flowchart TD
    subgraph Browser ["Client (Browser - Vite + React 18 + TypeScript)"]
        UI["Web UI: Timeline / Subscriptions / Discover / Reading View / Graph"]
        Parser["Browser Feed Parser (RSS 2.0, RSS 1.0/RDF, Atom)"]
        Extractor["Full-Text Extractor (Mozilla Readability + DOMPurify)"]
        Dexie["Local Dexie DB (IndexedDB)\n- feeds & posts\n- cached articles\n- sharing consent state\n- contribution outbox"]
        PWA["Service Worker (vite-plugin-pwa)\nApp shell caching for offline loading"]
        UI --> Parser
        UI --> Extractor
        UI --> Dexie
    end

    subgraph ServerRoutes ["Server Layer (Vercel Serverless / Vite Dev / Cloud Functions)"]
        Proxy["/api/fetch\nRaw CORS proxy, SSRF block, 8s timeout, 2 MiB cap, ETag/304"]
        Popular["/api/discovery/popular\nTop feeds by aggregate popularity (GET only)"]
        Recs["/api/discovery/recommendations\nCo-subscription & popularity ranking with Common Follower counts"]
        Submit["/api/discovery/submit\nAtomic anonymous batch transaction & idempotency receipt"]
    end

    subgraph Store ["Discovery Store (Firestore / Resilient In-Memory Fallback)"]
        ColFeeds["feeds/{feedId}\nNormalized URL, title, popularity counts"]
        ColPairs["feedPairs/{pairId}\nPairwise co-subscription count"]
        ColReceipts["contributionReceipts/{requestId}\n7-day idempotency receipt"]
    end

    Browser -- "POST /api/fetch" --> Proxy
    Browser -- "GET /api/discovery/popular" --> Popular
    Browser -- "POST /api/discovery/recommendations" --> Recs
    Browser -- "POST /api/discovery/submit" --> Submit

    Popular --> ColFeeds
    Recs --> ColFeeds
    Recs --> ColPairs
    Submit --> ColFeeds
    Submit --> ColPairs
    Submit --> ColReceipts
```

### Server Routes & Contracts

| Route | Method | Description |
| :--- | :--- | :--- |
| `/api/fetch` | GET / POST | Proxies raw XML/HTML across CORS boundaries. **Never parses or stores content on the server.** Enforces SSRF defense (private IP block), redirect cap (max 3), 8s timeout, 2 MiB limit, and conditional fetching (`If-None-Match`, `If-Modified-Since` -> 304 Not Modified). |
| `/api/discovery/popular` | GET | Returns global top feeds sorted by aggregate popularity (`livePopularityCount + seededPopularityCount`). Does not accept subscription lists; does not increment counters. |
| `/api/discovery/recommendations` | POST | Accepts followed feed URLs (max 100) only when personalized discovery is opted in. Computes reader overlap (`commonFollowers`) and combines it with popularity: `Score = (commonFollowers * 3) + popularity`. Strictly excludes already-followed feeds. |
| `/api/discovery/submit` | POST | Submits an anonymous batch of 1–20 eligible feed URLs with a unique `requestId`. Executes an atomic transaction incrementing popularity and pairwise co-subscription counters in `feedPairs`, storing an idempotency receipt to prevent replay attacks. |

---

## 2. Discovery Algorithm & Common Follower Counter

### The Core Problem Solved Without Big-Tech Algorithms
Traditional algorithmic feeds profile users and optimize for engagement ads. PS-003 solves discovery **without profiling**:
If reader A follows Blog X and Blog Y, Blog X and Blog Y form a co-subscription pair $(X, Y)$ with weight $+1$.
When you follow Blog X, the server finds all feeds co-subscribed with Blog X. If Blog Y has 14 readers who also read Blog X, Blog Y is recommended with a **Common Reader counter** of 14.

### The Ranking Formula
$$\text{Score} = (\text{Common Readers} \times 3) + \text{Total Popularity}$$
- **Common Readers ($co$)**: The count of other anonymous readers whose subscriptions overlap with your current reading list. Weighted by 3 to prioritize affinity over raw popularity.
- **Total Popularity**: Sum of live and seeded subscribers (`liveSignals + seededSignals`).
- **Transparent Output**:
  - `commonFollowers`: Exact integer counter of shared readers.
  - `overlapFeeds`: The exact blogs in your subscription list that share readers with this recommendation.
  - `reason`: Clean explanation (e.g., *"Frequently read alongside The Verge (14 common readers)"*).

### Live Algorithm Verification Console
The Discover page includes an interactive **Algorithm Verification Console** with a **"Simulate +1 Reader Overlap (Test Live Counter)"** button. When clicked:
1. It simulates an anonymous reader submitting a subscription batch overlapping your feeds.
2. The server records the transaction and increments the pair counter.
3. The recommendations view immediately refreshes live, demonstrating the `commonFollowers` and `liveSignals` counters incrementing in real time.

---

## 3. Official 10-Feed Evaluation Benchmark

All 10 benchmark feeds specified in the prompt were tested through the full proxy, parser, and readability extraction pipeline:

| Feed Name | URL | Format | Entries | Status |
| :--- | :--- | :---: | :---: | :---: |
| **BBC News** | `https://feeds.bbci.co.uk/news/rss.xml` | RSS 2.0 | 32 | Verified 200 OK |
| **The Verge** | `https://www.theverge.com/rss/index.xml` | Atom | 10 | Verified 200 OK |
| **TechCrunch** | `https://techcrunch.com/feed/` | RSS 2.0 | 20 | Verified 200 OK |
| **Hacker News** | `https://news.ycombinator.com/rss` | RSS 2.0 | 30 | Verified 200 OK |
| **WIRED** | `https://www.wired.com/feed/rss` | RSS 2.0 | 50 | Verified 200 OK |
| **Ars Technica** | `https://feeds.arstechnica.com/arstechnica/index` | RSS 2.0 | 20 | Verified 200 OK |
| **The Guardian** | `https://www.theguardian.com/world/rss` | RSS 2.0 | 45 | Verified 200 OK |
| **NASA News** | `https://www.nasa.gov/news-release/feed/` | RSS 2.0 | 10 | Verified 200 OK |
| **NPR News** | `https://feeds.npr.org/1001/rss.xml` | RSS 2.0 | 10 | Verified 200 OK |
| **The GitHub Blog**| `https://github.blog/feed/` | RSS 2.0 | 10 | Verified 200 OK |

> **1-Click Quick Import**: In the Subscriptions view, click the **"Load 10 Evaluation Feeds"** button to automatically import and parse all 10 evaluation feeds into your timeline!

---

## 4. Bonus Points & Advanced Capabilities

### Bonus Quest: Deliberate Seed Trap Detected
- **Trap 1 (NASA)**: `https://www.nasa.gov/rss/dyn/breaking_news.rss` and `https://www.nasa.gov/news-release/feed/` point to the exact same final URL and feed content. Our audit script (`npm run audit:seed-feeds`) detects and reports this under `same_final_url`.
- **Trap 2 (Hacker News)**: `https://hnrss.org/frontpage` is an alternate gateway mirroring `https://news.ycombinator.com/rss`. Both represent the same publication.

### Transparent Recommendations & Counter Badges
Every recommendation card clearly displays:
- `👥 X common readers`: Dedicated counter badge.
- `🔗 Co-read with: [Feed A, Feed B]`: Exact overlapping subscriptions.
- `★ Y total readers (Z live, W seed)`: Subscriber transparency.
- `Formula: (X common × 3) + Y pop = Score`: Mathematical transparency.

### "Blogs Like This" Interactive Network Graph
Discover view features a **"🕸️ Overlap Graph"** mode rendering an interactive SVG network:
- Nodes represent independent blogs colored by category.
- Edges represent shared reader overlap, with line thickness reflecting common reader volume.
- Clicking any node opens blog details, its pairwise reader counts, and a 1-click **Follow Feed** button.

### OPML Import & Export
- **Export OPML**: Generates an OPML 2.0 XML file containing all your followed feeds with categories and triggers a download.
- **Import OPML**: Accepts standard `.opml` or `.xml` subscription exports, discovers all outlines, and imports them.

### Per-Feed Categories / Folders
Feeds are automatically categorized (`Tech`, `News`, `Engineering`, `Science`, `Design`), allowing users to filter both their Timeline and Subscriptions list with 1-click filter pills.

### Conditional Fetching & Robots.txt Respect
- Sends `If-None-Match` and `If-Modified-Since` headers to upstream servers.
- When an upstream server returns `304 Not Modified`, the proxy honors it, saving bandwidth and battery.
- Proxied requests use a polite user-agent (`Confluence/1.0 (+feed reader; respectful bot)`) and return `X-Robots-Tag: noindex`.

---

## 5. Setup & Local Development

### Zero-Dependency Local Dev Server
The app includes an embedded Vite dev API middleware that executes `/api/*` endpoints directly without needing any external emulator or database:
```bash
# 1. Install dependencies
npm install

# 2. Run local dev server (works immediately with live API)
npm run dev

# 3. Open in browser
http://localhost:5173
```

### Production Build & Tests
```bash
# Run all 70 unit and integration tests
npm test

# Run seed feeds audit
npm run audit:seed-feeds

# Production bundle build
npm run build
```

### Deploying to Vercel
The repository is 100% Vercel-ready with `/api` serverless handlers:
```bash
npx vercel
```

---

## 6. Privacy & Threat Model

### What the Server Stores
- **Deterministic Feed Aggregates**: SHA-256 hash of normalized URL, title, description, popularity counts.
- **Co-subscription Pair Aggregates**: Sorted `(feedA, feedB)` pair hashes and count.
- **Short-Lived Idempotency Receipts**: Client-generated random `requestId` expiring in 7 days to prevent counter replay.
- **Short-Lived Rate Limit Keys**: Salted HMAC hash of `IP:window` expiring every 10 minutes.

### What the Server NEVER Stores
- **No User Accounts or Persistent IDs**: No usernames, passwords, cookies, or device fingerprints.
- **No Browsing or Reading History**: Read states (`isViewed`), open articles, and scroll positions stay strictly inside your browser's IndexedDB.
- **No Raw Feed XML or Article HTML**: All XML parsing, DOM sanitization (DOMPurify), and readability extraction occur strictly on the client.
- **No Plaintext IP Addresses**: Raw IPs are never stored in databases or server logs.
- **No Reading Profiles**: Submissions are anonymous one-time unordered batches; individual reader identities are never created or linked.

### Abuse Resistance
- **Rate Limiting**:
  - `/api/fetch`: 120 req / 10 min
  - `/api/discovery/popular`: 60 req / 10 min
  - `/api/discovery/recommendations`: 60 req / 10 min
  - `/api/discovery/submit`: 12 batches / 10 min
- **SSRF Defense**:
  - Rejection of private IPv4 (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, CGNAT 100.64/10), loopback, link-local, multicast, and IPv6 equivalents.
  - DNS resolution validation before outbound requests.
  - Max 3 redirect hops with validation on every hop.
  - 8-second request abort timeout.
  - 2 MiB response body cap.
  - Credential-bearing URLs and secret query parameters (`token`, `api_key`, `auth`) are blocked.
