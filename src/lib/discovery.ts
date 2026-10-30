import { appCheckHeaders } from "./app-check";
import { readerDb, type ContributionRecord } from "./db";
import { seedFeeds } from "../data/seeds";

export type DiscoveryFeedItem = {
  url: string;
  name?: string;
  description?: string;
  category?: string;
  score?: number;
  reason?: string;
  commonFollowers?: number;
  overlapFeeds?: string[];
  liveSignals?: number;
  seededSignals?: number;
  popularity?: number;
  livePopularityCount?: number;
  seededPopularityCount?: number;
};

export function getFallbackSeedFeeds(followedUrls: Set<string>): DiscoveryFeedItem[] {
  return seedFeeds
    .filter((feed) => !followedUrls.has(feed.url))
    .map((feed) => ({
      url: feed.url,
      name: feed.name,
      description: feed.description,
      category: feed.category,
      score: 1,
      reason: "Curated independent blog recommended for discovery",
      seededSignals: 1,
      liveSignals: 0,
      seededPopularityCount: 1,
      livePopularityCount: 0,
    }));
}

const SECRET_PATTERN = /^(token|secret|api_?key|auth(?:_?token)?|password|signature|sig)$/i;

function safeUrls(feedUrls: string[]): string[] {
  return [
    ...new Set(
      feedUrls.filter((value) => {
        try {
          const url = new URL(value);
          return (
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            (!url.port || ["80", "443"].includes(url.port)) &&
            ![...url.searchParams.keys()].some((key) => SECRET_PATTERN.test(key))
          );
        } catch {
          return false;
        }
      }),
    ),
  ];
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = { ...(init?.headers ?? {}), ...(await appCheckHeaders()) };
  return fetch(path, { ...init, headers });
}

export async function getPopularFeeds(): Promise<DiscoveryFeedItem[]> {
  const response = await request("/api/discovery/popular");
  if (!response.ok) throw new Error(`Popular feeds request failed with HTTP ${response.status}.`);
  return (await response.json()).feeds as DiscoveryFeedItem[];
}

export async function getRecommendations(feedUrls: string[], contextFeed?: string): Promise<DiscoveryFeedItem[]> {
  const response = await request("/api/discovery/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      feedUrls: safeUrls(feedUrls).slice(0, 100),
      contextFeed: contextFeed ? safeUrls([contextFeed])[0] : undefined,
    }),
  });
  if (!response.ok) throw new Error(`Recommendations request failed with HTTP ${response.status}.`);
  return (await response.json()).feeds as DiscoveryFeedItem[];
}

export async function submitContribution(feedUrls: string[]): Promise<void> {
  const requestId = crypto.randomUUID().replaceAll("-", "");
  const record: ContributionRecord = {
    requestId,
    feedUrls: safeUrls(feedUrls).slice(0, 20),
    createdAt: new Date().toISOString(),
    status: "queued",
  };
  if (!record.feedUrls.length) throw new Error("No eligible feed URLs were selected.");
  await readerDb.outbox.put(record);
  await flushContributionOutbox();
}

let isFlushing = false;

export async function flushContributionOutbox(): Promise<void> {
  if (isFlushing) return;
  isFlushing = true;
  try {
    const state = await readerDb.sharingState.get("discovery");
    if (!state?.enabled) {
      // If user opted out or not enabled, discard queued contributions
      await readerDb.outbox.where("status").equals("queued").delete();
      return;
    }

    const queued = await readerDb.outbox.where("status").equals("queued").sortBy("createdAt");
    for (const item of queued) {
      try {
        const response = await request("/api/discovery/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: item.requestId, feedUrls: item.feedUrls }),
        });
        if (response.ok) {
          await readerDb.outbox.delete(item.requestId);
        }
      } catch {
        // Network failure, leave in outbox for subsequent retry
      }
    }
  } finally {
    isFlushing = false;
  }
}
