import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { protectRequest, setAppCheckVerifierForTesting } from "../../functions/src/security";

function mockReqRes(headers: Record<string, string> = {}, method = "POST") {
  const req = {
    method,
    headers,
    header: (name: string) => headers[name.toLowerCase()] ?? headers[name],
    ip: "127.0.0.1",
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

describe("App Check Enforcement", () => {
  const originalEnv = process.env;
  const mockVerifier = vi.fn();

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockVerifier.mockReset();
    setAppCheckVerifierForTesting(mockVerifier);
  });

  afterEach(() => {
    process.env = originalEnv;
    setAppCheckVerifierForTesting(null);
  });

  it("missing token returns 401", async () => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.FIREBASE_EMULATOR_HUB;

    const { req, res, resState } = mockReqRes({});
    const allowed = await protectRequest(req as any, res as any, "test", 100);

    expect(allowed).toBe(false);
    expect(resState.statusCode).toBe(401);
    expect(resState.body).toEqual({ error: "App Check token required" });
  });

  it("invalid token returns 401 in production", async () => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.FIREBASE_EMULATOR_HUB;

    mockVerifier.mockRejectedValue(new Error("Token verification failed"));

    const { req, res, resState } = mockReqRes({ "x-firebase-appcheck": "invalid-token" });
    const allowed = await protectRequest(req as any, res as any, "test", 100);

    expect(allowed).toBe(false);
    expect(resState.statusCode).toBe(401);
    expect(resState.body).toEqual({ error: "Invalid App Check token" });
  });

  it("debug token in emulator is accepted without verifyToken", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";

    const { req, res, resState } = mockReqRes({ "x-firebase-appcheck": "debug" });
    const allowed = await protectRequest(req as any, res as any, "test", 100);

    expect(allowed).toBe(true);
    expect(resState.statusCode).toBe(200);
    expect(mockVerifier).not.toHaveBeenCalled();
  });

  it("debug token in production is rejected and calls verifyToken", async () => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.FIREBASE_EMULATOR_HUB;

    mockVerifier.mockRejectedValue(new Error("Cannot use debug token in production"));

    const { req, res, resState } = mockReqRes({ "x-firebase-appcheck": "debug" });
    const allowed = await protectRequest(req as any, res as any, "test", 100);

    expect(allowed).toBe(false);
    expect(resState.statusCode).toBe(401);
    expect(mockVerifier).toHaveBeenCalledWith("debug");
  });

  it("valid token in production proceeds to rate limiting", async () => {
    delete process.env.FUNCTIONS_EMULATOR;
    delete process.env.FIREBASE_EMULATOR_HUB;

    mockVerifier.mockResolvedValue({ appId: "test-app", token: "valid" });

    // Enable emulator flag for in-memory rate limiter during unit test
    process.env.FUNCTIONS_EMULATOR = "true";

    const { req, res } = mockReqRes({ "x-firebase-appcheck": "valid-token" });
    const allowed = await protectRequest(req as any, res as any, "test-valid", 100);

    expect(allowed).toBe(true);
    expect(mockVerifier).toHaveBeenCalledWith("valid-token");
  });
});
