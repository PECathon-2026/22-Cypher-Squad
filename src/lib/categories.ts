export const ALL_CATEGORIES = ["All", "Tech", "News", "Engineering", "Science", "Design"] as const;
export type FeedCategory = (typeof ALL_CATEGORIES)[number];

export const EVALUATION_FEEDS = [
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", category: "News" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", category: "Tech" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "Tech" },
  { name: "Hacker News", url: "https://news.ycombinator.com/rss", category: "Engineering" },
  { name: "Wired", url: "https://www.wired.com/feed/rss", category: "Tech" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", category: "Engineering" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss", category: "News" },
  { name: "NASA News Releases", url: "https://www.nasa.gov/news-release/feed/", category: "Science" },
  { name: "NPR News", url: "https://feeds.npr.org/1001/rss.xml", category: "News" },
  { name: "The GitHub Blog", url: "https://github.blog/feed/", category: "Engineering" },
];

export function inferCategory(title: string, url: string): string {
  const text = `${title} ${url}`.toLowerCase();
  if (text.includes("bbc") || text.includes("guardian") || text.includes("npr") || text.includes("news")) {
    return "News";
  }
  if (text.includes("nasa") || text.includes("space") || text.includes("science")) {
    return "Science";
  }
  if (
    text.includes("github") ||
    text.includes("netflix") ||
    text.includes("hackernews") ||
    text.includes("ycombinator") ||
    text.includes("increment") ||
    text.includes("engineering") ||
    text.includes("arstechnica")
  ) {
    return "Engineering";
  }
  if (text.includes("verge") || text.includes("techcrunch") || text.includes("wired") || text.includes("tech")) {
    return "Tech";
  }
  if (text.includes("css") || text.includes("design") || text.includes("smashing")) {
    return "Design";
  }
  return "Tech";
}
