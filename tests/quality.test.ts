import { expect, it } from "vitest";
import { evaluateQuality } from "../scripts/lib/quality.mjs";

it("SQL views list unused IDs and count terminal stops as used", () => {
  const result = evaluateQuality(
    ["a", "terminal", "unused"],
    ["t"],
    [
      { trip: "t", stop: "a", sequence: 1, arrival: 86400, departure: 86400 },
      {
        trip: "t",
        stop: "terminal",
        sequence: 2,
        arrival: 87000,
        departure: 87000,
      },
    ],
  );
  expect(result.unusedStopIds).toEqual(["unused"]);
  expect(result.unusedStopCount).toBe(1);
  expect(result.stopTimeOrderViolationCount).toBe(0);
});
it("SQL time ordering allows ties/25-hour times and detects backwards arrivals or dwell times", () => {
  const result = evaluateQuality(
    ["a", "b"],
    ["valid", "backwards", "dwell"],
    [
      {
        trip: "valid",
        stop: "a",
        sequence: 1,
        arrival: 90000,
        departure: 90000,
      },
      {
        trip: "valid",
        stop: "b",
        sequence: 2,
        arrival: 90000,
        departure: 90000,
      },
      {
        trip: "backwards",
        stop: "a",
        sequence: 1,
        arrival: 900,
        departure: 1000,
      },
      {
        trip: "backwards",
        stop: "b",
        sequence: 2,
        arrival: 999,
        departure: 1100,
      },
      { trip: "dwell", stop: "a", sequence: 1, arrival: 1000, departure: 999 },
    ],
  );
  expect(result.stopTimeOrderViolationCount).toBe(2);
  expect(result.stopTimeOrderViolations.map((v) => v.trip_id)).toEqual([
    "backwards",
    "dwell",
  ]);
});
