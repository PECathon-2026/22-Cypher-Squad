import { resolveFeedUrl, type ResolvedFeed } from "./feed";

export type FeedRefreshStatus = "synced" | "offline" | "temporary-error" | "malformed" | "empty" | "access-challenge";

export type FeedRefreshResult = {
  feed: ResolvedFeed | null;
  status: FeedRefreshStatus;
  error?: string;
};

export async function refreshFeed(url: string, online = navigator.onLine): Promise<FeedRefreshResult> {
  if (!online) return { feed: null, status: "offline", error: "Waiting for a connection." };
  try {
    const feed = await resolveFeedUrl(url);
    if (feed.entries.length === 0) return { feed, status: "empty", error: "The feed is valid but has no current posts." };
    return { feed, status: "synced" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The feed could not be refreshed.";
    const lower = message.toLowerCase();
    if (lower.includes("401") || lower.includes("403") || lower.includes("captcha") || lower.includes("login") || lower.includes("challenge")) {
      return { feed: null, status: "access-challenge", error: message };
    }
    if (lower.includes("malformed") || lower.includes("rss or atom") || lower.includes("xml")) {
      return { feed: null, status: "malformed", error: message };
    }
    return { feed: null, status: "temporary-error", error: message };
  }
}
