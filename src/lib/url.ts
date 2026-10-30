export function normalizeHttpUrl(input: string): string {
  const value = input.trim();
  const parsed = new URL(value.includes("://") ? value : `https://${value}`);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported.");
  if (parsed.username || parsed.password) throw new Error("Credential-bearing URLs are not accepted.");
  if (parsed.port && !["80", "443"].includes(parsed.port)) throw new Error("Non-standard ports are not accepted.");
  const secretPattern = /^(token|secret|api_?key|auth(?:_?token)?|password|signature|sig)$/i;
  if ([...parsed.searchParams.keys()].some((key) => secretPattern.test(key))) {
    throw new Error("Secret-like query parameters are not accepted.");
  }
  parsed.hash = "";
  if (!parsed.pathname) parsed.pathname = "/";
  return parsed.toString();
}

export function isSafeHttpUrl(input: string): boolean {
  try {
    normalizeHttpUrl(input);
    return true;
  } catch {
    return false;
  }
}
