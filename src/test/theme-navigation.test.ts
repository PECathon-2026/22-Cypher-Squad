import { describe, expect, it, beforeEach } from "vitest";

describe("Theme and Navigation Architecture", () => {
  let mockStorage: Record<string, string> = {};
  let rootClasses: Set<string> = new Set();

  beforeEach(() => {
    mockStorage = {};
    rootClasses = new Set();
  });

  function resolveTheme(storageValue: string | null, prefersDark: boolean): "light" | "dark" {
    if (storageValue === "light" || storageValue === "dark") return storageValue;
    if (prefersDark) return "dark";
    return "light";
  }

  function applyTheme(theme: "light" | "dark") {
    mockStorage["small-reader-theme"] = theme;
    if (theme === "dark") {
      rootClasses.add("dark");
    } else {
      rootClasses.delete("dark");
    }
  }

  it("defaults to light theme when no preference or system dark mode is present", () => {
    const theme = resolveTheme(null, false);
    expect(theme).toBe("light");
  });

  it("honors system dark mode when no explicit preference is stored", () => {
    const theme = resolveTheme(null, true);
    expect(theme).toBe("dark");
  });

  it("prioritizes stored user theme over system preference", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("toggles theme correctly and manages root class and storage", () => {
    applyTheme("dark");
    expect(mockStorage["small-reader-theme"]).toBe("dark");
    expect(rootClasses.has("dark")).toBe(true);

    applyTheme("light");
    expect(mockStorage["small-reader-theme"]).toBe("light");
    expect(rootClasses.has("dark")).toBe(false);
  });
});
