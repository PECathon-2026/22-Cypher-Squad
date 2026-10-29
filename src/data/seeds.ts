export type SeedFeed = { name: string; url: string; description: string };

export const seedFeeds: SeedFeed[] = [
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml", description: "Independent global news." },
  { name: "Hacker News", url: "https://hnrss.org/frontpage", description: "Technology and startup links." },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml", description: "Technology, culture, and science." },
  { name: "NYT Technology", url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", description: "Technology reporting from The New York Times." },
  { name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", description: "Internet infrastructure and security." },
  { name: "Netflix TechBlog", url: "https://netflixtechblog.com/feed", description: "Engineering at Netflix." },
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/", description: "Web design and development." },
  { name: "CSS-Tricks", url: "https://css-tricks.com/feed/", description: "Front-end web development." },
  { name: "Wired", url: "https://www.wired.com/feed/rss", description: "Ideas and technology." },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", description: "Technology and science." },
  { name: "NASA Breaking News", url: "https://www.nasa.gov/rss/dyn/breaking_news.rss", description: "Space and science news." },
  { name: "Increment", url: "https://increment.com/feed.xml", description: "Stories about technology and teams." },
];
