import { fetchThroughProxy } from "./fetch";
import { parseFeedXml } from "./feed-core";
import { normalizeHttpUrl as normalizeUrl } from "./url";

export type FeedEntry = {
  id: string;
  title: string;
  url: string;
  summary: string;
  contentHtml?: string;
  publishedAt: string;
  author?: string;
};

export type ResolvedFeed = {
  url: string;
  title: string;
  description: string;
  siteUrl: string;
  format: "rss" | "atom";
  entries: FeedEntry[];
};

const COMMON_FEED_PATHS = ["/feed", "/feed.xml", "/rss.xml", "/atom.xml"];
const FEED_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "text/xml",
]);

export async function resolveFeedUrl(input: string): Promise<ResolvedFeed> {
  const requestedUrl = normalizeHttpUrl(input);
  const directResult = await fetchAndParse(requestedUrl);
  if (directResult) return directResult;

  const siteDocument = await fetchText(requestedUrl);
  const candidates = discoverFeedLinks(siteDocument.body, requestedUrl);
  const origin = new URL(requestedUrl);
  candidates.push(...COMMON_FEED_PATHS.map((path) => new URL(path, origin).toString()));

  const attempted = new Set<string>();
  for (const candidate of candidates) {
    if (attempted.has(candidate)) continue;
    attempted.add(candidate);
    try {
      const result = await fetchAndParse(candidate);
      if (result) return result;
    } catch {
      // One candidate failing should not prevent trying the remaining paths.
    }
  }

  throw new Error("No RSS or Atom feed was found at this address.");
}

function normalizeHttpUrl(input: string): string {
  return normalizeUrl(input);
}

async function fetchAndParse(url: string): Promise<ResolvedFeed | null> {
  const response = await fetchThroughProxy(
    url,
    "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html",
  );
  const body = await response.text();
  return parseFeed(body, url);
}

async function fetchText(url: string): Promise<{ body: string }> {
  const response = await fetchThroughProxy(url, "text/html, application/xhtml+xml");
  return { body: await response.text() };
}

export function discoverFeedLinks(html: string, pageUrl: string): string[] {
  let effectiveBase = pageUrl;
  if (typeof DOMParser !== "undefined") {
    const document = new DOMParser().parseFromString(html, "text/html");
    const baseTag = document.querySelector("base[href]");
    effectiveBase = baseTag?.getAttribute("href")
      ? new URL(baseTag.getAttribute("href")!, pageUrl).toString()
      : pageUrl;

    const results: string[] = [];
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="alternate"][href]'));
    for (const link of links) {
      const type = (link.getAttribute("type") ?? "").toLowerCase();
      if (FEED_TYPES.has(type) || type.includes("rss") || type.includes("atom")) {
        const rawHref = link.getAttribute("href");
        if (rawHref) {
          try {
            results.push(new URL(rawHref, effectiveBase).toString());
          } catch {
            // Ignore invalid URLs
          }
        }
      }
    }
    return results;
  }

  // Node/test fallback
  const baseMatch = html.match(/<base\s+[^>]*href=["']([^"']+)["']/i);
  if (baseMatch) {
    try {
      effectiveBase = new URL(baseMatch[1], pageUrl).toString();
    } catch {
      // fallback
    }
  }

  const results: string[] = [];
  const linkRegex = /<link\s+[^>]*rel=["'][^"']*alternate[^"']*["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    const typeMatch = tag.match(/type=["']([^"']+)["']/i);
    const type = (typeMatch ? typeMatch[1] : "").toLowerCase();
    if (FEED_TYPES.has(type) || type.includes("rss") || type.includes("atom")) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        try {
          results.push(new URL(hrefMatch[1], effectiveBase).toString());
        } catch {
          // ignore
        }
      }
    }
  }
  return results;
}

function parseFeed(xml: string, url: string): ResolvedFeed | null {
  const shared = parseFeedXml(xml, url);
  if (shared.kind === "valid" || shared.kind === "valid-empty") return shared.feed;
  return null;
}
