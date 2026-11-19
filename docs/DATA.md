# Schedule data and methodology

Source: [Metrobus's official GTFS download](https://www.metrobustransit.ca/google/google_transit.zip). [Terms of use](https://metrobus.com/gtfs.asp) reviewed November 19, 2026. Data belongs to Metrobus Transit and is distributed under those terms; the application does not claim ownership of it.

Data used in this product or service is provided by Metrobus Transit, however Metrobus Transit assumes no responsibility for the accuracy or currency of the Data used in this product or service.

Run `npm run data:refresh` at least weekly to replace the retained source ZIP and rebuild all derived JSON. `data/source.json` records its SHA-256 and retrieval time. Builds validate required files, columns, references and time ordering, and fail before replacing output on malformed input. Generated JSON is excluded from Git; the source ZIP is retained so clean checkouts can build without a network download.

## Service days

The client uses the feed's agency timezone, `America/St_Johns`. GTFS times use service-date local noon minus twelve elapsed hours. Hours above 24 remain attached to their original service day, and calendar exceptions override weekly service. The departure search examines earlier service days using the maximum time in the feed, plus the following seven days. It does not invent departures beyond the feed's calendar.

## Insights

Each day type uses an upcoming, non-exception date inside the feed's range. If none remains, it selects a date within the feed's range. The chosen date appears in the UI. Stops count boarding locations with scheduled pickups. Route span uses first-stop departures. Midday headway uses the median spacing of first-stop departures from 10 a.m. to 2 p.m. per direction, taking the larger direction value. Insufficient observations display an unavailable value.

Thirty-minute coverage includes both boundaries of the 7 a.m. to 7 p.m. window. First-stop trip departures from 5 a.m. to 11:59 p.m. feed the hourly chart; first departures at 24:00 or later are folded into its final 11 p.m. bin, preserving their service day. Service gaps always refer to the representative weekday, including when another day is selected.

Coordinate checks use a configurable bounding box in `scripts/build-data.mjs`: latitude 47.35–47.75, longitude −52.95–−52.55, covering St. John's, Mount Pearl and Paradise. Duplicate names count every stop sharing its name with another stop ID. Calendar freshness is calculated in the browser, so it stays current between builds.

Maps render the selected trip's actual shape from `shapes.txt` as a local SVG. No map tiles, trackers, or location requests leave the device. The ordered stop list is the primary accessible representation.
