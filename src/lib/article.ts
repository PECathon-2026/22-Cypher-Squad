import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import { fetchThroughProxy } from "./fetch";
import { readerDb, trimArticleCache } from "./db";
import { parseFeedXml } from "./feed-core";

export type ExtractedArticle = {
  html: string;
  title: string;
  excerpt: string;
  source: "extracted" | "feed-content" | "summary-fallback";
};

export async function extractArticle(url: string, summary: string, title: string, feedContentHtml?: string, feedUrl?: string): Promise<ExtractedArticle> {
  try {
    const response = await fetchThroughProxy(url, "text/html, application/xhtml+xml");
    const html = await response.text();
    const document = new DOMParser().parseFromString(html, "text/html");
    const article = new Readability(document).parse();
    if (!article?.content) throw new Error("No readable article content was found.");
    return {
      html: DOMPurify.sanitize(article.content),
      title: article.title || title,
      excerpt: article.excerpt || summary,
      source: "extracted",
    };
  } catch {
    const feedEntryContent = feedUrl ? await getFeedEntryContent(feedUrl, url) : "";
    const feedContent = sanitizeFeedContent(feedContentHtml ?? feedEntryContent ?? summary);
    if (feedContent) {
      return {
        html: feedContent,
        title,
        excerpt: "",
        source: "feed-content",
      };
    }

    async function getFeedEntryContent(feedUrl: string, articleUrl: string): Promise<string> {
      try {
        const response = await fetchThroughProxy(feedUrl, "application/rss+xml, application/atom+xml, application/xml, text/xml");
        const parsed = parseFeedXml(await response.text(), feedUrl);
        if (parsed.kind !== "valid") return "";
        const target = canonicalArticleUrl(articleUrl);
        return parsed.feed.entries.find((entry) => canonicalArticleUrl(entry.url) === target)?.contentHtml ?? "";
      } catch {
        return "";
      }
    }

    function canonicalArticleUrl(value: string): string {
      try {
        const url = new URL(value);
        url.hash = "";
        return url.toString();
      } catch {
        return value;
      }
    }
    return {
      html: "",
      title,
      excerpt: summary,
      source: "summary-fallback",
    };
  }

}

export async function getCachedArticle(postId: string): Promise<ExtractedArticle | null> {
  const cached = await readerDb.articles.get(postId);
  if (!cached) return null;
  return {
    html: cached.sanitizedHtml,
    title: cached.title,
    excerpt: cached.excerpt,
    source: "extracted",
  };
}

export async function cacheArticle(postId: string, article: ExtractedArticle): Promise<void> {
  if (!article.html || article.source === "summary-fallback") return;
  await readerDb.articles.put({
    postId,
    sanitizedHtml: article.html,
    title: article.title,
    excerpt: article.excerpt,
    extractedAt: new Date().toISOString(),
  });
  await trimArticleCache();
}

function sanitizeFeedContent(summary: string): string {
  if (!/<[a-z][\s\S]*>/i.test(summary)) return "";
  const document = new DOMParser().parseFromString(summary, "text/html");
  document.querySelectorAll("script, style, iframe, object, embed, form, input, button").forEach((element) => element.remove());
  const text = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (text.length < 120) return "";
  return DOMPurify.sanitize(document.body.innerHTML);
}
