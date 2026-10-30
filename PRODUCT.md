# Small Web Reader — Product Specification & Truth

## 1. Vision & Purpose
Small Web Reader (PS-003) is a quiet, local-first RSS and Atom reader designed for readers who want an intentional, unhurried reading queue rather than an algorithmic, high-urgency engagement feed. It couples direct feed subscriptions with a privacy-preserving discovery mechanism based on aggregate co-subscription patterns across independent blogs, completely eliminating tracking, accounts, and personal reading profiles.

---

## 2. Target Audience & Core Jobs
- **The Independent Web Reader**: Reads essays, developer field notes, independent journals, and niche publications without algorithmic distraction or advertisement clutter.
- **The Privacy-Conscious User**: Demands that reading habits, viewed articles, subscription lists, and reading history never leave their local device.
- **The Commuter / Offline Reader**: Needs reliable offline reading where feed items and extracted full-text articles remain available without an active internet connection.

---

## 3. Core Capabilities & Mechanics

### A. The Reading Queue (Timeline `/`)
- Displays all saved posts chronologically (unread items first, followed by newest published).
- Local filtering by feed source and unread status.
- Immediate offline access to cached posts from IndexedDB.
- Visual state degradation for read posts (reduced opacity, check indicators).

### B. Feed Management (Subscriptions `/subscriptions`)
- Device-local subscription registry.
- Autodiscovery support across website URLs, `<link rel="alternate">`, and standard paths (`/feed`, `/feed.xml`, `/rss.xml`, `/atom.xml`).
- Comprehensive resilience handling for feed health states:
  - `synced`: Healthy update.
  - `attention`: Warning, timeout, or using cached fallback.
  - `empty`: Valid XML with no items.
  - `offline`: Network unreachable, serving local cache.
  - `malformed`: Unparseable XML syntax.
  - `access-challenge`: Cloudflare/bot challenge or 403.

### C. Full-Text Focused Reader (`/read?post=<id>`)
- Distraction-free editorial reading surface.
- Browser-side Readability extraction with DOMPurify sanitization.
- Graceful fallbacks: Extracted HTML → Feed content HTML → Plain summary fallback.
- Contextual related blog discovery at the foot of articles based on co-subscription graph edges.

### D. Anonymous Discovery & Contribution (`/discover`)
- **Zero Accounts, Zero Reader IDs**: No user accounts or cookies.
- **Private by Default**: Only popular aggregate feeds shown until personalized discovery is explicitly enabled.
- **Transient Evaluation**: When enabled, candidate feed URLs are sent transiently for ranking against aggregate popularity and co-subscription pairs, immediately discarded server-side.
- **Explicit Contribution**: Users may voluntarily contribute up to 20 subscribed feeds in an anonymous batch to strengthen aggregate co-subscription graphs.
- **Integrity & Abuse Resistance**: Rate-limited submissions, HMAC request receipts, URL normalization, and SSRF boundary defense.

### E. Settings & Preferences (`/settings`)
- Instant cache management (Clear cache, retention policies: 100 posts/feed, 200 article bodies).
- Explicit discovery opt-in/opt-out toggles.
- Transparent architectural explanations of local-first boundaries.

---

## 4. Platform & Technical Boundaries
- **Runtime**: Web (Desktop & Mobile Responsive PWA).
- **Client**: React 19 + TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), DOMPurify, Mozilla Readability.
- **Serverless API**: Vercel Serverless Functions / Firebase Cloud Functions (`/api/fetch`, `/api/discovery/popular`, `/api/discovery/recommendations`, `/api/discovery/submit`).
- **Persistence**: Server-side Cloud Firestore for aggregate counts only; browser-side IndexedDB for all user data.
