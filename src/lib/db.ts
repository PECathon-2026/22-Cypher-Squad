import Dexie, { type Table } from "dexie";
import type { FeedEntry } from "./feed";

export type LocalFeed = {
  id: string;
  name: string;
  url: string;
  description: string;
  posts: number;
  status: "synced" | "attention" | "offline" | "temporary-error" | "malformed" | "empty" | "access-challenge";
  error?: string;
  lastFetchedAt?: string;
};

export type LocalPost = FeedEntry & {
  postId: string;
  feed: string;
  feedUrl: string;
  minutes: number;
  viewed: boolean;
  accent: string;
  articleHtml?: string;
  articleSource?: "extracted" | "feed-content" | "summary-fallback";
};

export type ArticleRecord = {
  postId: string;
  sanitizedHtml: string;
  title: string;
  excerpt: string;
  extractedAt: string;
};
export type ContributionRecord = { requestId: string; feedUrls: string[]; createdAt: string; status: "queued" | "sent" };
export type SharingState = { id: "discovery"; enabled: boolean; lastSubmittedSnapshot?: string; updatedAt: string };

class ReaderDatabase extends Dexie {
  feeds!: Table<LocalFeed, string>;
  posts!: Table<LocalPost, string>;
  articles!: Table<ArticleRecord, string>;
  outbox!: Table<ContributionRecord, string>;
  sharingState!: Table<SharingState, string>;

  constructor() {
    super("small-web-reader");
    this.version(1).stores({
      feeds: "id, url",
      posts: "postId, feedUrl, publishedAt, viewed",
      articles: "postId, extractedAt",
    });
    this.version(2).stores({
      feeds: "id, url",
      posts: "postId, feedUrl, publishedAt, viewed",
      articles: "postId, extractedAt",
      outbox: "requestId, status, createdAt",
      sharingState: "id",
    });
  }

}

export const readerDb = new ReaderDatabase();

export async function setDiscoveryEnabled(enabled: boolean) {
  await readerDb.sharingState.put({ id: "discovery", enabled, updatedAt: new Date().toISOString() });
  if (!enabled) await readerDb.outbox.where("status").equals("queued").delete();
}

export async function seedDatabase(feeds: LocalFeed[], posts: LocalPost[]) {
  if ((await readerDb.feeds.count()) === 0) await readerDb.feeds.bulkPut(feeds);
  if ((await readerDb.posts.count()) === 0) await readerDb.posts.bulkPut(posts);
}

export async function clearReaderCache() {
  await readerDb.posts.clear();
  await readerDb.articles.clear();
}

export async function trimPostCache() {
  const feeds = await readerDb.feeds.toArray();
  for (const feed of feeds) {
    const posts = await readerDb.posts.where("feedUrl").equals(feed.url).sortBy("publishedAt");
    const excess = posts.slice(0, Math.max(0, posts.length - 100));
    if (excess.length) await readerDb.posts.bulkDelete(excess.map((post) => post.postId));
  }
}

export async function trimArticleCache() {
  const articles = await readerDb.articles.orderBy("extractedAt").toArray();
  const excess = articles.slice(0, Math.max(0, articles.length - 200));
  if (excess.length) await readerDb.articles.bulkDelete(excess.map((article) => article.postId));
}
