import { Temporal } from "@js-temporal/polyfill";

export const ZONE = "America/St_Johns";
export const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
export function parseTime(value) {
  if (!/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(value))
    throw new Error(`Invalid GTFS time: ${value}`);
  const [h, m, s] = value.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
export function isoDate(value) {
  return value.includes("-")
    ? value
    : `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}
export function localDate(now = Date.now(), zone = ZONE) {
  return Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}
export function addDays(date, days) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function dayType(date) {
  const day = Temporal.PlainDate.from(date).dayOfWeek;
  return day === 6 ? "saturday" : day === 7 ? "sunday" : "weekday";
}
export function activeServices(calendar, exceptions, date) {
  const day = Temporal.PlainDate.from(date).dayOfWeek;
  const key = DAYS[day % 7];
  const ids = new Set(
    calendar
      .filter((c) => date >= c.start && date <= c.end && c.days.includes(key))
      .map((c) => c.id),
  );
  for (const e of exceptions)
    if (e.date === date) {
      if (e.type === 1) ids.add(e.id);
      else ids.delete(e.id);
    }
  return ids;
}
// GTFS Time is measured from local noon minus twelve elapsed hours, including DST days.
export function serviceInstant(date, seconds, zone = ZONE) {
  return Temporal.PlainDate.from(date)
    .toZonedDateTime({ timeZone: zone, plainTime: "12:00" })
    .toInstant()
    .subtract({ hours: 12 })
    .add({ seconds }).epochMilliseconds;
}
export function clock(instant, zone = ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(instant)
    .replace(/a\.?m\.?/i, "a.m.")
    .replace(/p\.?m\.?/i, "p.m.")
    .replace(/\s+/g, " ");
}
export function scheduleClock(seconds) {
  const h = Math.floor(seconds / 3600) % 24,
    m = Math.floor(seconds / 60) % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}${seconds >= 86400 ? " (+1 day)" : ""}`;
}
export function countdown(instant, now = Date.now(), zone = ZONE) {
  if (localDate(instant, zone) > localDate(now, zone))
    return `${localDate(instant, zone) === addDays(localDate(now, zone), 1) ? "Tomorrow" : new Intl.DateTimeFormat("en-CA", { timeZone: zone, month: "short", day: "numeric" }).format(instant)} ${clock(instant, zone)}`;
  const min = Math.floor((instant - now) / 60000);
  if (min < 1) return "Now";
  return min < 60
    ? `in ${min} min`
    : `in ${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
}
export function nextDepartures(
  entries,
  calendar,
  exceptions,
  now = Date.now(),
  maxTime = 86400,
  zone = ZONE,
) {
  const today = localDate(now, zone),
    result = [];
  // Search a full week ahead to find the next actual service, including weekends/holidays.
  for (let i = -Math.ceil(maxTime / 86400); i <= 7; i++) {
    const date = addDays(today, i),
      active = activeServices(calendar, exceptions, date);
    const anchor = serviceInstant(date, 0, zone);
    for (const entry of entries)
      if (active.has(entry.service)) {
        const instant = anchor + entry.time * 1000;
        if (instant >= now - 1000) result.push({ ...entry, instant, date });
      }
  }
  return result.sort((a, b) => a.instant - b.instant);
}
