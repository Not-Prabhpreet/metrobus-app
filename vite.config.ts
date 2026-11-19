import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

let basePath = "/";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [
    react(),
    {
      name: "offline-schedule",
      configResolved(config) {
        basePath = config.base;
      },
      generateBundle(_, bundle) {
        const scheduleHash = createHash("sha256")
          .update(readFileSync("public/data/schedule.json"))
          .digest("hex");
        const files = [
          "",
          "index.html",
          "data/schedule.json",
          "icon.svg",
          "icon-192.png",
          "icon-512.png",
          "manifest.webmanifest",
          ...Object.keys(bundle).filter((f) => !f.endsWith(".map")),
        ].map((file) => basePath + file);
        const template = readFileSync("scripts/sw-template.js", "utf8");
        const version = createHash("sha256")
          .update(scheduleHash + JSON.stringify(files) + template)
          .digest("hex")
          .slice(0, 16);
        const source = template
          .replace("__VERSION__", JSON.stringify(version))
          .replace("__PRECACHE__", JSON.stringify([...new Set(files)]));
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
  build: { sourcemap: true },
});
