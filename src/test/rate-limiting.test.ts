import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import { rateLimit } from "../../functions/src/security";
import { checkRateLimit } from "../../api/_lib/security";

function mockReqRes(ip = "192.0.2.1") {
  const req = {
    ip,
    method: "POST",
    header: () => undefined,
  } as unknown as Request;

  const resState = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as unknown,
  };

  const res = {
    status: (code: number) => {
      resState.statusCode = code;
      return res;
    },
    json: (data: unknown) => {
      resState.body = data;
      return res;
    },
    set: (k: string, v: string) => {
      resState.headers[k] = v;
      return res;
    },
  } as unknown as Response;

  return { req, res, resState };
}

describe("Rate Limiting", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FUNCTIONS_EMULATOR: "true", RATE_LIMIT_SECRET: "test-secret" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("under limit succeeds", async () => {
    const { req, res } = mockReqRes("198.51.100.10");
    const allowed = await rateLimit(req as any, res as any, "test-under-limit", 5);
    expect(allowed).toBe(true);
  });

  it("over limit returns 429 and Retry-After exists", async () => {
    const ip = "198.51.100.20";
    const limit = 3;

    // Send requests up to limit
    for (let i = 0; i < limit; i++) {
      const { req, res } = mockReqRes(ip);
      const ok = await rateLimit(req as any, res as any, "test-over-limit", limit);
      expect(ok).toBe(true);
    }

    // Next request exceeds limit
    const { req, res, resState } = mockReqRes(ip);
    const blocked = await rateLimit(req as any, res as any, "test-over-limit", limit);

    expect(blocked).toBe(false);
    expect(resState.statusCode).toBe(429);
    expect(resState.headers["Retry-After"]).toBeDefined();
    const retryAfter = Number(resState.headers["Retry-After"]);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(600);
    expect(resState.body).toEqual({ error: "Rate limit exceeded" });
  });

  it("rate limits are partitioned by endpoint", async () => {
    const ip = "198.51.100.30";
    const limit = 2;

    // Saturate endpoint A
    for (let i = 0; i < limit + 1; i++) {
      const { req, res } = mockReqRes(ip);
      await rateLimit(req as any, res as any, "endpoint-A", limit);
    }

    // Endpoint B should still succeed
    const { req, res } = mockReqRes(ip);
    const ok = await rateLimit(req as any, res as any, "endpoint-B", limit);
    expect(ok).toBe(true);
  });

  describe("Serverless API Rate Limiter (checkRateLimit)", () => {
    it("allows requests below limit and blocks requests exceeding limit", () => {
      const ip = "203.0.113.42";
      const endpoint = "test-api-endpoint";
      const limit = 3;

      for (let i = 0; i < limit; i++) {
        const res = checkRateLimit(ip, endpoint, limit);
        expect(res.allowed).toBe(true);
        expect(res.retryAfter).toBe(0);
      }

      // Exceeded request
      const blocked = checkRateLimit(ip, endpoint, limit);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(600);
    });

    it("partitions rate limits by endpoint and IP", () => {
      const ipA = "203.0.113.100";
      const ipB = "203.0.113.101";
      const limit = 2;

      checkRateLimit(ipA, "fetch", limit);
      checkRateLimit(ipA, "fetch", limit);
      const blockedA = checkRateLimit(ipA, "fetch", limit);
      expect(blockedA.allowed).toBe(false);

      // Different IP for same endpoint should be allowed
      const resB = checkRateLimit(ipB, "fetch", limit);
      expect(resB.allowed).toBe(true);

      // Same IP for different endpoint should be allowed
      const resDiffEndpoint = checkRateLimit(ipA, "popular", limit);
      expect(resDiffEndpoint.allowed).toBe(true);
    });
  });
});
