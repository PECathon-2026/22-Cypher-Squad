import { useMemo, useState } from "react";
import { Plus, Check, Radio, Sparkles } from "lucide-react";
import type { DiscoveryFeedItem } from "../lib/discovery";
import { seedPairs } from "../../api/_lib/seed-data";

type GraphNode = {
  id: string;
  name: string;
  url: string;
  category: string;
  isFollowed: boolean;
  commonFollowers: number;
  x: number;
  y: number;
  color: string;
};

type GraphLink = {
  source: string;
  target: string;
  count: number;
};

export function NetworkGraph({
  userFeedUrls,
  recommendations,
  popularFeeds,
  onAddFeed,
}: {
  userFeedUrls: Set<string>;
  recommendations: DiscoveryFeedItem[];
  popularFeeds: DiscoveryFeedItem[];
  onAddFeed: (url: string) => Promise<string | null>;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [followMessage, setFollowMessage] = useState<string>("");

  const { nodes, links } = useMemo(() => {
    // Combine items
    const allItems = new Map<string, { name: string; url: string; category?: string; commonFollowers?: number }>();

    for (const rec of recommendations) {
      allItems.set(rec.url, {
        name: rec.name || new URL(rec.url).hostname,
        url: rec.url,
        category: rec.category || "Tech",
        commonFollowers: rec.commonFollowers || 0,
      });
    }

    for (const pop of popularFeeds) {
      if (!allItems.has(pop.url)) {
        allItems.set(pop.url, {
          name: pop.name || new URL(pop.url).hostname,
          url: pop.url,
          category: pop.category || "General",
          commonFollowers: pop.commonFollowers || 0,
        });
      }
    }

    const items = [...allItems.values()].slice(0, 16);
    const width = 720;
    const height = 480;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 80;

    const categoryColors: Record<string, string> = {
      Tech: "#d7a646",
      News: "#c97058",
      Science: "#527a5d",
      Engineering: "#40739e",
      Design: "#8c62aa",
      General: "#7f8c8d",
    };

    const graphNodes: GraphNode[] = items.map((item, idx) => {
      const angle = (idx / items.length) * 2 * Math.PI - Math.PI / 2;
      const dist = radius * (idx % 2 === 0 ? 0.95 : 0.72);
      return {
        id: item.url,
        name: item.name,
        url: item.url,
        category: item.category || "Tech",
        isFollowed: userFeedUrls.has(item.url),
        commonFollowers: item.commonFollowers ?? 0,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        color: categoryColors[item.category || "Tech"] || "#d7a646",
      };
    });

    const nodeUrlSet = new Set(graphNodes.map((n) => n.id));
    const graphLinks: GraphLink[] = [];

    for (const pair of seedPairs) {
      if (nodeUrlSet.has(pair.feedA) && nodeUrlSet.has(pair.feedB)) {
        graphLinks.push({
          source: pair.feedA,
          target: pair.feedB,
          count: pair.count,
        });
      }
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [userFeedUrls, recommendations, popularFeeds]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Connected links for selected node
  const connectedLinks = selectedNodeId
    ? links.filter((l) => l.source === selectedNodeId || l.target === selectedNodeId)
    : [];

  const handleFollow = async (url: string) => {
    const err = await onAddFeed(url);
    if (!err) {
      setFollowMessage(`Followed!`);
      setTimeout(() => setFollowMessage(""), 3000);
    }
  };

  return (
    <div className="network-graph-container bg-paper-deep/40 rounded-xl border border-line p-4 my-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-600" />
          <h3 className="font-semibold text-sm">Blogosphere Reader Overlap Graph</h3>
        </div>
        <span className="text-xs text-muted">
          Nodes: blogs · Edges: shared readers (thickness = overlap count)
        </span>
      </div>

      <div className="relative border border-line rounded-lg overflow-hidden bg-card-bg">
        <svg
          viewBox="0 0 720 480"
          className="w-full h-auto max-h-[460px] select-none"
          style={{ minHeight: "360px" }}
        >
          {/* Links */}
          {links.map((link, idx) => {
            const s = nodeMap.get(link.source);
            const t = nodeMap.get(link.target);
            if (!s || !t) return null;
            const isHighlighted = selectedNodeId && (link.source === selectedNodeId || link.target === selectedNodeId);
            const strokeWidth = Math.max(1.5, Math.min(5, link.count / 3));
            return (
              <g key={`link-${idx}`}>
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={isHighlighted ? "#d7a646" : "rgba(100, 116, 139, 0.25)"}
                  strokeWidth={isHighlighted ? strokeWidth + 1.5 : strokeWidth}
                  strokeDasharray={isHighlighted ? "none" : undefined}
                />
                {isHighlighted && (
                  <text
                    x={(s.x + t.x) / 2}
                    y={(s.y + t.y) / 2 - 4}
                    fill="#b45309"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="bg-white"
                  >
                    {link.count} common readers
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isFollowed = userFeedUrls.has(node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                className="cursor-pointer transition-transform duration-150 hover:scale-110"
              >
                <circle
                  r={isSelected ? 16 : isFollowed ? 13 : 11}
                  fill={node.color}
                  stroke={isSelected ? "#18221f" : "#ffffff"}
                  strokeWidth={isSelected ? 3 : 2}
                  className="shadow-sm"
                />
                {isFollowed && (
                  <circle r={4} fill="#ffffff" />
                )}
                <text
                  y={isSelected ? 26 : 22}
                  textAnchor="middle"
                  fontSize={isSelected ? "12" : "10"}
                  fontWeight={isSelected ? "bold" : "500"}
                  fill="currentColor"
                  className="pointer-events-none fill-stone-700 dark:fill-stone-200"
                >
                  {node.name.length > 18 ? `${node.name.slice(0, 16)}…` : node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected node card overlay */}
        {selectedNode && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-xs bg-paper-deep border border-line rounded-lg p-3 shadow-lg z-10">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider" style={{ backgroundColor: `${selectedNode.color}25`, color: selectedNode.color }}>
                  {selectedNode.category}
                </span>
                <h4 className="font-semibold text-sm mt-1">{selectedNode.name}</h4>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="text-muted hover:text-ink text-xs px-1"
                aria-label="Close details"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-muted mt-2 space-y-1">
              {connectedLinks.length > 0 ? (
                <div>
                  <span className="font-medium text-stone-700 dark:text-stone-300">Co-read with:</span>
                  <ul className="mt-1 space-y-0.5">
                    {connectedLinks.map((link, idx) => {
                      const peerId = link.source === selectedNode.id ? link.target : link.source;
                      const peer = nodeMap.get(peerId);
                      return (
                        <li key={idx} className="flex justify-between text-[11px]">
                          <span>{peer?.name || "Blog"}</span>
                          <span className="font-medium text-amber-700 dark:text-amber-400">
                            {link.count} common readers
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p>Popular independent feed in network.</p>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              {userFeedUrls.has(selectedNode.id) ? (
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Check size={14} /> Already Subscribed
                </span>
              ) : (
                <button
                  className="primary-button text-xs py-1 px-2.5"
                  onClick={() => handleFollow(selectedNode.id)}
                >
                  <Plus size={13} />
                  <span>Follow Feed</span>
                </button>
              )}
              {followMessage && (
                <span className="text-xs text-emerald-600 font-medium">{followMessage}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
