import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchSafely } from "./_lib/ssrf.js";
import { checkRateLimit, getTrustedClientIp } from "./_lib/security.js";

export default async function handler(req: IncomingMessage & { body?: any; query?: any }, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck, Authorization");
    res.end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  res.setHeader("Referrer-Policy", "no-referrer");

  const ip = getTrustedClientIp(req);
  const rate = checkRateLimit(ip, "fetch", 120);
  if (!rate.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(rate.retryAfter));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Rate limit exceeded" }));
    return;
  }

  if (!["GET", "POST"].includes(req.method || "")) {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    res.end("Method not allowed");
    return;
  }

  // Parse body if POST
  let rawUrl = "";
  let ifNoneMatch = (req.headers["if-none-match"] as string) || undefined;
  let ifModifiedSince = (req.headers["if-modified-since"] as string) || undefined;

  if (req.method === "GET") {
    const urlObj = new URL(req.url || "/", "http://localhost");
    rawUrl = urlObj.searchParams.get("url") || "";
    if (!ifNoneMatch) ifNoneMatch = urlObj.searchParams.get("etag") || undefined;
    if (!ifModifiedSince) ifModifiedSince = urlObj.searchParams.get("lastModified") || undefined;
  } else {
    try {
      const body = await parseJsonBody(req);
      rawUrl = typeof body?.url === "string" ? body.url : "";
      if (body?.etag && !ifNoneMatch) ifNoneMatch = String(body.etag);
      if (body?.lastModified && !ifModifiedSince) ifModifiedSince = String(body.lastModified);
    } catch {
      res.statusCode = 400;
      res.end("Invalid JSON payload");
      return;
    }
  }

  if (!rawUrl) {
    res.statusCode = 400;
    res.end("Missing url parameter");
    return;
  }

  try {
    const result = await fetchSafely(rawUrl, { ifNoneMatch, ifModifiedSince });
    res.statusCode = result.status;
    res.setHeader("Content-Type", result.contentType);
    if (result.etag) {
      res.setHeader("ETag", result.etag);
    }
    if (result.lastModified) {
      res.setHeader("Last-Modified", result.lastModified);
    }
    res.setHeader("X-Robots-Tag", "noindex");
    res.end(result.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream fetch failed";
    if (message.includes("timed out")) {
      res.statusCode = 504;
    } else if (
      message.includes("blocked") ||
      message.includes("Only HTTP") ||
      message.includes("Invalid URL") ||
      message.includes("redirects")
    ) {
      res.statusCode = 403;
    } else if (message.includes("exceeds the 2 MiB limit")) {
      res.statusCode = 413;
    } else {
      res.statusCode = 502;
    }
    res.end(message);
  }
}

async function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
