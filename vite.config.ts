import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

const emulatorProject = process.env.VITE_FIREBASE_PROJECT_ID ?? "cypher-squad";
const useEmulator = process.env.USE_FIREBASE_EMULATOR === "true";

function devApiPlugin(): Plugin {
  return {
    name: "dev-api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          const url = req.url;
          if (url.startsWith("/api/fetch")) {
            const mod = await server.ssrLoadModule("./api/fetch.ts");
            return await mod.default(req, res);
          }
          if (url.startsWith("/api/discovery/popular")) {
            const mod = await server.ssrLoadModule("./api/discovery/popular.ts");
            return await mod.default(req, res);
          }
          if (url.startsWith("/api/discovery/recommendations")) {
            const mod = await server.ssrLoadModule("./api/discovery/recommendations.ts");
            return await mod.default(req, res);
          }
          if (url.startsWith("/api/discovery/submit")) {
            const mod = await server.ssrLoadModule("./api/discovery/submit.ts");
            return await mod.default(req, res);
          }
        } catch (err: unknown) {
          console.error("Vite Dev API error:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: (err as Error).message }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    devApiPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Confluence",
        short_name: "Confluence",
        theme_color: "#f5f1e8",
        background_color: "#f5f1e8",
        display: "standalone",
        start_url: "/",
        icons: [],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: useEmulator
      ? {
          "/api": {
            target: "http://127.0.0.1:5002",
            rewrite: (path) => {
              const routes: Record<string, string> = {
                "/api/fetch": "fetchUpstream",
                "/api/discovery/popular": "popularFeeds",
                "/api/discovery/recommendations": "recommendations",
                "/api/discovery/submit": "submitContribution",
              };
              const match = Object.entries(routes).find(([prefix]) => path.startsWith(prefix));
              return match
                ? path.replace(
                    match[1] === "fetchUpstream" ? /^\/api\/fetch/ : new RegExp(`^${match[0]}`),
                    `/${emulatorProject}/us-central1/${match[1]}`,
                  )
                : path;
            },
          },
        }
      : undefined,
  },
});
