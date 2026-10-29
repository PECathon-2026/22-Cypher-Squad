import { appCheckHeaders } from "./app-check";
import { readerDb, type ContributionRecord } from "./db";

function safeUrls(feedUrls: string[]): string[] {
  return [...new Set(feedUrls.filter((value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) &&
        !url.username && !url.password &&
        (!url.port || ["80", "443"].includes(url.port)) &&
        ![...url.searchParams.keys()].some((key) => /token|secret|key|auth|password|signature/i.test(key));
    } catch {
      return false;
    }
  }))];
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = { ...(init?.headers ?? {}), ...(await appCheckHeaders()) };
  return fetch(path, { ...init, headers });
}

export async function getPopularFeeds() {
  const response = await request("/api/discovery/popular");
  if (!response.ok) throw new Error(`Popular feeds request failed with HTTP ${response.status}.`);
  return (await response.json()).feeds as Array<{ url: string; name?: string; score?: number; reason?: string }>;
}

export async function getRecommendations(feedUrls: string[]) {
  const response = await request("/api/discovery/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedUrls: safeUrls(feedUrls).slice(0, 100) }),
  });
  if (!response.ok) throw new Error(`Recommendations request failed with HTTP ${response.status}.`);
  return (await response.json()).feeds as Array<{ url: string; score?: number; reason?: string }>;
}

export async function submitContribution(feedUrls: string[]): Promise<void> {
  const requestId = crypto.randomUUID().replaceAll("-", "");
  const record: ContributionRecord = { requestId, feedUrls: safeUrls(feedUrls).slice(0, 20), createdAt: new Date().toISOString(), status: "queued" };
  if (!record.feedUrls.length) throw new Error("No eligible feed URLs were selected.");
  await readerDb.outbox.put(record);
  await flushContributionOutbox();
}

export async function flushContributionOutbox(): Promise<void> {
  const queued = await readerDb.outbox.where("status").equals("queued").sortBy("createdAt");
  for (const item of queued) {
    const response = await request("/api/discovery/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: item.requestId, feedUrls: item.feedUrls }),
    });
    if (!response.ok) throw new Error(await response.text());
    await readerDb.outbox.update(item.requestId, { status: "sent" });
  }
}
