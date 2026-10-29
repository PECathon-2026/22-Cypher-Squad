import { describe, expect, it } from "vitest";
import { parseFeedXml } from "./feed-core";
import { normalizeHttpUrl } from "./url";

describe("normalizeHttpUrl", () => {
  it("normalizes host, default port, fragment, and empty path", () => {
    expect(normalizeHttpUrl("HTTP://Example.COM:80#latest")).toBe("http://example.com/");
  });
  it("preserves meaningful query parameters", () => {
    expect(normalizeHttpUrl("https://example.com/feed?topic=tech")).toBe("https://example.com/feed?topic=tech");
  });
  it("rejects credentials and secret-like query keys", () => {
    expect(() => normalizeHttpUrl("https://user:pass@example.com/feed")).toThrow();
    expect(() => normalizeHttpUrl("https://example.com/feed?apiKey=secret")).toThrow();
  });
});

describe("parseFeedXml", () => {
  it("parses RSS and removes duplicate GUID entries", () => {
    const result = parseFeedXml(`<rss><channel><title>Test</title><link>https://example.com</link><item><guid>one</guid><title>One</title><link>/one</link><description>Short summary</description><content:encoded xmlns:content="x"><![CDATA[<p>Full body</p>]]></content:encoded></item><item><guid>one</guid><title>Duplicate</title></item></channel></rss>`, "https://example.com/feed.xml");
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") {
      expect(result.feed.entries).toHaveLength(1);
      expect(result.feed.entries[0].url).toBe("https://example.com/one");
      expect(result.feed.entries[0].summary).toBe("Short summary");
      expect(result.feed.entries[0].contentHtml).toBe("<p>Full body</p>");
    }
  });
  it("parses Atom and distinguishes an empty feed", () => {
    const result = parseFeedXml(`<feed xmlns="http://www.w3.org/2005/Atom"><title>Empty</title><link href="https://example.com/" /></feed>`, "https://example.com/atom.xml");
    expect(result.kind).toBe("valid-empty");
  });
  it("parses RSS 1.0 RDF feeds", () => {
    const result = parseFeedXml(`<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>RDF</title><link>https://example.com/</link></channel><item rdf:about="https://example.com/one"><title>One</title><link>https://example.com/one</link></item></rdf:RDF>`, "https://example.com/rdf");
    expect(result.kind).toBe("valid");
    if (result.kind === "valid") expect(result.feed.entries[0].title).toBe("One");
  });
  it("classifies malformed and unsupported documents", () => {
    expect(parseFeedXml("<rss>", "https://example.com/feed").kind).toBe("malformed-xml");
    expect(parseFeedXml("<json><item /></json>", "https://example.com/feed").kind).toBe("unsupported-format");
  });
});
