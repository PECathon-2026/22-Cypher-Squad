import { createHmac } from "node:crypto";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
): { allowed: boolean; retryAfter: number } {
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
    if ([...url.searchParams.keys()].some((key) => /token|secret|key|auth|password|signature/i.test(key))) {
      return "";
    }
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}
