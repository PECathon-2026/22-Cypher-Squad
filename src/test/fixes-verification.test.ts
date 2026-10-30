import { describe, it, expect } from "vitest";
import { parseFeedXml } from "../lib/feed-core";
import { normalizeHttpUrl } from "../lib/url";
import { discoverFeedLinks } from "../lib/feed";
import { validateUrl, isPrivateAddress, assertPublicDestination } from "../../api/_lib/ssrf";

describe("Fixes Verification Suite", () => {
  describe("Autodiscovery Link Resolution", () => {
    it("resolves relative feed links against pageUrl, not application origin", () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="alternate" type="application/rss+xml" title="Blog RSS" href="/blog/feed.xml" />
  <link rel="alternate" type="application/atom+xml" title="Blog Atom" href="relative/atom.xml" />
</head>
<body><h1>My Blog</h1></body>
</html>`;

      const links = discoverFeedLinks(html, "https://indie.example.com/subfolder/index.html");
      expect(links).toContain("https://indie.example.com/blog/feed.xml");
      expect(links).toContain("https://indie.example.com/subfolder/relative/atom.xml");
      expect(links.some((l) => l.includes("localhost"))).toBe(false);
    });

    it("respects base tag in HTML when resolving relative feed links", () => {
      const html = `<!DOCTYPE html>
<html>
<head>
  <base href="https://cdn.example.com/assets/" />
  <link rel="alternate" type="application/rss+xml" href="feed.xml" />
</head>
<body><h1>My Blog</h1></body>
</html>`;

      const links = discoverFeedLinks(html, "https://indie.example.com/index.html");
      expect(links).toContain("https://cdn.example.com/assets/feed.xml");
    });
  });
  describe("URL & Query Parameter Secret Filter", () => {
    it("allows legitimate parameters like author and keyword without false positives", () => {
      const url1 = normalizeHttpUrl("https://example.com/posts?author=alice&category=tech");
      expect(url1).toBe("https://example.com/posts?author=alice&category=tech");

      const url2 = normalizeHttpUrl("https://example.com/search?keyword=news&page=1");
      expect(url2).toBe("https://example.com/search?keyword=news&page=1");

      const validProxyUrl = validateUrl("https://example.com/feed.xml?author=alice");
      expect(validProxyUrl).toBe("https://example.com/feed.xml?author=alice");
    });

    it("rejects genuine secret-bearing query parameters", () => {
      expect(() => normalizeHttpUrl("https://example.com/feed.xml?token=secret123")).toThrow();
      expect(() => normalizeHttpUrl("https://example.com/feed.xml?api_key=secret123")).toThrow();
      expect(() => normalizeHttpUrl("https://example.com/feed.xml?auth=bearer123")).toThrow();
      expect(() => normalizeHttpUrl("https://example.com/feed.xml?signature=sig123")).toThrow();

      expect(() => validateUrl("https://example.com/feed.xml?token=secret123")).toThrow();
      expect(() => validateUrl("https://example.com/feed.xml?api_key=secret123")).toThrow();
    });
  });

  describe("XML Parser & Comment Resilience", () => {
    it("parses feeds with trailing comments without malformed-xml error", () => {
      const xmlWithComments = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Resilient Feed</title>
    <link>https://example.com</link>
    <description>Testing comments</description>
    <item>
      <title>Article 1</title>
      <link>https://example.com/post-1</link>
      <description>Hello world</description>
      <pubDate>Mon, 01 Jan 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
<!-- Cache hit: served by edge reverse proxy -->
<!-- Generation time: 12ms -->`;

      const result = parseFeedXml(xmlWithComments, "https://example.com/feed.xml");
      expect(result.kind).toBe("valid");
      if (result.kind === "valid") {
        expect(result.feed.title).toBe("Resilient Feed");
        expect(result.feed.entries).toHaveLength(1);
        expect(result.feed.entries[0].title).toBe("Article 1");
      }
    });

    it("handles array link collapse when both link and atom:link self exist", () => {
      const xmlWithAtomLink = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Dual Link Blog</title>
    <atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />
    <link>https://example.com/site</link>
    <description>Site link test</description>
    <item>
      <title>Post with self link</title>
      <link>https://example.com/post-1</link>
      <description>Sample post</description>
    </item>
  </channel>
</rss>`;

      const result = parseFeedXml(xmlWithAtomLink, "https://example.com/feed.xml");
      expect(result.kind).toBe("valid");
      if (result.kind === "valid") {
        expect(result.feed.siteUrl).toBe("https://example.com/site");
      }
    });

    it("blocks javascript: and malicious protocols in feed links", () => {
      const maliciousXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Malicious Feed</title>
    <link>javascript:alert(document.cookie)</link>
    <description>XSS vector test</description>
    <item>
      <title>Malicious item</title>
      <link>javascript:alert(1)</link>
      <description>XSS item</description>
    </item>
  </channel>
</rss>`;

      const result = parseFeedXml(maliciousXml, "https://example.com/feed.xml");
      expect(result.kind).toBe("valid");
      if (result.kind === "valid") {
        // Must safely fall back to base URL and disallow javascript:
        expect(result.feed.siteUrl).toBe("https://example.com/feed.xml");
        expect(result.feed.entries[0].url).toBe("https://example.com/feed.xml");
      }
    });
  });

  describe("SSRF & Private Network Defense", () => {
    it("blocks NAT64, 6to4, and Teredo ranges in isPrivateAddress", () => {
      expect(isPrivateAddress("64:ff9b::192.0.2.1")).toBe(true);
      expect(isPrivateAddress("2002:c000:0201::1")).toBe(true);
      expect(isPrivateAddress("2001:0000:4136:e378:8000:63bf:3fff:fdd2")).toBe(true);
      expect(isPrivateAddress("::1")).toBe(true);
      expect(isPrivateAddress("0:0:0:0:0:0:0:1")).toBe(true);
    });

    it("rejects IPv6 loopbacks with brackets in assertPublicDestination", async () => {
      await expect(assertPublicDestination("http://[::1]/feed.xml")).rejects.toThrow(
        "Private or local destinations are blocked",
      );
      await expect(assertPublicDestination("http://127.0.0.1/feed.xml")).rejects.toThrow(
        "Private or local destinations are blocked",
      );
    });
  });
});
