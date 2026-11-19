import {
  readFile,
  writeFile,
  mkdir,
  rename,
  rm,
  lstat,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { parse } from "csv-parse/sync";
import {
  activeServices,
  addDays,
  dayType,
  isoDate,
  localDate,
  parseTime,
} from "../src/lib/time.mjs";
import { metricsFor } from "../src/lib/metrics.mjs";
import { boardingDepartures } from "./lib/boarding.mjs";
import { evaluateQuality } from "./lib/quality.mjs";

const source = "https://www.metrobustransit.ca/google/google_transit.zip";
const root = new URL("../", import.meta.url);
const path = (p) => new URL(p, root);
const bounds = { south: 47.35, north: 47.75, west: -52.95, east: -52.55 };
try {
  await mkdir(path("data/"), { recursive: true });
  if (process.argv.includes("--download")) {
    const r = await fetch(source, { signal: AbortSignal.timeout(45000) });
    if (!r.ok) throw new Error(`GTFS download failed: HTTP ${r.status}`);
    const b = new Uint8Array(await r.arrayBuffer());
    unzipSync(b); // Validate before replacing the retained snapshot.
    await writeFile(path("data/google_transit.zip"), b);
  }
  const bytes = await readFile(path("data/google_transit.zip"));
  const zip = unzipSync(bytes);
  const required = ["agency", "routes", "trips", "stop_times", "stops"];
  const missing = required.filter((f) => !zip[f + ".txt"]);
  if (!zip["calendar.txt"] && !zip["calendar_dates.txt"])
    missing.push("calendar or calendar_dates");
  if (missing.length)
    throw new Error(`Missing GTFS files: ${missing.join(", ")}`);
  function csv(file, columns = []) {
    if (!zip[file + ".txt"]) return [];
    try {
      const rows = parse(
        strFromU8(zip[file + ".txt"]).replace(/\r\r\n/g, "\n"),
        { columns: true, bom: true, skip_empty_lines: true, trim: true },
      );
      if (!rows.length || columns.some((c) => !(c in rows[0])))
        throw new Error(`Required columns: ${columns.join(", ")}`);
      return rows;
    } catch (e) {
      throw new Error(`Malformed ${file}.txt: ${e.message}`);
    }
  }
  const agency = csv("agency", ["agency_timezone"])[0];
  const calendars = csv("calendar", [
    "service_id",
    "start_date",
    "end_date",
  ]).map((c) => ({
    id: c.service_id,
    start: isoDate(c.start_date),
    end: isoDate(c.end_date),
    days: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ].filter((d) => c[d] === "1"),
  }));
  const exceptions = csv("calendar_dates", [
    "service_id",
    "date",
    "exception_type",
  ]).map((c) => ({
    id: c.service_id,
    date: isoDate(c.date),
    type: Number(c.exception_type),
  }));
  const routes = csv("routes", [
    "route_id",
    "route_short_name",
    "route_long_name",
  ])
    .map((r) => ({
      id: r.route_id,
      number: r.route_short_name,
      name: r.route_long_name,
    }))
    .sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true }),
    );
  const stopRows = csv("stops", [
    "stop_id",
    "stop_name",
    "stop_lat",
    "stop_lon",
  ]).filter((s) => !s.location_type || s.location_type === "0");
  const stops = Object.fromEntries(
    stopRows.map((s) => [
      s.stop_id,
      {
        id: s.stop_id,
        code: s.stop_code || s.stop_id,
        name: s.stop_name,
        lat: Number(s.stop_lat),
        lon: Number(s.stop_lon),
        routes: [],
      },
    ]),
  );
  const trips = Object.fromEntries(
    csv("trips", ["trip_id", "route_id", "service_id"]).map((t) => [
      t.trip_id,
      {
        id: t.trip_id,
        route: t.route_id,
        service: t.service_id,
        headsign:
          t.trip_headsign ||
          routes.find((r) => r.id === t.route_id)?.name ||
          "Route",
        direction: t.direction_id || "0",
        shape: t.shape_id,
        stops: [],
      },
    ]),
  );
  const qualityStopTimes = [];
  for (const row of csv("stop_times", [
    "trip_id",
    "stop_id",
    "stop_sequence",
    "departure_time",
  ])) {
    const trip = trips[row.trip_id];
    if (!trip)
      throw new Error(`stop_times.txt references unknown trip ${row.trip_id}`);
    if (!stops[row.stop_id])
      throw new Error(`stop_times.txt references unknown stop ${row.stop_id}`);
    let time, arrival;
    try {
      time = parseTime(row.departure_time || row.arrival_time);
      arrival = parseTime(row.arrival_time || row.departure_time);
    } catch (e) {
      throw new Error(
        `Malformed stop_times.txt, trip ${trip.id}: ${e.message}`,
      );
    }
    qualityStopTimes.push({
      trip: trip.id,
      stop: row.stop_id,
      sequence: Number(row.stop_sequence),
      arrival,
      departure: time,
    });
    trip.stops.push({
      id: row.stop_id,
      time,
      sequence: Number(row.stop_sequence),
      pickup: row.pickup_type !== "1",
      headsign: row.stop_headsign || trip.headsign,
    });
    if (!stops[row.stop_id].routes.includes(trip.route))
      stops[row.stop_id].routes.push(trip.route);
  }
  for (const t of Object.values(trips)) {
    if (!t.stops.length)
      throw new Error(`trips.txt: trip ${t.id} has no stop_times`);
    if (!routes.some((r) => r.id === t.route))
      throw new Error(`trips.txt: unknown route ${t.route}`);
    t.stops.sort((a, b) => a.sequence - b.sequence);
    t.first = t.stops[0].time;
  }
  const quality = evaluateQuality(
    Object.keys(stops),
    Object.keys(trips),
    qualityStopTimes,
  );
  if (quality.stopTimeOrderViolationCount) {
    const violation = quality.stopTimeOrderViolations[0];
    throw new Error(
      `stop_times.txt: SQL time-order check failed in trip ${violation.trip_id}, sequence ${violation.stop_sequence} (${quality.stopTimeOrderViolationCount} violations)`,
    );
  }
  const departures = boardingDepartures(trips, Object.keys(stops));
  const shapePoints = {};
  for (const row of csv("shapes"))
    (shapePoints[row.shape_id] ??= []).push([
      Number(row.shape_pt_lat),
      Number(row.shape_pt_lon),
      Number(row.shape_pt_sequence),
    ]);
  const shapes = Object.fromEntries(
    Object.entries(shapePoints).map(([id, points]) => [
      id,
      points
        .sort((a, b) => a[2] - b[2])
        .filter((_, i) => i % 3 === 0 || i === points.length - 1)
        .map((p) => p.slice(0, 2)),
    ]),
  );
  const dates = [
    ...calendars.flatMap((c) => [c.start, c.end]),
    ...exceptions.filter((e) => e.type === 1).map((e) => e.date),
  ].sort();
  if (!dates.length)
    throw new Error(
      "No valid service dates in calendar.txt / calendar_dates.txt",
    );
  const start = dates[0],
    end = dates.at(-1),
    today = localDate();
  const summary = {};
  for (const type of ["weekday", "saturday", "sunday"]) {
    let date = today < start ? start : today > end ? start : today;
    let chosen = null;
    for (let i = 0; i < 370 && date <= end; i++, date = addDays(date, 1))
      if (
        dayType(date) === type &&
        !exceptions.some((e) => e.date === date) &&
        activeServices(calendars, exceptions, date).size
      ) {
        chosen = date;
        break;
      }
    if (!chosen)
      for (let date = start; date <= end; date = addDays(date, 1))
        if (
          dayType(date) === type &&
          activeServices(calendars, exceptions, date).size
        ) {
          chosen = date;
          break;
        }
    summary[type] = {
      date: chosen,
      ...metricsFor(
        trips,
        departures,
        routes,
        stops,
        chosen ? activeServices(calendars, exceptions, chosen) : new Set(),
      ),
    };
  }
  const outside = Object.values(stops).filter(
    (s) =>
      !Number.isFinite(s.lat) ||
      !Number.isFinite(s.lon) ||
      s.lat < bounds.south ||
      s.lat > bounds.north ||
      s.lon < bounds.west ||
      s.lon > bounds.east,
  ).length;
  const hash = createHash("sha256").update(bytes).digest("hex");
  let retrieved;
  try {
    const prior = JSON.parse(await readFile(path("data/source.json"), "utf8"));
    if (!process.argv.includes("--download") && prior.sha256 === hash)
      retrieved = prior.retrieved;
  } catch {}
  retrieved ??= new Date().toISOString();
  const meta = {
    source,
    terms: "https://metrobus.com/gtfs.asp",
    timezone: agency.agency_timezone,
    start,
    end,
    retrieved,
    sha256: hash,
    bounds,
    outside,
    ...quality,
    maxTime: Math.max(
      ...Object.values(trips).flatMap((t) => t.stops.map((s) => s.time)),
    ),
    chartAfterMidnight:
      "First departures at 24:00 or later are included in the final 11 p.m. service-day bin.",
  };
  const bundle = {
    meta,
    calendar: calendars,
    exceptions,
    routes,
    stops,
    trips,
    departures,
    shapes,
    summary,
  };
  await writeFile(
    path("data/source.json"),
    JSON.stringify({ source, retrieved, sha256: hash }, null, 2) + "\n",
  );
  // Stage all outputs, then replace the output directory only after complete validation.
  const staging = path("public/data-next/");
  await mkdir(new URL("stops/", staging), { recursive: true });
  await writeFile(new URL("schedule.json", staging), JSON.stringify(bundle));
  await writeFile(
    new URL("summary.json", staging),
    JSON.stringify({ meta, summary }),
  );
  for (const [id, entries] of Object.entries(departures))
    await writeFile(
      new URL(`stops/${encodeURIComponent(id)}.json`, staging),
      JSON.stringify({ stop: stops[id], departures: entries }),
    );
  const output = path("public/data/");
  if (!fileURLToPath(output).startsWith(fileURLToPath(path("public/"))))
    throw new Error("Output directory is outside public");
  try {
    if ((await lstat(output)).isSymbolicLink())
      throw new Error("Refusing to replace a linked output directory");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await rm(output, { recursive: true, force: true });
  await rename(staging, path("public/data/"));
  console.log(
    `GTFS ready: ${routes.length} routes, ${Object.keys(stops).length} stops, ${Object.keys(trips).length} trips; ${start} to ${end}.`,
  );
  console.log(
    "Representative dates:",
    Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, v.date])),
  );
} catch (e) {
  console.error(`Schedule build failed: ${e.message}`);
  process.exitCode = 1;
}
