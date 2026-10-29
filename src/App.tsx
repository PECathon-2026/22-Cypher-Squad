import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Circle,
  Compass,
  Download,
  Eye,
  EyeOff,
  Feather,
  Globe2,
  Info,
  Library,
  ListFilter,
  Menu,
  MoreHorizontal,
  Plus,
  Radio,
  Settings,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { cacheArticle, extractArticle, getCachedArticle } from "./lib/article";
import { resolveFeedUrl } from "./lib/feed";
import { clearReaderCache, readerDb, seedDatabase, setDiscoveryEnabled, trimPostCache, type LocalPost } from "./lib/db";
import { flushContributionOutbox, getPopularFeeds, getRecommendations, submitContribution, type DiscoveryFeedItem } from "./lib/discovery";
import { refreshFeed } from "./lib/refresh";

type Post = {
  id: string;
  feed: string;
  feedUrl: string;
  title: string;
  summary: string;
  contentHtml?: string;
  minutes: number;
  published: string;
  publishedAt: string;
  viewed: boolean;
  accent: string;
  articleUrl?: string;
  articleHtml?: string;
  articleSource?: "extracted" | "feed-content" | "summary-fallback";
};

type Feed = {
  id: string;
  name: string;
  url: string;
  description: string;
  posts: number;
  status: "synced" | "attention" | "offline" | "temporary-error" | "malformed" | "empty" | "access-challenge";
  error?: string;
  lastFetchedAt?: string;
};

const initialFeeds: Feed[] = [
  {
    id: "moss-signal",
    name: "Moss & Signal",
    url: "mossandsignal.example/feed.xml",
    description: "Tools, field notes, and the useful things between disciplines.",
    posts: 12,
    status: "synced",
  },
  {
    id: "long-afternoon",
    name: "The Long Afternoon",
    url: "longafternoon.example/rss",
    description: "Small observations from a life built around making.",
    posts: 8,
    status: "synced",
  },
  {
    id: "quiet-machines",
    name: "Quiet Machines",
    url: "quietmachines.example/atom.xml",
    description: "A gentle magazine about technology, craft, and attention.",
    posts: 5,
    status: "attention",
  },
];

const initialPosts: Post[] = [
  {
    id: "slow-tools",
    feed: "Moss & Signal",
    feedUrl: "mossandsignal.example/feed.xml",
    title: "A field guide to slow tools",
    summary:
      "The best tools do not disappear. They teach you their shape, then get out of the way.",
    minutes: 8,
    published: "12 minutes ago",
    publishedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    viewed: false,
    accent: "sage",
  },
  {
    id: "shared-workshop",
    feed: "The Long Afternoon",
    feedUrl: "longafternoon.example/rss",
    title: "Notes from a shared workshop",
    summary:
      "What changes when the room is designed for unfinished work instead of finished objects.",
    minutes: 6,
    published: "Yesterday",
    publishedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    viewed: false,
    accent: "ochre",
  },
  {
    id: "attention",
    feed: "Quiet Machines",
    feedUrl: "quietmachines.example/atom.xml",
    title: "The shape of attention",
    summary:
      "A short argument for leaving a little friction in the places where we want to remember.",
    minutes: 5,
    published: "2 days ago",
    publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    viewed: true,
    accent: "clay",
  },
  {
    id: "morning-light",
    feed: "Moss & Signal",
    feedUrl: "mossandsignal.example/feed.xml",
    title: "Working with the morning light",
    summary:
      "A desk, a window, and the first twenty minutes before the day begins asking for things.",
    minutes: 4,
    published: "3 days ago",
    publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    viewed: true,
    accent: "sage",
  },
];

const recommendations = [
  {
    name: "Signal & Craft",
    url: "signalcraft.example/feed.xml",
    detail: "14 demo contributions",
    reason: "A calm mix of design practice and independent work.",
    accent: "ochre",
  },
  {
    name: "The Marginalia Project",
    url: "marginalia.example/atom.xml",
    detail: "9 demo contributions",
    reason: "Notes on books, places, and the ideas that stay.",
    accent: "sage",
  },
];

const navItems = [
  { to: "/", label: "Timeline", icon: BookOpen },
  { to: "/subscriptions", label: "Subscriptions", icon: Library },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/settings", label: "Settings", icon: Settings },
];

function App() {
  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem("small-reader-posts");
    return saved ? (JSON.parse(saved) as Post[]) : initialPosts;
  });
  const [feeds, setFeeds] = useState<Feed[]>(() => {
    const saved = localStorage.getItem("small-reader-feeds");
    return saved ? (JSON.parse(saved) as Feed[]) : initialFeeds;
  });
  const [offline, setOffline] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    localStorage.setItem("small-reader-posts", JSON.stringify(posts));
    void readerDb.posts.bulkPut(posts.map(toLocalPost));
  }, [posts]);
  useEffect(() => {
    localStorage.setItem("small-reader-feeds", JSON.stringify(feeds));
    void readerDb.feeds.bulkPut(feeds);
  }, [feeds]);
  useEffect(() => {
    void (async () => {
      await seedDatabase(feeds, posts.map(toLocalPost));
      const [storedFeeds, storedPosts] = await Promise.all([
        readerDb.feeds.toArray(),
        readerDb.posts.toArray(),
      ]);
      if (storedFeeds.length) setFeeds(storedFeeds);
      if (storedPosts.length) setPosts(storedPosts.map(fromLocalPost));
      if (navigator.onLine) await refreshAllFeeds(storedFeeds.length ? storedFeeds : feeds);
    })();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false);
      void flushContributionOutbox().catch(() => undefined);
      void refreshAllFeeds(feeds);
    };
    const handleOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [feeds]);

  const unreadCount = posts.filter((post) => !post.viewed).length;
  const markViewed = (id: string, viewed = true) => {
    setPosts((current) =>
      current.map((post) => (post.id === id ? { ...post, viewed } : post)),
    );
  };
  const addFeed = async (inputUrl: string): Promise<string | null> => {
    try {
      const resolved = await resolveFeedUrl(inputUrl);
      const feedId = resolved.url;
      if (feeds.some((feed) => feed.id === feedId)) {
        return "That feed is already in your subscriptions.";
      }
      const newFeed: Feed = {
        id: feedId,
        name: resolved.title,
        url: resolved.url,
        description: resolved.description || `A ${resolved.format.toUpperCase()} feed from ${new URL(resolved.url).hostname}.`,
        posts: resolved.entries.length,
        status: "synced",
        lastFetchedAt: new Date().toISOString(),
      };
      const newPosts = resolved.entries.map((entry, index): Post => ({
        id: `${feedId}#${entry.id}`,
        feed: resolved.title,
        feedUrl: resolved.url,
        title: entry.title,
        summary: entry.summary,
        contentHtml: entry.contentHtml,
        minutes: Math.max(1, Math.ceil(entry.summary.split(/\s+/).length / 180)),
        published: formatPublishedDate(entry.publishedAt),
        publishedAt: entry.publishedAt,
        viewed: false,
        accent: ["sage", "ochre", "clay"][index % 3],
        articleUrl: entry.url,
      }));
      setFeeds((current) => [...current, newFeed]);
      setPosts((current) => [...newPosts, ...current]);
      await trimPostCache();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "The feed could not be loaded.";
    }
  };
  async function refreshAllFeeds(targetFeeds: Feed[]) {
    if (refreshing || !navigator.onLine) return;
    setRefreshing(true);
    const results = await Promise.all(targetFeeds.map(async (current) => ({
      current,
      result: await refreshFeed(current.url),
    })));
    const refreshedFeeds = new Map<string, Feed>();
    const refreshedPosts: Post[] = [];
    for (const { current, result } of results) {
      const nextFeed = { ...current, status: result.status, error: result.error, lastFetchedAt: new Date().toISOString() };
      refreshedFeeds.set(current.id, nextFeed);
      if (result.feed) {
        refreshedPosts.push(...result.feed.entries.map((entry, index): Post => ({
          id: `${current.id}#${entry.id}`,
          feed: result.feed!.title,
          feedUrl: current.url,
          title: entry.title,
          summary: entry.summary,
          contentHtml: entry.contentHtml,
          minutes: Math.max(1, Math.ceil(entry.summary.split(/\s+/).length / 180)),
          published: formatPublishedDate(entry.publishedAt),
          publishedAt: entry.publishedAt,
          viewed: false,
          accent: ["sage", "ochre", "clay"][index % 3],
          articleUrl: entry.url,
        })));
      }
    }
    setFeeds((current) => current.map((feed) => refreshedFeeds.get(feed.id) ?? feed));
    setPosts((current) => {
      const existing = new Map(current.map((post) => [post.id, post]));
      for (const post of refreshedPosts) {
        const previous = existing.get(post.id);
        existing.set(post.id, { ...post, viewed: previous?.viewed ?? false, articleHtml: previous?.articleHtml, articleSource: previous?.articleSource });
      }
      return [...existing.values()];
    });
    setRefreshing(false);
    await trimPostCache();
  }
  const removeFeed = (feedId: string) => {
    setFeeds((current) => current.filter((feed) => feed.id !== feedId));
    setPosts((current) => current.filter((post) => post.feedUrl !== feedId));
    void readerDb.feeds.delete(feedId);
    void readerDb.posts.where("feedUrl").equals(feedId).delete();
  };
  const clearCache = () => {
    setPosts([]);
    void clearReaderCache();
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <NavLink to="/" className="wordmark">
          <Feather size={17} strokeWidth={2.2} />
          <span>small web reader</span>
        </NavLink>
        <StatusButton offline={offline} onToggle={() => setOffline((value) => !value)} />
      </header>

      {mobileMenu && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileMenu(false)}>
          <aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-heading">
              <span className="eyebrow">Your reading room</span>
              <button className="icon-button" onClick={() => setMobileMenu(false)} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <Navigation closeMenu={() => setMobileMenu(false)} />
          </aside>
        </div>
      )}

      <div className="desktop-layout">
        <aside className="sidebar">
          <div className="brand-lockup">
            <div className="brand-mark"><Feather size={18} /></div>
            <div>
              <span className="wordmark">small web reader</span>
              <span className="brand-caption">a quiet queue for the open web</span>
            </div>
          </div>
          <Navigation />
          <div className="sidebar-foot">
            <div className="local-note">
              <ShieldCheck size={16} />
              <span>Your reading state stays on this device.</span>
            </div>
            <StatusButton offline={offline} onToggle={() => setOffline((value) => !value)} />
          </div>
        </aside>

        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={
                <TimelinePage
                  posts={posts}
                  feeds={feeds}
                  onAddFeed={addFeed}
                  unreadCount={unreadCount}
                  onMarkViewed={markViewed}
                  offline={offline}
                  refreshing={refreshing}
                  onRefresh={() => void refreshAllFeeds(feeds)}
                />
              }
            />
            <Route
              path="/subscriptions"
              element={<SubscriptionsPage feeds={feeds} onAddFeed={addFeed} onRemoveFeed={removeFeed} />}
            />
            <Route
              path="/discover"
              element={<DiscoverPage feeds={feeds} offline={offline} onAddFeed={addFeed} />}
            />
            <Route path="/settings" element={<SettingsPage offline={offline} onClearCache={clearCache} />} />
            <Route path="/read" element={<ReaderPage posts={posts} feeds={feeds} onAddFeed={addFeed} onMarkViewed={markViewed} offline={offline} />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function toLocalPost(post: Post): LocalPost {
  return {
    ...post,
    postId: post.id,
    url: post.articleUrl ?? post.feedUrl,
    summary: post.summary,
  };
}

function fromLocalPost(post: LocalPost): Post {
  return {
    ...post,
    id: post.postId,
    published: formatPublishedDate(post.publishedAt),
    articleUrl: post.url,
  };
}

function Navigation({ closeMenu }: { closeMenu?: () => void }) {
  return (
    <nav className="primary-nav" aria-label="Primary navigation">
      <span className="nav-section-label">Your room</span>
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={closeMenu}
          className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
        >
          <Icon size={18} strokeWidth={1.8} />
          <span>{label}</span>
          {label === "Timeline" && <span className="nav-count">3</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function StatusButton({ offline, onToggle }: { offline: boolean; onToggle: () => void }) {
  return (
    <button className={`connection-status ${offline ? "is-offline" : ""}`} onClick={onToggle}>
      {offline ? <WifiOff size={15} /> : <Wifi size={15} />}
      <span>{offline ? "Offline · cached" : "Online · synced"}</span>
    </button>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function TimelinePage({
  posts,
  feeds,
  onAddFeed,
  unreadCount,
  onMarkViewed,
  offline,
  refreshing,
  onRefresh,
}: {
  posts: Post[];
  feeds: Feed[];
  onAddFeed: (url: string) => Promise<string | null>;
  unreadCount: number;
  onMarkViewed: (id: string, viewed?: boolean) => void;
  offline: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState("All feeds");
  const [showUnread, setShowUnread] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [feedError, setFeedError] = useState("");
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const filteredPosts = useMemo(() => {
    return posts
      .filter((post) => filter === "All feeds" || post.feed === filter)
      .filter((post) => !showUnread || !post.viewed)
      .sort((a, b) => {
        if (a.viewed !== b.viewed) return a.viewed ? 1 : -1;
        return getPublishedTime(b) - getPublishedTime(a);
      });
  }, [filter, posts, showUnread]);

  const submitFeed = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedUrl = feedUrl.trim();
    if (!trimmedUrl) {
      setFeedError("Enter a blog or feed URL.");
      return;
    }

    try {
      const parsedUrl = new URL(trimmedUrl.includes("://") ? trimmedUrl : `https://${trimmedUrl}`);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Unsupported protocol");
      }
      setIsAddingFeed(true);
      const error = await onAddFeed(parsedUrl.toString());
      setIsAddingFeed(false);
      if (error) {
        setFeedError(error);
        return;
      }
      setFeedUrl("");
      setFeedError("");
      setShowAddFeed(false);
    } catch {
      setFeedError("Enter a valid http:// or https:// URL.");
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Your reading queue"
        title="Make room for good things."
        description="A single, unhurried place for the independent blogs you choose to follow."
        action={<button className="primary-button" onClick={() => setShowAddFeed(true)}><Plus size={17} /> Add a feed</button>}
      />

      <div className="queue-toolbar">
        <div className="select-wrap">
          <ListFilter size={16} />
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by feed">
            <option>All feeds</option>
            {feeds.map((feed) => <option key={feed.id}>{feed.name}</option>)}
          </select>
          <ChevronDown size={15} />
        </div>
        <button className={`filter-button ${showUnread ? "selected" : ""}`} onClick={() => setShowUnread((value) => !value)}>
          <Circle size={11} fill={showUnread ? "currentColor" : "none"} />
          {showUnread ? "Unread only" : `${unreadCount} unread`}
        </button>
        {offline && <span className="offline-note"><WifiOff size={14} /> Showing your saved queue</span>}
      </div>

      <section className="reading-rail" aria-label="Reading queue">
        {filteredPosts.map((post) => (
          <PostRow key={post.id} post={post} onMarkViewed={onMarkViewed} />
        ))}
        {filteredPosts.length === 0 && (
          <div className="empty-state">
            <BookOpen size={24} />
            <h2>Nothing waiting here.</h2>
            <p>Try another feed or return when the web has brought you something new.</p>
          </div>
        )}
      </section>

      <div className="queue-footer">
        <span><Download size={15} /> Saved locally for offline reading</span>
        <button className="quiet-button" onClick={onRefresh} disabled={refreshing || offline}>
          <Radio size={15} /> {refreshing ? "Refreshing feeds…" : offline ? "Offline" : "Refresh feeds"}
        </button>
      </div>

      {showAddFeed && (
        <div className="modal-backdrop" onClick={() => setShowAddFeed(false)}>
          <div className="modal add-feed-modal" role="dialog" aria-modal="true" aria-labelledby="add-feed-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddFeed(false)} aria-label="Close add feed dialog">
              <X size={18} />
            </button>
            <span className="eyebrow">New subscription</span>
            <h2 id="add-feed-title">Bring a feed into your room.</h2>
            <p>Paste a blog URL or a direct RSS/Atom URL. We’ll find the feed, validate it, and save its posts locally.</p>
            <form className="modal-form" onSubmit={submitFeed}>
              <label htmlFor="feed-url">Feed or blog URL</label>
              <div className="input-with-icon">
                <Globe2 size={17} />
                <input
                  id="feed-url"
                  type="url"
                  value={feedUrl}
                  onChange={(event) => {
                    setFeedUrl(event.target.value);
                    setFeedError("");
                  }}
                  placeholder="https://example.com/feed.xml"
                  autoFocus
                />
              </div>
              {feedError && <span className="form-error" role="alert">{feedError}</span>}
              <button className="primary-button full-width" type="submit" disabled={isAddingFeed}>
                <Plus size={17} /> {isAddingFeed ? "Finding feed…" : "Add feed"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PostRow({ post, onMarkViewed }: { post: Post; onMarkViewed: (id: string, viewed?: boolean) => void }) {
  const navigate = useNavigate();
  return (
    <article className={`post-row ${post.viewed ? "viewed" : ""}`}>
      <div className={`post-marker ${post.accent}`} aria-hidden="true">
        {post.viewed ? <Check size={14} /> : <span />}
      </div>
      <div className="post-content">
        <div className="post-meta">
          <span className="feed-name">{post.feed}</span>
          <span>{post.published}</span>
          <span>{post.minutes} min read</span>
        </div>
        <button className="post-title" onClick={() => navigate(`/read?post=${encodeURIComponent(post.id)}`)}>{post.title}</button>
        {post.summary ? <p className="post-summary">{post.summary.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</p> : null}
        <div className="post-actions">
          <button onClick={() => navigate(`/read?post=${encodeURIComponent(post.id)}`)}>Read story <ArrowUpRight size={14} /></button>
          <button onClick={() => onMarkViewed(post.id, !post.viewed)}>
            {post.viewed ? <><EyeOff size={14} /> Mark unread</> : <><Eye size={14} /> Mark read</>}
          </button>
        </div>
      </div>
      <button className="more-button" aria-label={`More actions for ${post.title}`}><MoreHorizontal size={18} /></button>
    </article>
  );
}

function SubscriptionsPage({ feeds, onAddFeed, onRemoveFeed }: { feeds: Feed[]; onAddFeed: (url: string) => Promise<string | null>; onRemoveFeed: (feedId: string) => void }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setMessage("");
    setError("");
    const result = await onAddFeed(url.trim());
    setLoading(false);
    if (result) {
      setError(result);
      return;
    }
    setMessage("Feed found and saved locally.");
    setUrl("");
  };
  return (
    <div className="page">
      <PageHeader
        eyebrow="Your subscriptions"
        title="Keep the good ones close."
        description="Feeds live on this device, so your list stays yours."
      />
      <form className="add-feed-form" onSubmit={submit}>
        <div className="input-with-icon"><Globe2 size={17} /><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a blog or feed URL" aria-label="Feed URL" /></div>
        <button className="primary-button" type="submit" disabled={loading}><Plus size={17} /> {loading ? "Finding feed…" : "Follow feed"}</button>
      </form>
      {message && <div className="inline-message"><Check size={16} /> {message}</div>}
      {error && <div className="inline-message error-message">{error}</div>}
      <section className="feed-list">
        {feeds.map((feed) => (
          <article className="feed-item" key={feed.id}>
            <div className="feed-icon"><Radio size={18} /></div>
            <div className="feed-item-body">
              <div className="feed-item-title"><h2>{feed.name}</h2><span className={`status-dot ${feed.status}`} /> </div>
              <p>{feed.description}</p>
              {feed.error && <span className="feed-error">{feed.error}</span>}
              <span className="feed-url">{feed.url}</span>
            </div>
            <div className="feed-item-side"><strong>{feed.posts || "—"}</strong><span>posts saved</span><button onClick={() => onRemoveFeed(feed.id)}>Unfollow</button></div>
          </article>
        ))}
      </section>
    </div>
  );
}

function DiscoverPage({ feeds, offline, onAddFeed }: { feeds: Feed[]; offline: boolean; onAddFeed: (url: string) => Promise<string | null> }) {
  const [personalized, setPersonalized] = useState(false);
  const [sharingLoaded, setSharingLoaded] = useState(false);
  const [liveRecommendations, setLiveRecommendations] = useState<DiscoveryFeedItem[]>([]);
  const [livePopular, setLivePopular] = useState<DiscoveryFeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showContribution, setShowContribution] = useState(false);
  const [contributionState, setContributionState] = useState("");
  const followedUrls = new Set(feeds.map((feed) => feed.url));
  const loadDiscovery = async () => {
    if (offline) return;
    setLoading(true);
    try {
      if (personalized) setLiveRecommendations(await getRecommendations(feeds.map((feed) => feed.url)));
      else setLivePopular(await getPopularFeeds());
    } catch {
      setContributionState("Discovery is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void readerDb.sharingState.get("discovery").then((state) => {
      if (state) setPersonalized(state.enabled);
      setSharingLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!sharingLoaded) return;
    void setDiscoveryEnabled(personalized);
    void loadDiscovery();
  }, [personalized, offline, sharingLoaded]);
  return (
    <div className="page">
      <PageHeader
        eyebrow="A wider reading room"
        title="Find another good corner."
        description="Recommendations are based on anonymous aggregate signals, never on a profile of you."
      />
      <section className="privacy-strip"><ShieldCheck size={18} /><div><strong>Private by default.</strong><span>{personalized ? "Eligible feed URLs may be sent transiently for ranking." : "Your subscriptions stay here until you choose otherwise."}</span></div><button onClick={() => setPersonalized((value) => !value)}>{personalized ? "Turn off" : "Learn about this"}</button></section>
      <section className="discover-section">
        <div className="section-heading"><div><span className="eyebrow">{personalized ? "For this reading room" : "Aggregate signals"}</span><h2>{personalized ? "Feeds linked to yours" : "Popular with other readers"}</h2></div><button className="quiet-button" onClick={() => void loadDiscovery()} disabled={loading}><Sparkles size={16} /> {loading ? "Loading…" : "Refresh"}</button></div>
        <div className="recommendation-grid">
          {(personalized ? liveRecommendations : livePopular).filter((item) => !followedUrls.has(item.url)).map((item) => (
            <article className="recommendation-card" key={item.url}>
              <div className="recommendation-swatch sage" />
              <div className="recommendation-body"><div className="recommendation-meta"><span>{item.score ? `${item.score} aggregate signal${item.score === 1 ? "" : "s"}` : "Suggested feed"}</span><span className="flex items-center gap-1.5">{typeof item.liveSignals === "number" && item.liveSignals > 0 ? <span className="text-[#527a5d] font-semibold">{item.liveSignals} live</span> : null}{typeof item.seededSignals === "number" && item.seededSignals > 0 ? <span>{item.seededSignals} seed</span> : null}{!item.liveSignals && !item.seededSignals ? <span>{personalized ? "live ranking" : "aggregate data"}</span> : null}</span></div><h3>{item.url}</h3><p>{item.reason ?? "A feed surfaced from anonymous aggregate signals."}</p><button className="secondary-button" onClick={() => void onAddFeed(item.url)}><Plus size={15} /> Follow feed</button></div>
            </article>
          ))}
        </div>
      </section>
      <section className="contribution-panel">
        <div><span className="eyebrow">Optional contribution</span><h2>Help the room get smarter.</h2><p>Share up to 20 selected feeds in one anonymous batch. This is separate from asking for recommendations and never creates an account.</p></div>
        <div className="contribution-actions">{offline && <span className="offline-note"><WifiOff size={14} /> Queued until you are online</span>}<button className="secondary-button" onClick={() => setShowContribution(true)} disabled={!personalized}><ShieldCheck size={15} /> Contribute selected feeds</button>{!personalized && <small>Enable personalized discovery first</small>}</div>
      </section>
      {contributionState && <div className="inline-message">{contributionState}</div>}
      {showContribution && <div className="modal-backdrop" onClick={() => setShowContribution(false)}><div className="modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowContribution(false)} aria-label="Close"><X size={18} /></button><span className="eyebrow">Review before sending</span><h2>These feeds will be included.</h2><p>No account or permanent reader ID is created. Accepted contributions update aggregate counts and cannot later be attributed to one person.</p><div className="review-list">{feeds.slice(0, 20).map((feed) => <div key={feed.id}><Check size={15} />{feed.name}</div>)}</div><button className="primary-button full-width" onClick={async () => { try { setContributionState("Sending contribution…"); await submitContribution(feeds.slice(0, 20).map((feed) => feed.url)); setContributionState("Contribution accepted."); setShowContribution(false); } catch { setContributionState("Contribution could not be sent. Try again when the backend is available."); } }}>Confirm contribution</button></div></div>}
    </div>
  );
}

function SettingsPage({ offline, onClearCache }: { offline: boolean; onClearCache: () => void }) {
  return (
    <div className="page">
      <PageHeader eyebrow="Preferences and privacy" title="Keep the edges simple." description="Small controls for a reading room that belongs to you." />
      <section className="settings-list">
        <div className="setting-row"><div className="setting-icon"><WifiOff size={18} /></div><div><h2>Offline reading</h2><p>{offline ? "You are viewing saved content. New feeds will wait until the connection returns." : "Your queue and opened articles are kept locally for offline reading."}</p></div><span className="setting-value">On</span></div>
        <div className="setting-row"><div className="setting-icon"><Download size={18} /></div><div><h2>Local cache</h2><p>Keep the newest 100 posts per feed and up to 200 opened article bodies.</p></div><button className="quiet-button" onClick={onClearCache}>Clear cache</button></div>
        <div className="setting-row"><div className="setting-icon"><ShieldCheck size={18} /></div><div><h2>Anonymous discovery</h2><p>Off by default. Recommendations and contributions are separate actions.</p></div><span className="setting-value muted">Off</span></div>
      </section>
      <div className="privacy-card"><Info size={18} /><div><strong>What never leaves this device</strong><p>Reading state, opened article content, and your subscription list stay local unless you explicitly opt in to a discovery request or contribution.</p></div></div>
    </div>
  );
}

function ReaderPage({
  posts,
  feeds,
  onAddFeed,
  onMarkViewed,
  offline,
}: {
  posts: Post[];
  feeds: Feed[];
  onAddFeed: (url: string) => Promise<string | null>;
  onMarkViewed: (id: string, viewed?: boolean) => void;
  offline: boolean;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const postId = searchParams.get("post");
  const post = posts.find((item) => item.id === postId);
  const [article, setArticle] = useState<{ html: string; title: string; excerpt: string; source: string } | null>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<DiscoveryFeedItem[]>([]);
  const [followMessage, setFollowMessage] = useState<string>("");

  useEffect(() => {
    if (!post) return;
    setArticle(null);
    if (!post.viewed) onMarkViewed(post.id, true);
    let active = true;
    void (async () => {
      const cached = await getCachedArticle(post.id);
      if (cached) {
        if (active) setArticle(cached);
        return;
      }
      if (offline) {
        if (active) setArticle({ html: "", title: post.title, excerpt: post.summary, source: "summary-fallback" });
        return;
      }
      const result = await extractArticle(post.articleUrl ?? post.feedUrl, post.summary, post.title, post.contentHtml, post.feedUrl);
      await cacheArticle(post.id, result);
      if (active) setArticle(result);
    })();
    return () => {
      active = false;
    };
  }, [offline, onMarkViewed, post]);

  useEffect(() => {
    if (!post || offline) return;
    let active = true;
    void (async () => {
      try {
        const state = await readerDb.sharingState.get("discovery");
        if (!state?.enabled) return;
        const results = await getRecommendations(feeds.map((f) => f.url), post.feedUrl);
        if (active) {
          const followedSet = new Set(feeds.map((f) => f.url));
          setRelatedBlogs(results.filter((item) => !followedSet.has(item.url)).slice(0, 4));
        }
      } catch {
        // Soft fallback for progressive discovery
      }
    })();
    return () => {
      active = false;
    };
  }, [post?.feedUrl, feeds, offline]);

  if (!post) {
    return (
      <div className="reader-page">
        <button className="back-button" onClick={() => navigate("/")}><ArrowLeft size={16} /> Back to queue</button>
        <div className="empty-state">
          <BookOpen size={24} />
          <h2>This story is no longer saved.</h2>
          <p>Return to your queue and choose another post.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="reader-page">
      <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back to queue</button>
      <article className="reader-article">
        <div className="reader-meta"><span>{post.feed}</span><span>{post.published}</span><span>{post.minutes} min read</span>{offline && <span><WifiOff size={13} /> Saved copy</span>}</div>
        <h1>{article?.title ?? post.title}</h1>
        <p className="reader-deck">{article?.excerpt ?? post.summary}</p>
        <div className="reader-rule" />
        {article?.html ? (
          <div className="article-content" dangerouslySetInnerHTML={{ __html: article.html }} />
        ) : (
          <>
            <p className="reader-fallback">The full article could not be extracted, so the feed summary is shown instead.</p>
            <p>{post.summary}</p>
          </>
        )}
        <a className="original-link" href={post.articleUrl ?? post.feedUrl} target="_blank" rel="noreferrer">Open original source <ArrowUpRight size={15} /></a>

        {relatedBlogs.length > 0 && (
          <section className="discover-section mt-10 pt-7 border-t border-line">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Discovery</span>
                <h2 className="text-xl font-serif font-medium">Blogs like {post.feed}</h2>
              </div>
            </div>
            <p className="text-muted text-xs mb-3">Discovered through anonymous co-subscription patterns with this blog.</p>
            {followMessage && <div className="inline-message"><Check size={14} /> {followMessage}</div>}
            <div className="recommendation-grid grid-cols-1">
              {relatedBlogs.map((item) => (
                <article className="recommendation-card" key={item.url}>
                  <div className="recommendation-swatch ochre" />
                  <div className="recommendation-body p-4">
                    <div className="recommendation-meta">
                      <span>{item.score ? `${item.score} signals` : "Related feed"}</span>
                      <span className="flex items-center gap-1">
                        {item.liveSignals ? <span className="text-[#527a5d] font-semibold">{item.liveSignals} live</span> : null}
                        {item.seededSignals ? <span>{item.seededSignals} seed</span> : null}
                      </span>
                    </div>
                    <h3 className="text-base mt-2 mb-1">{item.name || item.url}</h3>
                    <p className="text-xs text-muted mb-3">{item.reason || `Readers of ${post.feed} also follow this blog.`}</p>
                    <button
                      className="secondary-button text-xs py-1.5 px-3"
                      onClick={async () => {
                        const err = await onAddFeed(item.url);
                        if (!err) {
                          setFollowMessage(`Followed ${item.name || item.url}`);
                          setRelatedBlogs((prev) => prev.filter((b) => b.url !== item.url));
                        }
                      }}
                    >
                      <Plus size={13} /> Follow blog
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}

function formatPublishedDate(value: string): string {
  const date = new Date(value);
  if (date.getTime() === 0) return "Date unavailable";
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / 86_400_000),
    "day",
  );
}

function getPublishedTime(post: Post): number {
  const timestamp = Date.parse(post.publishedAt);
  if (!Number.isNaN(timestamp)) return timestamp;

  const relative = post.published.match(/(\d+)\s+(minute|hour|day)s?\s+ago/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const multiplier = unit === "minute" ? 60_000 : unit === "hour" ? 3_600_000 : 86_400_000;
    return Date.now() - amount * multiplier;
  }
  if (post.published.toLowerCase() === "yesterday") {
    return Date.now() - 86_400_000;
  }
  return 0;
}

export default App;
