import { fetchSafely } from "../api/_lib/ssrf.js";
import { parseFeedXml } from "../src/lib/feed-core.js";

const feeds = [
  "https://feeds.bbci.co.uk/news/rss.xml",
  "https://www.theverge.com/rss/index.xml",
  "https://techcrunch.com/feed/",
  "https://news.ycombinator.com/rss",
  "https://www.wired.com/feed/rss",
  "https://feeds.arstechnica.com/arstechnica/index",
  "https://www.theguardian.com/world/rss",
  "https://www.nasa.gov/news-release/feed/",
  "https://feeds.npr.org/1001/rss.xml",
  "https://github.blog/feed/",
];

async function testAll() {
  console.log("Testing user feeds...\n");
  for (const url of feeds) {
    console.log(`Testing: ${url}`);
    try {
      const resp = await fetchSafely(url);
      console.log(`  Fetch status: ${resp.status}, Content-Type: ${resp.contentType}, Body length: ${resp.body.length}`);
      const parsed = parseFeedXml(resp.body, url);
      if (parsed.kind === "valid") {
        console.log(`  Parsed successfully: Title="${parsed.feed.title}", Format=${parsed.feed.format}, Entries=${parsed.feed.entries.length}`);
        if (parsed.feed.entries.length > 0) {
          console.log(`  Sample entry 0: title="${parsed.feed.entries[0].title}", url="${parsed.feed.entries[0].url}"`);
        }
      } else {
        console.log(`  Parse failed / non-valid: kind=${parsed.kind}, error=${(parsed as any).error}`);
      }
    } catch (err: any) {
      console.log(`  Fetch/Parse threw error: ${err.message}`);
    }
    console.log("");
  }
}

testAll();
