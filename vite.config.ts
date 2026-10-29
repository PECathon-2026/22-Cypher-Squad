import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const emulatorProject = process.env.VITE_FIREBASE_PROJECT_ID ?? "cypher-squad";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Small Web Reader",
        short_name: "Web Reader",
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
    proxy: {
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
    },
  },
});
