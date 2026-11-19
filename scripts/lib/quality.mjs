import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function evaluateQuality(stopIds, tripIds, stopTimes) {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(
      readFileSync(new URL("../etl/views.sql", import.meta.url), "utf8"),
    );
    const addStop = database.prepare("INSERT INTO stops VALUES (?)");
    const addTrip = database.prepare("INSERT INTO trips VALUES (?)");
    const addTime = database.prepare(
      "INSERT INTO stop_times VALUES (?, ?, ?, ?, ?)",
    );
    database.exec("BEGIN");
    for (const id of stopIds) addStop.run(id);
    for (const id of tripIds) addTrip.run(id);
    for (const row of stopTimes)
      addTime.run(row.trip, row.stop, row.sequence, row.arrival, row.departure);
    database.exec("COMMIT");
    const counts = database.prepare("SELECT * FROM etl_data_quality").get();
    return {
      unusedStopCount: counts.unused_stop_count,
      unusedStopIds: database
        .prepare("SELECT stop_id FROM etl_unused_stops ORDER BY stop_id")
        .all()
        .map((row) => row.stop_id),
      stopTimeOrderViolationCount: counts.stop_time_order_violation_count,
      stopTimeOrderViolations: database
        .prepare(
          "SELECT * FROM etl_stop_time_order_violations ORDER BY trip_id, stop_sequence",
        )
        .all(),
    };
  } finally {
    database.close();
  }
}
