import { describe, it, expect } from "vitest";
import { exportOpml, parseOpml } from "../lib/opml";

describe("OPML Import and Export", () => {
  it("exports valid OPML with escaped attributes and roundtrips", () => {
    const original = [
      { name: "BBC News & Updates", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "News" },
      { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
      { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech" },
    ];

    const xml = exportOpml(original);
    expect(xml).toContain("<opml version=\"2.0\">");
    expect(xml).toContain("BBC News &amp; Updates");
    expect(xml).toContain("https://feeds.bbci.co.uk/news/rss.xml");

    const parsed = parseOpml(xml);
    expect(parsed).toHaveLength(3);
    expect(parsed[0].name).toBe("BBC News & Updates");
    expect(parsed[0].url).toBe("https://feeds.bbci.co.uk/news/rss.xml");
    expect(parsed[0].category).toBe("News");
    expect(parsed[1].name).toBe("The Verge");
  });
});
