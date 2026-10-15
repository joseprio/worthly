import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { functionsMixins } from "vite-plugin-functions-mixins";
import { VitePWA } from "vite-plugin-pwa";

// Served from https://joseprio.github.io/worthly/ via GitHub Pages ("docs" folder on main).
export default defineConfig({
  base: "/worthly/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  plugins: [
    svelte(),
    functionsMixins({ deps: ["m3-svelte"] }),
    VitePWA({
      registerType: "autoUpdate",
      pwaAssets: { config: true },
      manifest: {
        id: "/worthly/",
        name: "Worthly",
        short_name: "Worthly",
        description: "Estimate your net worth today and see how it grows.",
        lang: "en-GB",
        dir: "ltr",
        display: "standalone",
        orientation: "portrait",
        start_url: "/worthly/",
        scope: "/worthly/",
        theme_color: "#f7faf5",
        background_color: "#f7faf5",
        categories: ["finance"],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Only precache the Latin font subsets; others load on demand if ever needed.
        globIgnores: ["**/google-sans-flex-!(latin|latin-ext)-*.woff2"],
        navigateFallback: "/worthly/index.html",
      },
    }),
  ],
});
