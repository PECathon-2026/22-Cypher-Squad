import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { seedFeeds, seedPairs } from "./seed-data.js";
import { normalizeSafeUrl } from "./security.js";

export type FeedRecord = {
  id: string;
  name: string;
  normalizedUrl: string;
  description: string;
  category?: string;
  seededPopularityCount: number;
  livePopularityCount: number;
};

export type RecommendationItem = {
  url: string;
  name?: string;
  description?: string;
  category?: string;
  score: number;
  reason: string;
  commonFollowers: number;
  overlapFeeds: string[];
  liveSignals: number;
  seededSignals: number;
  popularity: number;
};

// In-memory backing store for local testing, demo mode, and offline/standalone resilience
const testFeeds = new Map<string, FeedRecord>();
const testPairs = new Map<string, { feedA: string; feedB: string; count: number }>();
const testReceipts = new Set<string>();

// Pre-populate seed feeds
for (const seed of seedFeeds) {
  const id = feedId(seed.normalizedUrl);
  testFeeds.set(id, {
    id,
    name: seed.name,
    normalizedUrl: seed.normalizedUrl,
    description: seed.description,
    category: seed.category,
    seededPopularityCount: 1,
    livePopularityCount: 0,
  });
}

// Pre-populate co-subscription network from seedPairs
for (const pair of seedPairs) {
  const id = pairId(pair.feedA, pair.feedB);
  testPairs.set(id, {
    feedA: pair.feedA,
    feedB: pair.feedB,
    count: pair.count,
  });
}

function useTestStore(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  return !process.env.FIREBASE_PROJECT_ID;
}

function getDb(): Firestore | null {
  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (projectId && clientEmail && privateKey) {
        initializeApp({
          credential: cert({ projectId, clientEmail, privateKey }),
        });
      } else if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_CONFIG) {
        initializeApp();
      } else {
        return null;
      }
    }
    return getFirestore();
  } catch {
    return null;
  }
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

export async function getPopularFeedsList(): Promise<FeedRecord[]> {
  const db = useTestStore() ? null : getDb();

  if (!db) {
    return [...testFeeds.values()]
      .sort(
        (a, b) =>
          b.livePopularityCount +
          b.seededPopularityCount -
          (a.livePopularityCount + a.seededPopularityCount),
      )
      .slice(0, 30);
  }

  try {
    const snapshot = await db.collection("feeds").get();
    const feeds = new Map<string, FeedRecord>();

    for (const seed of seedFeeds) {
      const id = feedId(seed.normalizedUrl);
      feeds.set(id, {
        id,
        name: seed.name,
        normalizedUrl: seed.normalizedUrl,
        description: seed.description,
        category: seed.category,
        seededPopularityCount: 1,
        livePopularityCount: 0,
      });
    }

    for (const document of snapshot.docs) {
      const data = document.data() as Partial<FeedRecord>;
      if (typeof data.normalizedUrl !== "string") continue;
      feeds.set(document.id, {
        id: document.id,
        name: data.name || new URL(data.normalizedUrl).hostname,
        normalizedUrl: data.normalizedUrl,
        description: data.description || "",
        category: data.category,
        seededPopularityCount: data.seededPopularityCount ?? 0,
        livePopularityCount: data.livePopularityCount ?? 0,
      });
    }

    return [...feeds.values()]
      .sort(
        (a, b) =>
          b.livePopularityCount +
          b.seededPopularityCount -
          (a.livePopularityCount + a.seededPopularityCount),
      )
      .slice(0, 30);
  } catch (err) {
    console.warn("Firestore access error, falling back to in-memory store:", (err as Error).message);
    return [...testFeeds.values()]
      .sort(
        (a, b) =>
          b.livePopularityCount +
          b.seededPopularityCount -
          (a.livePopularityCount + a.seededPopularityCount),
      )
      .slice(0, 30);
  }
}

export async function getRecommendationsList(
  followedUrls: string[],
  contextFeed?: string,
): Promise<RecommendationItem[]> {
  const followed = new Set(followedUrls.map(normalizeSafeUrl).filter(Boolean));
  const normalizedContext = contextFeed ? normalizeSafeUrl(contextFeed) : undefined;
  const coScores = new Map<string, number>();
  const overlapMap = new Map<string, string[]>();
  const feeds = await getPopularFeedsList();

  const feedNameMap = new Map<string, string>();
  for (const feed of feeds) {
    feedNameMap.set(feed.normalizedUrl, feed.name);
  }

  let pairs: Array<{ feedA?: string; feedB?: string; count?: number; liveCoSubscriptionCount?: number; seededCoSubscriptionCount?: number }> = [];
  const db = useTestStore() ? null : getDb();

  if (!db) {
    pairs = [...testPairs.values()];
  } else {
    try {
      const snapshot = await db.collection("feedPairs").get();
      pairs = snapshot.docs.map((document) => document.data());
      // Also combine in-memory seedPairs if db collection is empty
      if (pairs.length === 0) {
        pairs = [...testPairs.values()];
      }
    } catch {
      pairs = [...testPairs.values()];
    }
  }

  const querySet = normalizedContext ? new Set([normalizedContext]) : followed;

  for (const pair of pairs) {
    const a = normalizeSafeUrl(pair.feedA);
    const b = normalizeSafeUrl(pair.feedB);
    const weight =
      Number(pair.count ?? pair.liveCoSubscriptionCount ?? 0) +
      Number(pair.seededCoSubscriptionCount ?? 0);
    if (weight <= 0) continue;

    if (querySet.has(a) && !followed.has(b) && b) {
      coScores.set(b, (coScores.get(b) ?? 0) + weight);
      const list = overlapMap.get(b) ?? [];
      const name = feedNameMap.get(a) || (a ? new URL(a).hostname : "");
      if (name && !list.includes(name)) list.push(name);
      overlapMap.set(b, list);
    }
    if (querySet.has(b) && !followed.has(a) && a) {
      coScores.set(a, (coScores.get(a) ?? 0) + weight);
      const list = overlapMap.get(a) ?? [];
      const name = feedNameMap.get(b) || (b ? new URL(b).hostname : "");
      if (name && !list.includes(name)) list.push(name);
      overlapMap.set(a, list);
    }
  }

  const results: RecommendationItem[] = [];

  for (const feed of feeds) {
    if (followed.has(feed.normalizedUrl)) continue;
    const popularity = feed.livePopularityCount + feed.seededPopularityCount;
    const co = coScores.get(feed.normalizedUrl) ?? 0;
    const overlapping = overlapMap.get(feed.normalizedUrl) ?? [];

    if (normalizedContext && co === 0) continue;

    const score = co * 3 + popularity;
    const reason = normalizedContext
      ? `Frequently co-subscribed with this blog (${co} common reader${co === 1 ? "" : "s"})`
      : co > 0
        ? `Frequently read alongside ${overlapping.slice(0, 2).join(" & ")}${overlapping.length > 2 ? ` (+${overlapping.length - 2} more)` : ""} (${co} common reader${co === 1 ? "" : "s"})`
        : "Surfaced from aggregate reader popularity";

    results.push({
      url: feed.normalizedUrl,
      name: feed.name,
      description: feed.description,
      category: feed.category,
      score,
      reason,
      commonFollowers: co,
      overlapFeeds: overlapping,
      liveSignals: feed.livePopularityCount,
      seededSignals: feed.seededPopularityCount,
      popularity,
    });
  }

  if (normalizedContext && results.length === 0) {
    for (const feed of feeds) {
      if (followed.has(feed.normalizedUrl)) continue;
      const popularity = feed.livePopularityCount + feed.seededPopularityCount;
      results.push({
        url: feed.normalizedUrl,
        name: feed.name,
        description: feed.description,
        category: feed.category,
        score: popularity,
        reason: "Suggested independent blog",
        commonFollowers: 0,
        overlapFeeds: [],
        liveSignals: feed.livePopularityCount,
        seededSignals: feed.seededPopularityCount,
        popularity,
      });
    }
  }

  const limit = normalizedContext ? 5 : 10;
  return results.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url)).slice(0, limit);
}

export async function recordBatchContribution(
  requestId: string,
  rawUrls: string[],
): Promise<{ accepted: boolean; requestId: string; duplicate?: boolean }> {
  const validUrls = [...new Set(rawUrls.map(normalizeSafeUrl).filter(Boolean))];

  // In-memory update
  if (testReceipts.has(requestId)) {
    return { accepted: true, requestId, duplicate: true };
  }

  for (const url of validUrls) {
    const id = feedId(url);
    const seed = seedFeeds.find((candidate) => candidate.normalizedUrl === url);
    const existing = testFeeds.get(id);
    if (existing) {
      existing.livePopularityCount += 1;
    } else {
      testFeeds.set(id, {
        id,
        name: seed?.name ?? new URL(url).hostname,
        normalizedUrl: url,
        description: seed?.description ?? "",
        category: seed?.category,
        seededPopularityCount: seed ? 1 : 0,
        livePopularityCount: 1,
      });
    }
  }

  for (const [a, b] of pairUrls(validUrls)) {
    const id = pairId(a, b);
    const existing = testPairs.get(id);
    if (existing) {
      existing.count += 1;
    } else {
      testPairs.set(id, { feedA: a, feedB: b, count: 1 });
    }
  }

  testReceipts.add(requestId);

  // Firestore update if available
  const db = useTestStore() ? null : getDb();
  if (db) {
    try {
      await db.runTransaction(async (transaction) => {
        const receiptRef = db.collection("contributionReceipts").doc(requestId);
        const receipt = await transaction.get(receiptRef);
        if (receipt.exists) return;

        for (const url of validUrls) {
          const id = feedId(url);
          const feedRef = db.collection("feeds").doc(id);
          const seed = seedFeeds.find((candidate) => candidate.normalizedUrl === url);
          transaction.set(
            feedRef,
            {
              id,
              name: seed?.name ?? new URL(url).hostname,
              normalizedUrl: url,
              description: seed?.description ?? "",
              category: seed?.category ?? "General",
              seededPopularityCount: seed ? 1 : 0,
              livePopularityCount: FieldValue.increment(1),
            },
            { merge: true },
          );
        }

        for (const [a, b] of pairUrls(validUrls)) {
          transaction.set(
            db.collection("feedPairs").doc(pairId(a, b)),
            {
              feedA: a,
              feedB: b,
              count: FieldValue.increment(1),
              liveCoSubscriptionCount: FieldValue.increment(1),
            },
            { merge: true },
          );
        }

        transaction.create(receiptRef, {
          requestId,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (err) {
      console.warn("Firestore batch contribution error (handled in-memory):", (err as Error).message);
    }
  }

  return { accepted: true, requestId };
}
