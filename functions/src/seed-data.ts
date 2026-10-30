export type SeedFeed = {
  name: string;
  normalizedUrl: string;
  description: string;
  category?: string;
};

export type SeedPair = {
  feedA: string;
  feedB: string;
  count: number;
};

export const seedFeeds: SeedFeed[] = [
  {
    name: "BBC News",
    normalizedUrl: "https://feeds.bbci.co.uk/news/rss.xml",
    description: "Independent global journalism and world reporting.",
    category: "News",
  },
  {
    name: "The Verge",
    normalizedUrl: "https://www.theverge.com/rss/index.xml",
    description: "Covering the intersection of technology, science, art, and culture.",
    category: "Tech",
  },
  {
    name: "TechCrunch",
    normalizedUrl: "https://techcrunch.com/feed/",
    description: "Startup and technology news, funding, and product analysis.",
    category: "Tech",
  },
  {
    name: "Hacker News",
    normalizedUrl: "https://news.ycombinator.com/rss",
    description: "Technology, engineering, startups, and open internet discussions.",
    category: "Engineering",
  },
  {
    name: "Wired",
    normalizedUrl: "https://www.wired.com/feed/rss",
    description: "Long-form insights into technology, science, business, and design.",
    category: "Tech",
  },
  {
    name: "Ars Technica",
    normalizedUrl: "https://feeds.arstechnica.com/arstechnica/index",
    description: "Deep technical analysis of technology, policy, and scientific research.",
    category: "Engineering",
  },
  {
    name: "The Guardian",
    normalizedUrl: "https://www.theguardian.com/world/rss",
    description: "World news, independent investigative reporting, and international analysis.",
    category: "News",
  },
  {
    name: "NASA News Releases",
    normalizedUrl: "https://www.nasa.gov/news-release/feed/",
    description: "Space exploration, astronomical discoveries, and aeronautics research.",
    category: "Science",
  },
  {
    name: "NPR News",
    normalizedUrl: "https://feeds.npr.org/1001/rss.xml",
    description: "In-depth public radio reporting on international events, culture, and science.",
    category: "News",
  },
  {
    name: "The GitHub Blog",
    normalizedUrl: "https://github.blog/feed/",
    description: "Software engineering insights, developer tools, and platform updates.",
    category: "Engineering",
  },
  {
    name: "Netflix TechBlog",
    normalizedUrl: "https://netflixtechblog.com/feed",
    description: "Distributed systems, cloud infrastructure, and streaming engineering at Netflix.",
    category: "Engineering",
  },
  {
    name: "Increment",
    normalizedUrl: "https://increment.com/feed.xml",
    description: "A quarterly magazine dedicated to software architecture, operations, and teams.",
    category: "Engineering",
  },
  {
    name: "CSS-Tricks",
    normalizedUrl: "https://css-tricks.com/feed/",
    description: "Modern CSS, web performance, front-end architecture, and design systems.",
    category: "Design",
  },
  // Deliberate Trap seeds for Bonus Quest (alternate URLs pointing to the same publications)
  {
    name: "Hacker News (Alternate)",
    normalizedUrl: "https://hnrss.org/frontpage",
    description: "Alternative RSS gateway for Hacker News front page.",
    category: "Engineering",
  },
  {
    name: "NASA Breaking News (Alternate)",
    normalizedUrl: "https://www.nasa.gov/rss/dyn/breaking_news.rss",
    description: "Alternative legacy feed URL for NASA breaking news.",
    category: "Science",
  },
];

export const seedPairs: SeedPair[] = [
  {
    feedA: "https://www.theverge.com/rss/index.xml",
    feedB: "https://techcrunch.com/feed/",
    count: 14,
  },
  {
    feedA: "https://www.theverge.com/rss/index.xml",
    feedB: "https://www.wired.com/feed/rss",
    count: 12,
  },
  {
    feedA: "https://www.wired.com/feed/rss",
    feedB: "https://feeds.arstechnica.com/arstechnica/index",
    count: 16,
  },
  {
    feedA: "https://techcrunch.com/feed/",
    feedB: "https://news.ycombinator.com/rss",
    count: 15,
  },
  {
    feedA: "https://news.ycombinator.com/rss",
    feedB: "https://github.blog/feed/",
    count: 19,
  },
  {
    feedA: "https://news.ycombinator.com/rss",
    feedB: "https://feeds.arstechnica.com/arstechnica/index",
    count: 13,
  },
  {
    feedA: "https://github.blog/feed/",
    feedB: "https://netflixtechblog.com/feed",
    count: 11,
  },
  {
    feedA: "https://feeds.bbci.co.uk/news/rss.xml",
    feedB: "https://www.theguardian.com/world/rss",
    count: 17,
  },
  {
    feedA: "https://feeds.bbci.co.uk/news/rss.xml",
    feedB: "https://feeds.npr.org/1001/rss.xml",
    count: 14,
  },
  {
    feedA: "https://www.theguardian.com/world/rss",
    feedB: "https://feeds.npr.org/1001/rss.xml",
    count: 12,
  },
  {
    feedA: "https://www.nasa.gov/news-release/feed/",
    feedB: "https://feeds.arstechnica.com/arstechnica/index",
    count: 10,
  },
  {
    feedA: "https://www.nasa.gov/news-release/feed/",
    feedB: "https://www.wired.com/feed/rss",
    count: 9,
  },
  {
    feedA: "https://css-tricks.com/feed/",
    feedB: "https://github.blog/feed/",
    count: 8,
  },
  {
    feedA: "https://increment.com/feed.xml",
    feedB: "https://netflixtechblog.com/feed",
    count: 7,
  },
];
