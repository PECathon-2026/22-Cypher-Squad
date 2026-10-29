import { describe, it, expect } from "vitest";
import fetchHandler from "../../api/fetch";
import popularHandler from "../../api/discovery/popular";
import recommendationsHandler from "../../api/discovery/recommendations";
import submitHandler from "../../api/discovery/submit";
import { EventEmitter } from "node:events";

function createMockReqRes(method: string, url: string, bodyObj?: any, headers: Record<string, string> = {}) {
  const req = new EventEmitter() as any;
  req.method = method;
  req.url = url;
  req.headers = { "x-forwarded-for": "192.0.2.55", ...headers };

  const resState = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    data: "",
  };

  const res = {
    get statusCode() {
      return resState.statusCode;
    },
    set statusCode(code: number) {
      resState.statusCode = code;
    },
    setHeader: (k: string, v: string) => {
      resState.headers[k] = v;
    },
    end: (chunk?: string) => {
      if (chunk) resState.data += chunk;
    },
  } as any;

  // Emit data asynchronously
  setTimeout(() => {
    if (bodyObj !== undefined) {
      req.emit("data", JSON.stringify(bodyObj));
    }
    req.emit("end");
  }, 1);

  return { req, res, resState };
}

describe("Vercel Serverless API Endpoints", () => {
  it("GET /api/discovery/popular returns seeded feeds", async () => {
    const { req, res, resState } = createMockReqRes("GET", "/api/discovery/popular");
    await popularHandler(req, res);

    expect(resState.statusCode).toBe(200);
    const parsed = JSON.parse(resState.data);
    expect(parsed.feeds).toBeDefined();
    expect(parsed.feeds.length).toBeGreaterThanOrEqual(12);
  });

  it("POST /api/discovery/popular returns 405 Method Not Allowed", async () => {
    const { req, res, resState } = createMockReqRes("POST", "/api/discovery/popular", { test: true });
    await popularHandler(req, res);

    expect(resState.statusCode).toBe(405);
  });

  it("POST /api/discovery/submit validates 1-20 URLs and returns accepted", async () => {
    const payload = {
      requestId: "stable-client-request-id-abcdef1234",
      feedUrls: ["https://feeds.bbci.co.uk/news/rss.xml", "https://hnrss.org/frontpage"],
    };
    const { req, res, resState } = createMockReqRes("POST", "/api/discovery/submit", payload);
    await submitHandler(req, res);

    expect(resState.statusCode).toBe(200);
    const parsed = JSON.parse(resState.data);
    expect(parsed.accepted).toBe(true);
    expect(parsed.requestId).toBe(payload.requestId);
  });

  it("POST /api/discovery/submit rejects invalid or credential URLs", async () => {
    const payload = {
      requestId: "stable-client-request-id-abcdef1234",
      feedUrls: ["https://user:pass@bad.com/feed.xml"],
    };
    const { req, res, resState } = createMockReqRes("POST", "/api/discovery/submit", payload);
    await submitHandler(req, res);

    expect(resState.statusCode).toBe(400);
  });

  it("POST /api/discovery/recommendations excludes followed feeds", async () => {
    const followed = "https://feeds.bbci.co.uk/news/rss.xml";
    const payload = { feedUrls: [followed] };
    const { req, res, resState } = createMockReqRes("POST", "/api/discovery/recommendations", payload);
    await recommendationsHandler(req, res);

    expect(resState.statusCode).toBe(200);
    const parsed = JSON.parse(resState.data);
    expect(parsed.feeds).toBeDefined();
    expect(parsed.feeds.some((f: any) => f.url === followed)).toBe(false);
  });

  it("POST /api/fetch blocks SSRF to private IP", async () => {
    const payload = { url: "http://127.0.0.1:80/admin" };
    const { req, res, resState } = createMockReqRes("POST", "/api/fetch", payload);
    await fetchHandler(req, res);

    expect(resState.statusCode).toBe(403);
  });
});
