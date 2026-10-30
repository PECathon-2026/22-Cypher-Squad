export type SeedFeed = {
  name: string;
  url: string;
  description: string;
  category?: string;
};

export const seedFeeds: SeedFeed[] = [
  {
    name: "BBC News",
    url: "https://feeds.bbci.co.uk/news/rss.xml",
    description: "Independent global journalism and world reporting.",
    category: "News",
  },
  {
    name: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    description: "Covering the intersection of technology, science, art, and culture.",
    category: "Tech",
  },
  {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    description: "Startup and technology news, funding, and product analysis.",
    category: "Tech",
  },
  {
    name: "Hacker News",
    url: "https://news.ycombinator.com/rss",
    description: "Technology, engineering, startups, and open internet discussions.",
    category: "Engineering",
  },
  {
    name: "Wired",
    url: "https://www.wired.com/feed/rss",
    description: "Long-form insights into technology, science, business, and design.",
    category: "Tech",
  },
  {
    name: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    description: "Deep technical analysis of technology, policy, and scientific research.",
    category: "Engineering",
  },
  {
    name: "The Guardian",
    url: "https://www.theguardian.com/world/rss",
    description: "World news, independent investigative reporting, and international analysis.",
    category: "News",
  },
  {
    name: "NASA News Releases",
    url: "https://www.nasa.gov/news-release/feed/",
    description: "Space exploration, astronomical discoveries, and aeronautics research.",
    category: "Science",
  },
  {
    name: "NPR News",
    url: "https://feeds.npr.org/1001/rss.xml",
    description: "In-depth public radio reporting on international events, culture, and science.",
    category: "News",
  },
  {
    name: "The GitHub Blog",
    url: "https://github.blog/feed/",
    description: "Software engineering insights, developer tools, and platform updates.",
    category: "Engineering",
  },
  {
    name: "Netflix TechBlog",
    url: "https://netflixtechblog.com/feed",
    description: "Distributed systems, cloud infrastructure, and streaming engineering at Netflix.",
    category: "Engineering",
  },
  {
    name: "Increment",
    url: "https://increment.com/feed.xml",
    description: "A quarterly magazine dedicated to software architecture, operations, and teams.",
    category: "Engineering",
  },
  {
    name: "CSS-Tricks",
    url: "https://css-tricks.com/feed/",
    description: "Modern CSS, web performance, front-end architecture, and design systems.",
    category: "Design",
  },
  // Deliberate Trap seeds for Bonus Quest (alternate URLs pointing to the same publications)
  {
    name: "Hacker News (Alternate)",
    url: "https://hnrss.org/frontpage",
    description: "Alternative RSS gateway for Hacker News front page.",
    category: "Engineering",
  },
  {
    name: "NASA Breaking News (Alternate)",
    url: "https://www.nasa.gov/rss/dyn/breaking_news.rss",
    description: "Alternative legacy feed URL for NASA breaking news.",
    category: "Science",
  },
];
