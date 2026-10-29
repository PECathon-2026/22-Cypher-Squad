import type { IncomingMessage, ServerResponse } from "node:http";
import { checkRateLimit } from "../_lib/security.js";
import { getPopularFeedsList } from "../_lib/store.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Firebase-AppCheck, Authorization");
    res.end();
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(ip, "popular", 60);
  if (!rate.allowed) {
    res.statusCode = 429;
    res.setHeader("Retry-After", String(rate.retryAfter));
    res.end(JSON.stringify({ error: "Rate limit exceeded" }));
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  // Popular endpoint does not accept subscription list and does not increment counters
  const feeds = getPopularFeedsList();
  res.statusCode = 200;
  res.end(JSON.stringify({ feeds }));
}
