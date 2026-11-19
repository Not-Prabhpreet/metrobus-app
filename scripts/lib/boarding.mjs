// Boardable stop-time occurrences exclude the final occurrence, even when the
// feed forgets pickup_type=1. A loop's initial occurrence remains boardable.
export function boardingDepartures(trips, stopIds) {
  const departures = Object.fromEntries(stopIds.map((id) => [id, []]));
  for (const trip of Object.values(trips)) {
    trip.stops.sort((a, b) => a.sequence - b.sequence);
    for (const [index, stop] of trip.stops.entries()) {
      if (index === trip.stops.length - 1) stop.pickup = false;
      if (!stop.pickup) continue;
      departures[stop.id].push({
        time: stop.time,
        sequence: stop.sequence,
        trip: trip.id,
        route: trip.route,
        service: trip.service,
        headsign: stop.headsign || trip.headsign,
        direction: trip.direction,
      });
    }
  }
  return departures;
}
