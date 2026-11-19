# Metrobus Next

A mobile-first rider app and service planning dashboard for Metrobus in St. John's, Newfoundland and Labrador, using public GTFS schedule data.

## Project status

Primary hosting is [GitHub Pages](https://not-prabhpreet.github.io/metrobus-app/), which opens without signing in.

The first implementation includes stop search, on-device nearby stops, saved stops, scheduled departure countdowns, full timetables, route directions and shape previews, offline PWA caching, dark mode, and responsive service insights.

Stop departures now exclude terminating arrivals. The route page uses a client-side Leaflet map with OpenStreetMap tiles, the actual route shape and stop markers, with the accessible stop list below. Background tiles need an internet connection; route/stop data stays available offline. Home search filters while typing with a 150 ms debounce. SQL ETL views compute unused-stop and stop-time-order quality checks. Headways display whole-minute estimates, headsigns use Title Case, and early-ending service is marked “Peak only”.

All routes, stops, times, and metrics come from the retained official feed, currently valid October 26, 2026 through January 3, 2027. Times are scheduled. This app does not provide live vehicle tracking.

## Run locally

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
```

The development server prints its local URL. To test the production app, including offline behavior:

```sh
npm run build
npm run preview
```

Offline saving requires HTTPS or localhost and one successful connected visit. The service worker caches the app shell, bundled fonts, and complete precomputed schedule. It never sends the rider's location to a server. Saved stops and appearance preferences stay in browser storage.

## Validation

```sh
npm test
npm run build
npm run test:e2e
```

Browser checks cover desktop Chromium, Android-style Chromium, and iPhone-style WebKit. Locally, install WebKit with `npx playwright install webkit`; CI installs both browser engines automatically. These are browser/device emulations, not tests on physical phones. The checks cover rider flows, keyboard navigation, day toggles and sorting, accessibility scans, offline reload, dark mode, and narrow-screen reflow. Unit tests cover GTFS service-day arithmetic, Newfoundland daylight saving changes, calendar exceptions, and service metrics.

## Update the schedule

```sh
npm run data:refresh
```

GitHub Pages now downloads and validates the official feed on every deployment and automatically every Monday at 09:17 UTC. It runs all tests before publishing; a failed download or check leaves the current site in place. Each successful build retains the exact source ZIP and its timestamp/SHA-256 record as a workflow artifact for 90 days. No bot commits or additional secrets are needed.

For a manual refresh, run the command above, commit `data/google_transit.zip` and `data/source.json`, and redeploy. A normal local build uses the retained ZIP, so it is reproducible without downloading a new feed. A failed validation stops the build before replacing derived output. See [data sources and metric definitions](docs/DATA.md). GitHub can pause scheduled workflows after prolonged repository inactivity; the workflow also has a manual Run button.

## Stack and layout

React, TypeScript and Vite, with CSS variables implementing the brief's light/dark design tokens. Temporal handles service instants; CSV and ZIP parsing happens at build time.

- `scripts/build-data.mjs`: validated feed conversion and summary metrics.
- `scripts/etl/views.sql`: SQLite views for stop usage and time-order quality checks.
- `src/lib/`: shared service-time and metric calculations.
- `src/App.tsx`: rider screens and local preferences.
- `src/Insights.tsx`: dashboard, chart, sorting, and data-quality checks.
- `src/RouteMap.tsx`: client-only Leaflet map and visible OSM attribution.
- `scripts/sw-template.js`: production offline behavior.
- `public/data/`: generated JSON, including per-stop files; excluded from Git.
- `.github/workflows/pages.yml`: tested public deployment to GitHub Pages.
- `.openai/hosting.json`: retained metadata for the earlier private host; GitHub Pages is the primary deployment destination.

Installability and storage availability depend on the browser. The app reports unavailable persistent storage rather than assuming a save succeeded. A stale feed remains inspectable and displays its age; departure search never invents service beyond calendar validity.

## GitHub Pages deployment

Changes merged into `main` run the Pages workflow: latest-feed download, unit tests, a production build using `VITE_BASE_PATH=/metrobus-app/`, browser checks at that same path in all three browser configurations, and deployment of `dist/`. Weekly and manual runs use the same pipeline. The app uses hash routes, so stop and route links work without server rewrite rules.

The manifest, fonts, schedule fetch and scoped service worker support the repository subdirectory. Local development defaults to `/`. To test the Pages build locally, set `VITE_BASE_PATH=/metrobus-app/` for both `npm run build` and `npm run test:e2e`.

Offline cache versions include the complete generated schedule, so a data-only refresh creates a new cache. Open clients reload their schedule data when a new worker takes control.

## Final phone acceptance check

On an actual iPhone and Android phone: open the public app, allow location, save a stop, add/install it to the home screen, close it, switch to airplane mode, and reopen the saved stop. Automated browser emulation verifies the software flows; physical permission prompts, home-screen installation, and operating-system storage behavior need this device check.

## Development workflow

Use separate branches for coherent features and fixes, make meaningful commits, and push progress regularly during development. Keep `main` stable.

The design brief is maintained locally and is excluded from this public repository.

Independent concept built on Metrobus public data. Not affiliated with the St. John's Transportation Commission.
