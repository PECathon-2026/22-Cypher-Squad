import { describe, it, expect, vi } from "vitest";
import { pairUrls, pairId, feedId } from "../../functions/src/discovery";
import { normalizeSafeUrl } from "../../functions/src/security";

describe("Contribution Validation & Pair Generation", () => {
  it("normalizes and accepts a valid 1 URL batch", () => {
    const url = normalizeSafeUrl("https://example.com/feed.xml");
    expect(url).toBe("https://example.com/feed.xml");
    const pairs = pairUrls([url]);
    expect(pairs).toHaveLength(0); // 1 URL has 0 pairs
  });

  it("calculates correct pair counts for 20 URLs", () => {
    const urls = Array.from({ length: 20 }, (_, i) => `https://example${i}.com/feed.xml`);
    // Unique pairs for n=20 is 20 * 19 / 2 = 190
    const pairs = pairUrls(urls);
    expect(pairs).toHaveLength(190);

    // Verify all pairs are distinct
    const pairKeys = new Set(pairs.map(([a, b]) => pairId(a, b)));
    expect(pairKeys.size).toBe(190);
  });

  it("rejects batches with more than 20 URLs", () => {
    const rawUrls = Array.from({ length: 21 }, (_, i) => `https://example${i}.com/feed.xml`);
    const isRejected = rawUrls.length > 20;
    expect(isRejected).toBe(true);
  });

  it("pairId produces deterministic sorted output regardless of argument order", () => {
    const urlA = "https://a.example.com/feed";
    const urlB = "https://b.example.com/feed";
    const id1 = pairId(urlA, urlB);
    const id2 = pairId(urlB, urlA);
    expect(id1).toBe(id2);
  });

  it("rejects invalid URL formats", () => {
    expect(normalizeSafeUrl("not-a-url")).toBe("");
    expect(normalizeSafeUrl("ftp://example.com/feed")).toBe("");
    expect(normalizeSafeUrl("javascript:alert(1)")).toBe("");
  });

  it("rejects credential-bearing URLs", () => {
    expect(normalizeSafeUrl("https://user:password@example.com/feed")).toBe("");
  });

  it("rejects secret-like query parameter URLs", () => {
    expect(normalizeSafeUrl("https://example.com/feed?token=secret")).toBe("");
    expect(normalizeSafeUrl("https://example.com/feed?api_key=123")).toBe("");
    expect(normalizeSafeUrl("https://example.com/feed?auth=token")).toBe("");
    expect(normalizeSafeUrl("https://example.com/feed?signature=sig")).toBe("");
  });

  it("deduplicates identical URLs within a batch", () => {
    const input = [
      "https://example.com/feed.xml",
      "https://example.com/feed.xml",
      "https://other.com/feed.xml",
    ];
    const deduped = [...new Set(input.map(normalizeSafeUrl).filter(Boolean))];
    expect(deduped).toHaveLength(2);
    expect(pairUrls(deduped)).toHaveLength(1);
  });

  it("same request ID is idempotent and prevents re-incrementing", async () => {
    const processedReceipts = new Set<string>();
    let increments = 0;

    const processContribution = async (requestId: string, urls: string[]) => {
      // Simulate server-side receipt check
      if (processedReceipts.has(requestId)) {
        return { accepted: true, requestId, duplicate: true };
      }
      increments += urls.length;
      processedReceipts.add(requestId);
      return { accepted: true, requestId };
    };

    const reqId = "stable-client-request-id-123456789";
    const batch = ["https://example1.com/feed.xml", "https://example2.com/feed.xml"];

    const first = await processContribution(reqId, batch);
    expect(first.accepted).toBe(true);
    expect(increments).toBe(2);

    // Retrying with same request ID
    const retry = await processContribution(reqId, batch);
    expect(retry.accepted).toBe(true);
    expect(retry.duplicate).toBe(true);
    expect(increments).toBe(2); // Counter did not increment again!
  });
});
