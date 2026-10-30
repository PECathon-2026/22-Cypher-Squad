export type OpmlOutline = {
  name: string;
  url: string;
  category?: string;
  htmlUrl?: string;
};

export function exportOpml(feeds: Array<{ name: string; url: string; category?: string }>): string {
  const dateStr = new Date().toUTCString();
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const outlines = feeds
    .map(
      (f) =>
        `    <outline text="${escapeXml(f.name)}" title="${escapeXml(f.name)}" type="rss" xmlUrl="${escapeXml(f.url)}" htmlUrl="${escapeXml(f.url)}"${f.category ? ` category="${escapeXml(f.category)}"` : ""} />`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Confluence Subscriptions</title>
    <dateCreated>${dateStr}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function parseOpml(opmlContent: string): OpmlOutline[] {
  if (typeof DOMParser === "undefined") {
    // Basic regex fallback for testing environment without browser DOMParser
    const matches: OpmlOutline[] = [];
    const outlineRegex = /<outline\b([^>]+)\/?>/gi;
    let match: RegExpExecArray | null;
    while ((match = outlineRegex.exec(opmlContent)) !== null) {
      const attrs = match[1];
      const xmlUrlMatch = attrs.match(/xmlUrl=["']([^"']+)["']/i) || attrs.match(/url=["']([^"']+)["']/i);
      const textMatch = attrs.match(/text=["']([^"']+)["']/i) || attrs.match(/title=["']([^"']+)["']/i);
      const catMatch = attrs.match(/category=["']([^"']+)["']/i);
      if (xmlUrlMatch) {
        matches.push({
          url: unescapeXml(xmlUrlMatch[1].trim()),
          name: unescapeXml(textMatch ? textMatch[1].trim() : xmlUrlMatch[1].trim()),
          category: catMatch ? unescapeXml(catMatch[1].trim()) : undefined,
        });
      }
    }
    return matches;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(opmlContent, "text/xml");
  const outlines = Array.from(doc.querySelectorAll("outline"));
  const results: OpmlOutline[] = [];

  for (const outline of outlines) {
    const xmlUrl = outline.getAttribute("xmlUrl") || outline.getAttribute("url");
    if (!xmlUrl) continue;
    const name = outline.getAttribute("text") || outline.getAttribute("title") || xmlUrl;
    const category = outline.getAttribute("category") || outline.parentElement?.getAttribute("text") || undefined;
    const htmlUrl = outline.getAttribute("htmlUrl") || undefined;

    results.push({
      name: name.trim(),
      url: xmlUrl.trim(),
      category: category ? category.trim() : undefined,
      htmlUrl: htmlUrl ? htmlUrl.trim() : undefined,
    });
  }

  return results;
}

export function downloadOpmlFile(feeds: Array<{ name: string; url: string; category?: string }>) {
  const xml = exportOpml(feeds);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "confluence-subscriptions.opml";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
