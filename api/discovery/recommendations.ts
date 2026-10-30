import type { IncomingMessage, ServerResponse } from "node:http";
import { checkRateLimit, getTrustedClientIp } from "../_lib/security.js";
import { getRecommendationsList } from "../_lib/store.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck, Authorization");
    res.end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  const ip = getTrustedClientIp(req);
  const rate = checkRateLimit(ip, "recommendations", 60);
  if (!rate.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(rate.retryAfter));
    res.end(JSON.stringify({ error: "Rate limit exceeded" }));
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let body: any = {};
  try {
    body = await parseJsonBody(req);
  } catch {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const rawUrls = body?.feedUrls;
  const contextFeed = body?.contextFeed ? String(body.contextFeed) : undefined;
  if (!Array.isArray(rawUrls)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "feedUrls array is required" }));
    return;
  }
  if (rawUrls.length > 100) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "At most 100 feed URLs are allowed" }));
    return;
  }

  // Recommendations query combines co-subscription and popularity, excluding followed feeds
  const feeds = await getRecommendationsList(rawUrls, contextFeed);
  res.statusCode = 200;
  res.end(JSON.stringify({ feeds }));
}

async function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
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
