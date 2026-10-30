import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { normalizeSafeUrl, protectRequest } from "./security.js";
import { seedFeeds } from "./seed-data.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

export const popularFeeds = onRequest({ cors: true }, async (request, response) => {
  if (!(await protectRequest(request, response, "popular", 60))) return;
  if (request.method !== "GET") {
    response.status(405).set("Allow", "GET").send("Method not allowed");
    return;
  }

  // Popular feeds endpoint does not accept a user subscription list and does not increment counters
  let feeds: any[] = [];
  try {
    const snapshot = await db.collection("feeds").orderBy("livePopularityCount", "desc").limit(30).get();
    feeds = snapshot.empty
      ? seedFeeds.map((feed) => ({ ...feed, seededPopularityCount: 1, livePopularityCount: 0 }))
      : snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn("Firestore error in popularFeeds, using seed fallback:", (err as Error).message);
    feeds = seedFeeds.map((feed) => ({ ...feed, seededPopularityCount: 1, livePopularityCount: 0 }));
  }

  response.json({ feeds });
});

export const recommendations = onRequest({ cors: true }, async (request, response) => {
  if (!(await protectRequest(request, response, "recommendations", 60))) return;
  if (request.method !== "POST") {
    response.status(405).set("Allow", "POST").send("Method not allowed");
    return;
  }

  const rawUrls = request.body?.feedUrls;
  if (!Array.isArray(rawUrls)) {
    response.status(400).json({ error: "feedUrls array is required" });
    return;
  }
  if (rawUrls.length > 100) {
    response.status(400).json({ error: "At most 100 feed URLs are allowed" });
    return;
  }

  const urls = normalizeMany(rawUrls);
  const followed = new Set(urls);

  // 1. Fetch candidate feeds from the feeds collection (or fallback to seedFeeds)
  let candidateFeeds: Array<{
    url: string;
    name?: string;
    description?: string;
    seededPopularityCount?: number;
    livePopularityCount?: number;
  }> = [];

  try {
    const candidateSnapshot = await db.collection("feeds").orderBy("livePopularityCount", "desc").limit(100).get();
    candidateFeeds = candidateSnapshot.empty
      ? seedFeeds.map((feed) => ({
          url: feed.normalizedUrl,
          name: feed.name,
          description: feed.description,
          seededPopularityCount: 1,
          livePopularityCount: 0,
        }))
      : candidateSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              url: normalizeSafeUrl(data.normalizedUrl),
              name: typeof data.name === "string" ? data.name : undefined,
              description: typeof data.description === "string" ? data.description : undefined,
              seededPopularityCount: Number(data.seededPopularityCount ?? 0),
              livePopularityCount: Number(data.livePopularityCount ?? 0),
            };
          })
          .filter((f) => Boolean(f.url));
  } catch (err) {
    console.warn("Firestore error in recommendations candidates, using seed fallback:", (err as Error).message);
    candidateFeeds = seedFeeds.map((feed) => ({
      url: feed.normalizedUrl,
      name: feed.name,
      description: feed.description,
      seededPopularityCount: 1,
      livePopularityCount: 0,
    }));
  }

  // 2. Query co-subscription pairs from feedPairs for followed feeds
  const coScores = new Map<string, number>();
  if (urls.length > 0) {
    const chunkSize = 30;
    for (let i = 0; i < urls.length; i += chunkSize) {
      const chunk = urls.slice(i, i + chunkSize);
      try {
        const [snapA, snapB] = await Promise.all([
          db.collection("feedPairs").where("feedA", "in", chunk).get(),
          db.collection("feedPairs").where("feedB", "in", chunk).get(),
        ]);

        const processPair = (data: FirebaseFirestore.DocumentData) => {
          const liveCount = Number(data.liveCoSubscriptionCount ?? 0);
          const seededCount = Number(data.seededCoSubscriptionCount ?? 0);
          const weight = liveCount + seededCount;
          if (weight <= 0) return;

          const a = normalizeSafeUrl(data.feedA);
          const b = normalizeSafeUrl(data.feedB);
          if (followed.has(a) && !followed.has(b) && b) {
            coScores.set(b, (coScores.get(b) ?? 0) + weight);
          }
          if (followed.has(b) && !followed.has(a) && a) {
            coScores.set(a, (coScores.get(a) ?? 0) + weight);
          }
        };

        snapA.docs.forEach((doc) => processPair(doc.data()));
        snapB.docs.forEach((doc) => processPair(doc.data()));
      } catch (err) {
        console.warn("Firestore error in feedPairs query:", (err as Error).message);
      }
    }
  }

  // 3. Compute combined ranking score: coScore * 3 + popularity
  const feedMap = new Map<
    string,
    {
      url: string;
      name?: string;
      description?: string;
      score: number;
      reason: string;
      commonFollowers: number;
      liveSignals: number;
      seededSignals: number;
    }
  >();

  for (const candidate of candidateFeeds) {
    if (followed.has(candidate.url)) continue;
    const popularity = (candidate.livePopularityCount ?? 0) + (candidate.seededPopularityCount ?? 0);
    const co = coScores.get(candidate.url) ?? 0;
    const score = co * 3 + popularity;
    const reason =
      co > 0
        ? `Frequently read alongside your subscriptions (${co} common readers)`
        : "Aggregate popularity signal";
    feedMap.set(candidate.url, {
      url: candidate.url,
      name: candidate.name,
      description: candidate.description,
      score,
      reason,
      commonFollowers: co,
      liveSignals: candidate.livePopularityCount ?? 0,
      seededSignals: candidate.seededPopularityCount ?? 0,
    });
  }

  for (const [coUrl, co] of coScores.entries()) {
    if (followed.has(coUrl)) continue;
    if (!feedMap.has(coUrl)) {
      feedMap.set(coUrl, {
        url: coUrl,
        score: co * 3,
        reason: `Frequently read alongside your subscriptions (${co} common readers)`,
        commonFollowers: co,
        liveSignals: 0,
        seededSignals: 1,
      });
    }
  }

  const results = [...feedMap.values()]
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, 10);

  response.json({ feeds: results });
});

export const submitContribution = onRequest({ cors: true }, async (request, response) => {
  if (!(await protectRequest(request, response, "submit", 12))) return;
  if (request.method !== "POST") {
    response.status(405).set("Allow", "POST").send("Method not allowed");
    return;
  }

  const requestId = typeof request.body?.requestId === "string" ? request.body.requestId.trim() : "";
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
    response.status(400).json({ error: "A valid requestId (16-80 alphanumeric characters) is required" });
    return;
  }

  const rawUrls = request.body?.feedUrls;
  if (!Array.isArray(rawUrls) || rawUrls.length === 0 || rawUrls.length > 20) {
    response.status(400).json({ error: "Between 1 and 20 feed URLs are required" });
    return;
  }

  // Validate every URL strictly - reject if any URL is invalid
  const validUrls: string[] = [];
  for (const raw of rawUrls) {
    const normalized = normalizeSafeUrl(raw);
    if (!normalized) {
      response.status(400).json({ error: `Invalid, private, or credential-bearing feed URL: ${String(raw)}` });
      return;
    }
    validUrls.push(normalized);
  }

  // Deduplicate within the batch
  const urls = [...new Set(validUrls)];

  const receipt = db.collection("submissionReceipts").doc(requestId);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(receipt);
    if (existing.exists) {
      // Idempotency: repeated requests with same requestId do not increment counters
      return;
    }

    // Increment individual feed popularity counters
    for (const url of urls) {
      transaction.set(
        db.collection("feeds").doc(feedId(url)),
        { normalizedUrl: url, livePopularityCount: FieldValue.increment(1) },
        { merge: true },
      );
    }

    // Increment pair counters for every unique pair in batch
    const pairs = pairUrls(urls);
    for (const [a, b] of pairs) {
      transaction.set(
        db.collection("feedPairs").doc(pairId(a, b)),
        { feedA: a, feedB: b, liveCoSubscriptionCount: FieldValue.increment(1) },
        { merge: true },
      );
    }

    // Store idempotency receipt with 7-day expiry
    transaction.create(receipt, {
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Date.now() + 7 * 86_400_000,
    });
  });

  response.json({ accepted: true, requestId });
});

export function normalizeMany(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeSafeUrl).filter(Boolean))];
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
