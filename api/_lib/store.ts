import { createHash } from "node:crypto";
import { seedFeeds } from "./seed-data.js";
import { normalizeSafeUrl } from "./security.js";

type FeedRecord = {
  id: string;
  name: string;
  normalizedUrl: string;
  description: string;
  seededPopularityCount: number;
  livePopularityCount: number;
};

// In-memory persistent state within serverless lifecycle
const liveFeeds = new Map<string, FeedRecord>();
const livePairs = new Map<string, { feedA: string; feedB: string; count: number }>();
const submissionReceipts = new Set<string>();

// Initialize with seed data
for (const seed of seedFeeds) {
  const id = feedId(seed.normalizedUrl);
  liveFeeds.set(id, {
    id,
    name: seed.name,
    normalizedUrl: seed.normalizedUrl,
    description: seed.description,
    seededPopularityCount: 1,
    livePopularityCount: 0,
  });
}

export function feedId(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export function pairId(a: string, b: string): string {
  const [first, second] = [feedId(a), feedId(b)].sort();
  return `${first}_${second}`;
}

export function pairUrls(urls: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < urls.length; i += 1) {
    for (let j = i + 1; j < urls.length; j += 1) {
      const [first, second] = [urls[i], urls[j]].sort();
      pairs.push([first, second]);
    }
  }
  return pairs;
}

export function getPopularFeedsList() {
  return [...liveFeeds.values()]
    .sort((a, b) => (b.livePopularityCount + b.seededPopularityCount) - (a.livePopularityCount + a.seededPopularityCount))
    .slice(0, 30);
}

export function getRecommendationsList(followedUrls: string[]) {
  const followed = new Set(followedUrls.map(normalizeSafeUrl).filter(Boolean));
  const coScores = new Map<string, number>();

  // Tally co-subscription hits from live pairs
  for (const pair of livePairs.values()) {
    const a = normalizeSafeUrl(pair.feedA);
    const b = normalizeSafeUrl(pair.feedB);
    if (followed.has(a) && !followed.has(b) && b) {
      coScores.set(b, (coScores.get(b) ?? 0) + pair.count);
    }
    if (followed.has(b) && !followed.has(a) && a) {
      coScores.set(a, (coScores.get(a) ?? 0) + pair.count);
    }
  }

  const results: Array<{ url: string; name?: string; description?: string; score: number; reason: string }> = [];

  for (const feed of liveFeeds.values()) {
    if (followed.has(feed.normalizedUrl)) continue;
    const popularity = feed.livePopularityCount + feed.seededPopularityCount;
    const co = coScores.get(feed.normalizedUrl) ?? 0;
    const score = co * 3 + popularity;
    const reason = co > 0 ? "Frequently read alongside your subscriptions" : "Aggregate popularity signal";
    results.push({
      url: feed.normalizedUrl,
      name: feed.name,
      description: feed.description,
      score,
      reason,
    });
  }

  return results.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, 10);
}

export function recordBatchContribution(requestId: string, rawUrls: string[]): { accepted: boolean; requestId: string } {
  // Idempotency: if request was already processed, return immediately without re-incrementing
  if (submissionReceipts.has(requestId)) {
    return { accepted: true, requestId };
  }

  const validUrls = [...new Set(rawUrls.map(normalizeSafeUrl).filter(Boolean))];

  // Increment individual feed counters
  for (const url of validUrls) {
    const id = feedId(url);
    const existing = liveFeeds.get(id);
    if (existing) {
      existing.livePopularityCount += 1;
    } else {
      liveFeeds.set(id, {
        id,
        name: new URL(url).hostname,
        normalizedUrl: url,
        description: "",
        seededPopularityCount: 0,
        livePopularityCount: 1,
      });
    }
  }

  // Increment pair co-subscription counters
  const pairs = pairUrls(validUrls);
  for (const [a, b] of pairs) {
    const id = pairId(a, b);
    const existing = livePairs.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      livePairs.set(id, { feedA: a, feedB: b, count: 1 });
    }
  }

  submissionReceipts.add(requestId);
  return { accepted: true, requestId };
}
