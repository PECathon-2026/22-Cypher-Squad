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

const PURIFY_OPTIONS = {
  FORBID_TAGS: [
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "dialog",
    "style",
    "script",
    "iframe",
    "embed",
    "object",
  ],
  FORBID_ATTR: ["action", "formaction", "method"],
};

function rewriteRelativeAssets(container: Element, baseUrl: string) {
  // Rewrite images
  container.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) {
      try {
        img.setAttribute("src", new URL(src, baseUrl).toString());
      } catch {
        // ignore malformed URLs
      }
    }
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const rewritten = srcset
        .split(",")
        .map((part) => {
          const trimmed = part.trim();
          const spaceIdx = trimmed.lastIndexOf(" ");
          if (spaceIdx === -1) {
            try {
              return new URL(trimmed, baseUrl).toString();
            } catch {
              return trimmed;
            }
          }
          const candidate = trimmed.slice(0, spaceIdx);
          const descriptor = trimmed.slice(spaceIdx);
          try {
            return `${new URL(candidate, baseUrl).toString()}${descriptor}`;
          } catch {
            return trimmed;
          }
        })
        .join(", ");
      img.setAttribute("srcset", rewritten);
    }
  });

  // Rewrite links
  container.querySelectorAll("a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href) {
      try {
        a.setAttribute("href", new URL(href, baseUrl).toString());
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      } catch {
        // ignore
      }
    }
  });
}

export async function extractArticle(
  url: string,
  summary: string,
  title: string,
  feedContentHtml?: string,
  feedUrl?: string,
): Promise<ExtractedArticle> {
  try {
    const response = await fetchThroughProxy(url, "text/html, application/xhtml+xml");
    const html = await response.text();
    const document = new DOMParser().parseFromString(html, "text/html");
    rewriteRelativeAssets(document.body, url);
    const article = new Readability(document).parse();
    if (!article?.content) throw new Error("No readable article content was found.");
    return {
      html: DOMPurify.sanitize(article.content, PURIFY_OPTIONS),
      title: article.title || title,
      excerpt: article.excerpt || summary,
      source: "extracted",
    };
  } catch {
    const feedEntryContent = feedUrl ? await getFeedEntryContent(feedUrl, url) : "";
    const rawFeedContent = feedContentHtml ?? feedEntryContent ?? summary;
    const feedContent = sanitizeFeedContent(rawFeedContent, url);
    if (feedContent) {
      return {
        html: feedContent,
        title,
        excerpt: "",
        source: "feed-content",
      };
    }

    async function getFeedEntryContent(fUrl: string, articleUrl: string): Promise<string> {
      try {
        const response = await fetchThroughProxy(
          fUrl,
          "application/rss+xml, application/atom+xml, application/xml, text/xml",
        );
        const parsed = parseFeedXml(await response.text(), fUrl);
        if (parsed.kind !== "valid") return "";
        const target = canonicalArticleUrl(articleUrl);
        return (
          parsed.feed.entries.find((entry) => canonicalArticleUrl(entry.url) === target)
            ?.contentHtml ?? ""
        );
      } catch {
        return "";
      }
    }

    function canonicalArticleUrl(value: string): string {
      try {
        const parsed = new URL(value);
        parsed.hash = "";
        return parsed.toString();
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

function sanitizeFeedContent(content: string, baseUrl?: string): string {
  if (!/<[a-z][\s\S]*>/i.test(content)) return "";
  const document = new DOMParser().parseFromString(content, "text/html");
  if (baseUrl) {
    rewriteRelativeAssets(document.body, baseUrl);
  }
  document
    .querySelectorAll("script, style, iframe, object, embed, form, input, button, select, textarea, dialog")
    .forEach((element) => element.remove());
  const text = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "";
  return DOMPurify.sanitize(document.body.innerHTML, PURIFY_OPTIONS);
}
