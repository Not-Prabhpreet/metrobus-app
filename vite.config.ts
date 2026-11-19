import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { serviceWorkerSource } from "./scripts/lib/service-worker.mjs";

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
      writeBundle(output, bundle) {
        const directory = output.dir || "dist";
        writeFileSync(
          join(directory, "sw.js"),
          serviceWorkerSource(directory, basePath, Object.keys(bundle)),
        );
      },
    },
  ],
  build: { sourcemap: true },
});
