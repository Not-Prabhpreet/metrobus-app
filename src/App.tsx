import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  LocateFixed,
  Moon,
  Sun,
  WifiOff,
} from "lucide-react";
import {
  Badge,
  dayLabels,
  DepartureRow,
  distanceBetween,
  Empty,
  Footer,
  formatDate,
  Navigation,
  Notice,
  SaveButton,
  SearchField,
  StopRow,
} from "./components";
import {
  activeServices,
  clock,
  dayType,
  localDate,
  nextDepartures,
  scheduleClock,
  serviceInstant,
} from "./lib/time.mjs";
import type { Departure, Schedule, Stop, Trip } from "./types";
import { Insights } from "./Insights";
import { RouteMap } from "./RouteMap";

type Position = { lat: number; lon: number };
function readSaved(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem("metrobus-saved") || "[]");
    return Array.isArray(a) ? a.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}
function subscribeToLocation(update: () => void) {
  window.addEventListener("hashchange", update);
  return () => window.removeEventListener("hashchange", update);
}
function useLocation() {
  return useSyncExternalStore(
    subscribeToLocation,
    () => location.hash || "#/nearby",
  );
}
export function App() {
  const [data, setData] = useState<Schedule | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now()),
    [offline, setOffline] = useState(!navigator.onLine),
    [saved, setSaved] = useState(readSaved);
  const [position, setPosition] = useState<Position | null>(null),
    [geoState, setGeoState] = useState("idle"),
    [storageMessage, setStorageMessage] = useState("");
  const [cacheDate, setCacheDate] = useState(() => {
    try {
      return localStorage.getItem("metrobus-cache-date");
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("metrobus-theme") || "system";
    } catch {
      return "system";
    }
  });
  const hash = useLocation(),
    parts = hash.replace(/^#\/?/, "").split("/"),
    page = parts[0] || "nearby",
    id = decodeURIComponent(parts[1] || "");
  const active = ["search", "saved", "insights"].includes(page)
    ? page
    : "nearby";
  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch(`${import.meta.env.BASE_URL}data/schedule.json`)
      .then((r) => {
        if (!r.ok) throw Error("Schedule unavailable");
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    const on = () => setOffline(false),
      off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("metrobus-theme", theme);
    } catch {}
  }, [theme]);
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const titles: Record<string, string> = {
      nearby: "Find your stop",
      search: "Search stops",
      saved: "Saved stops",
      insights: "Service insights",
      stop: "Stop departures",
      route: "Route details",
    };
    document.title = `${titles[page] || "Page not found"} · Metrobus Next`;
    document.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [hash, !!data]);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    const readCacheDate = (worker: ServiceWorker | null) => {
      if (worker) {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          const date = event.data;
          if (typeof date === "string") {
            setCacheDate(date);
            try {
              localStorage.setItem("metrobus-cache-date", date);
            } catch {}
          }
          channel.port1.close();
        };
        worker.postMessage("SCHEDULE_SAVED", [channel.port2]);
      }
    };
    const updateSchedule = () => {
      setAttempt((value) => value + 1);
      readCacheDate(navigator.serviceWorker.controller);
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      updateSchedule,
    );
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => readCacheDate(registration.active))
      .catch(() =>
        setStorageMessage(
          "Offline saving is unavailable in this browser. You can still use the schedule while connected.",
        ),
      );
    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        updateSchedule,
      );
  }, []);
  function toggleSaved(stopId: string) {
    setSaved((prev) => {
      const next = prev.includes(stopId)
        ? prev.filter((s) => s !== stopId)
        : [...prev, stopId];
      try {
        localStorage.setItem("metrobus-saved", JSON.stringify(next));
        setStorageMessage("");
      } catch {
        setStorageMessage(
          "Your browser could not save stops permanently. They will stay saved for this visit.",
        );
      }
      return next;
    });
  }
  function locate() {
    if (!navigator.geolocation) {
      setGeoState("denied");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lon: p.coords.longitude });
        setGeoState("ready");
      },
      () => setGeoState("denied"),
      { timeout: 12000, maximumAge: 120000, enableHighAccuracy: false },
    );
  }
  const shared = data
    ? { data, now, saved, onToggle: toggleSaved, position }
    : null;
  const showTop = !["stop", "route"].includes(page);
  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {showTop && (
        <header className="site-header">
          <div className="stripe" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className="header-inner">
            <a className="brand" href="#/nearby">
              Metrobus Next
            </a>
            <button
              className="icon-button theme-button"
              aria-label={`Use ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? (
                <Sun aria-hidden="true" size={22} />
              ) : (
                <Moon aria-hidden="true" size={22} />
              )}
            </button>
            <div className="desktop-navigation">
              <Navigation active={active} />
            </div>
          </div>
        </header>
      )}
      <main
        id="main-content"
        tabIndex={-1}
        className={page === "insights" ? "insights-main" : "rider-main"}
      >
        {offline && (
          <div className="offline-banner" role="status">
            <WifiOff aria-hidden="true" size={26} />
            <div>
              <strong>
                You're offline. {data ? "Showing saved schedule." : ""}
              </strong>
              {data && (
                <p className="caption">
                  {cacheDate ? `Schedule saved ${formatDate(cacheDate)}. ` : ""}
                  Times may have changed.
                </p>
              )}
            </div>
          </div>
        )}
        {storageMessage && <Notice status>{storageMessage}</Notice>}
        {data && localDate(now, data.meta.timezone) > data.meta.end && (
          <Notice status>
            <strong>This schedule may be out of date.</strong>
            <p>
              Service dates end {formatDate(data.meta.end)}. Check{" "}
              <a href="https://metrobus.com">Metrobus</a> before travelling.
            </p>
          </Notice>
        )}
        {!data && !error && (
          <div className="loading" aria-busy="true" role="status">
            <h1 tabIndex={-1}>Loading schedule</h1>
            {[1, 2, 3, 4].map((n) => (
              <div className="skeleton" key={n} />
            ))}
          </div>
        )}
        {!data && error && (
          <>
            <h1 tabIndex={-1}>Schedule unavailable</h1>
            <Empty>
              <p>
                {offline
                  ? "You're offline and no schedule is saved yet. Connect once to save it."
                  : "The schedule could not be loaded. Check your connection and try again."}
              </p>
              <button
                className="button primary"
                onClick={() => setAttempt((v) => v + 1)}
              >
                Try again
              </button>
            </Empty>
          </>
        )}
        {shared &&
          (page === "nearby" ? (
            <Nearby {...shared} locate={locate} geoState={geoState} />
          ) : page === "search" ? (
            <SearchPage {...shared} />
          ) : page === "saved" ? (
            <SavedPage {...shared} />
          ) : page === "stop" && data!.stops[id] ? (
            <StopDetail {...shared} stop={data!.stops[id]} />
          ) : page === "route" && data!.routes.some((r) => r.id === id) ? (
            <RouteDetail {...shared} id={id} />
          ) : page === "insights" ? (
            <Insights data={data!} now={now} />
          ) : (
            <>
              <h1 tabIndex={-1}>Page not found</h1>
              <a className="button secondary" href="#/nearby">
                Find a stop
              </a>
            </>
          ))}
        <Footer />
      </main>
      <div className="mobile-navigation">
        <Navigation active={active} />
      </div>
    </>
  );
}
type Shared = {
  data: Schedule;
  now: number;
  saved: string[];
  onToggle: (id: string) => void;
  position: Position | null;
};
function useDepartures(data: Schedule, stopId: string, now: number) {
  return useMemo(
    () =>
      nextDepartures(
        data.departures[stopId] || [],
        data.calendar,
        data.exceptions,
        now,
        data.meta.maxTime,
        data.meta.timezone,
      ) as Departure[],
    [data, stopId, now],
  );
}
function SavedCard({ stop, ...props }: Shared & { stop: Stop }) {
  const { data, now, saved, onToggle } = props,
    next = useDepartures(data, stop.id, now).slice(0, 2);
  return (
    <article className="card saved-card">
      <div className="saved-card-header">
        <a href={`#/stop/${stop.id}`}>
          <strong>{stop.name}</strong>
          <span className="caption">Stop #{stop.code}</span>
        </a>
        <SaveButton
          stop={stop}
          saved={saved.includes(stop.id)}
          onToggle={onToggle}
        />
      </div>
      {next.length ? (
        next.map((d, i) => (
          <DepartureRow
            key={`${d.trip}-${i}`}
            departure={d}
            route={data.routes.find((r) => r.id === d.route)!}
            now={now}
          />
        ))
      ) : (
        <p className="empty-inline">
          No scheduled departures in the next seven days.
        </p>
      )}
    </article>
  );
}
function Nearby(props: Shared & { locate: () => void; geoState: string }) {
  const { data, position, geoState, locate } = props;
  const nearby = useMemo(
    () =>
      position
        ? Object.values(data.stops)
            .map((stop) => ({
              stop,
              distance: distanceBetween(position, stop),
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
        : [],
    [data, position],
  );
  const [query, setQuery] = useState("");
  return (
    <>
      <section className="page-intro">
        <h1 tabIndex={-1}>Find your stop</h1>
        <SearchField value={query} onChange={setQuery} />
      </section>
      {query ? (
        <SearchResults query={query} {...props} />
      ) : (
        <>
          <section className="section">
            <div className="section-heading">
              <h2>Near you</h2>
            </div>
            <p className="section-caption">
              Your location stays on this device.
            </p>
            {!position ? (
              <div className="location-prompt">
                <MapLocation />
                <p>
                  {geoState === "denied"
                    ? "Location is off. Search for a stop instead. Your location is never sent anywhere."
                    : "Find the stops closest to you, wherever your day takes you."}
                </p>
                <button
                  className="button secondary"
                  onClick={locate}
                  disabled={geoState === "loading"}
                >
                  <LocateFixed aria-hidden="true" size={20} />
                  {geoState === "loading"
                    ? "Finding your location…"
                    : geoState === "denied"
                      ? "Try location again"
                      : "Use my location"}
                </button>
              </div>
            ) : nearby[0]?.distance > 1000 ? (
              <Empty>
                <p>No stops within 1 km of you.</p>
                <p>Search for a stop above, or view your nearest stop:</p>
                <a href={`#/stop/${nearby[0].stop.id}`}>
                  {nearby[0].stop.name} ·{" "}
                  {(nearby[0].distance / 1000).toFixed(1)} km
                </a>
              </Empty>
            ) : (
              <div className="card stop-list">
                {nearby.map(({ stop, distance }) => (
                  <StopRow
                    key={stop.id}
                    stop={stop}
                    routes={data.routes}
                    saved={props.saved.includes(stop.id)}
                    onToggle={props.onToggle}
                    distance={distance}
                  />
                ))}
              </div>
            )}
          </section>
          <section className="section">
            <h2>Saved stops</h2>
            {props.saved.some((id) => data.stops[id]) ? (
              <div className="saved-list">
                {props.saved
                  .filter((id) => data.stops[id])
                  .map((id) => (
                    <SavedCard key={id} {...props} stop={data.stops[id]} />
                  ))}
              </div>
            ) : (
              <Empty>
                <StarEmpty />
                <p>
                  No saved stops yet. Tap the star on a stop to keep it here.
                </p>
                <a className="text-link" href="#/search">
                  Search for your first stop
                </a>
              </Empty>
            )}
          </section>
        </>
      )}
    </>
  );
}
function MapLocation() {
  return <LocateFixed className="empty-icon" aria-hidden="true" size={32} />;
}
function StarEmpty() {
  return (
    <span className="empty-star" aria-hidden="true">
      ☆
    </span>
  );
}
function SearchPage(props: Shared) {
  const [query, setQuery] = useState("");
  return (
    <>
      <section className="page-intro">
        <h1 tabIndex={-1}>Search stops</h1>
        <p className="intro-copy">
          A street name, stop number, or route. We'll find it.
        </p>
        <SearchField value={query} onChange={setQuery} />
      </section>
      <SearchResults query={query} {...props} />
    </>
  );
}
function SearchResults({ query, ...props }: Shared & { query: string }) {
  const [debounced, setDebounced] = useState(query),
    [limit, setLimit] = useState(20);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
      setLimit(20);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);
  const q = debounced.trim().toLocaleLowerCase(),
    { data } = props;
  const matchingRoutes = data.routes.filter(
    (r) =>
      q && (r.number.toLowerCase() === q || r.name.toLowerCase().includes(q)),
  );
  const matchingStops = Object.values(data.stops).filter(
    (s) =>
      q &&
      (s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.routes.some(
          (id) =>
            data.routes.find((r) => r.id === id)?.number.toLowerCase() === q,
        )),
  );
  return (
    <section className="section search-results" aria-label="Search results">
      <p className="caption" role="status">
        {q
          ? `${matchingStops.length} stops and ${matchingRoutes.length} routes found`
          : "Search by stop number, street name or route number."}
      </p>
      {matchingRoutes.length > 0 && (
        <>
          <h2>Routes</h2>
          <div className="card route-results">
            {matchingRoutes.map((route) => (
              <a
                className="route-result"
                href={`#/route/${route.id}`}
                key={route.id}
              >
                <span className="route-badge">{route.number}</span>
                <strong>{route.name}</strong>
              </a>
            ))}
          </div>
        </>
      )}
      {matchingStops.length > 0 && (
        <>
          <h2>Stops</h2>
          <div className="card stop-list">
            {matchingStops.slice(0, limit).map((stop) => (
              <StopRow
                key={stop.id}
                stop={stop}
                routes={data.routes}
                saved={props.saved.includes(stop.id)}
                onToggle={props.onToggle}
                distance={
                  props.position
                    ? distanceBetween(props.position, stop)
                    : undefined
                }
              />
            ))}
          </div>
          {matchingStops.length > limit && (
            <button
              className="button secondary full-width"
              onClick={() => setLimit((n) => n + 20)}
            >
              Show {Math.min(20, matchingStops.length - limit)} more stops
            </button>
          )}
        </>
      )}
      {q && !matchingRoutes.length && !matchingStops.length && (
        <Empty>
          <p>No stops or routes match '{debounced}'.</p>
          <p>Try the stop number or a street name.</p>
        </Empty>
      )}
    </section>
  );
}
function SavedPage(props: Shared) {
  const ids = props.saved.filter((id) => props.data.stops[id]);
  return (
    <>
      <section className="page-intro">
        <h1 tabIndex={-1}>Saved stops</h1>
        <p className="intro-copy">Your regular stops, a little closer.</p>
      </section>
      {ids.length ? (
        <div className="saved-list">
          {ids.map((id) => (
            <SavedCard key={id} {...props} stop={props.data.stops[id]} />
          ))}
        </div>
      ) : (
        <Empty>
          <StarEmpty />
          <p>No saved stops yet. Tap the star on a stop to keep it here.</p>
          <a className="button secondary" href="#/search">
            Find a stop
          </a>
        </Empty>
      )}
    </>
  );
}
function StopDetail({ stop, ...props }: Shared & { stop: Stop }) {
  const { data, now } = props,
    next = useDepartures(data, stop.id, now),
    [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [stop.id]);
  const today = localDate(now, data.meta.timezone),
    isToday =
      next[0] && localDate(next[0].instant, data.meta.timezone) === today;
  const timetableDate = next[0]?.date || today,
    active = activeServices(data.calendar, data.exceptions, timetableDate);
  const timetable = (data.departures[stop.id] || [])
    .filter((e) => active.has(e.service))
    .sort((a, b) => a.time - b.time);
  const hours = [...new Set(timetable.map((e) => Math.floor(e.time / 3600)))];
  return (
    <>
      <div className="detail-toolbar">
        <a
          className="icon-button"
          href="#/nearby"
          aria-label="Back to nearby stops"
        >
          <ChevronLeft aria-hidden="true" size={28} />
        </a>
        <SaveButton
          stop={stop}
          saved={props.saved.includes(stop.id)}
          onToggle={props.onToggle}
        />
      </div>
      <section className="detail-intro">
        <h1 tabIndex={-1}>{stop.name}</h1>
        <p>
          Stop #{stop.code} · {stop.routes.length === 1 ? "Route" : "Routes"}{" "}
          {stop.routes
            .map((id) => data.routes.find((r) => r.id === id)?.number)
            .join(", ")}
        </p>
      </section>
      {next.length ? (
        <>
          {!isToday && (
            <div className="no-more">
              <h2>No more buses today</h2>
              <p>
                {localDate(next[0].instant, data.meta.timezone) ===
                new Date(Date.parse(today + "T12:00:00Z") + 86400000)
                  .toISOString()
                  .slice(0, 10)
                  ? `First bus tomorrow ${clock(next[0].instant)}`
                  : `Next service: ${formatDate(localDate(next[0].instant, data.meta.timezone))}`}
              </p>
            </div>
          )}
          <DepartureRow
            hero
            departure={next[0]}
            route={data.routes.find((r) => r.id === next[0].route)!}
            now={now}
          />
          {next.length > 1 && (
            <section className="section">
              <h2>Then</h2>
              <div className="card">
                {next.slice(1, 4).map((d, i) => (
                  <DepartureRow
                    key={`${d.trip}-${i}`}
                    departure={d}
                    route={data.routes.find((r) => r.id === d.route)!}
                    now={now}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <Empty>
          <h2>No more buses today</h2>
          <p>
            No departures are scheduled in the next seven days for this stop.
          </p>
        </Empty>
      )}
      <button
        className="button secondary full-width timetable-toggle"
        aria-expanded={expanded}
        aria-controls="full-timetable"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Hide" : "Show"} full timetable{" "}
        <ChevronDown
          className={expanded ? "rotated" : ""}
          size={20}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <section id="full-timetable" className="card timetable">
          <h2 className="sr-only">Full timetable</h2>
          <p className="caption">
            {dayLabels[dayType(timetableDate)]} · {formatDate(timetableDate)} ·
            all routes · scheduled times
          </p>
          {hours.length ? (
            hours.map((hour) => (
              <div className="timetable-hour" key={hour}>
                <strong>
                  {hour % 12 || 12} {hour % 24 < 12 ? "a.m." : "p.m."}
                  {hour >= 24 ? " +1" : ""}
                </strong>
                <div>
                  {timetable
                    .filter((e) => Math.floor(e.time / 3600) === hour)
                    .map((e, i) => (
                      <a
                        href={`#/route/${e.route}`}
                        key={`${e.trip}-${i}`}
                        className={
                          next[0]?.trip === e.trip && next[0]?.time === e.time
                            ? "next-time"
                            : ""
                        }
                        aria-label={`${scheduleClock(e.time)}, route ${data.routes.find((r) => r.id === e.route)?.number}, ${e.headsign}`}
                      >
                        {Math.floor(e.time / 3600) % 12 || 12}:
                        {String(Math.floor(e.time / 60) % 60).padStart(2, "0")}
                      </a>
                    ))}
                </div>
              </div>
            ))
          ) : (
            <p>No timetable is available for this service day.</p>
          )}
        </section>
      )}
      <Notice>These are scheduled times. Live tracking is coming.</Notice>
    </>
  );
}
function RouteDetail({ id, ...props }: Shared & { id: string }) {
  const { data, now, position } = props,
    route = data.routes.find((r) => r.id === id)!;
  const [direction, setDirection] = useState("0");
  useEffect(() => setDirection("0"), [id]);
  const routeTrips = useMemo(
    () => Object.values(data.trips).filter((t) => t.route === id),
    [data, id],
  );
  const directions = [...new Set(routeTrips.map((t) => t.direction))];
  const selectedDirection = directions.includes(direction)
    ? direction
    : directions[0];
  const candidates = useMemo(
    () =>
      nextDepartures(
        routeTrips
          .filter((t) => t.direction === selectedDirection)
          .map((t) => ({
            time: t.first,
            trip: t.id,
            route: id,
            service: t.service,
            headsign: t.headsign,
            direction: t.direction,
          })),
        data.calendar,
        data.exceptions,
        now,
        data.meta.maxTime,
        data.meta.timezone,
      ) as Departure[],
    [data, id, routeTrips, selectedDirection, now],
  );
  const upcoming = candidates[0],
    trip: Trip | undefined = upcoming
      ? data.trips[upcoming.trip]
      : routeTrips.find((t) => t.direction === selectedDirection);
  const metric = data.summary[
    dayType(upcoming?.date || localDate(now))
  ].routes.find((r) => r.id === id);
  const nearest =
    position && trip
      ? [...trip.stops].sort(
          (a, b) =>
            distanceBetween(position, data.stops[a.id]) -
            distanceBetween(position, data.stops[b.id]),
        )[0].id
      : null;
  return (
    <>
      <div className="detail-toolbar">
        <a
          className="icon-button"
          href="#/nearby"
          aria-label="Back to nearby stops"
        >
          <ChevronLeft aria-hidden="true" size={28} />
        </a>
      </div>
      <div className="route-title">
        <span className="route-badge large-badge">{route.number}</span>
        <div>
          <h1 tabIndex={-1}>{route.name}</h1>
          <p>
            {trip?.headsign} ·{" "}
            {dayLabels[dayType(upcoming?.date || localDate(now))]}
          </p>
        </div>
      </div>
      {directions.length > 1 && (
        <div className="field-group">
          <label htmlFor="direction">Direction</label>
          <select
            id="direction"
            value={selectedDirection}
            onChange={(e) => setDirection(e.target.value)}
          >
            {directions.map((d) => (
              <option key={d} value={d}>
                {routeTrips.find((t) => t.direction === d)?.headsign ||
                  `Direction ${d}`}
              </option>
            ))}
          </select>
        </div>
      )}
      <dl className="route-facts">
        {[
          ["First bus", metric ? scheduleClock(metric.first) : "Not available"],
          ["Last bus", metric ? scheduleClock(metric.last) : "Not available"],
          [
            "Midday",
            metric?.headway
              ? `Every ${Number(metric.headway.toFixed(1))} min`
              : "Not enough service",
          ],
        ].map(([label, value]) => (
          <div className="card" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {trip && (
        <>
          <section className="section">
            <h2>Route map</h2>
            <div className="card map-card">
              <RouteMap
                points={
                  data.shapes[trip.shape] ||
                  trip.stops.map((s) => [
                    data.stops[s.id].lat,
                    data.stops[s.id].lon,
                  ])
                }
                trip={trip}
                data={data}
                nearest={nearest}
              />
              <p className="caption">
                Map preview.{" "}
                {nearest ? "The ringed stop is nearest to you. " : ""}Every stop
                is also listed below.
              </p>
            </div>
          </section>
          <section className="section">
            <h2>
              {trip.stops.length} stops · {trip.headsign}
            </h2>
            <p className="caption">
              {upcoming
                ? `Next trip starts ${clock(upcoming.instant)} · ${formatDate(upcoming.date)}`
                : "No trip is scheduled in the next seven days."}
            </p>
            <ol className="card ordered-stops">
              {trip.stops.map((s, i) => (
                <li
                  key={`${s.id}-${i}`}
                  className={`${i === 0 ? "first " : ""}${i === trip.stops.length - 1 ? "last " : ""}${nearest === s.id ? "nearest" : ""}`}
                >
                  <a href={`#/stop/${s.id}`}>
                    <span>
                      <strong>{data.stops[s.id].name}</strong>
                      <span className="caption">
                        Stop #{data.stops[s.id].code}
                        {i === 0
                          ? " · Start"
                          : i === trip.stops.length - 1
                            ? " · End"
                            : ""}
                        {nearest === s.id ? " · Nearest to you" : ""}
                        {!s.pickup ? " · Drop-off only" : ""}
                      </span>
                    </span>
                    <span className="stop-clock">
                      {upcoming
                        ? clock(
                            serviceInstant(
                              upcoming.date,
                              s.time,
                              data.meta.timezone,
                            ),
                          )
                        : "—"}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
            <p className="caption">
              Scheduled times for the next trip along this route. Not live
              tracking.
            </p>
          </section>
        </>
      )}
    </>
  );
}
