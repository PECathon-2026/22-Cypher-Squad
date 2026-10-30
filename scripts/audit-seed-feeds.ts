import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { writeFile } from "node:fs/promises";
import { seedFeeds } from "../src/data/seeds";
import { parseFeedXml, type FeedParseResult } from "../src/lib/feed-core";
import { normalizeHttpUrl } from "../src/lib/url";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;
const USER_AGENT = "SmallWebReaderSeedAudit/0.1";

type AuditResult = {
  name: string;
  originalUrl?: string;
  safeHash?: string;
  normalizedUrl?: string;
  finalUrl?: string;
  status?: number;
  contentType?: string;
  redirects: string[];
  classification: string;
  detail: string;
  title?: string;
  siteUrl?: string;
  entryCount?: number;
  sampleIds?: string[];
};

async function main() {
  const results: AuditResult[] = [];
  for (let index = 0; index < seedFeeds.length; index += 3) {
    const batch = seedFeeds.slice(index, index + 3);
    results.push(...await Promise.all(batch.map(auditSeed)));
  }
  const report = [
    "# Seed Feed Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Seed | Classification | Status | Entries | URL | Detail |",
    "|---|---|---:|---:|---|---|",
    ...results.map((result) => `| ${result.name} | ${result.classification} | ${result.status ?? "—"} | ${result.entryCount ?? "—"} | ${result.normalizedUrl ?? result.safeHash ?? "redacted"} | ${result.detail.replaceAll("|", "\\|")} |`),
    "",
    "## Identity findings",
    "",
    ...identityFindings(results),
    "",
    "Unsafe URLs are represented only by a stable hash and reason. Audit failures are informational and do not fail this command.",
  ].join("\n");
  await writeFile("seed-audit-report.md", report, "utf8");
  console.log(`Wrote seed-audit-report.md for ${results.length} seeds.`);
}

async function auditSeed(seed: (typeof seedFeeds)[number]): Promise<AuditResult> {
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeHttpUrl(seed.url);
  } catch (error) {
    return {
      name: seed.name,
      safeHash: createHash("sha256").update(seed.url).digest("hex").slice(0, 16),
      redirects: [],
      classification: "unsafe_or_rejected_url",
      detail: error instanceof Error ? error.message : "URL rejected",
    };
  }
  try {
    const response = await fetchSafely(normalizedUrl);
    const parsed = classifyBody(response.body, response.contentType, response.status, response.finalUrl);
    return {
      name: seed.name,
      originalUrl: seed.url,
      normalizedUrl,
      finalUrl: response.finalUrl,
      status: response.status,
      contentType: response.contentType,
      redirects: response.redirects,
      ...parsed,
    };
  } catch (error) {
    return {
      name: seed.name,
      originalUrl: seed.url,
      normalizedUrl,
      redirects: [],
      classification: "temporarily_unavailable",
      detail: error instanceof Error ? error.message : "Network failure",
    };
  }
}

async function fetchSafely(input: string) {
  let url = input;
  const redirects: string[] = [];
  const started = Date.now();
  for (let count = 0; count <= MAX_REDIRECTS; count += 1) {
    if (Date.now() - started > TIMEOUT_MS) throw new Error("8-second audit timeout exceeded");
    await assertPublicDestination(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, TIMEOUT_MS - (Date.now() - started)));
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": USER_AGENT } });
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || count === MAX_REDIRECTS) throw new Error("redirect_loop_or_limit");
      url = normalizeHttpUrl(new URL(location, url).toString());
      redirects.push(url);
      continue;
    }
    const body = await readBody(response, started);
    return { status: response.status, contentType: response.headers.get("content-type") ?? "", body, finalUrl: url, redirects };
  }
  throw new Error("redirect_loop_or_limit");
}

async function readBody(response: Response, started: number): Promise<string> {
  if (Number(response.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("empty_or_truncated_body");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    if (Date.now() - started > TIMEOUT_MS) throw new Error("8-second audit timeout exceeded");
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("empty_or_truncated_body");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

async function assertPublicDestination(url: string) {
  const hostname = new URL(url).hostname;
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(({ address }) => isPrivate(address))) throw new Error("unsafe_or_rejected_url");
}

function isPrivate(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

function classifyBody(body: string, contentType: string, status: number, url: string) {
  if (status === 401 || status === 403) {
    return { classification: "auth_or_access_challenge", detail: `Access challenge or authentication response (HTTP ${status}).` };
  }
  if (status === 429 || status >= 500) return { classification: "temporarily_unavailable", detail: `Transient HTTP status ${status}.` };
  if (status >= 400) return { classification: "http_error", detail: `HTTP status ${status}.` };

  const parsed = parseFeedXml(body, url);
  if (parsed.kind === "valid" || parsed.kind === "valid-empty") {
    return {
      classification: parsed.kind === "valid" ? "valid_feed" : "valid_empty_feed",
      detail: parsed.kind === "valid" ? "RSS or Atom feed parsed successfully." : "Feed parsed successfully but contains no entries.",
      title: parsed.feed.title,
      siteUrl: parsed.feed.siteUrl,
      entryCount: parsed.feed.entries.length,
      sampleIds: parsed.feed.entries.slice(0, 5).map((entry) => entry.id || entry.url),
    };
  }

  if (
    /cf-challenge|challenge-running|cf-browser-verification|just a moment\.\.\.|verify you are human/i.test(body) ||
    (/text\/html/i.test(contentType) && /captcha|cloudflare Ray ID/i.test(body))
  ) {
    return { classification: "auth_or_access_challenge", detail: "Cloudflare or bot challenge page encountered." };
  }

  if (/^\s*<(?:!doctype\s+html|html\b)/i.test(body) || /text\/html/i.test(contentType)) {
    return { classification: "not_a_feed_html", detail: "Response is HTML rather than a usable RSS or Atom feed." };
  }
  return { classification: parsed.kind, detail: parsed.error };
}

function identityFindings(results: AuditResult[]) {
  const findings: string[] = [];
  for (let i = 0; i < results.length; i += 1) {
    for (let j = i + 1; j < results.length; j += 1) {
      const left = results[i];
      const right = results[j];
      if (left.normalizedUrl && left.normalizedUrl === right.normalizedUrl) findings.push(`- **exact_duplicate**: ${left.name} and ${right.name} share a normalized URL.`);
      else if (left.finalUrl && left.finalUrl === right.finalUrl) findings.push(`- **same_final_url**: ${left.name} and ${right.name} ended at the same final URL.`);
    }
  }
  return findings.length ? findings : ["- No exact or same-final-URL duplicates detected."];
}

void main();
