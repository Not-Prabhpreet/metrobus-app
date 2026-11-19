import { useEffect, useMemo, useState } from "react";
import { Badge, dayLabels, formatDate, StatusChip } from "./components";
import { localDate, scheduleClock } from "./lib/time.mjs";
import type { DayType, RouteMetric, Schedule, Summary } from "./types";

type SortKey = "number" | "trips" | "first" | "last" | "headway" | "span";
const sortLabels: Record<SortKey, string> = {
  number: "Route",
  trips: "Trips",
  first: "First bus",
  last: "Last bus",
  headway: "Midday headway",
  span: "Service span",
};
function minutes(value: number | null) {
  return value === null
    ? "Not enough service"
    : `Every ${Number(value.toFixed(1))} min`;
}
function span(seconds: number) {
  return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
}
export function Insights({ data, now }: { data: Schedule; now: number }) {
  const [day, setDay] = useState<DayType>("weekday"),
    [sort, setSort] = useState<SortKey>("trips"),
    [descending, setDescending] = useState(true);
  const [limit, setLimit] = useState(() =>
    window.matchMedia("(max-width:719px)").matches ? 4 : 8,
  );
  const selected = data.summary[day];
  const rows = useMemo(
    () =>
      [...selected.routes].sort((a, b) => {
        if (sort === "headway") {
          if (a.headway === null && b.headway !== null) return 1;
          if (b.headway === null && a.headway !== null) return -1;
        }
        const order =
          sort === "number"
            ? a.number.localeCompare(b.number, undefined, { numeric: true })
            : (a[sort] ?? 0) - (b[sort] ?? 0);
        return (
          (descending ? -order : order) ||
          a.number.localeCompare(b.number, undefined, { numeric: true })
        );
      }),
    [selected, sort, descending],
  );
  const maxHeadway = Math.max(...selected.routes.map((r) => r.headway ?? -1));
  const least = selected.routes
    .filter((r) => r.headway === maxHeadway)
    .map((r) => r.number);
  const sentence =
    maxHeadway < 0
      ? "There are not enough midday departures to compare route frequencies."
      : `${least.length === 1 ? "Route" : "Routes"} ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(least)} ${least.length === 1 ? "runs" : "run"} least often at midday: every ${maxHeadway} minutes.`;
  function changeSort(key: SortKey) {
    if (sort === key) setDescending((v) => !v);
    else {
      setSort(key);
      setDescending(!["number", "first"].includes(key));
    }
  }
  const columns: SortKey[] = [
    "number",
    "trips",
    "first",
    "last",
    "headway",
    "span",
  ];
  return (
    <>
      <section className="insights-intro">
        <div>
          <h1 tabIndex={-1}>Service insights</h1>
          <p className="caption">
            Schedule valid {formatDate(data.meta.start)} –{" "}
            {formatDate(data.meta.end)} · downloaded{" "}
            {formatDate(data.meta.retrieved)}
          </p>
        </div>
        <div className="day-toggle" role="group" aria-label="Service day type">
          {(["weekday", "saturday", "sunday"] as DayType[]).map((d) => (
            <button key={d} aria-pressed={day === d} onClick={() => setDay(d)}>
              {dayLabels[d]}
            </button>
          ))}
        </div>
      </section>
      <p className="representative-date caption" aria-live="polite">
        {selected.date
          ? `Showing ${dayLabels[day].toLowerCase()} service for ${formatDate(selected.date)}.`
          : `No ${dayLabels[day].toLowerCase()} service in this feed.`}
      </p>
      <dl className="kpi-grid">
        {[
          [
            "Routes",
            selected.routes.length.toLocaleString(),
            `Running on ${day === "weekday" ? "a weekday" : dayLabels[day]}`,
          ],
          [
            "Stops",
            selected.stops.toLocaleString(),
            "With at least one departure",
          ],
          [
            `${dayLabels[day]} trips`,
            selected.trips.toLocaleString(),
            "Total across the day",
          ],
          [
            "Stops served every 30 min",
            `${selected.coverage}%`,
            "Between 7 a.m. and 7 p.m.",
          ],
        ].map(([label, value, context]) => (
          <div className="card kpi-tile" key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="kpi-value">{value}</span>
              <span className="caption kpi-context">{context}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <TripsChart
            summary={selected}
            day={day}
            note={data.meta.chartAfterMidnight}
          />
          <section className="card routes-panel">
            <h2>Routes</h2>
            <p className="table-sentence">{sentence}</p>
            <p className="caption table-caption">
              Showing {Math.min(limit, rows.length)} of {rows.length} routes.
              Select a column heading to sort.
            </p>
            <div className="mobile-sort">
              <label htmlFor="route-sort">Sort by</label>
              <select
                id="route-sort"
                value={`${sort}-${descending ? "desc" : "asc"}`}
                onChange={(e) => {
                  const [key, order] = e.target.value.split("-");
                  setSort(key as SortKey);
                  setDescending(order === "desc");
                }}
              >
                {columns.flatMap((key) =>
                  ["asc", "desc"].map((order) => (
                    <option key={`${key}-${order}`} value={`${key}-${order}`}>
                      {sortLabels[key]} (
                      {key === "number"
                        ? order === "asc"
                          ? "lowest first"
                          : "highest first"
                        : order === "asc"
                          ? "least first"
                          : "most first"}
                      )
                    </option>
                  )),
                )}
              </select>
            </div>
            <div className="route-table-container">
              <table className="route-table">
                <caption className="sr-only">
                  {dayLabels[day]} route service, sorted by {sortLabels[sort]}{" "}
                  {descending ? "descending" : "ascending"}.
                </caption>
                <thead>
                  <tr>
                    {columns.map((key) => (
                      <th
                        key={key}
                        scope="col"
                        aria-sort={
                          sort === key
                            ? descending
                              ? "descending"
                              : "ascending"
                            : "none"
                        }
                      >
                        <button onClick={() => changeSort(key)}>
                          {key === "trips"
                            ? `${dayLabels[day]} trips`
                            : key === "number"
                              ? "Route"
                              : sortLabels[key]}
                          {sort === key && (
                            <span className="sort-indicator" aria-hidden="true">
                              {descending ? "▼" : "▲"}
                            </span>
                          )}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="route-cell">
                          <Badge route={row} />
                          <a href={`#/route/${row.id}`}>{row.name}</a>
                        </div>
                      </td>
                      <td>
                        <strong>{row.trips}</strong>
                      </td>
                      <td>{scheduleClock(row.first)}</td>
                      <td>{scheduleClock(row.last)}</td>
                      <td>
                        <strong>{minutes(row.headway)}</strong>
                      </td>
                      <td>{span(row.span)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="route-cards">
              {rows.slice(0, limit).map((row) => (
                <RouteCard key={row.id} row={row} day={day} />
              ))}
            </div>
            {limit < rows.length && (
              <button
                className="button secondary full-width"
                onClick={() => setLimit((n) => n + 8)}
              >
                Show {Math.min(8, rows.length - limit)} more routes
              </button>
            )}
          </section>
        </div>
        <aside
          className="dashboard-aside"
          aria-label="Service gaps and data quality"
        >
          <ServiceGaps data={data} />
          <DataQuality data={data} now={now} />
        </aside>
      </div>
    </>
  );
}
function RouteCard({ row, day }: { row: RouteMetric; day: DayType }) {
  return (
    <article className="card route-metric-card">
      <div className="route-card-title">
        <Badge route={row} />
        <a href={`#/route/${row.id}`}>{row.name}</a>
      </div>
      <dl>
        {[
          [`${dayLabels[day]} trips`, row.trips],
          ["Midday headway", minutes(row.headway)],
          ["First bus", scheduleClock(row.first)],
          ["Last bus", scheduleClock(row.last)],
          ["Span", span(row.span)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
function TripsChart({
  summary,
  day,
  note,
}: {
  summary: Summary;
  day: DayType;
  note: string;
}) {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width:719px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width:719px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const width = compact ? 400 : 800,
    right = width - 48;
  const max = Math.max(...summary.hours.map((h) => h.count)),
    top = Math.max(10, Math.ceil(max / 20) * 20);
  const peaks = summary.hours.filter((h) => h.count === max),
    peak = peaks[0];
  const hourLabel = (hour: number) =>
    `${hour % 12 || 12} ${hour < 12 ? "a.m." : "p.m."}`;
  const x = (hour: number) => 48 + ((hour - 5) / 18) * (right - 48),
    y = (count: number) => 256 - (count / top) * 208;
  const points = summary.hours
    .map((h) => `${x(h.hour)},${y(h.count)}`)
    .join(" ");
  const sentence = summary.trips
    ? `${dayLabels[day]} service peaks at ${new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(peaks.map((p) => hourLabel(p.hour)))} (${max} trips an hour). ${summary.hours.filter((h) => h.hour >= 19).reduce((n, h) => n + h.count, 0)} trips start after 7 p.m.`
    : "No trips are scheduled for this day type.";
  return (
    <section className="card chart-panel">
      <h2>Trips per hour</h2>
      <p className="chart-sentence">{sentence}</p>
      <svg
        className="trips-chart"
        viewBox={`0 0 ${width} 320`}
        role="img"
        aria-label={sentence}
      >
        <rect
          x={x(19)}
          y="48"
          width={right - x(19)}
          height="208"
          fill="var(--tint)"
        />
        <text x={x(19) + 8} y="67" className="chart-band-label">
          {compact ? "After 7" : "After 7 p.m."}
          {compact && (
            <tspan x={x(19) + 8} dy={18}>
              p.m.
            </tspan>
          )}
        </text>
        {[0, 1, 2, 3, 4].map((i) => {
          const count = (top * i) / 4;
          return (
            <g key={i}>
              <line
                x1="48"
                y1={y(count)}
                x2={right}
                y2={y(count)}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text x="38" y={y(count) + 5} textAnchor="end">
                {count}
              </text>
            </g>
          );
        })}
        <polygon
          points={`48,256 ${points} ${right},256`}
          fill="var(--tint)"
          opacity=".6"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {max > 0 && (
          <>
            <circle
              cx={x(peak.hour)}
              cy={y(peak.count)}
              r="5"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="3"
            />
            <text
              x={Math.max(100, Math.min(right - 20, x(peak.hour)))}
              y={Math.max(25, y(peak.count) - 13)}
              textAnchor="middle"
              className="chart-peak"
            >
              {peak.count} at {hourLabel(peak.hour)}
            </text>
          </>
        )}
        {[6, 9, 12, 15, 18, 21].map((hour) => (
          <text
            key={hour}
            x={x(hour)}
            y="285"
            textAnchor="middle"
            className={
              hour === 9 || hour === 15 || hour === 21
                ? "desktop-chart-label"
                : ""
            }
          >
            {compact
              ? `${hour % 12 || 12} ${hour < 12 ? "a" : "p"}`
              : hourLabel(hour)}
          </text>
        ))}
      </svg>
      <details className="chart-data">
        <summary>View chart data as a list</summary>
        <ul>
          {summary.hours.map((h) => (
            <li key={h.hour}>
              <span>{hourLabel(h.hour)}</span>
              <strong>{h.count} trips</strong>
            </li>
          ))}
        </ul>
        <p className="caption">{note}</p>
      </details>
    </section>
  );
}
function ServiceGaps({ data }: { data: Schedule }) {
  const [limit, setLimit] = useState(6),
    gaps = data.summary.weekday.gaps;
  return (
    <section className="card side-panel">
      <h2>Service gaps</h2>
      <p>
        {gaps.length
          ? `${gaps.length} stops have no scheduled service at or after 7 p.m. on weekdays.`
          : "Every served weekday stop has a departure at or after 7 p.m."}
      </p>
      <p className="caption">
        Weekday ·{" "}
        {data.summary.weekday.date
          ? formatDate(data.summary.weekday.date)
          : "No representative date"}
      </p>
      <ul className="gap-list">
        {gaps.slice(0, limit).map((gap) => (
          <li key={gap.stop}>
            <a href={`#/stop/${gap.stop}`}>
              <strong>{data.stops[gap.stop].name}</strong>
              <span className="caption">Stop #{data.stops[gap.stop].code}</span>
            </a>
            <div>
              <span className="caption">Last bus</span>
              <strong>{scheduleClock(gap.last)}</strong>
            </div>
          </li>
        ))}
      </ul>
      {limit < gaps.length && (
        <button
          className="button secondary full-width"
          onClick={() => setLimit(gaps.length)}
        >
          See all {gaps.length} stops
        </button>
      )}
    </section>
  );
}
function DataQuality({ data, now }: { data: Schedule; now: number }) {
  const { meta } = data,
    days = Math.floor(
      (Date.parse(meta.end) - Date.parse(localDate(now, meta.timezone))) /
        86400000,
    );
  const checks: {
    title: string;
    pass: boolean;
    text: string;
    unusedIds?: string[];
  }[] = [
    {
      title: "Required files are present",
      pass: true,
      text: "agency, routes, trips, stop_times, stops and service calendar",
    },
    {
      title: "Stop coordinates are in the service area",
      pass: meta.outside === 0,
      text: meta.outside
        ? `${meta.outside} stops fall outside the configured service area`
        : `All ${Object.keys(data.stops).length.toLocaleString()} stops fall inside the region`,
    },
    {
      title: "Calendar covers the next 45 days",
      pass: days >= 45,
      text: `Feed ends ${formatDate(meta.end)}, ${days >= 0 ? `in ${days} days` : `${Math.abs(days)} days ago`}`,
    },
    {
      title: "Every stop is used by at least one trip",
      pass: meta.unusedStopCount === 0,
      text: meta.unusedStopCount
        ? `${meta.unusedStopCount} unused stops`
        : "All stops occur in at least one trip. No unused stop IDs.",
      unusedIds: meta.unusedStopIds,
    },
    {
      title: "Stop times increase within each trip",
      pass: meta.stopTimeOrderViolationCount === 0,
      text: meta.stopTimeOrderViolationCount
        ? `${meta.stopTimeOrderViolationCount} time-order violations`
        : "All trips have non-decreasing arrival/departure times. Equal times are allowed.",
    },
  ];
  const passed = checks.filter((c) => c.pass).length;
  return (
    <section className="card side-panel">
      <h2>Data quality</h2>
      <p>
        {passed} of {checks.length} checks pass
        {passed < checks.length
          ? `; ${checks.length - passed} ${checks.length - passed === 1 ? "needs" : "need"} a look before the next feed.`
          : "."}
      </p>
      <ul className="quality-list">
        {checks.map((check) => (
          <li key={check.title}>
            <div>
              <strong>{check.title}</strong>
              <p className="caption">{check.text}</p>
              {!!check.unusedIds?.length && (
                <details className="unused-stops">
                  <summary>Unused stop IDs ({check.unusedIds.length})</summary>
                  <ul>
                    {check.unusedIds.map((id) => (
                      <li key={id}>
                        <a href={`#/stop/${id}`}>{id}</a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <StatusChip pass={check.pass} />
          </li>
        ))}
      </ul>
    </section>
  );
}
