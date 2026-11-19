import { expect, it } from "vitest";
import { boardingDepartures } from "../scripts/lib/boarding.mjs";

it("excludes terminal arrivals and explicit no-pickup stops from boarding", () => {
  const trips = {
    a: {
      id: "a",
      route: "1",
      service: "s",
      headsign: "Town",
      direction: "0",
      stops: [
        { id: "end", time: 900, sequence: 3, pickup: true },
        { id: "start", time: 600, sequence: 1, pickup: true },
        { id: "middle", time: 700, sequence: 2, pickup: false },
      ],
    },
  };
  const result = boardingDepartures(trips, ["start", "middle", "end"]);
  expect(result.start).toHaveLength(1);
  expect(result.middle).toEqual([]);
  expect(result.end).toEqual([]);
  expect(trips.a.stops.at(-1)?.pickup).toBe(false);
});
it("keeps the initial boarding on a loop while excluding its terminal occurrence", () => {
  const trips = {
    loop: {
      id: "loop",
      route: "1",
      service: "s",
      headsign: "Loop",
      direction: "0",
      stops: [
        { id: "a", time: 600, sequence: 1, pickup: true },
        { id: "b", time: 700, sequence: 2, pickup: true },
        { id: "a", time: 900, sequence: 3, pickup: true },
      ],
    },
  };
  const result = boardingDepartures(trips, ["a", "b"]);
  expect(result.a.map((d) => d.time)).toEqual([600]);
  expect(result.b.map((d) => d.time)).toEqual([700]);
});
