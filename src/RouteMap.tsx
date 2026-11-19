import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { Schedule, Trip } from "./types";
import "leaflet/dist/leaflet.css";

export function RouteMap({
  points,
  trip,
  data,
  nearest,
}: {
  points: number[][];
  trip: Trip;
  data: Schedule;
  nearest: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let cancelled = false,
      map: LeafletMap | undefined,
      observer: ResizeObserver | undefined;
    let retryTiles: (() => void) | undefined;
    setStatus(navigator.onLine ? "loading" : "offline");
    async function mount() {
      // Leaflet touches the DOM: import and initialize only after client mount.
      const L = await import("leaflet");
      if (cancelled || !container.current) return;
      map = L.map(container.current, {
        scrollWheelZoom: false,
        attributionControl: true,
      });
      map.attributionControl.setPrefix(false);
      const shape = points
        .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map((p) => L.latLng(p[0], p[1]));
      const line = L.polyline(shape, {
        color: "var(--accent)",
        weight: 5,
      }).addTo(map);
      for (const [index, occurrence] of trip.stops.entries()) {
        const stop = data.stops[occurrence.id];
        if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) continue;
        const nearestStop = nearest === stop.id;
        L.marker([stop.lat, stop.lon], {
          icon: L.divIcon({
            className: `route-stop-marker${nearestStop ? " nearest-marker" : ""}`,
            html: '<span class="route-stop-dot"></span>',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          }),
          title: `${index + 1}. ${stop.name}${nearestStop ? " · Nearest to you" : ""}`,
          alt: `Stop #${stop.code}: ${stop.name}`,
          keyboard: false,
          interactive: false,
        })
          .addTo(map)
          .getElement()
          ?.setAttribute("aria-hidden", "true");
      }
      if (line.getBounds().isValid())
        map.fitBounds(line.getBounds(), { padding: [28, 28], maxZoom: 16 });
      else map.setView([47.56, -52.72], 12);
      let failed = false;
      const tiles = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      );
      tiles.on("tileerror", () => {
        failed = true;
        if (!cancelled) setStatus("unavailable");
      });
      tiles.on("load", () => {
        if (!cancelled && !failed) setStatus("ready");
      });
      tiles.addTo(map);
      retryTiles = () => {
        failed = false;
        setStatus("loading");
        tiles.redraw();
      };
      window.addEventListener("online", retryTiles);
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(container.current);
    }
    mount().catch(() => {
      if (!cancelled) setStatus("unavailable");
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      if (retryTiles) window.removeEventListener("online", retryTiles);
      map?.remove();
    };
  }, [points, trip, data, nearest]);
  const number = data.routes.find((r) => r.id === trip.route)?.number;
  return (
    <>
      <div
        ref={container}
        className="leaflet-route-map"
        role="region"
        aria-label={`Route ${number} map with stop markers. Every stop is listed below.`}
      />
      {status !== "ready" && (
        <p className="caption map-status" role="status">
          {status === "loading"
            ? "Loading map tiles…"
            : "Map tiles are unavailable. The route and stop list remain available; tiles need an internet connection."}
        </p>
      )}
    </>
  );
}
