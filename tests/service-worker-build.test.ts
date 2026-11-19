import { expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serviceWorkerSource } from "../scripts/lib/service-worker.mjs";

it("versions the worker from final HTML, hashed assets and data bytes", () => {
  const directory = mkdtempSync(join(tmpdir(), "metrobus-worker-"));
  const names = [
    "index.html",
    "data/schedule.json",
    "assets/app-aaaaaaaa.js",
    "icon.svg",
    "icon-192.png",
    "icon-512.png",
    "manifest.webmanifest",
  ];
  mkdirSync(join(directory, "data"));
  mkdirSync(join(directory, "assets"));
  try {
    for (const file of names) writeFileSync(join(directory, file), file);
    const build = () =>
      serviceWorkerSource(directory, "/metrobus-app/", [
        "index.html",
        "assets/app-aaaaaaaa.js",
      ]);
    const original = build();
    expect(build()).toBe(original);
    writeFileSync(
      join(directory, "index.html"),
      "<h1>New HTML, same asset names</h1>",
    );
    const htmlUpdate = build();
    expect(htmlUpdate).not.toBe(original);
    writeFileSync(join(directory, "data/schedule.json"), "new schedule");
    expect(build()).not.toBe(htmlUpdate);
    expect(build()).toContain("/metrobus-app/assets/app-aaaaaaaa.js");
  } finally {
    for (const file of names) unlinkSync(join(directory, file));
    rmdirSync(join(directory, "data"));
    rmdirSync(join(directory, "assets"));
    rmdirSync(directory);
  }
});
