import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getApps, initializeApp } from "firebase-admin/app";
import { onRequest } from "firebase-functions/v2/https";
import { protectRequest } from "./security.js";
export { popularFeeds, recommendations, submitContribution } from "./discovery.js";

if (!getApps().length) initializeApp();

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;

export const fetchUpstream = onRequest(
  {
    cors: true,
    timeoutSeconds: 15,
    memory: "256MiB",
  },
  async (request, response) => {
    if (!(await protectRequest(request, response, "fetch", 120))) return;
    if (!["GET", "POST"].includes(request.method)) {
      response.status(405).set("Allow", "GET, POST").send("Method not allowed");
      return;
    }

    const rawUrl =
      typeof request.body?.url === "string"
        ? request.body.url
        : typeof request.query.url === "string"
          ? request.query.url
          : "";
    if (!rawUrl) {
      response.status(400).send("Missing url parameter");
      return;
    }

    try {
      const result = await fetchSafely(rawUrl);
      response
        .status(result.status)
        .set("Content-Type", result.contentType)
        .set("Cache-Control", "no-store, max-age=0")
        .send(result.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upstream fetch failed";
      if (message.includes("timed out")) {
        response.status(504).send(message);
      } else if (
        message.includes("blocked") ||
        message.includes("Only HTTP") ||
        message.includes("Invalid URL") ||
        message.includes("redirects")
      ) {
        response.status(403).send(message);
      } else if (message.includes("exceeds the 2 MiB limit")) {
        response.status(413).send(message);
      } else {
        response.status(502).send(message);
      }
    }
  },
);

export async function fetchSafely(input: string): Promise<{ status: number; contentType: string; body: string }> {
  let url = validateUrl(input);

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicDestination(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let upstream: Response;
    try {
      upstream = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "SmallWebReader/0.1 (+feed reader)" },
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        throw new Error("Upstream request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(upstream.status)) {
      const location = upstream.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) {
        throw new Error("Too many or invalid upstream redirects");
      }
      url = validateUrl(new URL(location, url).toString());
      continue;
    }

    const body = await readLimitedBody(upstream);
    return {
      status: upstream.status,
      contentType: upstream.headers.get("content-type") ?? "application/octet-stream",
      body,
    };
  }

  throw new Error("Too many upstream redirects");
}

export function validateUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL format");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }
  if (url.username || url.password) {
    throw new Error("Credential-bearing URLs are blocked");
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Non-standard ports are blocked");
  }
  const secretPattern = /token|secret|key|auth|password|signature/i;
  for (const key of url.searchParams.keys()) {
    if (secretPattern.test(key)) {
      throw new Error("Secret-bearing query parameters are blocked");
    }
  }
  url.hash = "";
  return url.toString();
}

export async function assertPublicDestination(url: string): Promise<void> {
  const hostname = new URL(url).hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("Private or local destinations are blocked");
  }

  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error("Private or local destinations are blocked");
    }
    return;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Unable to resolve upstream hostname");
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Private or local destinations are blocked");
  }
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    const [a, b, c] = parts;
    if (a === 0) return true; // Current network
    if (a === 10) return true; // Private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 127) return true; // Loopback
    if (a === 169 && b === 254) return true; // Link-local / metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // Private
    if (a === 192 && b === 0 && c === 0) return true; // IETF
    if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
    if (a === 192 && b === 88 && c === 99) return true; // 6to4 Relay
    if (a === 192 && b === 168) return true; // Private
    if (a === 198 && (b === 18 || b === 19)) return true; // Benchmark
    if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
    if (a >= 224 && a <= 239) return true; // Multicast
    if (a >= 240) return true; // Reserved
    return false;
  }

  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.slice(7);
    if (isIP(ipv4Part) === 4) return isPrivateAddress(ipv4Part);
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("2001:db8:")) return true;
  return false;
}

export async function readLimitedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    throw new Error("Upstream response exceeds the 2 MiB limit");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("Upstream response exceeds the 2 MiB limit");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
