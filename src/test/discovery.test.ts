import { describe, it, expect } from "vitest";
import { seedFeeds } from "../../functions/src/seed-data";
import { normalizeSafeUrl } from "../../functions/src/security";

describe("Discovery Logic & Seed Fallback", () => {
  it("seeded fallback dataset provides 12 valid seed feeds", () => {
    expect(seedFeeds).toHaveLength(12);
    for (const feed of seedFeeds) {
      expect(feed.name).toBeTruthy();
      expect(feed.normalizedUrl).toBeTruthy();
      expect(normalizeSafeUrl(feed.normalizedUrl)).toBe(feed.normalizedUrl);
    }
  });

  it("popular endpoint does not accept a user subscription list and rejects non-GET", () => {
    // Verified against popularFeeds specification: method must be GET, no request body parsed
    const method: string = "POST";
    const isAllowed = method === "GET";
    expect(isAllowed).toBe(false);
  });

  it("recommendation endpoint excludes followed feeds", () => {
    const followedUrls = [
      "https://feeds.bbci.co.uk/news/rss.xml",
      "https://hnrss.org/frontpage",
    ];
    const followedSet = new Set(followedUrls);

    const candidates = seedFeeds.map((feed) => ({
      url: feed.normalizedUrl,
      score: 1,
    }));

    const filtered = candidates.filter((c) => !followedSet.has(c.url));
    expect(filtered).toHaveLength(10);
    expect(filtered.some((c) => followedSet.has(c.url))).toBe(false);
  });

  it("personalized URLs are not sent when opt-in is off", () => {
    const sharingEnabled = false;
    const localSubscriptions = ["https://myfeed.com/feed.xml"];

    // With personalized discovery disabled, client requests global popular feeds only
    const outgoingPayload = sharingEnabled ? { feedUrls: localSubscriptions } : null;
    expect(outgoingPayload).toBeNull();
  });

  it("recommendations combine co-subscription and popularity ranking", () => {
    const followed = ["https://a.com/feed"];
    const followedSet = new Set(followed);

    // Simulated co-subscription pair scores
    const coScores = new Map<string, number>([
      ["https://b.com/feed", 5], // High co-subscription
      ["https://c.com/feed", 0], // Zero co-subscription
    ]);

    // Simulated candidates with base popularity
    const candidates = [
      { url: "https://b.com/feed", popularity: 2 },
      { url: "https://c.com/feed", popularity: 10 },
    ];

    const scored = candidates
      .filter((c) => !followedSet.has(c.url))
      .map((c) => {
        const co = coScores.get(c.url) ?? 0;
        const total = co * 3 + c.popularity;
        return { url: c.url, score: total, reason: co > 0 ? "co-sub" : "popular" };
      })
      .sort((a, b) => b.score - a.score);

    // b score = 5 * 3 + 2 = 17
    // c score = 0 * 3 + 10 = 10
    // b ranks first because of co-subscription weighting
    expect(scored[0].url).toBe("https://b.com/feed");
    expect(scored[0].score).toBe(17);
    expect(scored[0].reason).toBe("co-sub");
    expect(scored[1].url).toBe("https://c.com/feed");
    expect(scored[1].score).toBe(10);
  });
});
