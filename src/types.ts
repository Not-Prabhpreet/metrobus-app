export type DayType = "weekday" | "saturday" | "sunday";
export type Stop = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  routes: string[];
};
export type Route = { id: string; number: string; name: string };
export type Entry = {
  time: number;
  trip: string;
  route: string;
  service: string;
  headsign: string;
  direction: string;
};
export type Departure = Entry & { instant: number; date: string };
export type Trip = {
  id: string;
  route: string;
  service: string;
  headsign: string;
  direction: string;
  shape: string;
  first: number;
  stops: { id: string; time: number; sequence: number; pickup: boolean }[];
};
export type RouteMetric = Route & {
  trips: number;
  first: number;
  last: number;
  span: number;
  headway: number | null;
};
export type Summary = {
  date: string | null;
  routes: RouteMetric[];
  stops: number;
  trips: number;
  coverage: number;
  hours: { hour: number; count: number }[];
  gaps: { stop: string; last: number }[];
};
export type Schedule = {
  meta: {
    source: string;
    terms: string;
    timezone: string;
    start: string;
    end: string;
    retrieved: string;
    sha256: string;
    outside: number;
    duplicateNames: number;
    maxTime: number;
    chartAfterMidnight: string;
  };
  calendar: { id: string; start: string; end: string; days: string[] }[];
  exceptions: { id: string; date: string; type: number }[];
  stops: Record<string, Stop>;
  routes: Route[];
  trips: Record<string, Trip>;
  departures: Record<string, Entry[]>;
  shapes: Record<string, number[][]>;
  summary: Record<DayType, Summary>;
};
