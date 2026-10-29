import { getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { Request, Response } from "express";
import { createHmac } from "node:crypto";

if (!getApps().length) initializeApp();
const db = getFirestore();
const WINDOW_MS = 10 * 60 * 1000;
const localRateLimits = new Map<string, { count: number; expiresAt: number }>();

let customAppCheckVerifier: ((token: string) => Promise<unknown>) | null = null;

export function setAppCheckVerifierForTesting(
  verifier: ((token: string) => Promise<unknown>) | null,
) {
  customAppCheckVerifier = verifier;
}

export async function protectRequest(
  request: Request,
  response: Response,
  endpoint: string,
  limit: number,
): Promise<boolean> {
  if (request.method === "OPTIONS") return true;

  const token = request.header("X-Firebase-AppCheck");
  const isLocalEmulator =
    process.env.FUNCTIONS_EMULATOR === "true" ||
    Boolean(process.env.FIREBASE_EMULATOR_HUB);

  // Allow debug token only when running locally in emulator
  if (isLocalEmulator && token === "debug") {
    return rateLimit(request, response, endpoint, limit);
  }

  if (!token) {
    response.status(401).json({ error: "App Check token required" });
    return false;
  }

  try {
    if (customAppCheckVerifier) {
      await customAppCheckVerifier(token);
    } else {
      await getAppCheck().verifyToken(token);
    }
  } catch {
    response.status(401).json({ error: "Invalid App Check token" });
    return false;
  }

  return rateLimit(request, response, endpoint, limit);
}

export async function rateLimit(
  request: Request,
  response: Response,
  endpoint: string,
  limit: number,
): Promise<boolean> {
  const source = request.ip || "unknown";
  const key = createHmac("sha256", process.env.RATE_LIMIT_SECRET ?? "local-only-secret")
    .update(`${endpoint}:${source}`)
    .digest("hex");
  const window = Math.floor(Date.now() / WINDOW_MS);
  const isLocalEmulator =
    process.env.FUNCTIONS_EMULATOR === "true" ||
    Boolean(process.env.FIREBASE_EMULATOR_HUB);

  if (isLocalEmulator) {
    const localKey = `${endpoint}:${key}:${window}`;
    const current = localRateLimits.get(localKey);
    const count = (current?.expiresAt ?? 0) > Date.now() ? (current?.count ?? 0) + 1 : 1;
    localRateLimits.set(localKey, { count, expiresAt: Date.now() + WINDOW_MS });
    if (count > limit) {
      const retryAfter = Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000);
      response
        .status(429)
        .set("Retry-After", String(retryAfter))
        .json({ error: "Rate limit exceeded" });
      return false;
    }
    return true;
  }

  // Production uses durable Firestore rateLimits collection
  const ref = db.collection("rateLimits").doc(`${endpoint}_${key}_${window}`);
  let count = 0;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    count = Number(snapshot.data()?.count ?? 0) + 1;
    transaction.set(
      ref,
      { count, expiresAt: Date.now() + WINDOW_MS, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });

  if (count > limit) {
    const retryAfter = Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000);
    response
      .status(429)
      .set("Retry-After", String(retryAfter))
      .json({ error: "Rate limit exceeded" });
    return false;
  }

  return true;
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
