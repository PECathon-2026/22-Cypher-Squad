import { XMLParser } from "fast-xml-parser";
import type { FeedEntry, ResolvedFeed } from "./feed";

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  trimValues: true,
  removeNSPrefix: true,
  htmlEntities: true,
});

export type FeedParseResult =
  | { kind: "valid"; feed: ResolvedFeed }
  | { kind: "valid-empty"; feed: ResolvedFeed }
  | { kind: "malformed-xml"; error: string }
  | { kind: "unsupported-format"; error: string };

export function parseFeedXml(xml: string, url: string): FeedParseResult {
  const cleaned = xml.replace(/^\uFEFF/, "");
  // Strip trailing or interior comments before root-tag matching so comments like <!-- Cache hit --> don't break validation
  const stripped = cleaned.replace(/<!--[\s\S]*?-->/g, "").trim();
  const rootMatch = stripped.match(/<([A-Za-z][\w:.-]*)(?:\s[^>]*)?>/);
  if (rootMatch && !new RegExp(`</(?:[\\w.-]+:)?${rootMatch[1].split(":").pop()}>\\s*$`, "i").test(stripped) && !stripped.includes("/>")) {
    return { kind: "malformed-xml", error: "The XML document is incomplete." };
  }
  let document: XmlNode;
  try {
    document = parser.parse(cleaned) as XmlNode;
  } catch {
    return { kind: "malformed-xml", error: "The XML document could not be parsed." };
  }
  const root = document.rss as XmlNode | undefined;
  const rdf = document.RDF as XmlNode | undefined;
  const atom = document.feed as XmlNode | undefined;
  if (atom) return buildAtom(atom, url);
  if (root) return buildRss(root, url);
  if (rdf) return buildRss(rdf, url);
  return { kind: "unsupported-format", error: "The document is not RSS, RSS 1.0/RDF, or Atom." };
}

function buildRss(root: XmlNode, url: string): FeedParseResult {
  const channel = asObject(root.channel);
  if (!channel) return { kind: "malformed-xml", error: "RSS document has no channel." };
  const items = asArray(channel.item ?? root.item);
  const feed: ResolvedFeed = {
    url,
    title: value(channel.title) || new URL(url).hostname,
    description: value(channel.description),
    siteUrl: resolveRelative(rssLinkValue(channel.link), url),
    format: "rss",
    entries: deduplicate(items.map((item, index) => {
      const link = rssLinkValue(item.link) || value(item.guid);
      const contentHtml = value(item.encoded);
      const titleStr = value(item.title) || "Untitled post";
      const dateStr = parseDate(value(item.pubDate) || value(item.date));
      return {
        id: generatePostId(url, value(item.guid), link, titleStr, dateStr, index),
        title: titleStr,
        url: resolveRelative(link || url, url),
        summary: plainText(value(item.description) || contentHtml),
        contentHtml: contentHtml || undefined,
        publishedAt: dateStr,
        author: value(item.author) || value(item.creator) || undefined,
      };
    })),
  };
  return feed.entries.length ? { kind: "valid", feed } : { kind: "valid-empty", feed };
}

function buildAtom(root: XmlNode, url: string): FeedParseResult {
  const entries = asArray(root.entry);
  const feed: ResolvedFeed = {
    url,
    title: value(root.title) || new URL(url).hostname,
    description: value(root.subtitle),
    siteUrl: resolveRelative(linkValue(root.link) || "", url),
    format: "atom",
    entries: deduplicate(entries.map((entry, index) => {
      const link = linkValue(entry.link) || value(entry.id);
      const contentHtml = value(entry.content);
      const titleStr = value(entry.title) || "Untitled post";
      const dateStr = parseDate(value(entry.published) || value(entry.updated));
      return {
        id: generatePostId(url, value(entry.id), link, titleStr, dateStr, index),
        title: titleStr,
        url: resolveRelative(link || url, url),
        summary: plainText(value(entry.summary) || contentHtml),
        contentHtml: contentHtml || undefined,
        publishedAt: dateStr,
        author: value(asObject(entry.author)?.name) || undefined,
      };
    })),
  };
  return feed.entries.length ? { kind: "valid", feed } : { kind: "valid-empty", feed };
}

function asObject(value: unknown): XmlNode | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as XmlNode : undefined;
}
function asArray(value: unknown): XmlNode[] {
  if (Array.isArray(value)) return value.map(asObject).filter((item): item is XmlNode => Boolean(item));
  const object = asObject(value);
  return object ? [object] : [];
}
function value(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  const object = asObject(value);
  return object ? String(object["#text"] ?? object["#cdata"] ?? "").trim() : "";
}

function rssLinkValue(val: unknown): string {
  if (Array.isArray(val)) {
    for (const item of val) {
      if (typeof item === "string" && item.trim()) return item.trim();
      const obj = asObject(item);
      if (obj) {
        if (obj["@_rel"] === "self") continue;
        const candidate = String(obj["@_href"] ?? obj["#text"] ?? obj["#cdata"] ?? "").trim();
        if (candidate) return candidate;
      }
    }
    for (const item of val) {
      const v = value(item);
      if (v) return v;
    }
    return "";
  }
  return value(val);
}

function linkValue(value: unknown): string {
  const links = Array.isArray(value) ? value : [value];
  const alternate = links.map(asObject).find((link) => !link || !link["@_rel"] || link["@_rel"] === "alternate");
  return valueOfLink(alternate);
}
function valueOfLink(value: XmlNode | undefined): string {
  return value ? String(value["@_href"] ?? value["#text"] ?? "").trim() : "";
}
function resolveRelative(valueToResolve: string, base: string): string {
  try {
    const resolved = new URL(valueToResolve || base, base).toString();
    const parsed = new URL(resolved);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return base;
    }
    return resolved;
  } catch {
    return base;
  }
}
function parseDate(valueToParse: string): string {
  const parsed = valueToParse ? Date.parse(valueToParse) : Number.NaN;
  return Number.isNaN(parsed) ? new Date(0).toISOString() : new Date(parsed).toISOString();
}
function plainText(valueToStrip: string): string {
  return valueToStrip.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function deduplicate(entries: FeedEntry[]): FeedEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.id || entry.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generatePostId(feedUrl: string, guid: string, link: string, title: string, publishedAt: string, index: number): string {
  if (guid) return guid;
  if (link) return link;
  const raw = `${feedUrl}::${title}::${publishedAt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `${feedUrl}#post-${Math.abs(hash)}-${index}`;
}
