import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import { isPrivateAddress } from "./ssrf.js";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RATE_LIMIT_ENTRIES = 5000;
const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

function pruneMemoryRateLimits() {
  const now = Date.now();
  for (const [key, value] of memoryRateLimits.entries()) {
    if (value.expiresAt <= now) {
      memoryRateLimits.delete(key);
    }
  }
  if (memoryRateLimits.size > MAX_RATE_LIMIT_ENTRIES) {
    // Evict oldest entries if still over capacity
    const excess = memoryRateLimits.size - MAX_RATE_LIMIT_ENTRIES;
    let count = 0;
    for (const key of memoryRateLimits.keys()) {
      memoryRateLimits.delete(key);
      count++;
      if (count >= excess) break;
    }
  }
}

export function getTrustedClientIp(req: IncomingMessage): string {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }
  const vercelIp = req.headers["x-vercel-forwarded-for"];
  if (typeof vercelIp === "string" && vercelIp.trim()) {
    return vercelIp.split(",")[0].trim();
  }
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    return xff.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

export function checkRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
): { allowed: boolean; retryAfter: number } {
  if (memoryRateLimits.size > 2000) {
    pruneMemoryRateLimits();
  }

  const secret = process.env.RATE_LIMIT_SECRET ?? "default-production-hmac-secret";
  const key = createHmac("sha256", secret).update(`${endpoint}:${ip}`).digest("hex");
  const window = Math.floor(Date.now() / WINDOW_MS);
  const cacheKey = `${endpoint}:${key}:${window}`;

  const current = memoryRateLimits.get(cacheKey);
  const count = (current?.expiresAt ?? 0) > Date.now() ? (current?.count ?? 0) + 1 : 1;
  memoryRateLimits.set(cacheKey, { count, expiresAt: Date.now() + WINDOW_MS });

  const retryAfter = Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000);
  if (count > limit) {
    return { allowed: false, retryAfter };
  }
  return { allowed: true, retryAfter: 0 };
}

export function normalizeSafeUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const trimmed = value.trim();
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (url.username || url.password) return "";
    if (url.port && !["80", "443"].includes(url.port)) return "";

    const hostname = url.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal"
    ) {
      return "";
    }

    const cleanHostname = hostname.replace(/^\[|\]$/g, "");
    if (isIP(cleanHostname) && isPrivateAddress(cleanHostname)) {
      return "";
    }

    const secretPattern = /^(token|secret|api_?key|auth(?:_?token)?|password|signature|sig)$/i;
    for (const key of url.searchParams.keys()) {
      if (secretPattern.test(key)) {
        return "";
      }
    }
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}
