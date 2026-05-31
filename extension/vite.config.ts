import { crx } from "@crxjs/vite-plugin";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import manifest from "./manifest.json";

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyOfflineIconPlugin() {
  return {
    name: "copy-offline-icon",
    writeBundle(options: { dir?: string }) {
      const src = resolve(__dirname, "public/icons/icon-offline-48.png");
      const outDir = options.dir || resolve(__dirname, "dist");
      const destDir = resolve(outDir, "public/icons");
      const dest = resolve(destDir, "icon-offline-48.png");
      try {
        mkdirSync(destDir, { recursive: true });
        copyFileSync(src, dest);
      } catch {}
    },
  };
}

export default defineConfig({
  plugins: [react(), crx({ manifest }), copyOfflineIconPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
