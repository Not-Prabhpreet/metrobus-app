CREATE TABLE stops (stop_id TEXT PRIMARY KEY);
CREATE TABLE trips (trip_id TEXT PRIMARY KEY);
CREATE TABLE stop_times (
  trip_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  stop_sequence INTEGER NOT NULL,
  arrival_seconds INTEGER NOT NULL,
  departure_seconds INTEGER NOT NULL,
  PRIMARY KEY (trip_id, stop_sequence)
);
CREATE INDEX stop_times_stop_id ON stop_times (stop_id);

-- Count usage across every service pattern, including terminal/drop-off stops.
CREATE VIEW etl_unused_stops AS
SELECT s.stop_id
FROM stops s
WHERE NOT EXISTS (
  SELECT 1 FROM stop_times st JOIN trips t ON t.trip_id = st.trip_id
  WHERE st.stop_id = s.stop_id
);

-- Compare elapsed service-day seconds, never wall-clock strings or modulo 24h.
CREATE VIEW etl_ordered_stop_times AS
SELECT st.*,
  LAG(departure_seconds) OVER (
    PARTITION BY trip_id ORDER BY stop_sequence
  ) AS previous_departure_seconds
FROM stop_times st;

-- Equality is valid GTFS timing; a vehicle may serve adjacent stops in one minute.
CREATE VIEW etl_stop_time_order_violations AS
SELECT trip_id, stop_id, stop_sequence, arrival_seconds, departure_seconds,
  previous_departure_seconds
FROM etl_ordered_stop_times
WHERE departure_seconds < arrival_seconds
   OR arrival_seconds < previous_departure_seconds;

CREATE VIEW etl_data_quality AS
SELECT
  (SELECT COUNT(*) FROM etl_unused_stops) AS unused_stop_count,
  (SELECT COUNT(*) FROM etl_stop_time_order_violations) AS stop_time_order_violation_count;
