import { expect, it } from "vitest";
import { titleCaseHeadsign, headwayLabel } from "../src/lib/presentation.mjs";
import { metricsFor } from "../src/lib/metrics.mjs";

it("title-cases headsigns and preserves local acronyms and apostrophes", () => {
  expect(titleCaseHeadsign("THE VILLAGE - STAVANGER DRIVE")).toBe(
    "The Village - Stavanger Drive",
  );
  expect(titleCaseHeadsign("MUN - ST. JOHN'S YMCA")).toBe(
    "MUN - St. John's YMCA",
  );
  expect(titleCaseHeadsign("MUN-CNA-MI")).toBe("MUN-CNA-MI");
});
it("rounds headways to whole-minute approximate labels", () => {
  expect(headwayLabel(27.5)).toBe("About every 28 min");
  expect(headwayLabel(27.4)).toBe("About every 27 min");
  expect(headwayLabel(null)).toBe("Not enough service");
});
it("tags last buses strictly before 10 a.m. as peak only", () => {
  const m = metricsFor(
    { t: { id: "t", route: "r", service: "s", first: 20000, direction: "0" } },
    {
      early: [{ service: "s", time: 35999 }],
      ten: [{ service: "s", time: 36000 }],
      late: [{ service: "s", time: 90000 }],
    },
    [{ id: "r" }],
    {},
    new Set(["s"]),
  );
  expect(m.gaps).toEqual([
    { stop: "early", last: 35999, peakOnly: true },
    { stop: "ten", last: 36000, peakOnly: false },
  ]);
});
