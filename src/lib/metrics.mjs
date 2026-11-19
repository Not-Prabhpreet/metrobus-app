export function median(values) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y),
    i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}
export function coverage(times) {
  const a = [...new Set(times.filter((t) => t >= 25200 && t <= 68400))].sort(
    (x, y) => x - y,
  );
  const bounded = [25200, ...a, 68400];
  return (
    a.length > 0 && bounded.slice(1).every((t, i) => t - bounded[i] <= 1800)
  );
}
export function middayHeadway(trips) {
  const directions = [...new Set(trips.map((t) => t.direction))];
  const values = directions.map((direction) => {
    const times = [
      ...new Set(
        trips
          .filter(
            (t) =>
              t.direction === direction && t.first >= 36000 && t.first <= 50400,
          )
          .map((t) => t.first),
      ),
    ].sort((a, b) => a - b);
    return median(times.slice(1).map((t, i) => (t - times[i]) / 60));
  });
  return values.some((v) => v === null) || !values.length
    ? null
    : Math.max(...values);
}
export function metricsFor(trips, departures, routes, stops, active) {
  const selected = Object.values(trips).filter((t) => active.has(t.service));
  const served = Object.entries(departures)
    .map(([id, entries]) => ({
      id,
      times: entries.filter((e) => active.has(e.service)).map((e) => e.time),
    }))
    .filter((s) => s.times.length);
  const routeRows = routes
    .map((route) => {
      const ts = selected.filter((t) => t.route === route.id);
      if (!ts.length) return null;
      const first = Math.min(...ts.map((t) => t.first)),
        last = Math.max(...ts.map((t) => t.first));
      return {
        ...route,
        trips: ts.length,
        first,
        last,
        span: last - first,
        headway: middayHeadway(ts),
      };
    })
    .filter(Boolean);
  const hours = Array.from({ length: 19 }, (_, i) => ({
    hour: i + 5,
    count: 0,
  }));
  // Preserve service-day totals: 24:00+ first departures join the final 23:00 bin.
  for (const t of selected) {
    const h = Math.min(23, Math.floor(t.first / 3600));
    if (h >= 5) hours[h - 5].count++;
  }
  const gaps = served
    .map((s) => {
      const last = Math.max(...s.times);
      return { stop: s.id, last, peakOnly: last < 36000 };
    })
    .filter((s) => s.last < 68400)
    .sort((a, b) => a.last - b.last);
  return {
    routes: routeRows,
    stops: served.length,
    trips: selected.length,
    coverage: served.length
      ? Math.round(
          (served.filter((s) => coverage(s.times)).length / served.length) *
            100,
        )
      : 0,
    hours,
    gaps,
  };
}
