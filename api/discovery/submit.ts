import type { IncomingMessage, ServerResponse } from "node:http";
import { checkRateLimit, normalizeSafeUrl } from "../_lib/security.js";
import { recordBatchContribution } from "../_lib/store.js";

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

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
  const rate = checkRateLimit(ip, "submit", 12);
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

  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "A valid requestId (16-80 alphanumeric characters) is required" }));
    return;
  }

  const rawUrls = body?.feedUrls;
  if (!Array.isArray(rawUrls) || rawUrls.length === 0 || rawUrls.length > 20) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: "Between 1 and 20 feed URLs are required" }));
    return;
  }

  // Validate every URL individually
  for (const raw of rawUrls) {
    const normalized = normalizeSafeUrl(raw);
    if (!normalized) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: `Invalid, private, or credential-bearing feed URL: ${String(raw)}` }));
      return;
    }
  }

  const result = recordBatchContribution(requestId, rawUrls);
  res.statusCode = 200;
  res.end(JSON.stringify(result));
}

async function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) reject(new Error("Body too large"));
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
