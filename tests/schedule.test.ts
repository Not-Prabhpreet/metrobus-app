import { describe, expect, it } from "vitest";
import {
  activeServices,
  countdown,
  nextDepartures,
  parseTime,
  serviceInstant,
} from "../src/lib/time.mjs";
import {
  coverage,
  median,
  middayHeadway,
  metricsFor,
} from "../src/lib/metrics.mjs";

const calendar = [
  { id: "fri", start: "2026-01-01", end: "2026-12-31", days: ["friday"] },
];
describe("GTFS service days", () => {
  it("preserves after-midnight hours and rejects malformed times", () => {
    expect(parseTime("25:35:00")).toBe(92100);
    expect(() => parseTime("12:75:00")).toThrow();
  });
  it("keeps Friday service eligible after midnight Saturday", () => {
    const now = serviceInstant("2026-11-20", 24 * 3600 + 30 * 60);
    const entries = [{ time: parseTime("24:45:00"), service: "fri" }];
    const next = nextDepartures(entries, calendar, [], now, 90000);
    expect(next[0].date).toBe("2026-11-20");
    expect(next[0].instant - now).toBe(15 * 60000);
    expect(
      nextDepartures(
        entries,
        calendar,
        [{ id: "fri", date: "2026-11-20", type: 2 }],
        now,
        90000,
      )[0]?.date,
    ).not.toBe("2026-11-20");
  });
  it("applies additions and removals, including an exceptions-only feed", () => {
    const changes = [
      { id: "fri", date: "2026-11-20", type: 2 },
      { id: "special", date: "2026-11-20", type: 1 },
    ];
    expect([...activeServices(calendar, changes, "2026-11-20")]).toEqual([
      "special",
    ]);
    expect([...activeServices([], changes, "2026-11-20")]).toEqual(["special"]);
  });
  it("uses the GTFS noon anchor across Newfoundland DST changes", () => {
    expect(new Date(serviceInstant("2026-03-08", 6 * 3600)).toISOString()).toBe(
      "2026-03-08T08:30:00.000Z",
    );
    expect(new Date(serviceInstant("2026-03-08", 0)).toISOString()).toBe(
      "2026-03-08T02:30:00.000Z",
    );
    expect(new Date(serviceInstant("2026-11-01", 0)).toISOString()).toBe(
      "2026-11-01T03:30:00.000Z",
    );
    expect(new Date(serviceInstant("2026-11-01", 3600)).toISOString()).toBe(
      "2026-11-01T04:30:00.000Z",
    );
  });
  it("formats countdown boundaries and tomorrow in agency time", () => {
    const now = serviceInstant("2026-11-19", 12 * 3600);
    expect(countdown(now + 59000, now)).toBe("Now");
    expect(countdown(now + 60000, now)).toBe("in 1 min");
    expect(countdown(now + 3900000, now)).toBe("in 1 h 5 min");
    expect(
      countdown(serviceInstant("2026-11-20", 6 * 3600 + 15 * 60), now),
    ).toBe("Tomorrow 6:15 a.m.");
  });
});
describe("service metrics", () => {
  it("counts the coverage window boundaries and rejects empty service", () => {
    const times = Array.from({ length: 25 }, (_, i) => 25200 + i * 1800);
    expect(coverage(times)).toBe(true);
    expect(coverage(times.slice(2))).toBe(false);
    expect(coverage([])).toBe(false);
  });
  it("uses the median for each direction then the less frequent direction", () => {
    const trips = [0, 1200, 2400]
      .map((t) => ({ direction: "0", first: 36000 + t }))
      .concat(
        [0, 2700, 5400].map((t) => ({ direction: "1", first: 36000 + t })),
      );
    expect(middayHeadway(trips)).toBe(45);
    expect(middayHeadway([{ direction: "0", first: 36000 }])).toBeNull();
    expect(median([10, 20, 40, 50])).toBe(30);
  });
  it("counts distinct trips and stops and excludes exactly 7 p.m. from service gaps", () => {
    const trip = {
      id: "t",
      route: "r",
      service: "s",
      first: 90000,
      direction: "0",
    };
    const m = metricsFor(
      { t: trip },
      {
        a: [{ service: "s", time: 68400 }],
        b: [{ service: "s", time: 68000 }],
      },
      [{ id: "r" }],
      {},
      new Set(["s"]),
    );
    expect(m.trips).toBe(1);
    expect(m.stops).toBe(2);
    expect(m.hours.at(-1)?.count).toBe(1);
    expect(m.gaps).toEqual([{ stop: "b", last: 68000, peakOnly: false }]);
  });
});
