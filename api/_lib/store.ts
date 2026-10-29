import { createHash } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
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

const testFeeds = new Map<string, FeedRecord>();
const testPairs = new Map<string, { feedA: string; feedB: string; count: number }>();
const testReceipts = new Set<string>();

for (const seed of seedFeeds) {
  const id = feedId(seed.normalizedUrl);
  testFeeds.set(id, {
    id,
    name: seed.name,
    normalizedUrl: seed.normalizedUrl,
    description: seed.description,
    seededPopularityCount: 1,
    livePopularityCount: 0,
  });
}

function useTestStore() {
  return process.env.NODE_ENV === "test";
}

function getDb() {
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
      throw new Error(
        "Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
      );
    }
  }

  return getFirestore();
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

export async function getPopularFeedsList() {
  if (useTestStore()) {
    return [...testFeeds.values()]
      .sort((a, b) => (b.livePopularityCount + b.seededPopularityCount) - (a.livePopularityCount + a.seededPopularityCount))
      .slice(0, 30);
  }

  const snapshot = await getDb().collection("feeds").get();
  const feeds = new Map<string, FeedRecord>();

  for (const seed of seedFeeds) {
    const id = feedId(seed.normalizedUrl);
    feeds.set(id, {
      id,
      name: seed.name,
      normalizedUrl: seed.normalizedUrl,
      description: seed.description,
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
      seededPopularityCount: data.seededPopularityCount ?? 0,
      livePopularityCount: data.livePopularityCount ?? 0,
    });
  }

  return [...feeds.values()]
    .sort((a, b) => (b.livePopularityCount + b.seededPopularityCount) - (a.livePopularityCount + a.seededPopularityCount))
    .slice(0, 30);
}

export async function getRecommendationsList(followedUrls: string[]) {
  const followed = new Set(followedUrls.map(normalizeSafeUrl).filter(Boolean));
  const coScores = new Map<string, number>();
  const feeds = await getPopularFeedsList();

  const pairs = useTestStore()
    ? [...testPairs.values()]
    : (await getDb().collection("feedPairs").get()).docs.map((document) => document.data() as {
        feedA?: string;
        feedB?: string;
        count?: number;
      });

  for (const pair of pairs) {
    const a = normalizeSafeUrl(pair.feedA);
    const b = normalizeSafeUrl(pair.feedB);
    if (followed.has(a) && !followed.has(b) && b) {
      coScores.set(b, (coScores.get(b) ?? 0) + (pair.count ?? 0));
    }
    if (followed.has(b) && !followed.has(a) && a) {
      coScores.set(a, (coScores.get(a) ?? 0) + (pair.count ?? 0));
    }
  }

  const results: Array<{ url: string; name?: string; description?: string; score: number; reason: string }> = [];

  for (const feed of feeds) {
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

export async function recordBatchContribution(
  requestId: string,
  rawUrls: string[],
): Promise<{ accepted: boolean; requestId: string }> {
  const validUrls = [...new Set(rawUrls.map(normalizeSafeUrl).filter(Boolean))];
  if (useTestStore()) {
    if (testReceipts.has(requestId)) return { accepted: true, requestId };

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
          seededPopularityCount: seed ? 1 : 0,
          livePopularityCount: 1,
        });
      }
    }

    for (const [a, b] of pairUrls(validUrls)) {
      const id = pairId(a, b);
      const existing = testPairs.get(id);
      if (existing) existing.count += 1;
      else testPairs.set(id, { feedA: a, feedB: b, count: 1 });
    }

    testReceipts.add(requestId);
    return { accepted: true, requestId };
  }

  const db = getDb();

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
        },
        { merge: true },
      );
    }

    transaction.create(receiptRef, {
      requestId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { accepted: true, requestId };
}
