import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function serviceWorkerSource(directory, basePath, assetNames) {
  const template = readFileSync(
    new URL("../sw-template.js", import.meta.url),
    "utf8",
  );
  const files = [
    ...new Set([
      "index.html",
      "data/schedule.json",
      "icon.svg",
      "icon-192.png",
      "icon-512.png",
      "manifest.webmanifest",
      ...assetNames.filter((name) => !name.endsWith(".map")),
    ]),
  ].sort();
  // Hash the final emitted bytes, including HTML and unversioned public files.
  const hash = createHash("sha256").update(basePath).update(template);
  for (const file of files)
    hash.update(file).update(readFileSync(join(directory, file)));
  const version = hash.digest("hex").slice(0, 16);
  return template
    .replace("__VERSION__", JSON.stringify(version))
    .replace(
      "__PRECACHE__",
      JSON.stringify(files.map((file) => basePath + file)),
    );
}
