import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Info,
  MapPin,
  Search,
  Star,
  TriangleAlert,
} from "lucide-react";
import type { Departure, Route, Stop } from "./types";
import { clock, countdown } from "./lib/time.mjs";

export const dayLabels = {
  weekday: "Weekday",
  saturday: "Saturday",
  sunday: "Sunday",
};
export function Footer() {
  return (
    <footer className="footer">
      <p>Scheduled times, not live tracking.</p>
      <p>
        Independent concept built on Metrobus public data. Not affiliated with
        the St. John's Transportation Commission.
      </p>
      <p className="data-attribution">
        Data used in this product or service is provided by Metrobus Transit,
        however Metrobus Transit assumes no responsibility for the accuracy or
        currency of the Data used in this product or service.
      </p>
      <a href="https://metrobus.com/gtfs.asp" target="_blank" rel="noreferrer">
        Metrobus data terms of use
      </a>
    </footer>
  );
}
export function Navigation({ active }: { active: string }) {
  const tabs = [
    { id: "nearby", label: "Nearby", icon: MapPin },
    { id: "search", label: "Search", icon: Search },
    { id: "saved", label: "Saved", icon: Star },
    { id: "insights", label: "Insights", icon: BarChart3 },
  ];
  return (
    <nav aria-label="Main navigation" className="main-nav">
      {tabs.map(({ id, label, icon: Icon }) => (
        <a
          key={id}
          href={`#/${id}`}
          aria-current={active === id ? "page" : undefined}
        >
          <Icon aria-hidden="true" size={24} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
export function Badge({
  route,
  headsign,
  large = false,
  invert = false,
}: {
  route: Route;
  headsign?: string;
  large?: boolean;
  invert?: boolean;
}) {
  return (
    <a
      className={`badge-link ${large ? "large" : ""}`}
      href={`#/route/${route.id}`}
      aria-label={`Route ${route.number}: ${headsign || route.name}`}
    >
      <span className={`route-badge ${invert ? "invert" : ""}`}>
        {route.number}
      </span>
    </a>
  );
}
export function SaveButton({
  stop,
  saved,
  onToggle,
}: {
  stop: Stop;
  saved: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      className={`icon-button save-button ${saved ? "is-saved" : ""}`}
      aria-pressed={saved}
      aria-label={`${saved ? "Remove saved stop" : "Save stop"} ${stop.name}`}
      onClick={() => onToggle(stop.id)}
    >
      <Star
        aria-hidden="true"
        fill={saved ? "currentColor" : "none"}
        size={26}
      />
    </button>
  );
}
export function StopRow({
  stop,
  routes,
  saved,
  onToggle,
  distance,
}: {
  stop: Stop;
  routes: Route[];
  saved: boolean;
  onToggle: (id: string) => void;
  distance?: number;
}) {
  return (
    <div className="stop-row">
      <a href={`#/stop/${stop.id}`} className="stop-link">
        <span className="stop-copy">
          <strong>{stop.name}</strong>
          <span className="caption">
            Stop #{stop.code} · {stop.routes.length === 1 ? "Route" : "Routes"}{" "}
            {stop.routes
              .map((id) => routes.find((r) => r.id === id)?.number)
              .join(", ")}
            {saved ? " · Saved" : ""}
          </span>
        </span>
        {distance !== undefined && (
          <span className="distance">
            {distance < 1000
              ? `${Math.round(distance / 10) * 10} m`
              : `${(distance / 1000).toFixed(1)} km`}
          </span>
        )}
      </a>
      <SaveButton stop={stop} saved={saved} onToggle={onToggle} />
    </div>
  );
}
export function DepartureRow({
  departure,
  route,
  now,
  hero = false,
}: {
  departure: Departure;
  route: Route;
  now: number;
  hero?: boolean;
}) {
  return hero ? (
    <article className="departure-hero">
      <div className="hero-destination">
        <Badge route={route} headsign={departure.headsign} invert />
        <strong>{departure.headsign}</strong>
      </div>
      <p className="countdown">{countdown(departure.instant, now)}</p>
      <p className="hero-clock">{clock(departure.instant)} · Scheduled</p>
    </article>
  ) : (
    <div className="departure-row">
      <Badge route={route} headsign={departure.headsign} />
      <div className="departure-destination">
        <strong>{departure.headsign}</strong>
        <span className="caption">Scheduled</span>
      </div>
      <div className="departure-time">
        <strong>{countdown(departure.instant, now)}</strong>
        <time
          className="caption"
          dateTime={new Date(departure.instant).toISOString()}
        >
          {clock(departure.instant)}
        </time>
      </div>
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="search-field">
      <Search aria-hidden="true" size={23} />
      <label className="sr-only" htmlFor="stop-search">
        Search by stop name, stop number or route number
      </label>
      <input
        id="stop-search"
        type="search"
        placeholder="Stop name, number or route"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
    </div>
  );
}
export function Notice({
  children,
  status = false,
}: {
  children: React.ReactNode;
  status?: boolean;
}) {
  return (
    <div className="notice" role={status ? "status" : undefined}>
      <Info size={22} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
export function StatusChip({ pass }: { pass: boolean }) {
  const Icon = pass ? CheckCircle2 : TriangleAlert;
  return (
    <span className={`status-chip ${pass ? "pass" : "warning"}`}>
      <Icon size={16} aria-hidden="true" />
      {pass ? "Pass" : "Warning"}
    </span>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value.slice(0, 10) + "T12:00:00Z"));
}
export function distanceBetween(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlon = (b.lon - a.lon) * rad;
  const n =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(n), Math.sqrt(1 - n));
}
