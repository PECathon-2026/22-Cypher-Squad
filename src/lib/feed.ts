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
const FEED_TYPES = new Set(["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"]);

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
  const response = await fetchThroughProxy(url, "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html");
  const body = await response.text();
  return parseFeed(body, url);
}

async function fetchText(url: string): Promise<{ body: string }> {
  const response = await fetchThroughProxy(url, "text/html, application/xhtml+xml");
  return { body: await response.text() };
}

function discoverFeedLinks(html: string, pageUrl: string): string[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="alternate"][href]'))
    .filter((link) => {
      const type = (link.getAttribute("type") ?? "").toLowerCase();
      return FEED_TYPES.has(type) || type.includes("rss") || type.includes("atom");
    })
    .map((link) => new URL(link.href || link.getAttribute("href")!, pageUrl).toString());
}

function parseFeed(xml: string, url: string): ResolvedFeed | null {
  const shared = parseFeedXml(xml, url);
  if (shared.kind === "valid" || shared.kind === "valid-empty") return shared.feed;
  return null;
  /*
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) return null;

  const root = document.documentElement;
  if (root.localName === "feed") return parseAtom(document, url);
  if (root.localName === "rss" || root.localName === "RDF") return parseRss(document, url);
  return null;
  */
}

function parseRss(document: Document, url: string): ResolvedFeed {
  const channel = document.querySelector("channel");
  if (!channel) throw new Error("The RSS document has no channel.");
  const entries = Array.from(channel.querySelectorAll(":scope > item")).map((item, index) => {
    const articleUrl = text(item, "link") || text(item, "guid") || url;
    return {
      id: text(item, "guid") || articleUrl || `${url}#${index}`,
      title: text(item, "title") || "Untitled post",
      url: resolveRelative(articleUrl, url),
      summary: text(item, "description") || text(item, "content\\:encoded") || "",
      publishedAt: parseDate(text(item, "pubDate") || text(item, "dc\\:date")),
      author: text(item, "author") || text(item, "dc\\:creator") || undefined,
    };
  });
  return {
    url,
    title: text(channel, "title") || new URL(url).hostname,
    description: text(channel, "description"),
    siteUrl: resolveRelative(text(channel, "link"), url),
    format: "rss",
    entries: deduplicateEntries(entries),
  };
}

function parseAtom(document: Document, url: string): ResolvedFeed {
  const root = document.documentElement;
  const entries = Array.from(root.children)
    .filter((element) => element.localName === "entry")
    .map((entry, index) => {
      const link = Array.from(entry.children).find((element) => element.localName === "link" && (element.getAttribute("rel") ?? "alternate") === "alternate");
      const articleUrl = link?.getAttribute("href") || childText(entry, "id") || url;
      return {
        id: childText(entry, "id") || articleUrl || `${url}#${index}`,
        title: childText(entry, "title") || "Untitled post",
        url: resolveRelative(articleUrl, url),
        summary: childText(entry, "content") || childText(entry, "summary") || "",
        publishedAt: parseDate(childText(entry, "published") || childText(entry, "updated")),
        author: childText(entry, "author", "name") || undefined,
      };
    });
  return {
    url,
    title: childText(root, "title") || new URL(url).hostname,
    description: childText(root, "subtitle"),
    siteUrl: resolveRelative(childText(root, "link", "href") || "", url),
    format: "atom",
    entries: deduplicateEntries(entries),
  };
}

function text(parent: ParentNode, selector: string): string {
  return parent.querySelector(selector)?.textContent?.trim() ?? "";
}

function childText(parent: Element, localName: string, nestedLocalName?: string): string {
  const child = Array.from(parent.children).find((element) => element.localName === localName);
  if (!child) return "";
  if (nestedLocalName) {
    return Array.from(child.children).find((element) => element.localName === nestedLocalName)?.textContent?.trim() ?? "";
  }
  return child.textContent?.trim() ?? "";
}

function resolveRelative(value: string, base: string): string {
  try {
    return new URL(value || base, base).toString();
  } catch {
    return base;
  }
}

function parseDate(value: string): string {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? new Date(0).toISOString() : new Date(parsed).toISOString();
}

function deduplicateEntries(entries: FeedEntry[]): FeedEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.id}|${entry.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
import { fetchThroughProxy } from "./fetch";
import { parseFeedXml } from "./feed-core";
import { normalizeHttpUrl as normalizeUrl } from "./url";
