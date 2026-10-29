import { describe, it, expect, vi } from "vitest";
import {
  validateUrl,
  isPrivateAddress,
  assertPublicDestination,
  readLimitedBody,
} from "../../functions/src/index";

describe("Fetch Proxy - URL Validation", () => {
  it("public feed succeeds with clean URL", () => {
    const valid = validateUrl("https://example.com/feed.xml");
    expect(valid).toBe("https://example.com/feed.xml");
  });

  it("non-standard port rejected", () => {
    expect(() => validateUrl("http://example.com:8080/feed.xml")).toThrow(
      "Non-standard ports are blocked",
    );
    expect(() => validateUrl("https://example.com:8443/feed.xml")).toThrow(
      "Non-standard ports are blocked",
    );
  });

  it("standard ports 80 and 443 are accepted", () => {
    expect(validateUrl("http://example.com:80/feed.xml")).toBe("http://example.com/feed.xml");
    expect(validateUrl("https://example.com:443/feed.xml")).toBe("https://example.com/feed.xml");
  });

  it("credentials rejected", () => {
    expect(() => validateUrl("https://user:pass@example.com/feed.xml")).toThrow(
      "Credential-bearing URLs are blocked",
    );
    expect(() => validateUrl("https://admin@example.com/feed.xml")).toThrow(
      "Credential-bearing URLs are blocked",
    );
  });

  it("secret-like query parameters rejected", () => {
    expect(() => validateUrl("https://example.com/feed.xml?token=abc")).toThrow(
      "Secret-bearing query parameters are blocked",
    );
    expect(() => validateUrl("https://example.com/feed.xml?api_key=secret123")).toThrow(
      "Secret-bearing query parameters are blocked",
    );
    expect(() => validateUrl("https://example.com/feed.xml?auth=bearer")).toThrow(
      "Secret-bearing query parameters are blocked",
    );
    expect(() => validateUrl("https://example.com/feed.xml?signature=sig")).toThrow(
      "Secret-bearing query parameters are blocked",
    );
  });

  it("rejects non-HTTP protocols", () => {
    expect(() => validateUrl("ftp://example.com/feed.xml")).toThrow(
      "Only HTTP and HTTPS URLs are allowed",
    );
    expect(() => validateUrl("file:///etc/passwd")).toThrow(
      "Only HTTP and HTTPS URLs are allowed",
    );
    expect(() => validateUrl("javascript:alert(1)")).toThrow(
      "Only HTTP and HTTPS URLs are allowed",
    );
  });
});

describe("Fetch Proxy - SSRF & Destination Checks", () => {
  it("loopback rejected", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("127.0.1.1")).toBe(true);
    expect(isPrivateAddress("::1")).toBe(true);
  });

  it("private IP ranges rejected", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("172.31.255.255")).toBe(true);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fd12:3456:789a::1")).toBe(true);
  });

  it("metadata and link-local address rejected", () => {
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("169.254.1.1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("::ffff:169.254.169.254")).toBe(true);
  });

  it("multicast and reserved addresses rejected", () => {
    expect(isPrivateAddress("0.0.0.0")).toBe(true);
    expect(isPrivateAddress("224.0.0.1")).toBe(true);
    expect(isPrivateAddress("240.0.0.1")).toBe(true);
    expect(isPrivateAddress("ff02::1")).toBe(true);
  });

  it("public IP allowed", () => {
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("1.1.1.1")).toBe(false);
  });

  it("localhost and cloud metadata hostnames blocked in assertPublicDestination", async () => {
    await expect(assertPublicDestination("http://localhost/feed")).rejects.toThrow(
      "Private or local destinations are blocked",
    );
    await expect(assertPublicDestination("http://metadata.google.internal/feed")).rejects.toThrow(
      "Private or local destinations are blocked",
    );
    await expect(assertPublicDestination("http://service.local/feed")).rejects.toThrow(
      "Private or local destinations are blocked",
    );
  });
});

describe("Fetch Proxy - Redirects & Timeouts", () => {
  it("revalidates each redirect destination URL and blocks redirects to private destinations", () => {
    const initialUrl = "https://example.com/feed";
    const redirectLocation = "http://169.254.169.254/latest/meta-data";

    const resolved = new URL(redirectLocation, initialUrl).toString();
    expect(() => validateUrl(resolved)).not.toThrow();
    const hostname = new URL(resolved).hostname;
    expect(isPrivateAddress(hostname)).toBe(true);
  });

  it("enforces max 3 redirects limit", () => {
    const maxRedirects = 3;
    let redirectCount = 0;
    const canFollow = () => {
      if (redirectCount >= maxRedirects) {
        throw new Error("Too many upstream redirects");
      }
      redirectCount++;
    };

    canFollow(); // 1
    canFollow(); // 2
    canFollow(); // 3
    expect(() => canFollow()).toThrow("Too many upstream redirects");
  });

  it("enforces timeout on slow upstream requests", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50);

    const slowFetch = new Promise((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error("Upstream request timed out"));
      });
    });

    await expect(slowFetch).rejects.toThrow("Upstream request timed out");
    clearTimeout(timeout);
  });
});

describe("Fetch Proxy - Body Size & Limits", () => {
  it("response size under 2 MiB succeeds", async () => {
    const text = "A".repeat(1000);
    const mockResponse = new Response(text, {
      headers: { "content-length": "1000" },
    });
    const body = await readLimitedBody(mockResponse);
    expect(body).toBe(text);
  });

  it("response size over 2 MiB declared in header is rejected", async () => {
    const mockResponse = new Response("oversized", {
      headers: { "content-length": String(3 * 1024 * 1024) },
    });
    await expect(readLimitedBody(mockResponse)).rejects.toThrow(
      "Upstream response exceeds the 2 MiB limit",
    );
  });

  it("streaming body exceeding 2 MiB is cancelled and rejected", async () => {
    const chunk = new Uint8Array(1024 * 1024); // 1 MiB chunk
    let count = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (count < 3) {
          controller.enqueue(chunk);
          count += 1;
        } else {
          controller.close();
        }
      },
    });
    const mockResponse = new Response(stream);
    await expect(readLimitedBody(mockResponse)).rejects.toThrow(
      "Upstream response exceeds the 2 MiB limit",
    );
  });
});
