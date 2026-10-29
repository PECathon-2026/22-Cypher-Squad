import { appCheckHeaders } from "./app-check";

export async function fetchThroughProxy(url: string, accept: string): Promise<Response> {
  const proxyBase = import.meta.env.VITE_FETCH_PROXY_URL ?? "/api/fetch";
  const response = await fetch(proxyBase, {
    method: "POST",
    headers: { Accept: accept, "Content-Type": "application/json", ...(await appCheckHeaders()) },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    throw new Error(`The fetch proxy returned HTTP ${response.status}.`);
  }
  return response;
}
